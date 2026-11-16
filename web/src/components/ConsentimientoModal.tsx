import { fhAsset } from '../fh/content'
import './TerminosDesktop.css'

interface ConsentimientoModalProps {
  onAccept: () => void
}

export default function ConsentimientoModal({ onAccept }: ConsentimientoModalProps) {
  return (
    <main className="terms-desktop" aria-labelledby="terms-desktop-title">
      <img className="terms-desktop__brand" src={fhAsset('terms/brand.svg')} width={231} height={105} alt="InfectoAssist" />
      <h1 id="terms-desktop-title" className="terms-desktop__title">Cómo usar esta plataforma</h1>
      <div className="terms-desktop__copy">
        <p>
          La presente herramienta digital basada en inteligencia artificial se encuentra
          en fase de prueba piloto. Las respuestas que brinda son experimentales y pueden
          contener errores o imprecisiones.
        </p>
        <p>
          El uso de la aplicación durante esta etapa está limitado al marco del estudio
          piloto. Los y las participantes se comprometen a no considerar las respuestas
          como conocimiento clínico definitivo ni a utilizarlas como sustituto de
          protocolos médicos validados.
        </p>
        <p>
          Al aceptar este aviso, usted reconoce que la aplicación está sometida a
          evaluación y que su uso tiene fines de prueba y retroalimentación, sin
          constituir una guía médica oficial.
        </p>
      </div>

        <button
          type="button"
          onClick={onAccept}
          className="terms-desktop__accept"
        >
          <span>Aceptar y continuar →</span>
        </button>
    </main>
  )
}
