import { useEffect, useRef, useState, type ReactNode } from 'react'
import { consultar, obtenerDocumentos, ConsultaError } from '../api'
import FeedbackControls from '../components/FeedbackControls'
import ProfileDesktop from '../fh/ProfileDesktop'
import Modal from '../fh/Modal'
import ChatSourceDialog from '../fh/ChatSourceDialog'
import { openPdf } from '../fh/openPdf'
import { uniqueGuides } from '../fh/uniqueGuides'
import WelcomeTour from '../fh/WelcomeTour'
import { WELCOME_DESCRIPTION, WELCOME_STEPS, shouldShowWelcome } from '../fh/welcomeState'
import { normalizeSearch } from '../fh/search'
import { fhAsset, INTERACTIONS_URL, RECOMMENDATIONS, RESPONSIBLE_USE } from '../fh/content'
import { sourceKey } from '../fh/savedSources'
import Markdown from '../fh/Markdown'
import '../nativeBridge'
import { answerForDisplay } from '../fh/answerPresentation'
import type { ChatMessage, HistoryMessage, Registration, Source } from '../types'
import '../fh/fh.css'
import '../fh/WelcomeDesktop.css'
import '../fh/ConsultationDesktop.css'
import '../fh/RecommendationsDesktop.css'
import '../fh/ChatbotDesktop.css'
import '../fh/ProfileDesktop.css'

type Screen =
  | 'welcome'
  | 'consultation'
  | 'chat'
  | 'recommendations'
  | 'guides'
  | 'profile'
type ActiveModal =
  | { kind: 'external' }
  | { kind: 'sources'; sources: Source[] }
interface ConsultaPayload {
  registration_id: string
  question: string
  history: HistoryMessage[]
}
interface Props {
  registration: Registration
  onLogout: (message?: string) => void
  onRegistrationUpdated: (registration: Registration) => void
}
const NAVIGATION = [
  { id: 'guides', label: 'Guías' },
  { id: 'consultation', label: 'Consulta' },
  { id: 'profile', label: 'Perfil' },
] as const
const WELCOME_NAVIGATION_ASSETS = {
  guides: { active: 'guides.svg', inactive: 'guides-inactive.svg' },
  consultation: { active: 'consultation-active.svg', inactive: 'consultation.svg' },
  profile: { active: 'profile-active.svg', inactive: 'profile.svg' },
} as const
const TITLES: Record<Screen, string> = {
  welcome: 'Bienvenidx',
  consultation: 'Consulta',
  chat: 'Chatbot',
  recommendations: 'Recomendaciones',
  guides: 'Guías y documentos',
  profile: 'Perfil',
}
function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function renderRecommendationText(body: string, emphasis: readonly string[]): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = body
  for (const phrase of emphasis) {
    const start = remaining.indexOf(phrase)
    if (start < 0) continue
    parts.push(remaining.slice(0, start))
    parts.push(<strong key={phrase}>{phrase}</strong>)
    remaining = remaining.slice(start + phrase.length)
  }
  parts.push(remaining)
  return parts
}
function SourceRow({
  source,
  index,
  onClick,
}: {
  source: Source
  index: number
  onClick: () => void
}) {
  return (
    <button type="button" className="fh-source-row" onClick={onClick}>
      <span className="fh-source-number">{index + 1}</span>
      <span className="fh-source-row-body">
        <strong>{source.title}</strong>
        {source.page != null && <small>Página {source.page}</small>}
      </span>
      <img src={fhAsset('source-arrow.svg')} alt="" />
    </button>
  )
}

export default function PantallaChat({ registration, onLogout, onRegistrationUpdated }: Props) {
  const welcomeKey = `palmera-web-welcome:${registration.registration_id}`
  const [screen, setScreen] = useState<Screen>(() =>
    shouldShowWelcome(welcomeKey) ? 'welcome' : 'consultation'
  )
  const [tourStep, setTourStep] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [retryPayload, setRetryPayload] = useState<ConsultaPayload | null>(null)
  const [modal, setModal] = useState<ActiveModal | null>(null)
  const [noticeVisible, setNoticeVisible] = useState(true)
  const [guideNoticeVisible, setGuideNoticeVisible] = useState(true)
  const [query, setQuery] = useState('')
  const [catalog, setCatalog] = useState<Source[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const requestPending = useRef(false)
  const sessionActive = useRef(true)

  useEffect(() => {
    sessionActive.current = true
    return () => {
      sessionActive.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setCatalogStatus('loading')
    obtenerDocumentos(registration.registration_id, controller.signal).then(documents => {
      if (controller.signal.aborted) return
      setCatalog(documents.map(document => ({
        document_id: document.document_id,
        title: document.title,
        page: null,
        content_preview: document.description ?? '',
        pdf_available: document.pdf_available,
      })))
      setCatalogStatus('ready')
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogStatus('error')
    })
    return () => controller.abort()
  }, [registration.registration_id, registration.pais, catalogAttempt])

  useEffect(() => {
    headingRef.current?.focus()
  }, [screen])
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const resize = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    resize()
    let lastWidth = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return
      lastWidth = el.clientWidth
      resize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [input, screen])
  useEffect(() => {
    if (screen === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending, screen])

  useEffect(() => {
    window.__palmeraBack = () => {
      if (modal) { setModal(null); return true }
      if (screen !== 'consultation' && screen !== 'welcome') { setScreen('consultation'); return true }
      return false
    }
    return () => { delete window.__palmeraBack }
  }, [screen, modal])

  const activeSection =
    screen === 'welcome'
      ? WELCOME_STEPS[tourStep].section
      : ['chat', 'recommendations'].includes(screen)
      ? 'consultation'
      : screen
  const visibleSources = catalog.filter((source) =>
    normalizeSearch(`${source.title} ${source.content_preview}`).includes(normalizeSearch(query))
  )
  const finishWelcome = () => {
    try {
      localStorage.setItem(welcomeKey, 'true')
    } catch {
      /* The current session can finish even if browser storage is unavailable. */
    }
    setScreen('consultation')
  }
  const selectScreen = (next: Screen) => {
    setQuery('')
    setScreen(next)
  }
  const openSource = (source: Source) => {
    setPdfError(null)
    void openPdf(registration.registration_id, source).catch((error: Error) => {
      if (sessionActive.current) setPdfError(error.message)
    })
  }

  const performRequest = async (payload: ConsultaPayload) => {
    if (requestPending.current) return
    requestPending.current = true
    setSending(true)
    setErrorBanner(null)
    const answerId = newId()
    try {
      const res = await consultar(payload, partial => {
        if (!sessionActive.current) return
        setMessages(prev => {
          const message: ChatMessage = {id: answerId, role: 'assistant', content: partial.answer, sources: partial.sources, hasContext: partial.sources.length > 0}
          return prev.some(item => item.id === answerId) ? prev.map(item => item.id === answerId ? message : item) : [...prev, message]
        })
      })
      if (!sessionActive.current) return
      setMessages((prev) => [
        ...prev.filter(item => item.id !== answerId),
        {
          id: answerId,
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          hasContext: res.has_context,
          latencyMs: res.latency_ms,
          modelName: res.model_name,
          logId: res.log_id,
        },
      ])
      setRetryPayload(null)
    } catch (error) {
      if (!sessionActive.current) return
      if (error instanceof ConsultaError && error.status === 404) {
        onLogout('No encontramos tu registro. Completá el formulario nuevamente.')
        return
      }
      setErrorBanner(
        error instanceof ConsultaError && error.status === 503
          ? 'El corpus de ese país no está disponible todavía.'
          : error instanceof ConsultaError && error.status === 400
          ? 'El modelo seleccionado no está habilitado.'
          : 'Ocurrió un error al generar la respuesta. Probá de nuevo.'
      )
      setRetryPayload(payload)
    } finally {
      requestPending.current = false
      if (sessionActive.current) setSending(false)
    }
  }
  const handleSend = () => {
    const question = input.trim()
    if (!question || requestPending.current) return
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }))
    setInput('')
    setNoticeVisible(false)
    setMessages((prev) => [...prev, { id: newId(), role: 'user', content: question }])
    void performRequest({ registration_id: registration.registration_id, question, history })
  }

  const isWelcome = screen === 'welcome'
  const isRecommendations = screen === 'recommendations'
  const isChat = screen === 'chat'
  const isProfile = screen === 'profile'
  const hasConsultationLayout = screen === 'consultation' || isRecommendations || isChat || isProfile
  const desktopAssetFolder = isProfile ? 'profile' : isChat ? 'chat' : isRecommendations ? 'recommendations' : 'consultation'

  return (
    <div className={`fh-workspace${isWelcome ? ' fh-welcome-desktop' : hasConsultationLayout ? ' fh-consultation-desktop' : ''}${isRecommendations ? ' fh-recommendations-desktop' : isChat ? ' fh-chat-desktop' : isProfile ? ' fh-profile-desktop' : ''}`}   data-onboarding={screen === 'welcome' ? 'true' : undefined}>
      <aside className="fh-sidebar">
        <div className="fh-logo">
          <img src={fhAsset('brand/sidebar.jpg')} width={684} height={150} alt="InfectoAsist" />
        </div>
        <nav className="fh-nav" aria-label="Navegación principal">
          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              type="button"
              className="fh-nav-button"
              aria-pressed={activeSection === item.id}
              onClick={() =>
                screen === 'welcome'
                  ? setTourStep(NAVIGATION.findIndex((section) => section.id === item.id))
                  : selectScreen(item.id)
              }
            >
              <span className="fh-nav-icon">
                <img
                  src={fhAsset(
                    hasConsultationLayout
                      ? isProfile && item.id === 'profile' ? 'profile-active.svg' : isProfile && item.id === 'consultation' ? 'welcome-guides/consultation.svg' : `${desktopAssetFolder}/${item.id}.svg`
                      : isWelcome
                      ? `welcome-guides/${WELCOME_NAVIGATION_ASSETS[item.id][activeSection === item.id ? 'active' : 'inactive']}`
                      : `${item.id}-${activeSection === item.id ? 'active' : 'inactive'}.svg`
                  )}
                  alt=""
                />
              </span>
              {isWelcome || hasConsultationLayout ? <span className={isWelcome ? "fh-welcome-nav-label" : "fh-consultation-nav-label"}>{item.label}</span> : item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="fh-sidebar-logout"
          onClick={() => onLogout()}
        >
          <img src={fhAsset('logout.svg')} alt="" />
          <span>Salir</span>
        </button>
      </aside>
      <main className="fh-main">
        <section className="fh-page" aria-labelledby="fh-page-title">
          <header className="fh-heading">
            <div className="fh-heading-row">
              {['chat', 'recommendations'].includes(screen) && (
                <button
                  type="button"
                  aria-label="Volver a Consulta"
                  className="fh-back"
                  onClick={() => selectScreen('consultation')}
                >
                  <img src={fhAsset(isChat ? 'chat/back.svg' : isRecommendations ? 'recommendations/back.svg' : 'recommendations/back.png')} alt="" />
                </button>
              )}
              <h1 id="fh-page-title" ref={headingRef} tabIndex={-1}>
                {TITLES[screen]}
              </h1>
            </div>
            {screen === 'welcome' && (
              <p className="fh-welcome-description">{WELCOME_DESCRIPTION}</p>
            )}
            {screen === 'consultation' && (
              <p className="fh-subtitle">Herramientas disponibles para uso del personal:</p>
            )}
            {screen === 'chat' && (
              <p className="fh-subtitle">
                Encontrá información para acompañar tu práctica clínica.
              </p>
            )}
            {screen === 'recommendations' && (
              <p className="fh-subtitle">
                Algunas recomendaciones para el abordaje integral en las consultas en salud.
              </p>
            )}
          </header>

          {screen === 'consultation' && (
            <div className="fh-scroll">
              <div className="fh-home">
                <button
                  type="button"
                  className="fh-card fh-card-main"
                  onClick={() => selectScreen('chat')}
                >
                  <span className="fh-card-icon" aria-hidden="true">
                    <img src={fhAsset('consultation/chatbot-outline.svg')} alt="" />
                  </span>
                  <h2>Chatbot</h2>
                  <p>Consulta directa</p>
                </button>
                <button
                  type="button"
                  className="fh-card fh-card-recommendations"
                  onClick={() => selectScreen('recommendations')}
                >
                  <span className="fh-card-icon">
                    <img src={fhAsset('consultation/recommendations.svg')} alt="" />
                  </span>
                  <h2>Recomendaciones</h2>
                  <p>Buenas prácticas para una consulta integral</p>
                </button>
                <button
                  type="button"
                  className="fh-card fh-card-external"
                  onClick={() => setModal({ kind: 'external' })}
                >
                  <span className="fh-card-icon">
                    <img src={fhAsset('consultation/external-link.svg')} alt="" />
                  </span>
                  <h2>
                    Guía: interacciones
                    <br />
                    entre medicación
                  </h2>
                  <span className="fh-external-url">interaccioneshiv.huesped.org.ar</span>
                </button>
              </div>
            </div>
          )}

          {screen === 'recommendations' && (
            <div className="fh-scroll">
              <div className="fh-recommendations">
                {RECOMMENDATIONS.map((item) => (
                  <article key={item.title} className="fh-recommendation">
                    <h2>
                      <span
                        className={`fh-recommendation-icon fh-recommendation-icon-${item.icon}`}
                        style={{ backgroundImage: `url("${fhAsset('recommendations/icons-original.png')}")` }}
                        aria-hidden="true"
                      />
                      {item.title}
                    </h2>
                    <p>{renderRecommendationText(item.body, item.emphasis)}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {isProfile && (
            <ProfileDesktop registration={registration} onUpdated={onRegistrationUpdated} />
          )}

          {screen === 'guides' && (
            <div className="fh-scroll">
              {guideNoticeVisible && (
                <aside className="fh-notice">
                  <h2>GUÍAS CLÍNICAS DISPONIBLES</h2>
                  <p>{RESPONSIBLE_USE}</p>
                  <button type="button" onClick={() => setGuideNoticeVisible(false)}>
                    Entendido
                  </button>
                </aside>
              )}
              <input
                type="search"
                aria-label="Buscar en las guías"
                className="fh-search"
                placeholder="Buscar en las guías"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="fh-library">
                {visibleSources.map((source, index) => (
                  <SourceRow
                    key={sourceKey(source)}
                    source={source}
                    index={index}
                    onClick={() => openSource(source)}
                  />
                ))}
              </div>
              {catalogStatus === 'loading' && <p role="status">Cargando catálogo…</p>}
              {catalogStatus === 'error' && <div role="alert" className="fh-error">
                <p>No se pudo cargar el catálogo del backend.</p>
                <button className="fh-button" onClick={() => setCatalogAttempt(value => value + 1)}>Reintentar catálogo</button>
              </div>}
              {visibleSources.length === 0 && catalogStatus === 'ready' && (
                <p className="fh-empty">
                  {query
                    ? 'No se encontraron resultados.'
                    : 'El corpus asignado no tiene documentos disponibles.'}
                </p>
              )}
            </div>
          )}

          {screen === 'chat' && (
            <>
              <div className="fh-scroll fh-chat-scroll" aria-busy={sending}>
                {noticeVisible && (
                  <aside className="fh-notice">
                    <h2>Uso responsable de la herramienta</h2>
                    <p>{RESPONSIBLE_USE.replace('disponible. Las', 'disponible.\nLas')}</p>
                    <button type="button" onClick={() => setNoticeVisible(false)}>
                      Entendido
                    </button>
                  </aside>
                )}
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <div key={message.id} className="fh-message fh-message-user">
                      {message.content}
                    </div>
                  ) : (
                    <article key={message.id} className="fh-message">
                      <div className="fh-answer"><Markdown>{answerForDisplay(message.content, message.sources ?? [])}</Markdown></div>
                      {message.hasContext !== false && !!message.sources?.length && (
                        <div className="fh-message-sources">
                          {uniqueGuides(message.sources).map((source, index) => (
                            <button
                              key={`${sourceKey(source)}-${index}`}
                              type="button"
                              className="fh-source-chip"
                              onClick={() => openSource(source)}
                            >
                              {index + 1}. {source.title}
                              {source.page != null ? ` · pág. ${source.page}` : ''}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="fh-text-button"
                            onClick={() =>
                              setModal({ kind: 'sources', sources: uniqueGuides(message.sources ?? []) })
                            }
                          >
                            Ver todas las fuentes
                          </button>
                        </div>
                      )}
                      {message.logId && (
                        <FeedbackControls
                          logId={message.logId}
                          registrationId={registration.registration_id}
                        />
                      )}
                    </article>
                  )
                )}
                {sending && (
                  <p role="status" className="fh-loading">
                    Generando respuesta…
                  </p>
                )}
                <div ref={bottomRef} />
              </div>
              {errorBanner && (
                <div role="alert" className="fh-error">
                  {errorBanner}
                  <button
                    type="button"
                    disabled={sending || !retryPayload}
                    onClick={() => {
                      if (retryPayload) void performRequest(retryPayload)
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              )}
              <form
                className="fh-composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleSend()
                }}
              >
                <textarea
                  ref={textareaRef}
                  aria-label="Escribí tu consulta"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Escribí tu consulta abajo y el chatbot responderá basado en las guías cargadas."
                  rows={1}
                  maxLength={1000}
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="fh-send"
                  aria-label="Enviar consulta"
                  disabled={sending || !input.trim()}
                >
                  <img src={fhAsset('chat/send.svg')} alt="" />
                </button>
              </form>
            </>
          )}
        </section>
      </main>
      {modal?.kind !== 'sources' && pdfError && (
        <div role="alert" className="fh-error">
          {pdfError}
          <button type="button" className="fh-text-button" onClick={() => setPdfError(null)}>Cerrar aviso</button>
        </div>
      )}

      {screen === 'welcome' && (
        <WelcomeTour
          step={tourStep}
          onFinish={finishWelcome}
          onNext={() =>
            tourStep < WELCOME_STEPS.length - 1
              ? setTourStep((value) => value + 1)
              : finishWelcome()
          }
        />
      )}
      {modal?.kind === 'sources' && (
        <ChatSourceDialog
          key="sources"
          state={modal}
          onClose={() => setModal(null)}
          onSelect={openSource}
          error={pdfError}
        />
      )}
      {modal && modal.kind !== 'sources' && (
        <Modal
          variant={modal.kind === 'external' ? 'external' : 'default'}
          title="Vas a salir de la aplicación"
          onClose={() => setModal(null)}
        >
          {modal.kind === 'external' && (
            <div className="fh-external-body">
              <p id="fh-external-description" className="fh-external-description">
                La <strong>Guía de Interacciones en medicación</strong> es un sitio web externo de Fundación Huésped.
              </p>
              <p className="fh-external-destination">{INTERACTIONS_URL}</p>
              <div className="fh-external-actions">
                <button type="button" className="fh-button" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <a
                  className="fh-button fh-button-primary"
                  href={INTERACTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setModal(null)}
                >
                  Continuar al sitio
                </a>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
