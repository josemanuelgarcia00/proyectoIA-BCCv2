import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authClient from '../google/auth';
import { GOOGLE_CLIENT_ID, GOOGLE_SHEET_ID } from '../config';

const AuthContext = createContext(null);

/**
 * Envuelve toda la app: sin backend, cada usuario inicia sesión con su propia
 * cuenta de Google (Google Identity Services) y esa cuenta debe tener permiso
 * de Editor sobre el Google Sheet. El token en sí vive en google/auth.js
 * (no en React, porque lo consumen llamadas async fuera del árbol de
 * componentes, como sheetsApi.js); este contexto solo expone el estado de
 * sesión a la interfaz.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_SHEET_ID) {
      setError('Faltan VITE_GOOGLE_CLIENT_ID y/o VITE_GOOGLE_SHEET_ID. Configúralos en frontend/.env (ver .env.example) antes de iniciar sesión.');
      setStatus('error');
      return;
    }
    authClient.initAuth()
      .then(() => setStatus('ready'))
      .catch((e) => { setError(e.message); setStatus('error'); });
  }, []);

  const signIn = useCallback(() => {
    setSigningIn(true);
    setError(null);
    return authClient.signIn()
      .then(() => setSignedIn(true))
      .catch((e) => { setError(e.message); throw e; })
      .finally(() => setSigningIn(false));
  }, []);

  const signOut = useCallback(() => {
    authClient.signOut();
    setSignedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ status, error, signedIn, signingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
