/** Puerto de app/infrastructure/storage/sheetRowFormat.py: columnas y formato
 * de fila compartidos entre Diccionario y Desechados. */

export const DICTIONARY_COLUMNS = [
  'servicio', 'app', 'tipo', 'verbo', 'ambito', 'uso_funcional',
  'entradas', 'salidas', 'invoca', 'tablas_referenciales',
  'documento_origen | version', 'fiabilidad',
];

export const REJECTED_COLUMNS = [...DICTIONARY_COLUMNS, 'observaciones'];

/** Combina documento de origen y versión en el formato de columna única del
 * Diccionario, p.ej. "AF_Solicitud....docx | v2.0". */
export function formatDocumentVersion(sourceDocument, docVersion) {
  if (!sourceDocument) return '';
  if (!docVersion) return sourceDocument;
  const versionLabel = docVersion.toLowerCase().startsWith('v') ? docVersion : `v${docVersion}`;
  return `${sourceDocument} | ${versionLabel}`;
}

export function rowFromData(serviceName, data) {
  return {
    servicio: serviceName,
    app: data.app,
    tipo: data.type,
    verbo: data.verb,
    ambito: data.scope,
    uso_funcional: data.functional_use,
    entradas: (data.inputs || []).join(';'),
    salidas: (data.outputs || []).join(';'),
    invoca: (data.invokes || []).join(';'),
    tablas_referenciales: (data.reference_tables || []).join(';'),
    'documento_origen | version': formatDocumentVersion(data.source_document, data.doc_version),
    fiabilidad: data.reliability,
  };
}

/** Acumula observaciones de sucesivos rechazos del mismo servicio, sin repetir texto ya registrado. */
export function mergeObservations(previous, next) {
  previous = (previous || '').trim();
  next = (next || '').trim();
  if (!next || next === previous) return previous;
  if (!previous) return next;
  if (previous.includes(next)) return previous;
  return `${previous} / ${next}`;
}
