import { StyleSheet, Text, View } from 'react-native';

import { ESPACIO, RADIO, TAMANIO, TAMANIO_TEXTO } from '@/constants/tema';
import { useEstilos } from '@/hooks/useEstilos';
import { crearHojas } from '@/lib/estilos';
import { contar } from '@/lib/textos';
import type { Libro } from '@/types';

type Props = {
  libro: Libro;
  disponibles: number;
  enEspera: number;
};

const hojas = crearHojas((c) =>
  StyleSheet.create({
    ficha: {
      gap: ESPACIO.md,
      padding: ESPACIO.lg,
      borderRadius: RADIO.grande,
      borderWidth: TAMANIO.bordeFino,
      borderColor: c.borde,
      backgroundColor: c.superficie,
    },
    titulo: {
      color: c.texto,
      fontSize: TAMANIO_TEXTO.titulo,
      fontWeight: '700',
    },
    datosContenedor: {
      gap: ESPACIO.xs,
      paddingVertical: ESPACIO.xs,
    },
    dato: {
      color: c.textoSuave,
      fontSize: TAMANIO_TEXTO.normal,
    },
    badgesContenedor: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ESPACIO.sm,
      marginTop: ESPACIO.xs,
    },
    badge: {
      paddingHorizontal: ESPACIO.md,
      paddingVertical: ESPACIO.xs,
      borderRadius: RADIO.pill,
      borderWidth: TAMANIO.bordeFino,
    },
    badgeDisponible: {
      backgroundColor: c.exitoSuave,
      borderColor: c.exito,
    },
    badgeAgotado: {
      backgroundColor: c.peligroSuave,
      borderColor: c.peligro,
    },
    badgeEspera: {
      backgroundColor: c.avisoFondo,
      borderColor: c.avisoTexto,
    },
    textoDisponible: {
      color: c.exito,
      fontSize: TAMANIO_TEXTO.chico,
      fontWeight: '600',
    },
    textoAgotado: {
      color: c.peligro,
      fontSize: TAMANIO_TEXTO.chico,
      fontWeight: '600',
    },
    textoEsperaBadge: {
      color: c.avisoTexto,
      fontSize: TAMANIO_TEXTO.chico,
      fontWeight: '600',
    },
  }),
);

function textoEspera(cantidad: number): string {
  if (cantidad === 0) return 'Sin lista de espera';
  return `${contar(cantidad, 'persona', 'personas')} en espera`;
}

export function FichaLibro({ libro, disponibles, enEspera }: Props) {
  const estilos = useEstilos(hojas);
  const hayEjemplares = disponibles > 0;

  return (
    <View style={estilos.ficha}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {libro.titulo}
      </Text>
      <View style={estilos.datosContenedor}>
        <Text style={estilos.dato}>Autor: {libro.autor}</Text>
        <Text style={estilos.dato}>Año de publicación: {libro.anio}</Text>
        <Text style={estilos.dato}>ISBN: {libro.isbn}</Text>
      </View>
      <View style={estilos.badgesContenedor}>
        <View
          style={[estilos.badge, hayEjemplares ? estilos.badgeDisponible : estilos.badgeAgotado]}>
          <Text style={hayEjemplares ? estilos.textoDisponible : estilos.textoAgotado}>
            {hayEjemplares
              ? contar(disponibles, 'ejemplar disponible', 'ejemplares disponibles')
              : 'Sin ejemplares disponibles'}
          </Text>
        </View>
        <View style={[estilos.badge, estilos.badgeEspera]}>
          <Text style={estilos.textoEsperaBadge}>{textoEspera(enEspera)}</Text>
        </View>
      </View>
    </View>
  );
}
