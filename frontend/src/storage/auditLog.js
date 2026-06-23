/** Puerto de app/infrastructure/storage/googleSheetsAuditLog.py. */
import { readOptionalSheetValues, recordsFromValues, clearAndWrite, hasWriteAccess } from '../google/sheetsApi';
import { localIsoTimestamp } from './timestamp';

const SHEET_NAME = 'Auditoria';
const COLUMNS = ['fecha_hora', 'servicio', 'iteracion', 'accion', 'valor', 'snapshot'];

/** Todas las entradas registradas, en orden cronológico. */
export async function readAll(sheetId) {
  const values = await readOptionalSheetValues(sheetId, SHEET_NAME);
  if (!values) return [];
  return recordsFromValues(values);
}

export async function append(sheetId, { servicio, accion, valor = '', iteracion = '', snapshot = '' }) {
  // Modo solo lectura (sin sesión de Google, ver sheetsApi.hasWriteAccess):
  // se omite en silencio para no romper el flujo de exploración en memoria;
  // solo "Guardar en Google Sheets" avisa explícitamente de que falta login.
  if (!hasWriteAccess()) return;

  const entries = await readAll(sheetId);
  entries.push({
    fecha_hora: localIsoTimestamp(),
    servicio,
    iteracion: iteracion !== '' && iteracion != null ? String(iteracion) : '',
    accion,
    valor: valor || '',
    snapshot: snapshot || '',
  });
  await writeAll(sheetId, entries);
}

/** Borra del historial las entradas de los servicios indicados (ya volcados a Diccionario/Desechados). */
export async function removeForServices(sheetId, servicios) {
  if (!hasWriteAccess()) return;

  const names = new Set(servicios.map((s) => String(s).toUpperCase()));
  if (names.size === 0) return;

  const current = await readAll(sheetId);
  const entries = current.filter((e) => !names.has(String(e.servicio || '').toUpperCase()));
  if (entries.length === current.length) return;

  await writeAll(sheetId, entries);
}

async function writeAll(sheetId, entries) {
  const table = [COLUMNS, ...entries.map((e) => COLUMNS.map((col) => String(e[col] ?? '')))];
  await clearAndWrite(sheetId, SHEET_NAME, table);
}
