/**
 * Puerto de app/infrastructure/persistence/serviceRepository.py (CatalogRepository).
 * En Python era singleton para sobrevivir entre peticiones HTTP; aquí ya vive
 * en un solo proceso de navegador, así que basta con estado a nivel de módulo.
 */
import { readSheets, getSignature } from '../storage/sheetsReader';
import { extractServicesFromRecords, buildDictionaryIndex } from '../storage/sheetParser';
import { readAll as readAuditLog } from '../storage/auditLog';

// Mismo margen que en Python: no repetir la comprobación de cambios en cada
// clic de la interfaz (cada comprobación en Sheets cuesta una llamada a la API).
const MIN_CHECK_INTERVAL_MS = 15000;

function freshState(sheetId) {
  return {
    sheetId,
    servicesCache: null,
    dictionaryCache: null,
    sourceSignature: null,
    excludedFromCatalog: new Set(),
    lastCheckedAt: 0,
  };
}

let state = freshState(null);

function findInCache(name) {
  if (!state.servicesCache) return null;
  const upper = name.toUpperCase();
  return state.servicesCache.find((s) => s.name.toUpperCase() === upper) || null;
}

function restoreFromSnapshot(freshService, snapshot) {
  freshService.winning_data = snapshot.winning_data;
  freshService.exists_in_dictionary = snapshot.exists_in_dictionary;
  freshService.consolidated_status = snapshot.consolidated_status;
  freshService.closed = snapshot.closed;
  freshService.observations = snapshot.observations || '';

  // Autocorrección de un bug ya arreglado: "rechazar" un servicio que ya
  // existía en el Diccionario no debe quedar "Desechado", sino "Aceptado".
  if (freshService.consolidated_status === 'Desechado' && freshService.exists_in_dictionary === 'Si') {
    freshService.consolidated_status = 'Aceptado';
  }

  const snapshotIterations = new Map((snapshot.perimeter_iterations || []).map((it) => [it.iteration_id, it]));
  for (const iteration of freshService.perimeter_iterations) {
    const saved = snapshotIterations.get(iteration.iteration_id);
    if (!saved) continue;
    iteration.data = saved.data;
    iteration.conflicts = saved.conflicts;
    iteration.resolution = saved.resolution;
    iteration.observations = saved.observations || '';
  }
}

async function replayAuditLog(sheetId) {
  const entries = await readAuditLog(sheetId);

  // Cada entrada es una foto completa; solo interesa la última por servicio.
  const latestSnapshotByService = {};
  for (const entry of entries) {
    const rawSnapshot = entry.snapshot;
    if (!rawSnapshot) continue;
    const servicio = String(entry.servicio || '');
    try {
      latestSnapshotByService[servicio] = JSON.parse(rawSnapshot);
    } catch {
      continue;
    }
  }

  for (const [servicio, snapshot] of Object.entries(latestSnapshotByService)) {
    const service = findInCache(servicio);
    if (!service) continue;
    try {
      restoreFromSnapshot(service, snapshot);
    } catch (e) {
      console.warn(`No se pudo restaurar la auditoría de '${servicio}', se omite:`, e);
    }
  }
}

async function loadServices(sheetId, dictionaryRecords = null, perimeterRecords = null) {
  try {
    if (dictionaryRecords == null || perimeterRecords == null) {
      ({ dictionaryRecords, perimeterRecords } = await readSheets(sheetId));
    }
    state.dictionaryCache = buildDictionaryIndex(dictionaryRecords);
    let services = extractServicesFromRecords(dictionaryRecords, perimeterRecords);
    if (state.excludedFromCatalog.size) {
      services = services.filter((s) => !state.excludedFromCatalog.has(s.name.toUpperCase()));
    }
    state.servicesCache = services;
    state.sourceSignature = await getSignature(dictionaryRecords, perimeterRecords);
  } catch (e) {
    console.error('Error al leer la fuente de datos:', e);
    state.servicesCache = [];
    state.dictionaryCache = {};
    return;
  }

  // El replay va aparte: si falla, el catálogo se queda sin las revisiones
  // restauradas en vez de vaciarse por completo.
  try {
    await replayAuditLog(sheetId);
  } catch (e) {
    console.warn('No se pudo reproducir la auditoría (el catálogo sigue disponible sin ella):', e);
  }
}

/** Carga inicial: solo recarga si es la primera vez o si cambia de Sheet. */
export async function init(sheetId) {
  if (state.sheetId === sheetId && state.servicesCache !== null) return;
  state = freshState(sheetId);
  await loadServices(sheetId);
  state.lastCheckedAt = Date.now();
}

export function removeFromCache(names) {
  if (!names || !names.length) return;
  const nameSet = new Set(names.map((n) => n.toUpperCase()));
  for (const n of nameSet) state.excludedFromCatalog.add(n);
  if (state.servicesCache) {
    state.servicesCache = state.servicesCache.filter((s) => !nameSet.has(s.name.toUpperCase()));
  }
}

/** Recarga pedida a propósito, sin pasar por el margen mínimo entre comprobaciones. */
export async function refresh(sheetId) {
  await loadServices(sheetId);
  state.lastCheckedAt = Date.now();
}

/** Si los datos de origen cambiaron desde la última carga, recarga el catálogo completo. */
export async function refreshIfSourceChanged(sheetId) {
  const now = Date.now();
  if (now - state.lastCheckedAt < MIN_CHECK_INTERVAL_MS) return false;
  state.lastCheckedAt = now;

  let dictionaryRecords;
  let perimeterRecords;
  let newSignature;
  try {
    ({ dictionaryRecords, perimeterRecords } = await readSheets(sheetId));
    newSignature = await getSignature(dictionaryRecords, perimeterRecords);
  } catch (e) {
    if (state.sourceSignature == null && !state.servicesCache) {
      await loadServices(sheetId);
      return true;
    }
    return false;
  }

  if (state.sourceSignature == null || newSignature !== state.sourceSignature) {
    await loadServices(sheetId, dictionaryRecords, perimeterRecords);
    return true;
  }
  return false;
}

export async function getAll(sheetId) {
  await refreshIfSourceChanged(sheetId);
  return state.servicesCache || [];
}

export function getById(itemId) {
  return findInCache(itemId);
}

export function getServicesWithConflicts() {
  return (state.servicesCache || []).filter((s) => s.perimeter_iterations.some((it) => it.conflicts.length > 0));
}

export function getResolvedServices() {
  return (state.servicesCache || []).filter((s) => !s.perimeter_iterations.some((it) => it.conflicts.length > 0));
}

export function getRejectedServices() {
  return (state.servicesCache || []).filter((s) => s.consolidated_status === 'Desechado');
}

export async function getDictionaryRows(sheetId) {
  await refreshIfSourceChanged(sheetId);
  return state.dictionaryCache || {};
}
