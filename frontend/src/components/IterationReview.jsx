import React, { useState, useEffect } from 'react';
import * as servicesApi from '../api/servicesApi';

const STATUS_STAMP = {
  'Aceptado': 'stamp-moss',
  'Unificado': 'stamp-moss',
  'Cerrado': 'stamp-moss',
  'Desechado': 'stamp-rust',
  'En revision': 'stamp-amber'
};

export default function IterationReview({ service, onServiceClosed }) {
  const [localService, setLocalService] = useState(service);
  const [toast, setToast] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [iterationObservations, setIterationObservations] = useState('');
  const [savingIterationObservations, setSavingIterationObservations] = useState(false);

  // Cuando se selecciona otro servicio en la lista, reiniciamos el estado local
  useEffect(() => {
    setLocalService(service);
    setToast(null);
    setPreviewData(null);
  }, [service]);

  // Sincroniza el cuadro de observaciones con la iteración que sería rechazada
  // si se pulsa "Rechazar": la primera con conflictos sin revisar, o si ya no
  // quedan conflictos pendientes, la última iteración (la que se rechazaría
  // por completo al rechazar el servicio).
  useEffect(() => {
    const iterations = localService?.perimeter_iterations || [];
    const pending = iterations.filter(it => it.conflicts && it.conflicts.length > 0);
    const target = pending[0] || iterations[iterations.length - 1] || null;
    setIterationObservations(target?.observations || '');
  }, [localService]);

  if (!localService || !localService.perimeter_iterations) {
    return <div className="empty">Cargando detalles del servicio...</div>;
  }

  // Función auxiliar para renderizar listas de forma segura
  const renderList = (list) => {
    if (!list || list.length === 0) return 'N/A';
    return list.join(', ');
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const resolveIteration = async (iterationId, resolution) => {
    setResolvingId(iterationId);
    try {
      const updated = await servicesApi.resolveIteration(localService.service_name, iterationId, resolution);
      setLocalService(updated);
      showToast(`✅ Iteración ${iterationId} revisada`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const revertIteration = async (iterationId) => {
    setResolvingId(iterationId);
    try {
      const updated = await servicesApi.revertIteration(localService.service_name, iterationId);
      setLocalService(updated);
      showToast(`↩ Iteración ${iterationId} restaurada`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const resetServiceConflicts = async () => {
    setResolvingId('reset');
    try {
      const updated = await servicesApi.resetConflicts(localService.service_name);
      setLocalService(updated);
      showToast(`↺ Conflictos de ${localService.service_name} reiniciados`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const requestAcceptPreview = async () => {
    setResolvingId('accept-close');
    try {
      const preview = await servicesApi.previewAccept(localService.service_name);
      setPreviewData(preview);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const confirmAcceptAndClose = async () => {
    setResolvingId('accept-close');
    try {
      await servicesApi.acceptAndClose(localService.service_name);
      setPreviewData(null);
      showToast(`✅ ${localService.service_name} aceptado y cerrado`);
      if (onServiceClosed) onServiceClosed(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const rejectService = () => {
    setConfirmDialog({
      title: 'Rechazar servicio',
      message: `¿Seguro que quieres rechazar "${localService.service_name}"? No se incorporará al Diccionario.`,
      confirmLabel: 'Rechazar',
      onConfirm: performRejectService
    });
  };

  const performRejectService = async () => {
    setConfirmDialog(null);
    setResolvingId('reject-service');
    try {
      await servicesApi.rejectService(localService.service_name);
      showToast(`❌ ${localService.service_name} rechazado`);
      if (onServiceClosed) onServiceClosed(localService.service_name);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setResolvingId(null);
    }
  };

  const saveIterationObservations = async (iterationId) => {
    setSavingIterationObservations(true);
    try {
      const updated = await servicesApi.updateIterationObservations(
        localService.service_name, iterationId, iterationObservations
      );
      setLocalService(updated);
      showToast('📝 Observaciones de la iteración guardadas');
    } catch (e) {
      showToast(`❌ ${e.message}`);
    } finally {
      setSavingIterationObservations(false);
    }
  };

  // Solo interesa mostrar iteraciones con conflictos pendientes de revisar
  const visibleIterations = localService.perimeter_iterations.filter(
    it => it.conflicts && it.conflicts.length > 0
  );

  // Última iteración = dato consolidado que pasaría al Diccionario una vez revisado
  // todo, y también la iteración que se rechazaría por completo si se rechaza el servicio
  const lastIteration = localService.perimeter_iterations.length > 0
    ? localService.perimeter_iterations[localService.perimeter_iterations.length - 1]
    : null;
  const finalData = lastIteration?.data || null;

  // Cuando ya no quedan conflictos pendientes, mostramos diccionario y resultado final lado a lado
  const allResolved = localService.perimeter_iterations.length > 0 && visibleIterations.length === 0;

  // Servicio nuevo: no existe en el Diccionario Maestro, solo se puede aceptar o rechazar
  const isNewService = !localService.is_in_dictionary;

  // Iteraciones ya revisadas (con resolución persistida), para poder volver atrás
  // una a una. A diferencia de antes, esto no depende de un estado local que se
  // reinicia al salir y volver a entrar al servicio: se basa en el dato guardado.
  const resolvedIterations = localService.perimeter_iterations.filter(
    it => it.resolution != null
  );

  // Solo se muestra una iteración con conflictos a la vez (la siguiente aparece
  // al resolver la actual), manteniendo siempre su iteration_id original.
  const currentIteration = visibleIterations[0] || null;
  const totalConflictIterations = visibleIterations.length + resolvedIterations.length;
  const currentPosition = resolvedIterations.length + 1;

  const resolutionStamp = (resolution) => {
    if (resolution === 'unify') return { label: 'Unificada', cls: 'stamp-moss' };
    if (resolution === 'reject') return { label: 'Rechazada', cls: 'stamp-rust' };
    return { label: 'Revisada', cls: 'stamp-ink' };
  };

  const statusStampClass = STATUS_STAMP[localService.status] || 'stamp-ink';

  // Cuadro de observaciones ligado siempre a una iteración concreta (la que se
  // rechazaría si se pulsa "Rechazar"), nunca a una nota genérica del servicio
  const iterationObservationsBox = (iterationId) => (
    <div className="note-block" style={{ marginTop: '16px' }}>
      <h4 className="subhead" style={{ marginBottom: '8px' }}>Observaciones de esta iteración</h4>
      <textarea
        value={iterationObservations}
        onChange={(e) => setIterationObservations(e.target.value)}
        placeholder="Notas sobre esta iteración, p. ej. el motivo si se va a rechazar (opcional)..."
        rows={2}
        style={{
          width: '100%', padding: '8px', borderRadius: '2px',
          border: '1px solid var(--rule)', fontSize: '13px',
          fontFamily: 'inherit', resize: 'vertical'
        }}
      />
      <div style={{ marginTop: '8px', textAlign: 'right' }}>
        <button
          className="btn-quiet"
          disabled={savingIterationObservations}
          onClick={() => saveIterationObservations(iterationId)}
        >
          {savingIterationObservations ? 'Guardando...' : 'Guardar observaciones'}
        </button>
      </div>
    </div>
  );

  // Solo se usa cuando el servicio SÍ existe en el Diccionario (si es nuevo, se
  // muestra en su lugar el aviso de una sola línea más abajo en el render)
  const dictionaryBox = (
    <div className="data-card accent-primary">
      <h3>Diccionario maestro</h3>

      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{localService.dictionary_data?.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{localService.dictionary_data?.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{localService.dictionary_data?.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{localService.dictionary_data?.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{localService.dictionary_data?.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{localService.dictionary_data?.source_document || 'N/A'} <span className="mono">v{localService.dictionary_data?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {localService.dictionary_data?.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(localService.dictionary_data?.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(localService.dictionary_data?.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(localService.dictionary_data?.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(localService.dictionary_data?.reference_tables)}</span></div>
      </div>
    </div>
  );

  const finalResultBox = (
    <div className="data-card accent-moss">
      <h3>
        Resultado para el diccionario
        <span className="stamp stamp-moss">Listo para cerrar</span>
      </h3>

      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{finalData?.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData?.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData?.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData?.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/A'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData?.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(finalData?.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(finalData?.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(finalData?.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(finalData?.reference_tables)}</span></div>
      </div>

      <div className="buttons" style={{ marginTop: '20px' }}>
        <button
          className="btn-accept"
          disabled={resolvingId === 'accept-close'}
          onClick={requestAcceptPreview}
        >
          {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar cambios'}
        </button>
        <button
          className="btn-quiet"
          style={{ flex: 1, textAlign: 'center' }}
          disabled={resolvingId === 'reset'}
          onClick={resetServiceConflicts}
        >
          {resolvingId === 'reset' ? 'Aplicando...' : 'Reiniciar conflicto'}
        </button>
        <button
          className="btn-reject"
          disabled={resolvingId === 'reject-service'}
          onClick={rejectService}
        >
          {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar servicio'}
        </button>
      </div>

      {lastIteration && iterationObservationsBox(lastIteration.iteration_id)}
    </div>
  );

  // Para servicios nuevos: solo el dato y la decisión de aceptar/rechazar, sin
  // hablar de "revisión completada" (no había nada del Diccionario que revisar)
  const newServiceResultBox = (
    <div className="data-card">
      <h3>Datos del servicio</h3>

      <div className="data-grid">
        <div><span className="data-field-label">App</span><span className="mono">{finalData?.app || 'N/A'}</span></div>
        <div><span className="data-field-label">Tipo</span><span className="mono">{finalData?.type || 'N/A'}</span></div>
        <div><span className="data-field-label">Verbo</span><span className="mono">{finalData?.verb || 'N/A'}</span></div>
        <div><span className="data-field-label">Ámbito</span>{finalData?.scope || 'N/A'}</div>
        <div><span className="data-field-label">Fiabilidad</span>{finalData?.reliability || 'N/A'}</div>
        <div><span className="data-field-label">Documento</span>{finalData?.source_document || 'N/A'} <span className="mono">v{finalData?.doc_version || '-'}</span></div>

        <div className="data-field-block">
          <span className="data-field-label">Uso funcional</span>
          {finalData?.functional_use || 'N/A'}
        </div>

        <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(finalData?.inputs)}</span></div>
        <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(finalData?.outputs)}</span></div>
        <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(finalData?.invokes)}</span></div>
        <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(finalData?.reference_tables)}</span></div>
      </div>

      <div className="buttons" style={{ marginTop: '20px' }}>
        <button
          className="btn-accept"
          disabled={resolvingId === 'accept-close'}
          onClick={requestAcceptPreview}
        >
          {resolvingId === 'accept-close' ? 'Calculando...' : 'Aceptar'}
        </button>
        <button
          className="btn-reject"
          disabled={resolvingId === 'reject-service'}
          onClick={rejectService}
        >
          {resolvingId === 'reject-service' ? 'Aplicando...' : 'Rechazar'}
        </button>
      </div>

      {lastIteration && iterationObservationsBox(lastIteration.iteration_id)}
    </div>
  );

  return (
    <div className="iteration-review">
      <h2 style={{ marginBottom: '4px', color: 'var(--ink)', fontSize: '17px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="mono">{localService.service_name}</span>
        <span className={`stamp ${statusStampClass}`}>{localService.status}</span>
      </h2>

      {isNewService && (
        <div className="info-line" style={{ marginTop: '16px' }}>
          <span className="stamp stamp-amber">Nuevo</span>
          <span>No existe en el Diccionario Maestro — es un servicio nuevo detectado en el perímetro.</span>
        </div>
      )}

      <div style={{ marginTop: isNewService ? '16px' : '20px' }}>

      {localService.perimeter_iterations.length === 0 ? (
        <>
          {!isNewService && dictionaryBox}
          <div className="empty" style={{ border: '1px solid var(--rule)', borderRadius: '3px', background: 'white', marginTop: '24px' }}>
            No hay iteraciones registradas para este servicio.
          </div>
        </>
      ) : allResolved ? (
        isNewService ? (
          newServiceResultBox
        ) : (
          /* Diccionario y resultado final lado a lado, una vez revisados todos los conflictos */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {dictionaryBox}
            {finalResultBox}
          </div>
        )
      ) : (
        <>
          {!isNewService && <div style={{ marginBottom: '24px' }}>{dictionaryBox}</div>}
          {currentIteration && (
          <div key={currentIteration.iteration_id} className="field-diff">

            <div className="iteration-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Iteración {currentIteration.iteration_id}</span>
              <span className="folio-count">Punto {currentPosition} de {totalConflictIterations}</span>
            </div>

            {/* Datos detallados de la iteración actual */}
            <div style={{ margin: '18px 0' }}>
              <h4 className="subhead">Datos capturados del perímetro</h4>
              <div className="data-grid">
                <div><span className="data-field-label">App</span><span className="mono">{currentIteration.data.app || 'N/A'}</span></div>
                <div><span className="data-field-label">Tipo</span><span className="mono">{currentIteration.data.type || 'N/A'}</span></div>
                <div><span className="data-field-label">Verbo</span><span className="mono">{currentIteration.data.verb || 'N/A'}</span></div>
                <div><span className="data-field-label">Ámbito</span>{currentIteration.data.scope || 'N/A'}</div>
                <div><span className="data-field-label">Fiabilidad</span>{currentIteration.data.reliability || 'N/A'}</div>
                <div><span className="data-field-label">Documento</span>{currentIteration.data.source_document || 'N/A'} <span className="mono">v{currentIteration.data.doc_version || '-'}</span></div>

                <div className="data-field-block">
                  <span className="data-field-label">Uso funcional</span>
                  {currentIteration.data.functional_use || 'N/A'}
                </div>

                <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(currentIteration.data.inputs)}</span></div>
                <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(currentIteration.data.outputs)}</span></div>
                <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(currentIteration.data.invokes)}</span></div>
                <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(currentIteration.data.reference_tables)}</span></div>
              </div>
            </div>

            {/* Mapeo de Conflictos */}
            <div className="conflict-block">
                <h4 className="subhead" style={{ marginBottom: '16px' }}>
                  Conflictos detectados ({currentIteration.conflicts.length})
                </h4>

                {currentIteration.conflicts.map((conflict, idx) => (
                  <div key={idx} className="conflict-row">
                    <div className="field-name">
                      <span className="mono">{conflict.column === 'document' ? 'documento + versión' : conflict.column}</span>
                    </div>
                    <div className="field-values">
                      <div className="value-box">
                        <div className="label">Valor anterior</div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          {conflict.original || 'N/D'}
                        </div>
                      </div>
                      <div className="value-box">
                        <div className="label">Nueva propuesta</div>
                        <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
                          {conflict.proposed || 'N/D'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="buttons">
                  <button
                    className="btn-unify"
                    disabled={resolvingId === currentIteration.iteration_id}
                    onClick={() => resolveIteration(currentIteration.iteration_id, 'unify')}
                  >
                    {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Unificar'}
                  </button>
                  <button
                    className="btn-reject"
                    disabled={resolvingId === currentIteration.iteration_id}
                    onClick={() => resolveIteration(currentIteration.iteration_id, 'reject')}
                  >
                    {resolvingId === currentIteration.iteration_id ? 'Aplicando...' : 'Rechazar cambios'}
                  </button>
                </div>
              </div>

            {iterationObservationsBox(currentIteration.iteration_id)}

            </div>
          )}
        </>
      )}

      {resolvedIterations.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 className="subhead">Iteraciones ya revisadas</h4>
          {resolvedIterations.map(it => {
            const stamp = resolutionStamp(it.resolution);
            return (
              <div
                key={it.iteration_id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'white', border: '1px solid var(--rule)',
                  marginBottom: '8px', fontSize: '13px'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mono">Iteración {it.iteration_id}</span>
                  <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>
                </span>
                <button
                  className="btn-quiet"
                  disabled={resolvingId === it.iteration_id}
                  onClick={() => revertIteration(it.iteration_id)}
                >
                  {resolvingId === it.iteration_id ? 'Aplicando...' : 'Volver atrás'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      </div>

      {previewData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(21,48,47,0.55)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '4px', padding: '24px',
            maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
            border: '1px solid var(--rule)'
          }}>
            <h3 style={{ color: 'var(--ink)', marginBottom: '6px', fontSize: '15px', fontWeight: 600 }}>
              Así quedará en el Diccionario
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Resultado de unir la revisión final de <strong className="mono">{localService.service_name}</strong> con el dato maestro actual del Diccionario. Nada se elimina ni se sobrescribe.
            </p>

            <div className="data-grid">
              <div><span className="data-field-label">App</span><span className="mono">{previewData.app || 'N/A'}</span></div>
              <div><span className="data-field-label">Tipo</span><span className="mono">{previewData.type || 'N/A'}</span></div>
              <div><span className="data-field-label">Verbo</span><span className="mono">{previewData.verb || 'N/A'}</span></div>
              <div><span className="data-field-label">Ámbito</span>{previewData.scope || 'N/A'}</div>
              <div><span className="data-field-label">Fiabilidad</span>{previewData.reliability || 'N/A'}</div>
              <div><span className="data-field-label">Documento</span>{previewData.source_document || 'N/A'} <span className="mono">v{previewData.doc_version || '-'}</span></div>

              <div className="data-field-block">
                <span className="data-field-label">Uso funcional</span>
                {previewData.functional_use || 'N/A'}
              </div>

              <div className="wide"><span className="data-field-label">Entradas</span><span className="mono">{renderList(previewData.inputs)}</span></div>
              <div className="wide"><span className="data-field-label">Salidas</span><span className="mono">{renderList(previewData.outputs)}</span></div>
              <div className="wide"><span className="data-field-label">Invoca</span><span className="mono">{renderList(previewData.invokes)}</span></div>
              <div className="wide"><span className="data-field-label">Tablas referenciales</span><span className="mono">{renderList(previewData.reference_tables)}</span></div>
            </div>

            <div className="buttons" style={{ marginTop: '24px' }}>
              <button
                className="btn-accept"
                disabled={resolvingId === 'accept-close'}
                onClick={confirmAcceptAndClose}
              >
                {resolvingId === 'accept-close' ? 'Aplicando...' : 'Confirmar y cerrar'}
              </button>
              <button
                className="btn-quiet"
                style={{ flex: 1, textAlign: 'center' }}
                disabled={resolvingId === 'accept-close'}
                onClick={() => setPreviewData(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(21,48,47,0.55)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2100, padding: '20px'
        }}>
          <div style={{
            background: 'white', borderRadius: '4px', padding: '24px',
            maxWidth: '440px', width: '100%',
            border: '1px solid var(--rule)'
          }}>
            <h3 style={{ color: 'var(--ink)', marginBottom: '10px', fontSize: '15px', fontWeight: 600 }}>
              {confirmDialog.title}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              {confirmDialog.message}
            </p>

            <div className="buttons">
              <button className="btn-reject" onClick={confirmDialog.onConfirm}>
                {confirmDialog.confirmLabel || 'Confirmar'}
              </button>
              <button
                className="btn-quiet"
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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