export type ChatbotMockSource = {
  id: string;
  label: string;
};

export type ChatbotMockDocument = ChatbotMockSource & {
  title: string;
  institution: string;
  year: string;
  page: string;
  excerpt: string;
};

export type ChatbotMockStep = {
  id: string;
  text: string;
  sources: ChatbotMockSource[];
};

export const CHATBOT_MOCK_SOURCES: ChatbotMockDocument[] = [
  {
    id: 'msal-pba-2022',
    label: 'MSal PBA · 2022',
    title: 'Recomendaciones para la PPE para VIH, ITS y anticoncepción',
    institution: 'Ministerio de Salud PBA',
    year: '2022',
    page: 'P4',
    excerpt:
      'La profilaxis post-exposición (PPE) debe iniciarse lo antes posible, preferiblemente dentro de las primeras 2 horas y no más allá de las 72 horas posteriores a la exposición. La evaluación inicial incluye el tipo y riesgo de la exposición —vía, fluido involucrado y carácter consentido o no de la relación—, la historia clínica relevante (vacunación para hepatitis B, uso previo de PrEP, alergias) y la situación de la persona fuente cuando es posible identificarla.',
  },
  {
    id: 'direccion-vih-2023',
    label: 'Dir. VIH · 2023',
    title: 'Guía de prevención y tratamiento de la infección por VIH',
    institution: 'Dirección de VIH, ITS y Hepatitis',
    year: '2023',
    page: 'p31',
    excerpt:
      'La indicación de profilaxis post-exposición requiere evaluar el tipo de exposición, el fluido involucrado y el estado serológico de la persona fuente. El tratamiento debe iniciarse cuanto antes y siempre dentro de las primeras 72 horas.',
  },
  {
    id: 'fundacion-huesped-2024',
    label: 'Fundación Huésped · 2024',
    title: 'Manual de profilaxis post-exposición (PEP)',
    institution: 'Fundación Huésped',
    year: '2024',
    page: 'P12',
    excerpt:
      'Antes de iniciar la profilaxis se recomienda revisar antecedentes clínicos relevantes, vacunación para hepatitis B, uso previo de PrEP, alergias y posibles interacciones con otros tratamientos.',
  },
];

export const CHATBOT_MOCK_CONTENT = {
  consultationId: '01',
  consultationDate: '01/05/2026',
  exampleQuestion: 'Cuándo indicar PPE?',
  responsibleUseTitle: 'Uso responsable de la herramienta',
  responsibleUseBody:
    'InfectoAssist brinda orientación basada en información validada y evidencia disponible. Las respuestas funcionan como apoyo para la práctica clínica y no reemplazan el juicio profesional, el diagnóstico ni la indicación de tratamientos.',
  emptyStateMessage:
    'Escribí tu consulta abajo y el chatbot responderá basado en las guías cargadas.',
  answer:
    'La PPE está indicada ante exposiciones con riesgo significativo de transmisión del VIH y debe iniciarse lo antes posible —dentro de las primeras 2 horas y nunca después de las 72 horas postexposición.',
  answerSources: [{ id: 'msal-pba-2022', label: 'MSal PBA · 2022' }],
  stepsTitle: 'Antes de indicarla, evaluá:',
  steps: [
    {
      id: 'exposure-risk',
      text: 'Tipo y riesgo de la exposición: vía, tipo de fluido y carácter consentido o no de la relación.',
      sources: [
        { id: 'msal-pba-2022', label: 'MSal PBA · 2022' },
        { id: 'direccion-vih-2023', label: 'Dir. VIH · 2023' },
      ],
    },
    {
      id: 'serological-status',
      text: 'Estado serológico de la persona expuesta: solicitá test de VIH basal; si es reactivo, corresponde derivación para tratamiento, no PPE.',
      sources: [{ id: 'direccion-vih-2023', label: 'Dir. VIH · 2023' }],
    },
    {
      id: 'clinical-history',
      text: 'Historia clínica relevante: vacunación para hepatitis B, uso previo de PrEP y alergias.',
      sources: [],
    },
  ] satisfies ChatbotMockStep[],
  sourceSummary: '3 Fuentes en esta respuesta',
  feedbackPrompt: 'Valorar respuesta',
  commentsLabel: 'Enviar comentarios',
} as const;
