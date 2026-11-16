// Versioned wire contract: presentation data only, never SQL or filesystem paths.
export type Country = 'AR' | 'BO';
export interface Registration {
  registration_id: string;
  nombre: string;
  mail: string;
  pais: Country;
  provincia: string;
  efector: string;
  disciplina: string;
}
export interface Source {
  title: string;
  document_id?: string | null;
  page: number | null;
  content_preview: string;
  citation_titles?: string[];
  pdf_available?: boolean;
}
export interface LocalConsultation {
  log_id: string;
  registration_id: string;
  country: Country;
  question: string;
  answer: string;
  sources: Source[];
  model_used: string;
  package_version: string;
  has_context: boolean;
  latency_ms: number;
  created_at: string;
}
export interface Feedback {
  rating: 'up' | 'down';
  comment: string | null;
  feedback_at: string;
}
export interface FeedbackReceipt extends Feedback {
  log_id: string;
}
export interface BridgeRequest {
  version: 1;
  id: string;
  action:
    | 'session.get'
    | 'session.logout'
    | 'registration.create'
    | 'profile.update'
    | 'navigation.exit'
    | 'documents.list'
    | 'document.open'
    | 'consultation.send'
    | 'feedback.save'
    | 'feedback.sync';
  payload: Record<string, unknown>;
}
export type BridgeResponse = { version: 1; id: string } & (
  | { ok: true; result: unknown }
  | { ok: false; error: { status: number; message: string } }
);
export function isRegistration(value: unknown): value is Registration {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    (r.pais === 'AR' || r.pais === 'BO') &&
    [
      'registration_id',
      'nombre',
      'mail',
      'provincia',
      'efector',
      'disciplina',
    ].every(
      key => typeof r[key] === 'string' && (r[key] as string).trim().length > 0,
    )
  );
}
export function parseBridgeRequest(raw: string): BridgeRequest {
  if (raw.length > 150000) throw new Error('Solicitud demasiado grande.');
  const r: unknown = JSON.parse(raw);
  if (!r || typeof r !== 'object') throw new Error('Solicitud inválida.');
  const v = r as Record<string, unknown>;
  const actions = [
    'session.get',
    'session.logout',
    'registration.create',
    'profile.update',
    'navigation.exit',
    'documents.list',
    'document.open',
    'consultation.send',
    'feedback.save',
    'feedback.sync',
  ];
  if (
    v.version !== 1 ||
    typeof v.id !== 'string' ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(v.id) ||
    !actions.includes(String(v.action)) ||
    !v.payload ||
    typeof v.payload !== 'object' ||
    Array.isArray(v.payload)
  ) {
    throw new Error('Solicitud inválida.');
  }
  return v as unknown as BridgeRequest;
}
