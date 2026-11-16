import { useRef, useState, type FormEvent } from 'react'
import { actualizarPerfil, ConsultaError } from '../api'
import { fhAsset } from './content'
import type { Country, ProfilePayload, Registration } from '../types'

const COUNTRIES: Record<Country, string> = { AR: 'Argentina', BO: 'Bolivia' }

export default function ProfileDesktop({ registration, onUpdated }: {
  registration: Registration
  onUpdated: (registration: Registration) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfilePayload>(registration)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const firstField = useRef<HTMLInputElement>(null)

  const closeEditor = () => {
    setEditing(false)
    setError(null)
    requestAnimationFrame(() => editButton.current?.focus())
  }
  const update = (field: keyof ProfilePayload, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }))
    setError(null)
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError(null)
    try {
      const updated = await actualizarPerfil(registration.registration_id, {
        nombre: draft.nombre.trim(), mail: draft.mail.trim(), pais: draft.pais,
        provincia: draft.provincia.trim(), efector: draft.efector.trim(), disciplina: draft.disciplina.trim(),
      })
      onUpdated(updated)
      closeEditor()
    } catch (reason) {
      setError(reason instanceof ConsultaError && reason.status === 0
        ? 'No se pudo conectar con el servidor. Los cambios no se guardaron.'
        : reason instanceof ConsultaError && (reason.status === 405 || (reason.status === 404 && reason.message === 'Not Found'))
          ? 'El servidor todavía no admite la edición de perfil. Los cambios no se guardaron.'
          : reason instanceof ConsultaError && reason.status === 409
            ? 'Ya existe un registro con ese mail y país.'
            : reason instanceof ConsultaError && reason.status === 404
              ? 'No se encontró tu registro. Los cambios no se guardaron.'
              : 'No se pudieron guardar los cambios. Intentá nuevamente.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return <div className={`fh-scroll fh-profile-panel${editing ? ' fh-profile-editing' : ''}`}>
    <section className="fh-profile-summary" aria-label={editing ? 'Editar perfil' : 'Datos del perfil'}>
      <header className="fh-profile-identity">
        <div><h2>{registration.nombre}</h2><p>{registration.mail}</p></div>
        {!editing && <button ref={editButton} type="button" className="fh-profile-edit-button" onClick={() => {
          setDraft({ nombre: registration.nombre, mail: registration.mail, pais: registration.pais,
            provincia: registration.provincia, efector: registration.efector, disciplina: registration.disciplina })
          setError(null)
          setEditing(true)
          requestAnimationFrame(() => firstField.current?.focus())
        }}>Editar</button>}
      </header>
      {editing ? <form onSubmit={submit} aria-label="Editar datos del perfil" aria-busy={saving}>
        <fieldset disabled={saving} className="fh-profile-fields">
          <label>Nombre *<input ref={firstField} name="nombre" autoComplete="name" value={draft.nombre} onChange={e => update('nombre', e.target.value)} required maxLength={120} /></label>
          <label>Mail *<input name="mail" type="email" autoComplete="email" value={draft.mail} onChange={e => update('mail', e.target.value)} required /></label>
          <label>País *<span className="fh-profile-country"><select name="pais" value={draft.pais} onChange={e => {
            setDraft(previous => ({ ...previous, pais: e.target.value as Country, provincia: '' }))
            setError(null)
          }} required>{Object.entries(COUNTRIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="fh-profile-country-arrow" style={{ backgroundImage: `url("${fhAsset('profile/edit-original.png')}")` }} aria-hidden="true" /></span></label>
          <label>Provincia *<input name="provincia" value={draft.provincia} onChange={e => update('provincia', e.target.value)} required maxLength={80} /></label>
          <label>Efector de salud *<input name="efector" value={draft.efector} onChange={e => update('efector', e.target.value)} required maxLength={160} /></label>
          <label>Disciplina/especialidad *<input name="disciplina" value={draft.disciplina} onChange={e => update('disciplina', e.target.value)} required maxLength={120} /></label>
        </fieldset>
        {error && <p role="alert" className="fh-profile-save-error">{error}</p>}
        <div className="fh-profile-edit-actions">
          <button type="button" className="fh-profile-cancel" disabled={saving} onClick={closeEditor}>Cancelar</button>
          <button type="submit" className="fh-profile-save" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form> : <dl>{[
        ['País', COUNTRIES[registration.pais]], ['Provincia', registration.provincia],
        ['Efector de salud', registration.efector], ['Disciplina/especialidad', registration.disciplina],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'No informado'}</dd></div>)}</dl>}
    </section>

  </div>
}
