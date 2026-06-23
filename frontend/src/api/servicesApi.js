/** Sustituye a app/infrastructure/api/routers/controllers/serviceController.py:
 * misma forma de respuesta (vía responseMapper) y mismos mensajes de error,
 * pero llamando directamente a serviceService en vez de hacer fetch a una API. */
import * as serviceService from '../services/serviceService';
import { toResponseDTO, toRowDTO } from '../domain/responseMapper';

export async function getServices() {
  const entities = await serviceService.getFullCatalog();
  return entities.map(toResponseDTO);
}

export async function getServicesWithConflicts() {
  const entities = await serviceService.getServicesWithConflicts();
  return entities.map(toResponseDTO);
}

export async function getResolvedServices() {
  const entities = await serviceService.getResolvedServices();
  return entities.map(toResponseDTO);
}

export async function getRejectedServices() {
  const entities = await serviceService.getRejectedServices();
  return entities.map(toResponseDTO);
}

export async function getFullDictionary() {
  const entities = await serviceService.getFullDictionary();
  return entities.map(toResponseDTO);
}

export async function refreshServices() {
  await serviceService.refreshFromSource();
  return { status: 'ok' };
}

export async function resolveIteration(itemId, iterationId, resolution) {
  const entity = await serviceService.resolveIterationConflicts(itemId.toUpperCase(), iterationId, resolution);
  if (!entity) throw new Error('Servicio o iteración no encontrada');
  return toResponseDTO(entity);
}

export async function revertIteration(itemId, iterationId) {
  const entity = await serviceService.revertIteration(itemId.toUpperCase(), iterationId);
  if (!entity) throw new Error('Servicio o iteración no encontrada');
  return toResponseDTO(entity);
}

export async function resetConflicts(itemId) {
  const entity = await serviceService.resetServiceConflicts(itemId.toUpperCase());
  if (!entity) throw new Error('Servicio no encontrado');
  return toResponseDTO(entity);
}

export async function previewAccept(itemId) {
  const merged = await serviceService.previewAcceptMerge(itemId.toUpperCase());
  if (!merged) throw new Error('El servicio no existe o todavía tiene conflictos pendientes');
  return toRowDTO(merged);
}

export async function acceptAndClose(itemId) {
  const entity = await serviceService.acceptAndCloseService(itemId.toUpperCase());
  if (!entity) throw new Error('El servicio no existe o todavía tiene conflictos pendientes');
  return toResponseDTO(entity);
}

export async function rejectService(itemId) {
  const entity = await serviceService.rejectService(itemId.toUpperCase());
  if (!entity) throw new Error('Servicio no encontrado');
  return toResponseDTO(entity);
}

export async function revertRejectService(itemId) {
  const entity = await serviceService.revertRejection(itemId.toUpperCase());
  if (!entity) throw new Error('Servicio no encontrado');
  return toResponseDTO(entity);
}

export async function updateObservations(itemId, observations) {
  const entity = await serviceService.updateObservations(itemId.toUpperCase(), observations);
  if (!entity) throw new Error('Servicio no encontrado');
  return toResponseDTO(entity);
}

export async function updateIterationObservations(itemId, iterationId, observations) {
  const entity = await serviceService.updateIterationObservations(itemId.toUpperCase(), iterationId, observations);
  if (!entity) throw new Error('Servicio o iteración no encontrada');
  return toResponseDTO(entity);
}

export async function saveToSheet(serviceNames) {
  return serviceService.saveToSheet(serviceNames);
}
