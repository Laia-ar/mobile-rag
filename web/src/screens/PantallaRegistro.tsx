import { useState } from 'react'
import { ConsultaError, registrar } from '../api'
import { PROVINCIA_LABEL, PROVINCIAS } from '../data/provincias'
import type { Country, Registration } from '../types'
import { fhAsset } from '../fh/content'
import './LoginDesktop.css'

interface PantallaRegistroProps {
  onRegistered: (registration: Registration) => void
  initialError: string | null
}

const COUNTRIES: { id: Country; name: string }[] = [
  { id: 'AR', name: 'Argentina' },
  { id: 'BO', name: 'Bolivia' },
]

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function PantallaRegistro({ onRegistered, initialError }: PantallaRegistroProps) {
  const [nombre, setNombre] = useState('')
  const [mail, setMail] = useState('')
  const [mailTouched, setMailTouched] = useState(false)
  const [pais, setPais] = useState<Country | null>(null)
  const [provincia, setProvincia] = useState('')
  const [efector, setEfector] = useState('')
  const [disciplina, setDisciplina] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [submitting, setSubmitting] = useState(false)
  const mailInvalid = !MAIL_RE.test(mail.trim())
  const showMailError = mailTouched && mailInvalid

  const handlePaisChange = (next: Country) => {
    setPais(next)
    setProvincia('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    if (!nombre.trim()) return setError('Ingresá tu nombre.')
    if (mailInvalid) {
      setMailTouched(true)
      return
    }
    if (!pais) return setError('Elegí tu país para continuar.')
    if (!provincia) return setError(`Elegí tu ${PROVINCIA_LABEL[pais].toLowerCase()}.`)
    if (!efector.trim()) return setError('Ingresá tu efector de salud.')
    if (!disciplina.trim()) return setError('Ingresá tu disciplina o especialidad.')

    setError(null)
    setSubmitting(true)
    try {
      const registration = await registrar({
        nombre: nombre.trim(),
        mail: mail.trim(),
        pais,
        provincia,
        efector: efector.trim(),
        disciplina: disciplina.trim(),
        consent_aceptado: true,
      })
      onRegistered(registration)
    } catch (err) {
      setError(
        err instanceof ConsultaError && err.status !== 0
          ? 'No se pudo completar el registro. Revisá los datos e intentá de nuevo.'
          : 'No se pudo conectar con el servidor. Probá de nuevo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = Boolean(
    nombre.trim() && MAIL_RE.test(mail.trim()) && pais && provincia && efector.trim() && disciplina.trim(),
  )

  return (
    <main className="login-desktop" aria-labelledby="login-desktop-title">
      <div className="login-desktop__frame" aria-hidden="true" />
      <div className="login-desktop__panel" aria-hidden="true" />
      <img
        className="login-desktop__brand"
        src={fhAsset('brand/login.jpg')}
        width={500}
        height={253}
        alt="InfectoAsist"
      />
      <p className="login-desktop__description">
        Información actualizada y basada en evidencia para la atención en enfermedades infecciosas
        orientada a personal de salud
      </p>
      <section className="login-desktop__content" aria-labelledby="login-desktop-title">
        <h1 id="login-desktop-title" className="login-desktop__title">
          Ingresá tus datos para empezar
        </h1>

        <form
          className="login-desktop__form"
          onSubmit={handleSubmit}
          aria-describedby="login-desktop-required"
        >
          <div className="login-desktop__fields">
            <div className="login-desktop__field login-desktop__field--name">
              <label htmlFor="reg-nombre">Nombre *</label>
              <input
                id="reg-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="name"
                aria-required="true"
                className="login-desktop__control"
              />
            </div>

            <div className="login-desktop__field login-desktop__field--mail">
              <label htmlFor="reg-mail">Mail *</label>
              <input
                id="reg-mail"
                type="email"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                onBlur={() => setMailTouched(true)}
                placeholder="nombre@ejemplo.com"
                autoComplete="email"
                aria-required="true"
                aria-invalid={showMailError}
                aria-describedby={showMailError ? 'reg-mail-error' : undefined}
                className="login-desktop__control"
              />
              {showMailError && (
                <p id="reg-mail-error" className="login-desktop__mail-error" role="alert">
                  Ingrese un mail válido
                </p>
              )}
            </div>

            <div className="login-desktop__field login-desktop__field--country">
              <label htmlFor="reg-pais">País *</label>
              <div className="login-desktop__select-wrapper">
                <img
                  className="login-desktop__country-chevron"
                  src={fhAsset('login/country-chevron.svg')}
                  width={13.8564}
                  height={12}
                  alt=""
                  aria-hidden="true"
                />
                <select
                  id="reg-pais"
                  value={pais ?? ''}
                  onChange={(e) => handlePaisChange(e.target.value as Country)}
                  aria-required="true"
                  className="login-desktop__control login-desktop__select"
                >
                  <option value="" disabled>Selecciona</option>
                  {COUNTRIES.map((country) => (
                    <option key={country.id} value={country.id}>{country.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="login-desktop__field login-desktop__field--province">
              <label htmlFor="reg-provincia">{pais ? PROVINCIA_LABEL[pais] : 'Provincia'} *</label>
              <select
                id="reg-provincia"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                disabled={!pais}
                aria-required="true"
                className={`login-desktop__control login-desktop__select ${!provincia ? 'login-desktop__control--placeholder' : ''}`}
              >
                <option value="">{pais === 'BO' ? 'Seleccioná una opción' : 'Ej: Buenos Aires'}</option>
                {pais && PROVINCIAS[pais].map((province) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </div>

            <div className="login-desktop__field login-desktop__field--efector">
              <label htmlFor="reg-efector">Efector de salud *</label>
              <input
                id="reg-efector"
                type="text"
                value={efector}
                onChange={(e) => setEfector(e.target.value)}
                placeholder="Hospital, centro de salud,etc"
                aria-required="true"
                className="login-desktop__control"
              />
            </div>

            <div className="login-desktop__field">
              <label htmlFor="reg-disciplina">Disciplina/especialidad *</label>
              <input
                id="reg-disciplina"
                type="text"
                value={disciplina}
                onChange={(e) => setDisciplina(e.target.value)}
                placeholder="Ej: Medicina general"
                aria-required="true"
                className="login-desktop__control"
              />
            </div>
          </div>

          <p id="login-desktop-required" className="login-desktop__required">* Datos obligatorios</p>
          {error && <p className="login-desktop__error" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="login-desktop__submit"
          >
            {submitting ? 'Registrando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}
