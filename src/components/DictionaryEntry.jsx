import React from 'react';

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-amber'
};

export default function DictionaryEntry({ service }) {
  if (!service) {
    return <div className="empty">Selecciona un servicio para ver sus datos.</div>;
  }

  const renderList = (list) => {
    if (!list || list.length === 0) return 'N/A';
    return list.join(', ');
  };

  const data = service.dictionary_data;
  const stampClass = STATUS_STAMP[service.status] || 'stamp-ink';

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '16px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{service.service_name}</span>
        <span className={`stamp ${stampClass}`}>{service.status}</span>
      </h2>

      {service.observations && (
        <div className="info-line" style={{ background: 'var(--paper)', borderLeftColor: 'var(--rule-strong)', marginBottom: '20px' }}>
          <div>
            <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.6px' }}>
              Observaciones
            </strong>
            {service.observations}
          </div>
        </div>
      )}

      {!data ? (
        <div className="empty" style={{ border: '1px solid var(--rule)', borderRadius: '3px', background: 'white' }}>
          No hay datos del Diccionario para este servicio.
        </div>
      ) : (
        <div className="data-card accent-primary">
          <h3>Diccionario maestro</h3>

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
    </div>
  );
}