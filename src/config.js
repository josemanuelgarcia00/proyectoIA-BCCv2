export const GOOGLE_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '';

// Sin login: el Sheet se lee a través de un Google Apps Script propio (ver
// /apps-script/Code.gs), publicado como aplicación web. No expone ningún
// secreto y el Sheet puede quedarse privado.
export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';
