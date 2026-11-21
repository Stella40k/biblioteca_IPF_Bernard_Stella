export type Colores = {
  fondo: string;
  superficie: string;
  superficieAlt: string;
  borde: string;
  texto: string;
  textoSuave: string;
  primario: string;
  primarioSuave: string;
  textoSobrePrimario: string;
  peligro: string;
  peligroSuave: string;
  exito: string;
  exitoSuave: string;
  avisoFondo: string;
  avisoTexto: string;
  deshabilitado: string;
};

export type Esquema = 'claro' | 'oscuro';

export const COLORES: Record<Esquema, Colores> = {
  claro: {
    fondo: '#F1F5F3',
    superficie: '#FFFFFF',
    superficieAlt: '#F8FAF9',
    borde: '#CBD5E1',
    texto: '#0F172A',
    textoSuave: '#475569',
    primario: '#047857',
    primarioSuave: '#E6F4EA',
    textoSobrePrimario: '#FFFFFF',
    peligro: '#DC2626',
    peligroSuave: '#FEE2E2',
    exito: '#15803D',
    exitoSuave: '#DCFCE7',
    avisoFondo: '#FEF3C7',
    avisoTexto: '#92400E',
    deshabilitado: '#94A3B8',
  },
  oscuro: {
    fondo: '#061812',
    superficie: '#0F2C23',
    superficieAlt: '#14382D',
    borde: '#1D4A3C',
    texto: '#F1F5F9',
    textoSuave: '#94A3B8',
    primario: '#34D399',
    primarioSuave: '#0B241C',
    textoSobrePrimario: '#061812',
    peligro: '#F87171',
    peligroSuave: '#371717',
    exito: '#4ADE80',
    exitoSuave: '#123321',
    avisoFondo: '#2F2305',
    avisoTexto: '#FDE68A',
    deshabilitado: '#475569',
  },
};

export const ESPACIO = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const TAMANIO_TEXTO = {
  chico: 13,
  normal: 16,
  subtitulo: 18,
  titulo: 22,
} as const;

export const RADIO = {
  chico: 8,
  normal: 14,
  grande: 22,
  pill: 999,
} as const;

export const OPACIDAD = {
  presionado: 0.7,
} as const;

export const TAMANIO = {
  areaTactilMinima: 44,
  icono: 24,
  iconoGrande: 48,
  alturaCamara: 320,
  bordeFino: 1,
} as const;
