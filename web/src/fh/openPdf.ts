import { nativeRequest } from '../nativeBridge'
import type { Source } from '../types'
export async function openPdf(registrationId: string, source: Source): Promise<void> {
  if (!source.document_id || source.pdf_available === false) throw new Error('El PDF de este documento no está disponible.')
  await nativeRequest('document.open', {registration_id: registrationId, document_id: source.document_id, page: source.page ?? 1})
}
