export const WELCOME_STEPS = [
  {
    section: 'guides',
    title: 'Guías y recursos',
    description: 'Accedé a guías actualizadas y contenido validado para la atención clínica.',
  },
  {
    section: 'consultation',
    title: 'Orientación clínica',
    description: 'Realizá consultas y accedé a recomendaciones basadas en evidencia.',
  },
  {
    section: 'profile',
    title: 'Perfil y configuración',
    description: 'Gestioná los datos de tu perfil en la aplicación.',
  },
] as const
export const WELCOME_DESCRIPTION =
  'Esta plataforma es una herramienta de apoyo a la decisión clínica creada exclusivamente para asistir al personal de salud en la detección temprana y el abordaje integral de infecciones de transmisión sexual. En esta etapa del desarrollo los contenidos abordados son específicamente VIH y Sífilis.'

export function shouldShowWelcome(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'true'
  } catch {
    return true
  }
}
