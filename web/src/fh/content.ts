import assets from 'virtual:palmera-assets'

// Copy and public URL from the final FH screens (Figma 249:318).
export const RESPONSIBLE_USE =
  'InfectoAssist brinda orientación basada en información validada y evidencia disponible. Las respuestas funcionan como apoyo para la práctica clínica y no reemplazan el juicio profesional, el diagnóstico ni la indicación de tratamientos.'
export const INTERACTIONS_URL = 'https://interaccioneshiv.huesped.org.ar/'
export const fhAsset = (path: string) => assets[`fh/${path}`] ?? ''
export const RECOMMENDATIONS = [
  {
    title: 'Nombre y pronombre',
    icon: 'person',
    emphasis: ['nombre o pronombre', 'Evitá asumir o presuponer.'],
    body: 'Preguntá el nombre o pronombre con el que la persona se identifica y, si ocurre una\nequivocación, disculpate. Ante dudas, es preferible nombrarla por el apellido y luego, en privado,\npreguntar y aclarar. Evitá asumir o presuponer.',
  },
  {
    title: 'Prácticas, no identidad',
    icon: 'practices',
    emphasis: ['prácticas sexuales', 'Preguntá y no asumas.'],
    body: 'Para evaluar ITS, centrate en las prácticas sexuales y no en la identidad de género u orientación sexual. Intervení de forma libre de prejuicios, favoreciendo un ámbito de confianza. Preguntá y no asumas.',
  },
  {
    title: 'Explicá el porqué',
    icon: 'reason',
    emphasis: ['aclarar el fundamento'],
    body: 'Al preguntar sobre determinados aspectos —por ejemplo, el inicio o el tipo de relaciones sexuales — es importante aclarar el fundamento que origina esa pregunta.',
  },
  {
    title: 'Respetá la intimidad',
    icon: 'privacy',
    emphasis: ['lo relevante para la consulta', 'Respetá'],
    body: 'Abordá sólo lo relevante para la consulta, evitando indagar sobre cuestiones que invadan la intimidad sin necesidad (como el nombre de nacimiento o intervenciones sobre el cuerpo sin motivo). Respetá si la persona no desea responder o profundizar.',
  },
]
