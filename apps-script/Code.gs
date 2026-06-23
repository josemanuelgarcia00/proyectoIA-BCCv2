/**
 * Puente de solo lectura entre el frontend estático (GitHub Pages) y el
 * Google Sheet real, sin exponer ningún secreto: este script se ejecuta con
 * tu identidad de Google de forma transparente (no necesita credentials.json
 * ni una API key), y el Sheet puede quedarse privado.
 *
 * Instrucciones de publicación (hazlo tú desde tu cuenta de Google):
 * 1. Ve a https://script.google.com/ → "Nuevo proyecto".
 * 2. Borra el contenido de Code.gs y pega este archivo entero.
 * 3. Implementar → Nueva implementación → tipo "Aplicación web".
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Autoriza los permisos cuando te lo pida (acceso a tus Sheets).
 * 5. Copia la URL que te da ("...script.google.com/macros/s/XXXX/exec") y
 *    pégala en frontend/.env como VITE_APPS_SCRIPT_URL.
 *
 * Solo lee datos (getValues/getSheets): no modifica el Sheet en ningún caso.
 */

var SHEET_ID = '15onaWFcYxxkT1tCJclEiK24fOW9nIy8StMRpkePSc88';

function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var action = (e.parameter.action || 'values');

    if (action === 'meta') {
      var titles = ss.getSheets().map(function (sheet) { return sheet.getName(); });
      return jsonOutput({ titles: titles });
    }

    var sheetName = e.parameter.sheet;
    if (!sheetName) {
      return jsonOutput({ error: "Falta el parámetro 'sheet'" });
    }

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return jsonOutput({ values: null });
    }

    var values = sheet.getDataRange().getValues();
    return jsonOutput({ values: values });
  } catch (err) {
    return jsonOutput({ error: String(err) });
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
