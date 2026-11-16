import type { BridgeRequest, BridgeResponse } from '../../shared/mobileProtocol'

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void }
    __palmeraReceive?: (message: BridgeResponse) => void
    __palmeraProgress?: (message: {version: 1; id: string; answer: string; sources: import('./types').Source[]}) => void
    __palmeraBack?: () => boolean
  }
}
export class ConsultaError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
let sequence = 0
const pending = new Map<string, {resolve(value: unknown): void; reject(reason: Error): void; timer: ReturnType<typeof setTimeout> | null; progress?: (value: {answer: string; sources: import('./types').Source[]}) => void}>()
window.__palmeraReceive = message => {
  if (message.version !== 1) return
  const operation = pending.get(message.id)
  if (!operation) return
  pending.delete(message.id)
  if (operation.timer) clearTimeout(operation.timer)
  if (message.ok) operation.resolve(message.result)
  else operation.reject(new ConsultaError(message.error.status, message.error.message))
}
window.__palmeraProgress = message => {
  if (message.version === 1) pending.get(message.id)?.progress?.(message)
}
export function nativeRequest<T>(action: BridgeRequest['action'], payload: Record<string, unknown> = {}, progress?: (value: {answer: string; sources: import('./types').Source[]}) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!window.ReactNativeWebView) return reject(new ConsultaError(0, 'Abrí esta interfaz desde la aplicación móvil.'))
    const id = `request-${Date.now()}-${++sequence}`
    const timer = action === 'consultation.send' ? null : setTimeout(() => {
      pending.delete(id)
      reject(new ConsultaError(0, 'La operación tardó demasiado. Intentá nuevamente.'))
    }, 45000)
    pending.set(id, {resolve: value => resolve(value as T), reject, timer, progress})
    window.ReactNativeWebView.postMessage(JSON.stringify({version: 1, id, action, payload}))
  })
}
