export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const GOOGLE_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Modo temporal sin login: API key de solo lectura (ver README). Requiere
// que el Sheet sea "Cualquiera con el enlace puede ver". Se puede quitar en
// cuanto vuelva a activarse el login con Google (AuthProvider en App.jsx).
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
