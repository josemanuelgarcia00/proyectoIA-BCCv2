import { useEffect } from 'react';
import IterationReview from './components/IterationReview';
import DictionaryEntry from './components/DictionaryEntry';
import RejectedEntry from './components/RejectedEntry';
import SaveSelector from './components/SaveSelector';
import { CatalogProvider, useCatalog } from './contexts/CatalogContext';
import './index.css';

// LOGIN DESACTIVADO DE MOMENTO: se lee el Sheet con VITE_GOOGLE_API_KEY (solo
// lectura, ver google/sheetsApi.js), sin pasar por <AuthProvider>/<LoginGate>.
// Para reactivar el login con Google: envolver <CatalogProvider> con
// <AuthProvider> (contexts/AuthContext.jsx) y volver a gatear el render con
// useAuth().signedIn, como antes.

function CatalogView() {
  const {
    services, view, loading, selectedService, setSelectedService,
    searchTerm, setSearchTerm, sortAlpha, setSortAlpha, toast, showToast,
    viewLabels, loadConflicts, loadDictionary, loadRejected, loadSaveSelection,
    removeService,
  } = useCatalog();

  useEffect(() => { loadConflicts(); }, []);

  // Filtra por nombre de servicio según el término de búsqueda, y opcionalmente
  // ordena alfabéticamente (solo disponible en el Diccionario completo)
  const filteredServices = services
    .filter((service) => service.service_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (sortAlpha ? a.service_name.localeCompare(b.service_name) : 0));

  return (
    <div className="container">
      <header>
        <span className="eyebrow">Cajamar · Registro de servicios</span>
        <h1>Gestor de Conflictos de Servicios</h1>
        <p>Concilia el Perímetro frente al Diccionario y resuelve cada conflicto sin perder datos</p>
        <p style={{ marginTop: '10px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)' }}>
          ⚠️ Modo solo lectura (sin login): los cambios no se guardan en el Sheet.
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button className="btn-header" onClick={loadConflicts}>Revisar servicios</button>
          <button className="btn-header" onClick={loadDictionary}>Ver diccionario completo</button>
          <button className="btn-header" onClick={loadRejected}>Ver desechados</button>
          <button className="btn-header" onClick={loadSaveSelection}>Guardar en Google Sheets</button>
        </div>
      </header>

      {view === 'save' ? (
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <SaveSelector
            services={services}
            loading={loading}
            onSaved={(msg) => { showToast(msg); loadSaveSelection(); }}
          />
        </div>
      ) : (
        <>
          <div className="panel">
            {loading ? (
              <div className="loading">Cargando {viewLabels.loading}...</div>
            ) : services.length === 0 ? (
              <div className="empty">{viewLabels.empty}</div>
            ) : (
              <>
                <h2>
                  {viewLabels.title}
                  <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                    {filteredServices.length} de {services.length}
                  </span>
                </h2>

                <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Buscar servicio por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {view === 'dictionary' && (
                    <button
                      className="btn-quiet"
                      style={{ flex: 'none' }}
                      onClick={() => setSortAlpha((prev) => !prev)}
                    >
                      {sortAlpha ? 'Orden original' : 'Ordenar A-Z'}
                    </button>
                  )}
                </div>

                {filteredServices.length === 0 ? (
                  <div className="empty" style={{ padding: '40px 20px' }}>
                    No se encontraron servicios que coincidan con "<strong>{searchTerm}</strong>"
                  </div>
                ) : (
                  filteredServices.map((service) => (
                    <div
                      key={service.service_name}
                      className={`service-item ${selectedService?.service_name === service.service_name ? 'active' : ''}`}
                      onClick={() => setSelectedService(service)}
                    >
                      <div className="service-name">{service.service_name}</div>
                      <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {service.is_in_dictionary
                          ? <span className="stamp stamp-moss">En diccionario</span>
                          : <span className="stamp stamp-amber">Nuevo</span>}
                        {view !== 'dictionary' && service.perimeter_iterations?.length > 0 && (
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {service.perimeter_iterations.length} iteraciones
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>

          <div className="panel">
            {selectedService ? (
              view === 'dictionary' ? (
                <DictionaryEntry service={selectedService} />
              ) : view === 'rejected' ? (
                <RejectedEntry service={selectedService} onRestored={removeService} />
              ) : (
                <IterationReview service={selectedService} onServiceClosed={removeService} />
              )
            ) : (
              <div className="empty">Selecciona un servicio para {viewLabels.select}</div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.startsWith('❌') ? 'var(--rust)' : (toast.startsWith('⚠️') ? 'var(--amber-ink)' : 'var(--ink)'),
          color: 'white',
          padding: '13px 18px',
          borderRadius: '2px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          fontWeight: 500,
          fontSize: '13.5px',
          zIndex: 1000,
          maxWidth: '360px'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <CatalogProvider>
      <CatalogView />
    </CatalogProvider>
  );
}
