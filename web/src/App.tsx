import { useState } from 'react'
import { nativeRequest } from './nativeBridge'
import ConsentimientoModal from './components/ConsentimientoModal'
import PantallaChat from './screens/PantallaChat'
import PantallaRegistro from './screens/PantallaRegistro'
import type { Registration } from './types'

const REGISTRATION_KEY = 'palmera-web-registration'

function consentKey(registration: Registration): string {
  return `${REGISTRATION_KEY}:consent:${registration.registration_id}`
}

function loadConsent(registration: Registration | null): boolean {
  if (!registration) return false
  try {
    return localStorage.getItem(consentKey(registration)) === '1'
  } catch {
    return false
  }
}

function loadRegistration(): Registration | null {
  try {
    const raw = localStorage.getItem(REGISTRATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Registration>
    if (
      typeof parsed.registration_id === 'string' &&
      parsed.registration_id.length > 0 &&
      typeof parsed.nombre === 'string' &&
      (parsed.pais === 'AR' || parsed.pais === 'BO')
    ) {
      return parsed as Registration
    }
    return null
  } catch {
    return null
  }
}

export default function App() {
  const [registration, setRegistration] = useState<Registration | null>(loadRegistration)
  const [consent, setConsent] = useState(() => loadConsent(registration))
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)

  const handleAcceptConsent = () => {
    if (!registration) return
    try {
      localStorage.setItem(consentKey(registration), '1')
    } catch {
      // Si el navegador bloquea el almacenamiento, la aceptación dura esta sesión.
    }
    setConsent(true)
  }

  const handleRegistered = (reg: Registration) => {
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify(reg))
    setLogoutMessage(null)
    setConsent(loadConsent(reg))
    setRegistration(reg)
  }

  const handleLogout = (message?: string) => {
    // Se conserva la aceptación de cada registro para futuros ingresos.
    void nativeRequest('session.logout').catch(() => undefined)
    localStorage.removeItem(REGISTRATION_KEY)
    setConsent(false)
    setRegistration(null)
    setLogoutMessage(message ?? null)
  }

  if (!registration) {
    return <PantallaRegistro onRegistered={handleRegistered} initialError={logoutMessage} />
  }

  if (!consent) {
    return <ConsentimientoModal onAccept={handleAcceptConsent} />
  }

  return <PantallaChat registration={registration} onLogout={handleLogout} onRegistrationUpdated={handleRegistered} />
}
