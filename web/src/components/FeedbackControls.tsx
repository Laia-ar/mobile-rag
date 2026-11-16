import { useState } from 'react'
import { ConsultaError, enviarFeedback } from '../api'
import type { FeedbackRating } from '../types'
import { ThumbDownIcon, ThumbUpIcon } from './icons'

interface FeedbackControlsProps {
  logId: string
  registrationId: string
}

function feedbackErrorMessage(error: unknown): string {
  if (error instanceof ConsultaError) {
    if (error.status === 404) return 'No se encontró la respuesta para registrar el feedback.'
    if (error.status === 409) return 'Esta respuesta no admite feedback.'
  }
  return 'No se pudo guardar el feedback. Probá de nuevo.'
}

export default function FeedbackControls({ logId, registrationId }: FeedbackControlsProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(null)
  const [comment, setComment] = useState('')
  const [savedComment, setSavedComment] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'rating' | 'comment' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (nextRating: FeedbackRating, withComment: boolean) => {
    setSubmitting(withComment ? 'comment' : 'rating')
    setError(null)
    try {
      const trimmed = comment.trim()
      const res = await enviarFeedback(logId, {
        registration_id: registrationId,
        rating: nextRating,
        ...(withComment ? { comment: trimmed.length > 0 ? trimmed : null } : {}),
      })
      setRating(res.rating)
      setComment(res.comment ?? '')
      setSavedComment(res.comment)
    } catch (err) {
      setError(feedbackErrorMessage(err))
    } finally {
      setSubmitting(null)
    }
  }

  const handleRate = (next: FeedbackRating) => {
    if (submitting || next === rating) return
    void send(next, false)
  }

  const handleSaveComment = () => {
    if (submitting || !rating) return
    void send(rating, true)
  }

  const busy = submitting !== null
  const hasCommentChanges = comment !== (savedComment ?? '')

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleRate('up')}
          disabled={busy}
          aria-label="Respuesta útil"
          aria-pressed={rating === 'up'}
          title="Respuesta útil"
          className={`rounded-full p-1.5 transition-colors disabled:opacity-50 ${
            rating === 'up'
              ? 'bg-brand-light text-brand-dark'
              : 'text-[#999] hover:bg-gray-100 hover:text-[#666]'
          }`}
        >
          <ThumbUpIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleRate('down')}
          disabled={busy}
          aria-label="Respuesta no útil"
          aria-pressed={rating === 'down'}
          title="Respuesta no útil"
          className={`rounded-full p-1.5 transition-colors disabled:opacity-50 ${
            rating === 'down'
              ? 'bg-brand-light text-brand-dark'
              : 'text-[#999] hover:bg-gray-100 hover:text-[#666]'
          }`}
        >
          <ThumbDownIcon className="h-4 w-4" />
        </button>
        {submitting === 'rating' && (
          <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#e0e0e0] border-t-brand" />
        )}
        {rating && !busy && !error && (
          <span className="ml-1 text-[10px] text-[#888]">¡Gracias por tu feedback!</span>
        )}
      </div>

      {rating && (
        <div className="space-y-1.5">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Comentario opcional: ¿qué estuvo bien o mal de la respuesta?"
            rows={2}
            maxLength={1000}
            disabled={busy}
            className="w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#333] outline-none placeholder:text-[#999] focus:border-brand disabled:opacity-60"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveComment}
              disabled={busy || !hasCommentChanges}
              className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:bg-[#ccc]"
            >
              {submitting === 'comment' ? 'Guardando…' : 'Guardar comentario'}
            </button>
            {savedComment !== null && !hasCommentChanges && !busy && !error && (
              <span className="text-[10px] text-[#4CAF50]">Comentario guardado.</span>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  )
}
