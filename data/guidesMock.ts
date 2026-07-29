export type GuideMockDocument = {
  id: string;
  category: string;
  title: string;
  institution: string;
  year: string;
  pages: string;
  size: string;
  searchTerms: string[];
  featured?: boolean;
};

const BASE_GUIDE = {
  category: 'Nacional',
  institution: 'Dirección de VIH, ITS y Hepatitis',
  year: '2025',
  pages: '156 págs.',
  size: '2.4 MB',
} as const;

export const GUIDE_MOCK_DOCUMENTS: GuideMockDocument[] = [
  {
    ...BASE_GUIDE,
    id: 'respuesta-vih-argentina-1',
    title: 'Respuesta al VIH y las ITS en Argentina',
    searchTerms: ['respuesta', 'vih', 'its', 'argentina'],
    featured: true,
  },
  {
    ...BASE_GUIDE,
    id: 'respuesta-vih-argentina-2',
    title: 'Respuesta al VIH y las ITS en Argentina',
    searchTerms: ['respuesta', 'vih', 'its', 'argentina'],
    featured: true,
  },
  {
    ...BASE_GUIDE,
    id: 'respuesta-vih-argentina-3',
    title: 'Respuesta al VIH y las ITS en Argentina',
    searchTerms: ['respuesta', 'vih', 'its', 'argentina'],
    featured: true,
  },
  {
    ...BASE_GUIDE,
    id: 'prep',
    title: 'PrEP',
    searchTerms: ['prep', 'profilaxis pre exposición'],
  },
  {
    ...BASE_GUIDE,
    id: 'pep',
    title: 'PEP',
    searchTerms: ['pep', 'ppe', 'profilaxis post exposición'],
  },
  {
    ...BASE_GUIDE,
    id: 'diagnostico-sifilis',
    title: 'Diagnóstico de sífilis',
    searchTerms: ['diagnóstico sífilis', 'sifilis'],
  },
  {
    ...BASE_GUIDE,
    id: 'diagnostico-vih',
    title: 'Diagnóstico de VIH',
    searchTerms: ['diagnóstico vih'],
  },
  {
    ...BASE_GUIDE,
    id: 'aplicacion-penicilina',
    title: 'Aplicación de penicilina',
    searchTerms: ['aplicación de penicilina', 'penicilina'],
  },
  {
    ...BASE_GUIDE,
    id: 'anticoncepcion-emergencia',
    title: 'Anticoncepción de emergencia',
    searchTerms: ['anticoncepción de emergencia', 'anticoncepcion'],
  },
  {
    ...BASE_GUIDE,
    id: 'derechos',
    title: 'Derechos en la atención de la salud',
    searchTerms: ['derechos'],
  },
  {
    ...BASE_GUIDE,
    id: 'tratamiento-vih',
    title: 'Tratamiento del VIH',
    searchTerms: ['tratamiento vih'],
  },
  {
    ...BASE_GUIDE,
    id: 'tratamiento-sifilis',
    title: 'Tratamiento de la sífilis',
    searchTerms: ['tratamiento sífilis', 'tratamiento sifilis'],
  },
  {
    ...BASE_GUIDE,
    id: 'informacion-general',
    title: 'Información general sobre VIH e ITS',
    searchTerms: ['información general', 'informacion general'],
  },
];

export const GUIDE_QUICK_SUGGESTIONS = [
  'PEP',
  'PrEP',
  'Diagnóstico Sífilis',
  'Diagnóstico VIH',
  'Aplicación de penicilina',
  'Anticoncepción de emergencia',
  'Derechos',
  'Tratamiento VIH',
  'Tratamiento Sífilis',
  'Información general',
] as const;
