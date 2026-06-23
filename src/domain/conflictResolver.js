/** Puerto literal de app/application/conflictResolverService.py (lógica pura, sin I/O). */
import { LIST_FIELDS, hasNewContent, cloneExcelRowData, createExcelRowData } from './models';

const ROW_FIELDS = [
  'app', 'type', 'verb', 'scope', 'functional_use',
  'inputs', 'outputs', 'invokes', 'reference_tables',
  'source_document', 'doc_version', 'reliability',
];

function mergeValues(previousValue, currentValue, fieldName) {
  if (LIST_FIELDS.has(fieldName)) {
    const merged = previousValue ? [...previousValue] : [];
    for (const item of currentValue || []) {
      if (!merged.includes(item)) merged.push(item);
    }
    return merged;
  }

  const previous = previousValue || '';
  const current = currentValue || '';
  if (!previous) return current;
  if (!hasNewContent(current, previous, fieldName)) return previous;
  return `${previous} / ${current}`;
}

/**
 * Resuelve TODOS los conflictos de una iteración contra su línea base en
 * cascada (la 1ª iteración se compara con winning_data; el resto, con la
 * iteración inmediatamente anterior). "unify" une ambos valores; "reject"
 * descarta la propuesta nueva y mantiene la línea base.
 */
export function resolveIteration(service, iterationId, resolution = 'unify') {
  const iterations = service.perimeter_iterations;
  const idx = iterations.findIndex((it) => it.iteration_id === iterationId);
  if (idx === -1) return null;

  const iteration = iterations[idx];
  const baselineData = idx > 0 ? iterations[idx - 1].data : service.winning_data;

  for (const conflict of iteration.conflicts) {
    if (conflict.column === 'document') {
      if (resolution === 'reject' && baselineData) {
        iteration.data.source_document = baselineData.source_document;
        iteration.data.doc_version = baselineData.doc_version;
      } else if (resolution !== 'reject') {
        const baseDoc = baselineData ? baselineData.source_document : iteration.data.source_document;
        const baseVersion = baselineData ? baselineData.doc_version : iteration.data.doc_version;
        iteration.data.source_document = mergeValues(baseDoc, iteration.data.source_document, 'source_document');
        iteration.data.doc_version = mergeValues(baseVersion, iteration.data.doc_version, 'doc_version');
      }
      continue;
    }

    const currentValue = iteration.data[conflict.column];
    const baselineValue = baselineData ? baselineData[conflict.column] : currentValue;

    if (resolution === 'reject') {
      iteration.data[conflict.column] = baselineValue;
    } else {
      iteration.data[conflict.column] = mergeValues(baselineValue, currentValue, conflict.column);
    }
  }

  iteration.conflicts = [];
  iteration.resolution = resolution;
  service.consolidated_status = computeStatus(service);
  return iteration;
}

/**
 * "Aceptado"/"Unificado" solo se asignan cuando el servicio está realmente
 * cerrado (closed=true). Si ya no quedan conflictos pero el usuario todavía
 * no ha confirmado el cierre, el servicio sigue "En revision".
 */
export function computeStatus(service) {
  if (service.perimeter_iterations.some((it) => it.conflicts.length > 0)) return 'En revision';
  if (!service.closed) return 'En revision';
  if (service.perimeter_iterations.some((it) => it.resolution === 'unify')) return 'Unificado';
  return 'Aceptado';
}

/** Vuelve atrás la resolución aplicada a una iteración concreta. */
export function revertIteration(service, iterationId) {
  const iteration = service.perimeter_iterations.find((it) => it.iteration_id === iterationId);
  if (!iteration || iteration.original_data == null) return null;

  iteration.data = cloneExcelRowData(iteration.original_data);
  iteration.conflicts = iteration.original_conflicts.map((c) => ({ ...c }));
  iteration.resolution = null;

  service.closed = false;
  service.consolidated_status = computeStatus(service);
  return iteration;
}

/** Reinicia TODAS las iteraciones del servicio a su estado original. */
export function resetService(service) {
  for (const iteration of service.perimeter_iterations) {
    if (iteration.original_data != null) {
      iteration.data = cloneExcelRowData(iteration.original_data);
      iteration.conflicts = iteration.original_conflicts.map((c) => ({ ...c }));
      iteration.resolution = null;
    }
  }

  service.closed = false;
  service.consolidated_status = computeStatus(service);
  return service;
}

/**
 * Rechaza la propuesta pendiente del Perímetro. Si el servicio es nuevo se
 * marca "Desechado"; si ya existía en el Diccionario, queda "Aceptado" (sin
 * tocar el dato maestro ya vigente).
 */
export function rejectService(service) {
  service.closed = true;
  service.consolidated_status = service.exists_in_dictionary === 'Si' ? 'Aceptado' : 'Desechado';
  return service;
}

/** Deshace el rechazo de un servicio y lo devuelve a la zona de revisión. */
export function revertRejection(service) {
  service.closed = false;
  service.consolidated_status = computeStatus(service);
  return service;
}

/**
 * Calcula (sin aplicar) cómo quedaría el dato final para el Diccionario:
 * une la última iteración revisada con el dato maestro actual.
 */
export function previewFinalMerge(service) {
  if (service.perimeter_iterations.some((it) => it.conflicts.length > 0)) return null;
  if (service.perimeter_iterations.length === 0) return null;

  const finalData = service.perimeter_iterations[service.perimeter_iterations.length - 1].data;
  const masterData = service.winning_data;

  if (masterData == null) return cloneExcelRowData(finalData);

  const merged = {};
  for (const field of ROW_FIELDS) {
    merged[field] = mergeValues(masterData[field], finalData[field], field);
  }
  return createExcelRowData(merged);
}

/** Cierra el servicio: une el resultado final con el dato maestro y lo fija como definitivo. */
export function acceptAndClose(service) {
  const merged = previewFinalMerge(service);
  if (merged == null) return null;

  service.winning_data = merged;
  service.exists_in_dictionary = 'Si';
  service.closed = true;
  service.consolidated_status = 'Cerrado';
  return service;
}
