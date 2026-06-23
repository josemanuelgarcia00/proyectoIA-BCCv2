/** Puerto de app/infrastructure/api/dtos/serviceOutDTO.py: misma forma de
 * objeto que antes devolvía la API REST, para no tener que reescribir el
 * renderizado de los componentes (IterationReview, DictionaryEntry, etc.). */

export function toRowDTO(data) {
  if (!data) return null;
  return {
    app: data.app,
    type: data.type,
    verb: data.verb,
    scope: data.scope,
    functional_use: data.functional_use,
    inputs: data.inputs,
    outputs: data.outputs,
    invokes: data.invokes,
    reference_tables: data.reference_tables,
    source_document: data.source_document,
    doc_version: data.doc_version,
    reliability: data.reliability,
  };
}

export function toResponseDTO(entity) {
  if (!entity) return null;

  const perimeterIterations = entity.perimeter_iterations.map((it) => ({
    iteration_id: it.iteration_id,
    data: toRowDTO(it.data),
    conflicts: it.conflicts.map((c) => ({
      column: c.column,
      original: c.dictionary_base_value,
      proposed: c.perimeter_new_proposal,
    })),
    resolution: it.resolution,
    observations: it.observations || '',
  }));

  return {
    service_name: entity.name,
    status: entity.consolidated_status,
    is_in_dictionary: (entity.exists_in_dictionary || '').toLowerCase() === 'si',
    requires_attention: entity.perimeter_iterations.some((it) => it.conflicts.length > 0),
    closed: entity.closed,
    observations: entity.observations || '',
    dictionary_data: toRowDTO(entity.winning_data),
    perimeter_iterations: perimeterIterations,
  };
}
