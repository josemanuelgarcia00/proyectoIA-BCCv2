/** Puerto de app/infrastructure/storage/sheetParser.py: agrupa por servicio,
 * detecta iteraciones y conflictos, e independiza el resto de la lógica de
 * si los registros vienen de Excel o de Google Sheets. */
import {
  createServiceEntity, createPerimeterIteration, createExcelRowData, createCellConflict,
  hasNewContent, cloneExcelRowData,
} from '../domain/models';

const ITERATION_SUFFIX = /\s\((\d+)\)$/;
const STRIP_ITERATION_SUFFIX = /\s\(\d+\)$/;

// Columna única que representa el par documento de origen + versión, p.ej.
// "AF_Solicitud - Datos del contrato - v1.2.6.docx | v2.0".
const DOCUMENT_VERSION_PATTERN = /^(.*\S)\s*[-(|]?\s*[vV](\d+(?:\.\d+)*)\)?\s*$/;
// Variante sin "v": la versión viene solo entre paréntesis.
const DOCUMENT_VERSION_PARENS_PATTERN = /^(.*\S)\s*\((\d+(?:\.\d+)*)\)\s*$/;
// Un token que es en realidad una versión suelta ("v2.0", "(1.1)", "2.0").
const VERSION_TOKEN_PATTERN = /^\(?[vV]?\d+(?:\.\d+)*\)?$/;

function stripChars(value, chars) {
  const set = new Set(chars.split(''));
  let start = 0;
  let end = value.length;
  while (start < end && set.has(value[start])) start += 1;
  while (end > start && set.has(value[end - 1])) end -= 1;
  return value.slice(start, end);
}

function normalizeVersion(value) {
  value = (value || '').trim();
  if (!value) return '';

  if (value.includes(' / ')) {
    const seen = new Set();
    const parts = [];
    for (const part of value.split(' / ')) {
      const normalized = normalizeVersion(part);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        parts.push(normalized);
      }
    }
    return parts.join(' / ');
  }

  if (value.startsWith('(') && value.endsWith(')')) {
    value = value.slice(1, -1).trim();
  }
  if (value.slice(0, 1).toLowerCase() === 'v') {
    value = value.slice(1).trim();
  }
  return value;
}

function cleanCorruptedDocument(docPart) {
  const fragments = [];
  for (const chunk of docPart.split('|')) {
    for (const p of chunk.split(' / ')) fragments.push(p.trim());
  }

  const seen = new Set();
  const cleaned = [];
  for (const fragment of fragments) {
    if (!fragment || VERSION_TOKEN_PATTERN.test(fragment)) continue;
    if (!seen.has(fragment)) {
      seen.add(fragment);
      cleaned.push(fragment);
    }
  }
  return cleaned.join(' / ');
}

function splitDocumentVersion(value) {
  if (!value) return ['', ''];
  value = value.trim();

  if (value.includes(' | ')) {
    const lastSep = value.lastIndexOf(' | ');
    let docPart = value.slice(0, lastSep).trim();
    const versionPart = value.slice(lastSep + 3);
    if (docPart.includes('|')) {
      docPart = cleanCorruptedDocument(docPart);
    }
    return [docPart, normalizeVersion(versionPart)];
  }

  const match = DOCUMENT_VERSION_PATTERN.exec(value) || DOCUMENT_VERSION_PARENS_PATTERN.exec(value);
  if (!match) return [value, ''];

  return [stripChars(match[1], ' -|'), match[2]];
}

function getField(columnsLower, namesList, defaultValue = '') {
  for (const name of namesList) {
    const key = name.toLowerCase().trim();
    if (key in columnsLower) {
      const value = columnsLower[key];
      return value ? String(value).trim() : defaultValue;
    }
  }
  return defaultValue;
}

function parseListField(columnsLower, namesList, defaultValue = []) {
  const value = getField(columnsLower, namesList, '');
  if (!value) return defaultValue;
  return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

/** Convierte un registro (fila como objeto) en un ExcelRowData, con mapeo
 * flexible de columnas (case-insensitive, con nombres alternativos). */
export function recordToExcelRowData(record) {
  const columnsLower = {};
  for (const [k, v] of Object.entries(record)) {
    columnsLower[k.toLowerCase().trim()] = v;
  }

  const combinedDoc = getField(columnsLower, ['documento_origen | version', 'documento_origen|version', 'source_document'], '');
  let [sourceDocument, docVersion] = splitDocumentVersion(combinedDoc);
  if (!sourceDocument) {
    sourceDocument = getField(columnsLower, ['documento_origen'], '');
  }
  if (!docVersion) {
    docVersion = getField(columnsLower, ['doc_version', 'versión', 'version', 'version_doc'], '1.0.0');
  }
  docVersion = normalizeVersion(docVersion);

  return createExcelRowData({
    app: getField(columnsLower, ['app', 'aplicación', 'application'], ''),
    type: getField(columnsLower, ['type', 'tipo', 'resource_type'], ''),
    verb: getField(columnsLower, ['verb', 'verbo', 'http_method'], 'GET'),
    scope: getField(columnsLower, ['scope', 'alcance', 'nivel', 'ambito', 'ámbito'], ''),
    functional_use: getField(columnsLower, ['functional_use', 'uso_funcional', 'description'], ''),
    inputs: parseListField(columnsLower, ['inputs', 'parámetros_entrada', 'entrada', 'entradas'], []),
    outputs: parseListField(columnsLower, ['outputs', 'parámetros_salida', 'salida', 'salidas'], []),
    invokes: parseListField(columnsLower, ['invokes', 'invoca', 'llamadas'], []),
    reference_tables: parseListField(columnsLower, ['reference_tables', 'tablas_referencia', 'tablas_referenciales'], []),
    source_document: sourceDocument,
    doc_version: docVersion,
    reliability: getField(columnsLower, ['reliability', 'confiabilidad', 'fiabilidad'], 'Media'),
  });
}

function detectConflicts(currentData, baselineData) {
  if (baselineData == null) return [];

  const conflicts = [];
  const fieldsToCheck = [
    'app', 'type', 'verb', 'scope', 'functional_use',
    'inputs', 'outputs', 'invokes', 'reference_tables', 'reliability',
  ];

  for (const attrName of fieldsToCheck) {
    const currentValue = currentData[attrName];
    const baseValue = baselineData[attrName];
    if (hasNewContent(currentValue, baseValue, attrName)) {
      conflicts.push(createCellConflict({
        column: attrName,
        dictionary_base_value: String(baseValue),
        perimeter_new_proposal: String(currentValue),
      }));
    }
  }

  const docHasNew = hasNewContent(currentData.source_document, baselineData.source_document, 'source_document');
  const versionHasNew = hasNewContent(currentData.doc_version, baselineData.doc_version, 'doc_version');
  if (docHasNew || versionHasNew) {
    conflicts.push(createCellConflict({
      column: 'document',
      dictionary_base_value: `${baselineData.source_document} (v${baselineData.doc_version})`,
      perimeter_new_proposal: `${currentData.source_document} (v${currentData.doc_version})`,
    }));
  }

  return conflicts;
}

function rawKeyOf(record) {
  const firstKey = Object.keys(record)[0];
  return String(record[firstKey] ?? '').trim();
}

export function buildDictionaryIndex(dictionaryRecords) {
  const index = {};
  for (const record of dictionaryRecords) {
    const rawKey = rawKeyOf(record);
    if (!rawKey || rawKey.toLowerCase() === 'nan') continue;

    const cleanName = rawKey.replace(STRIP_ITERATION_SUFFIX, '').trim().toUpperCase();
    index[cleanName] = recordToExcelRowData(record);
  }
  return index;
}

/**
 * Lee el perímetro y extrae servicios agrupados por nombre, detectando
 * iteraciones (sufijo "(n)") y conflictos contra el Diccionario / iteración
 * anterior en cascada.
 */
export function extractServicesFromRecords(dictionaryRecords, perimeterRecords) {
  const dictionaryIndex = buildDictionaryIndex(dictionaryRecords);
  if (!perimeterRecords || perimeterRecords.length === 0) return [];

  const servicesMap = new Map(); // cleanName -> [{ rawName, iterationNum, record }]

  for (const record of perimeterRecords) {
    const rawKey = rawKeyOf(record);
    if (!rawKey || rawKey.toLowerCase() === 'nan') continue;

    const match = ITERATION_SUFFIX.exec(rawKey);
    const iterationNum = match ? parseInt(match[1], 10) : 1;
    const cleanName = rawKey.replace(STRIP_ITERATION_SUFFIX, '').trim().toUpperCase();

    if (!servicesMap.has(cleanName)) servicesMap.set(cleanName, []);
    servicesMap.get(cleanName).push({ rawName: rawKey, iterationNum, record });
  }

  const services = [];
  for (const [serviceName, entries] of servicesMap) {
    entries.sort((a, b) => a.iterationNum - b.iterationNum);

    const masterData = dictionaryIndex[serviceName] || null;

    const iterations = [];
    entries.forEach((entry, idx) => {
      const iterationId = idx + 1;
      const excelRowData = recordToExcelRowData(entry.record);

      // Línea base en cascada: la 1ª iteración se compara contra el
      // Diccionario; el resto, contra la iteración inmediatamente anterior.
      const baselineData = idx === 0 ? masterData : iterations[idx - 1].data;
      const conflicts = detectConflicts(excelRowData, baselineData);

      iterations.push(createPerimeterIteration({
        iteration_id: iterationId,
        data: excelRowData,
        conflicts,
        original_data: cloneExcelRowData(excelRowData),
        original_conflicts: conflicts.map((c) => ({ ...c })),
      }));
    });

    const hasConflicts = iterations.some((it) => it.conflicts.length > 0);
    // Si ya existía en el Diccionario y nada propone algo distinto, se cierra
    // solo (no requiere decisión); los servicios nuevos sí la requieren.
    const unchangedExisting = masterData !== null && !hasConflicts;

    services.push(createServiceEntity({
      name: serviceName,
      exists_in_dictionary: masterData ? 'Si' : 'No',
      consolidated_status: hasConflicts ? 'En revision' : 'Aceptado',
      winning_data: masterData,
      perimeter_iterations: iterations,
      closed: unchangedExisting,
    }));
  }

  return services;
}

export function cleanServiceName(raw) {
  return String(raw ?? '').trim().replace(STRIP_ITERATION_SUFFIX, '').toUpperCase();
}
