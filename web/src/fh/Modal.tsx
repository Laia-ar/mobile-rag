import { useEffect, useRef, type ReactNode } from 'react'
import { fhAsset } from './content'

export default function Modal({
  title,
  onClose,
  children,
  variant = 'default',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  variant?: 'default' | 'external' | 'chat-source' | 'chat-sources'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const isExternal = variant === 'external'
  const isChatSource = variant === 'chat-source' || variant === 'chat-sources'
  const hasIconClose = isExternal || isChatSource
  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      dialog?.close()
      trigger?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`fh-modal${isExternal ? ' fh-modal-external' : isChatSource ? ` fh-chat-modal fh-modal-${variant}` : ''}`}
      aria-labelledby="fh-modal-title"
      aria-describedby={isExternal ? 'fh-external-description' : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="fh-modal-inner">
        <header className="fh-modal-header">
          {isExternal && (
            <span className="fh-external-icon-badge" aria-hidden="true">
              <span className="fh-external-icon" style={{ maskImage: `url("${fhAsset('consultation/external-link.svg')}")` }} />
            </span>
          )}
          <h2 id="fh-modal-title">{title}</h2>
          <button
            type="button"
            className={isExternal ? 'fh-external-close' : isChatSource ? 'fh-chat-modal-close' : 'fh-text-button'}
            aria-label={isExternal ? 'Cerrar aviso' : isChatSource ? 'Cerrar fuentes' : undefined}
            onClick={onClose}
          >
            {hasIconClose ? (
              <span aria-hidden="true" style={{ maskImage: `url("${fhAsset('welcome-guides/close.svg')}")` }} />
            ) : 'Cerrar'}
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
