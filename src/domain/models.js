/** Puerto de app/domain/service.py: entidades de dominio como objetos planos. */

export const LIST_FIELDS = new Set(['inputs', 'outputs', 'invokes', 'reference_tables']);

export function createExcelRowData(fields = {}) {
  return {
    app: '',
    type: '',
    verb: '',
    scope: '',
    functional_use: '',
    inputs: [],
    outputs: [],
    invokes: [],
    reference_tables: [],
    source_document: '',
    doc_version: '',
    reliability: '',
    ...fields,
  };
}

export function cloneExcelRowData(data) {
  if (!data) return null;
  return {
    ...data,
    inputs: [...(data.inputs || [])],
    outputs: [...(data.outputs || [])],
    invokes: [...(data.invokes || [])],
    reference_tables: [...(data.reference_tables || [])],
  };
}

export function createCellConflict(fields = {}) {
  return { column: '', dictionary_base_value: '', perimeter_new_proposal: '', ...fields };
}

export function createPerimeterIteration(fields = {}) {
  return {
    iteration_id: 0,
    data: createExcelRowData(),
    conflicts: [],
    resolution: null,
    original_data: null,
    original_conflicts: [],
    observations: '',
    ...fields,
  };
}

export function createServiceEntity(fields = {}) {
  return {
    name: '',
    exists_in_dictionary: 'No',
    consolidated_status: 'En revision',
    winning_data: null,
    dictionary_data: null,
    perimeter_iterations: [],
    closed: false,
    observations: '',
    ...fields,
  };
}

export function hasCriticalConflicts(service) {
  return service.perimeter_iterations.some((it) => it.conflicts.length > 0);
}

/** Indica si current_value aporta algo que baseline_value todavía no contempla. */
export function hasNewContent(currentValue, baselineValue, fieldName) {
  if (LIST_FIELDS.has(fieldName)) {
    const baselineItems = new Set(baselineValue || []);
    return (currentValue || []).some((item) => !baselineItems.has(item));
  }

  const current = (currentValue ?? '').toString().trim();
  const baseline = (baselineValue ?? '').toString().trim();
  if (!current || current === baseline) return false;
  if (!baseline) return true;

  const baselineParts = new Set(baseline.split(' / ').map((p) => p.trim()));
  return !baselineParts.has(current);
}
