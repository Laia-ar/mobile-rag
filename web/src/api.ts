import type { CatalogDocument, ConsultaResponse, FeedbackPayload, FeedbackResponse, HistoryMessage, ProfilePayload, Registration, RegistroPayload } from './types'
import { nativeRequest } from './nativeBridge'
export { ConsultaError } from './nativeBridge'

export function registrar(payload: RegistroPayload): Promise<Registration> {
  return nativeRequest('registration.create', {...payload})
}
export function actualizarPerfil(registrationId: string, payload: ProfilePayload): Promise<Registration> {
  return nativeRequest('profile.update', {registration_id: registrationId, ...payload})
}
export function obtenerDocumentos(registrationId: string, _signal?: AbortSignal): Promise<CatalogDocument[]> {
  void _signal
  return nativeRequest('documents.list', {registration_id: registrationId})
}
export function consultar(payload: {registration_id: string; question: string; history: HistoryMessage[]}, onProgress?: (value: {answer: string; sources: import('./types').Source[]}) => void): Promise<ConsultaResponse> {
  return nativeRequest('consultation.send', {...payload}, onProgress)
}
export function enviarFeedback(logId: string, payload: FeedbackPayload): Promise<FeedbackResponse> {
  return nativeRequest('feedback.save', {log_id: logId, ...payload})
}
// Legacy PdfPreview is not part of the staging flow. PDFs use the native adapter.
export async function obtenerPdf(_registrationId: string, _documentId: string, _signal?: AbortSignal): Promise<Blob> { void _registrationId; void _documentId; void _signal; throw new Error('Usá el visor de documentos de la aplicación.') }
