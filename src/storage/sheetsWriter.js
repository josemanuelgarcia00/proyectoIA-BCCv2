/** Puerto de app/infrastructure/storage/googleSheetsWriter.py. */
import { readOptionalSheetValues, recordsFromValues, clearAndWrite } from '../google/sheetsApi';
import { readDictionarySheet } from './sheetsReader';
import { recordToExcelRowData, cleanServiceName } from './sheetParser';
import { DICTIONARY_COLUMNS, REJECTED_COLUMNS, rowFromData, mergeObservations } from './sheetRowFormat';
import { localIsoTimestamp } from './timestamp';

const DICTIONARY_SHEET = 'Diccionario';
const REJECTED_SHEET = 'Desechados';
const PERIMETER_SHEET = 'Perímetro';
const PERIMETER_HISTORY_SHEET = 'Perímetro_Historico';

function rowsToTable(columns, rowsByService) {
  return [columns, ...Object.values(rowsByService).map((row) => columns.map((col) => row[col] ?? ''))];
}

async function readExistingDictionary(sheetId) {
  let dictionaryRecords;
  try {
    dictionaryRecords = await readDictionarySheet(sheetId);
  } catch {
    return {};
  }

  const existing = {};
  for (const record of dictionaryRecords) {
    const firstKey = Object.keys(record)[0];
    const rawKey = String(record[firstKey] ?? '').trim();
    if (!rawKey || rawKey.toLowerCase() === 'nan') continue;

    const serviceName = cleanServiceName(rawKey);
    const rowData = recordToExcelRowData(record);
    existing[serviceName] = rowFromData(serviceName, rowData);
  }
  return existing;
}

async function readExistingRejected(sheetId) {
  const values = await readOptionalSheetValues(sheetId, REJECTED_SHEET);
  if (!values) return {};

  const records = recordsFromValues(values);
  const existing = {};
  for (const record of records) {
    const name = String(record.servicio ?? '').trim().toUpperCase();
    if (!name) continue;
    existing[name] = {};
    for (const col of REJECTED_COLUMNS) existing[name][col] = record[col] ?? '';
  }
  return existing;
}

export async function saveDictionary(sheetId, services) {
  const rowsByService = await readExistingDictionary(sheetId);

  let upserted = 0;
  for (const service of services) {
    if (service.consolidated_status === 'Desechado') continue;
    if (!service.perimeter_iterations.length) continue;
    if (service.perimeter_iterations.some((it) => it.conflicts.length > 0)) continue;
    if (!service.closed) continue;

    const finalData = service.closed && service.winning_data
      ? service.winning_data
      : service.perimeter_iterations[service.perimeter_iterations.length - 1].data;
    rowsByService[service.name] = rowFromData(service.name, finalData);
    upserted += 1;
  }

  if (upserted === 0) return 0;

  await clearAndWrite(sheetId, DICTIONARY_SHEET, rowsToTable(DICTIONARY_COLUMNS, rowsByService));
  return upserted;
}

export async function saveRejected(sheetId, services) {
  const rejected = services.filter((s) => s.consolidated_status === 'Desechado');
  if (!rejected.length) return 0;

  const rowsByService = await readExistingRejected(sheetId);

  for (const service of rejected) {
    const iteration = service.perimeter_iterations[service.perimeter_iterations.length - 1] || null;
    const data = iteration ? iteration.data : service.winning_data;
    if (data == null) continue;

    const previousObservations = rowsByService[service.name]?.observaciones || '';
    const row = rowFromData(service.name, data);
    row.observaciones = mergeObservations(previousObservations, iteration ? iteration.observations : '');
    rowsByService[service.name] = row;
  }

  await clearAndWrite(sheetId, REJECTED_SHEET, rowsToTable(REJECTED_COLUMNS, rowsByService));
  return rejected.length;
}

/** Mueve las filas del Perímetro de los servicios indicados a
 * 'Perímetro_Historico' (con fecha de archivado) y las quita del activo. */
export async function archivePerimeterRows(sheetId, serviceNames) {
  const names = new Set(serviceNames.map((n) => n.toUpperCase()));
  if (names.size === 0) return 0;

  const values = await readOptionalSheetValues(sheetId, PERIMETER_SHEET);
  if (!values) return 0;
  const records = recordsFromValues(values);
  if (!records.length) return 0;

  const columns = Object.keys(records[0]);
  const keyCol = columns[0];

  const toArchive = records.filter((r) => names.has(cleanServiceName(r[keyCol])));
  const toKeep = records.filter((r) => !names.has(cleanServiceName(r[keyCol])));

  if (!toArchive.length) return 0;

  const timestamp = localIsoTimestamp();
  for (const record of toArchive) record.fecha_archivado = timestamp;
  const historyColumns = [...columns, 'fecha_archivado'];

  const perimeterTable = [columns, ...toKeep.map((r) => columns.map((c) => String(r[c] ?? '')))];
  await clearAndWrite(sheetId, PERIMETER_SHEET, perimeterTable);

  const existingHistoryValues = await readOptionalSheetValues(sheetId, PERIMETER_HISTORY_SHEET);
  const existingHistory = existingHistoryValues ? recordsFromValues(existingHistoryValues) : [];
  const allHistory = [...existingHistory, ...toArchive];
  const historyTable = [historyColumns, ...allHistory.map((r) => historyColumns.map((c) => String(r[c] ?? '')))];
  await clearAndWrite(sheetId, PERIMETER_HISTORY_SHEET, historyTable);

  return toArchive.length;
}
