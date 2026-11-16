import { fhAsset } from './content'
import { WELCOME_STEPS } from './welcomeState'

const PAGINATION_ASSETS = [
  'pagination.svg',
  'pagination-consultation.svg',
  'pagination-profile.svg',
] as const

export default function WelcomeTour({
  step,
  onNext,
  onFinish,
}: {
  step: number
  onNext: () => void
  onFinish: () => void
}) {
  const item = WELCOME_STEPS[step]
  const isLastStep = step === WELCOME_STEPS.length - 1
  return (
    <section
      className={`fh-tour fh-tour-step-${step}`}
      aria-label={`Recorrido de bienvenida, paso ${step + 1} de ${WELCOME_STEPS.length}`}
    >
      <img
        className="fh-tour-pointer"
        src={fhAsset(`welcome-guides/${step === 1 ? 'pointer-consultation.svg' : 'pointer.svg'}`)}
        alt=""
      />
      <button
        type="button"
        className="fh-tour-close"
        aria-label="Cerrar recorrido"
        onClick={onFinish}
      >
        <img src={fhAsset('welcome-guides/close.svg')} alt="" />
      </button>
      <div aria-live="polite">
        <h2>{item.title}</h2>
        <p>{item.description}</p>
      </div>
      <footer>
        <div className="fh-tour-dots" aria-hidden="true">
          <img src={fhAsset(`welcome-guides/${PAGINATION_ASSETS[step]}`)} alt="" />
        </div>
        <button type="button" className="fh-tour-next" onClick={onNext}>
          <span className="fh-tour-next-label">{isLastStep ? 'Finalizar' : 'Siguiente'}</span>
          <img src={fhAsset('welcome-guides/next.svg')} alt="" />
        </button>
      </footer>
    </section>
  )
}
