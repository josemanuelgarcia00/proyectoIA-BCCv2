/** Puerto de app/application/serviceService.py: orquesta repository +
 * conflictResolver + auditLog + writer. Opera siempre sobre el Sheet
 * configurado en VITE_GOOGLE_SHEET_ID (ver ../config.js). */
import { GOOGLE_SHEET_ID } from '../config';
import * as repo from '../repository/catalogRepository';
import * as conflictResolver from '../domain/conflictResolver';
import * as auditLog from '../storage/auditLog';
import * as writer from '../storage/sheetsWriter';
import { createServiceEntity } from '../domain/models';
import { hasWriteAccess } from '../google/sheetsApi';

const SHEET_ID = GOOGLE_SHEET_ID;

async function ensureInit() {
  if (!SHEET_ID) {
    throw new Error('Falta configurar VITE_GOOGLE_SHEET_ID');
  }
  await repo.init(SHEET_ID);
}

function logDecision(service, accion, valor = '', iteracion = '') {
  return auditLog.append(SHEET_ID, {
    servicio: service.name,
    accion,
    valor,
    iteracion,
    snapshot: JSON.stringify(service),
  });
}

export async function getFullCatalog() {
  await ensureInit();
  return repo.getAll(SHEET_ID);
}

export async function getServicesWithConflicts() {
  await ensureInit();
  return repo.getServicesWithConflicts();
}

export async function getResolvedServices() {
  await ensureInit();
  return repo.getResolvedServices();
}

export async function getRejectedServices() {
  await ensureInit();
  return repo.getRejectedServices();
}

/** Todo el contenido de Diccionario, incluyendo servicios sin actividad en el Perímetro actual. */
export async function getFullDictionary() {
  await ensureInit();
  const dictionaryRows = await repo.getDictionaryRows(SHEET_ID);
  const all = await repo.getAll(SHEET_ID);
  const catalogByName = new Map(all.map((s) => [s.name, s]));

  const entities = [];
  for (const [name, rowData] of Object.entries(dictionaryRows)) {
    const service = catalogByName.get(name);
    if (service) {
      entities.push(service);
      continue;
    }
    entities.push(createServiceEntity({
      name,
      exists_in_dictionary: 'Si',
      consolidated_status: 'Aceptado',
      winning_data: rowData,
      perimeter_iterations: [],
      closed: true,
    }));
  }
  return entities;
}

export async function refreshFromSource() {
  await ensureInit();
  await repo.refresh(SHEET_ID);
  return repo.getAll(SHEET_ID);
}

export async function resolveIterationConflicts(itemId, iterationId, resolution) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const iteration = conflictResolver.resolveIteration(service, iterationId, resolution);
  if (!iteration) return null;

  await logDecision(service, 'resolve_iteration', resolution, iterationId);
  return service;
}

export async function revertIteration(itemId, iterationId) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const iteration = conflictResolver.revertIteration(service, iterationId);
  if (!iteration) return null;

  await logDecision(service, 'revert_iteration', '', iterationId);
  return service;
}

export async function resetServiceConflicts(itemId) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const result = conflictResolver.resetService(service);
  await logDecision(service, 'reset_service');
  return result;
}

export async function previewAcceptMerge(itemId) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;
  return conflictResolver.previewFinalMerge(service);
}

export async function acceptAndCloseService(itemId) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const result = conflictResolver.acceptAndClose(service);
  if (!result) return null;

  await logDecision(service, 'accept_and_close');
  return result;
}

export async function rejectService(itemId) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const result = conflictResolver.rejectService(service);
  await logDecision(service, 'reject_service');
  return result;
}

export async function revertRejection(itemId) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const result = conflictResolver.revertRejection(service);
  await logDecision(service, 'revert_rejection');
  return result;
}

export async function updateObservations(itemId, observations) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  service.observations = observations;
  await logDecision(service, 'update_observations', observations);
  return service;
}

export async function updateIterationObservations(itemId, iterationId, observations) {
  await ensureInit();
  const service = repo.getById(itemId);
  if (!service) return null;

  const iteration = service.perimeter_iterations.find((it) => it.iteration_id === iterationId);
  if (!iteration) return null;

  iteration.observations = observations;
  await logDecision(service, 'update_iteration_observations', observations, iterationId);
  return service;
}

/**
 * Vuelca a Diccionario/Desechados el resultado final de los servicios
 * indicados (o de todo el catálogo si no se indica ninguno). Solo exige que
 * esos servicios ya no tengan conflictos pendientes.
 */
export async function saveToSheet(serviceNames = null) {
  await ensureInit();

  if (!hasWriteAccess()) {
    throw new Error('Inicia sesión con Google para guardar cambios en el Sheet (de momento estás en modo solo lectura).');
  }

  const allServices = await repo.getAll(SHEET_ID);

  let targetServices;
  if (serviceNames && serviceNames.length) {
    const selected = new Set(serviceNames.map((n) => n.toUpperCase()));
    targetServices = allServices.filter((s) => selected.has(s.name.toUpperCase()));
  } else {
    targetServices = allServices;
  }

  const pending = targetServices.filter((s) => s.perimeter_iterations.some((it) => it.conflicts.length > 0));
  if (pending.length) {
    return { saved: false, pending_services: pending.length };
  }

  const written = await writer.saveDictionary(SHEET_ID, targetServices);
  const rejectedWritten = await writer.saveRejected(SHEET_ID, targetServices);

  // Ya quedaron fijados: dejan de reproducirse en el historial de auditoría y
  // de aparecer como pendientes en el resto de esta sesión.
  const savedNames = targetServices.filter((s) => s.closed).map((s) => s.name);
  await auditLog.removeForServices(SHEET_ID, savedNames);
  repo.removeFromCache(savedNames);

  const archived = await writer.archivePerimeterRows(SHEET_ID, savedNames);

  return {
    saved: true,
    services_written: written,
    rejected_written: rejectedWritten,
    perimeter_rows_archived: archived,
  };
}
