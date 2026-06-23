/** Puerto de app/infrastructure/storage/googleSheetsReader.py. */
import { getSheetValues, recordsFromValues } from '../google/sheetsApi';

const DICTIONARY_SHEET = 'Diccionario';
const PERIMETER_SHEET = 'Perímetro';

function cleanRecords(records) {
  return records.map((record) => {
    const cleaned = {};
    for (const [k, v] of Object.entries(record)) {
      cleaned[String(k).trim()] = v;
    }
    return cleaned;
  });
}

export async function readSheets(sheetId) {
  let dicValues;
  let perValues;
  try {
    [dicValues, perValues] = await Promise.all([
      getSheetValues(sheetId, DICTIONARY_SHEET),
      getSheetValues(sheetId, PERIMETER_SHEET),
    ]);
  } catch (exc) {
    throw new Error(`No se pudieron leer las hojas 'Diccionario' y 'Perímetro': ${exc.message}`);
  }

  return {
    dictionaryRecords: cleanRecords(recordsFromValues(dicValues)),
    perimeterRecords: cleanRecords(recordsFromValues(perValues)),
  };
}

export async function readDictionarySheet(sheetId) {
  let values;
  try {
    values = await getSheetValues(sheetId, DICTIONARY_SHEET);
  } catch (exc) {
    throw new Error(`No se pudo leer la hoja 'Diccionario': ${exc.message}`);
  }
  return cleanRecords(recordsFromValues(values));
}

/** Google Sheets no expone una "fecha de modificación" barata desde aquí, así
 * que la firma de cambio es un hash del contenido. */
export async function getSignature(dictionaryRecords, perimeterRecords) {
  const input = JSON.stringify(dictionaryRecords) + JSON.stringify(perimeterRecords);
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
