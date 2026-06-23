import React, { useState } from 'react';
import * as servicesApi from '../api/servicesApi';

export default function RejectedEntry({ service, onRestored }) {
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState(null);

  if (!service) {
    return <div className="empty">Selecciona un servicio para ver sus datos.</div>;
  }

  const renderList = (list) => {
    if (!list || list.length === 0) return 'N/A';
    return list.join(', ');
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  // El dato del rechazo es el de la última iteración del perímetro (la que se
  // descartó); si no hubiera iteraciones, recurrimos al dato del Diccionario.
  const lastIteration = service.perimeter_iterations.length > 0
    ? service.perimeter_iterations[service.perimeter_iterations.length - 1]
    : null;
  const data = lastIteration?.data || service.dictionary_data;

  const restoreToReview = async () => {
    setRestoring(true);
    try {
      await servicesApi.revertRejectService(service.service_name);
      showToast(`↩ ${service.service_name} movido a revisión`);
      if (onRestored) onRestored(service.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{service.service_name}</span>
        <span className="stamp stamp-rust">Desechado</span>
      </h2>

      {lastIteration?.observations && (
        <div className="info-line" style={{ background: 'var(--paper)', borderLeftColor: 'var(--rule-strong)', marginBottom: '20px' }}>
          <div>
            <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.6px' }}>
              Observaciones del rechazo
            </strong>
            {lastIteration.observations}
          </div>
        </div>
      )}

      {!data ? (
        <div className="empty" style={{ border: '1px solid var(--rule)', borderRadius: '3px', background: 'white' }}>
          No hay datos para este servicio.
        </div>
      ) : (
        <div className="data-card accent-primary">
          <h3>Datos del servicio rechazado</h3>

          <div className="data-grid">
            <div><span className="data-field-label">App</span><span className="mono">{data.app || 'N/A'}</span></div>
            <div><span className="data-field-label">Tipo</span><span className="mono">{data.type || 'N/A'}</span></div>
            <div><span className="data-field-label">Verbo</span><span className="mono">{data.verb || 'N/A'}</span></div>
            <div><span className="data-field-label">Ámbito</span>{data.scope || 'N/A'}</div>
            <div><span className="data-field-label">Fiabilidad</span>{data.reliability || 'N/A'}</div>
            <div><span className="data-field-label">Documento</span>{data.source_document || 'N/A'} <span className="mono">v{data.doc_version || '-'}</span></div>

            <div className="data-field-block">
              <span className="data-field-label">Uso funcional</span>
              {data.functional_use || 'N/A'}
            </div>

            <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(data.inputs)}</span></div>
            <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(data.outputs)}</span></div>
            <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(data.invokes)}</span></div>
            <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(data.reference_tables)}</span></div>
          </div>
        </div>
      )}

      <div className="buttons" style={{ marginTop: '20px' }}>
        <button
          className="btn-unify"
          disabled={restoring}
          onClick={restoreToReview}
        >
          {restoring ? 'Aplicando...' : 'Mover a revisión'}
        </button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.startsWith('❌') ? 'var(--rust)' : 'var(--ink)',
          color: 'white',
          padding: '13px 18px',
          borderRadius: '2px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          fontWeight: 500,
          fontSize: '13.5px',
          zIndex: 1000
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
