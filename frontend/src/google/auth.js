/**
 * Sustituye a la cuenta de servicio de app/infrastructure/storage/googleSheetsClient.py:
 * en vez de un secreto en el servidor, cada usuario inicia sesión con su propia
 * cuenta de Google (Google Identity Services) y concede el scope de Sheets.
 * El token vive solo en memoria de esta pestaña, nunca se persiste.
 */
import { GOOGLE_CLIENT_ID, SHEETS_SCOPE } from '../config';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

function loadGisScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });
}

export async function initAuth() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Falta configurar VITE_GOOGLE_CLIENT_ID');
  }
  await loadGisScript();
}

export function getToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  return null;
}

export function isSignedIn() {
  return getToken() !== null;
}

export function signIn() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services no está cargado todavía'));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SHEETS_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + Math.max(0, (response.expires_in - 60)) * 1000;
        resolve(accessToken);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || 'No se pudo iniciar sesión con Google'));
      },
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  tokenExpiresAt = 0;
}

/** Devuelve un token válido, pidiendo inicio de sesión si no hay uno todavía. */
export async function ensureToken() {
  const existing = getToken();
  if (existing) return existing;
  return signIn();
}
