import { useState, useEffect } from 'react';
import * as servicesApi from '../api/servicesApi';

export default function SaveSelector({ services, loading, onSaved }) {
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Elegible = el usuario tomó una decisión explícita sobre él (aceptar y
  // cerrar, o rechazar) y ya no tiene conflictos. Un servicio NUEVO sin
  // cambios puede quedar "Aceptado" por defecto sin que nadie lo haya
  // confirmado, y eso no debería guardarse sin revisión. La excepción es un
  // servicio que YA existía en el Diccionario y es idéntico al Perímetro: ahí
  // no hay nada que decidir, así que el backend ya lo entrega cerrado.
  const isEligible = (s) => s.closed && !s.requires_attention;
  const eligible = services.filter(isEligible);

  // Cada vez que se recarga el catálogo (al entrar a la pestaña o tras guardar),
  // partimos de "todo lo listo seleccionado" para no obligar a marcar uno a uno;
  // el usuario puede desmarcar lo que prefiera dejar para más adelante.
  useEffect(() => {
    setSelected(new Set(eligible.map(s => s.service_name)));
  }, [services]);

  const toggle = (name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSave = () => {
    setSaving(true);
    servicesApi.saveToSheet(Array.from(selected))
      .then(data => {
        if (data.saved) {
          onSaved(`✅ Guardado en Google Sheets: ${data.services_written} servicio(s) al Diccionario, ${data.rejected_written} a Desechados (${data.perimeter_rows_archived} fila(s) archivadas del Perímetro)`);
        } else {
          onSaved(`⚠️ ${data.pending_services} de los seleccionados todavía tienen conflictos sin revisar`);
        }
      })
      .catch(e => onSaved(`❌ Error al guardar: ${e.message}`))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return <div className="loading">Cargando catálogo...</div>;
  }

  if (services.length === 0) {
    return <div className="empty">No hay servicios cargados</div>;
  }

  return (
    <div>
      <h2>
        Seleccionar servicios a guardar
        <span className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          {selected.size} de {eligible.length} listos seleccionados
        </span>
      </h2>

      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
        Solo se pueden guardar los servicios ya confirmados (aceptados y cerrados, o rechazados) y sin conflictos pendientes
        (los demás aparecen deshabilitados). No es necesario terminar de revisar todo el catálogo: lo que no selecciones se
        queda pendiente para una próxima vez.
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button className="btn-quiet" onClick={() => setSelected(new Set(eligible.map(s => s.service_name)))}>
          Seleccionar todos los listos
        </button>
        <button className="btn-quiet" onClick={() => setSelected(new Set())}>
          Deseleccionar todos
        </button>
        <button
          className="btn-header"
          style={{ marginLeft: 'auto', flex: 'none', color: 'var(--ink)', borderColor: 'var(--rule-strong)' }}
          onClick={handleSave}
          disabled={saving || selected.size === 0}
        >
          {saving ? 'Guardando...' : `Guardar ${selected.size} seleccionado(s)`}
        </button>
      </div>

      <div>
        {services.map(s => {
          const eligibleRow = isEligible(s);
          const reason = s.requires_attention
            ? ' · tiene conflictos pendientes'
            : (!s.closed ? ' · aún no se ha aceptado ni rechazado' : '');

          return (
            <label
              key={s.service_name}
              className="service-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: eligibleRow ? 'pointer' : 'not-allowed',
                opacity: eligibleRow ? 1 : 0.5
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(s.service_name)}
                disabled={!eligibleRow}
                onChange={() => toggle(s.service_name)}
                style={{ width: '16px', height: '16px', flex: 'none' }}
              />
              <div style={{ flex: 1 }}>
                <div className="service-name" style={{ marginBottom: '2px' }}>{s.service_name}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  {s.status}{reason}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
