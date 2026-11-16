export type Country = 'AR' | 'BO'

export interface Registration {
  registration_id: string
  nombre: string
  mail: string
  pais: Country
  provincia: string
  efector: string
  disciplina: string
}

export type ProfilePayload = Omit<Registration, 'registration_id'>

export interface RegistroPayload {
  nombre: string
  mail: string
  pais: Country
  provincia: string
  efector: string
  disciplina: string
  consent_aceptado: true
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Source {
  title: string
  citation_titles?: string[]
  document_id?: string | null
  pdf_available?: boolean
  page: number | null
  content_preview: string
}

export interface CatalogDocument {
  document_id: string
  title: string
  description: string | null
  document_type: string
  file_size: number
  pdf_available: boolean
}

export interface ConsultaResponse {
  answer: string
  sources: Source[]
  model_used: string
  model_name: string
  corpus_name: string
  prompt_name: string | null
  has_context: boolean
  latency_ms: number
  log_id: string
}

export interface CorpusInfo {
  corpus_name: string
  pais: Country
}

export interface PromptInfo {
  prompt_name: string | null
  pais: Country
}

export interface ModelInfo {
  model_id: string
  model_name: string
}

export type FeedbackRating = 'up' | 'down'

export interface FeedbackPayload {
  registration_id: string
  rating: FeedbackRating
  comment?: string | null
}

export interface FeedbackResponse {
  log_id: string
  rating: FeedbackRating
  comment: string | null
  feedback_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  hasContext?: boolean
  latencyMs?: number
  modelName?: string
  logId?: string
}
