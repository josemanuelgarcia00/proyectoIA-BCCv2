/**
 * Sustituye a gspread (usado hoy por googleSheetsClient.py y los lectores/
 * escritores de Google Sheets): lee el Sheet a través de un Google Apps
 * Script propio (ver /apps-script/Code.gs), que se ejecuta con la identidad
 * de Google de quien lo publicó. Así el Sheet puede quedarse privado y no
 * hace falta ningún secreto (API key, cuenta de servicio...) en el frontend.
 *
 * Sin login no hay forma segura de escribir desde un sitio estático público
 * (cualquier credencial de escritura embebida en el bundle sería visible
 * para cualquiera), así que las escrituras no están soportadas: ver
 * hasWriteAccess().
 */
import { APPS_SCRIPT_URL } from '../config';

export function hasWriteAccess() {
  return false;
}

async function callAppsScript(params) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Falta VITE_APPS_SCRIPT_URL para leer el Sheet (ver apps-script/Code.gs).');
  }

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${APPS_SCRIPT_URL}?${query}`);
  if (!res.ok) {
    throw new Error(`Error al leer el Sheet (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function listSheetTitles() {
  const data = await callAppsScript({ action: 'meta' });
  return data.titles || [];
}

export async function getSheetValues(_sheetId, sheetName) {
  const data = await callAppsScript({ action: 'values', sheet: sheetName });
  if (data.values == null) {
    throw new Error(`La hoja '${sheetName}' no existe en el Sheet`);
  }
  return data.values;
}

/** Igual que getSheetValues, pero devuelve null si la hoja no existe (en vez de lanzar). */
export async function readOptionalSheetValues(_sheetId, sheetName) {
  const data = await callAppsScript({ action: 'values', sheet: sheetName });
  return data.values;
}

const NO_WRITE_ERROR = 'Esta app no tiene login: no se pueden guardar cambios en el Sheet (modo solo lectura).';

export async function updateSheetValues() {
  throw new Error(NO_WRITE_ERROR);
}

export async function clearSheetValues() {
  throw new Error(NO_WRITE_ERROR);
}

export async function ensureSheetExists() {
  throw new Error(NO_WRITE_ERROR);
}

/** Reescribe la hoja completa (limpiar + escribir). Sin login esto no está
 * soportado: ver hasWriteAccess(), los llamadores deben comprobarlo antes. */
export async function clearAndWrite() {
  throw new Error(NO_WRITE_ERROR);
}

/** Igual que gspread worksheet.get_all_records(): primera fila = cabecera. */
export function recordsFromValues(values) {
  if (!values || values.length === 0) return [];
  const header = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const record = {};
    header.forEach((col, idx) => {
      record[col] = row[idx] !== undefined ? row[idx] : '';
    });
    return record;
  });
}
