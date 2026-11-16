import Modal from './Modal'
import { fhAsset } from './content'
import { sourceKey } from './savedSources'
import type { Source } from '../types'

type SourceDialogState =
  | { kind: 'sources'; sources: Source[] }

export default function ChatSourceDialog({
  state, onClose, onSelect, error,
}: {
  state: SourceDialogState
  onClose: () => void
  onSelect: (source: Source) => void
  error: string | null
}) {
  return (
    <Modal title="Fuentes de la respuesta" variant="chat-sources" onClose={onClose}>
      <p className="fh-chat-dialog-meta fh-chat-source-count">
        {state.sources.length} {state.sources.length === 1 ? 'documento citado' : 'documentos citados'}
      </p>
      <div className="fh-chat-sources-list">
        {state.sources.map((source, index) => (
          <div className="fh-chat-source-entry" key={`${sourceKey(source)}-${index}`}>
            <button
              type="button"
              className="fh-chat-source-row"
              onClick={() => onSelect(source)}
            >
              <span className="fh-chat-source-number">{index + 1}</span>
              <span className="fh-chat-source-row-body">
                <strong>{source.title}</strong>
                {source.page != null && <small>
                  <img src={fhAsset(`chat/${index === 0 ? 'book-first.svg' : 'book-list.svg'}`)} alt="" />
                  <span>Página {source.page}</span>
                </small>}
              </span>
              <img className="fh-chat-source-row-arrow" src={fhAsset('chat/row-arrow.svg')} alt="" />
              {index < state.sources.length - 1 && <img className="fh-chat-row-rule" src={fhAsset('chat/row-rule.svg')} alt="" />}
            </button>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="fh-error">{error}</p>}
    </Modal>
  )
}
