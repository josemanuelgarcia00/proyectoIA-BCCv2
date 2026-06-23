import { createContext, useContext, useState, useCallback } from 'react';
import * as servicesApi from '../api/servicesApi';

const CatalogContext = createContext(null);

const VIEW_LABELS = {
  conflicts: { loading: 'pendientes', title: 'Pendientes de revisión', empty: 'No hay nada pendiente de revisión', select: 'revisar iteraciones y conflictos' },
  dictionary: { loading: 'diccionario', title: 'Diccionario completo', empty: 'El Diccionario todavía no tiene servicios', select: 'ver sus datos' },
  rejected: { loading: 'desechados', title: 'Servicios desechados', empty: 'No hay servicios desechados', select: 'ver sus datos y moverlo a revisión' },
  save: { loading: 'catálogo', title: 'Guardar en Google Sheets', empty: 'No hay servicios cargados', select: '' },
};

// Pendiente de revisión: tiene conflictos sin resolver, es un servicio nuevo
// (no está en el Diccionario), o ya se resolvieron todas sus iteraciones pero
// todavía no se ha aceptado ni rechazado (sigue sin estar "closed"). Este
// último caso es importante: al resolver el último conflicto,
// requires_attention pasa a false, pero el servicio debe seguir visible hasta
// que el usuario confirme.
const hasResolvedIterations = (s) => (s.perimeter_iterations || []).some((it) => it.resolution != null);
const isPending = (s) => !s.closed && (s.requires_attention || !s.is_in_dictionary || hasResolvedIterations(s));

/** Estado del catálogo (servicios cargados, vista activa, búsqueda) compartido
 * por App y los componentes de detalle, respaldado por servicesApi/serviceService. */
export function CatalogProvider({ children }) {
  const [services, setServices] = useState([]);
  const [view, setView] = useState('conflicts');
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAlpha, setSortAlpha] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const runLoad = useCallback((nextView, fetcher) => {
    setLoading(true);
    setView(nextView);
    setSearchTerm('');
    setSortAlpha(false);
    setSelectedService(null);

    return fetcher()
      .then((data) => {
        setServices(data);
        setSelectedService(null);
      })
      .catch((e) => {
        console.error(`Error cargando ${nextView}:`, e);
        showToast(`❌ ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  // Trae el catálogo actual en memoria (sin recargar desde el Sheet de
  // origen, para no perder revisiones ya aplicadas que aún no se han guardado)
  const loadConflicts = useCallback(
    () => runLoad('conflicts', async () => (await servicesApi.getServices()).filter(isPending)),
    [runLoad]
  );

  // Trae TODO el contenido de la hoja Diccionario, no solo los servicios que
  // además aparecen en la hoja Perímetro actual
  const loadDictionary = useCallback(() => runLoad('dictionary', servicesApi.getFullDictionary), [runLoad]);

  // Trae los servicios marcados como Desechado en esta sesión
  const loadRejected = useCallback(() => runLoad('rejected', servicesApi.getRejectedServices), [runLoad]);

  // Trae el catálogo completo (todos los estados) para elegir qué guardar
  const loadSaveSelection = useCallback(() => runLoad('save', servicesApi.getServices), [runLoad]);

  // Quita un servicio de la lista activa sin recargar (tras cerrarlo,
  // rechazarlo o restaurarlo desde un componente de detalle)
  const removeService = useCallback((name) => {
    setServices((prev) => prev.filter((s) => s.service_name !== name));
    setSelectedService(null);
  }, []);

  const value = {
    services,
    view,
    loading,
    selectedService,
    setSelectedService,
    searchTerm,
    setSearchTerm,
    sortAlpha,
    setSortAlpha,
    toast,
    showToast,
    viewLabels: VIEW_LABELS[view],
    loadConflicts,
    loadDictionary,
    loadRejected,
    loadSaveSelection,
    removeService,
  };

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de <CatalogProvider>');
  return ctx;
}
