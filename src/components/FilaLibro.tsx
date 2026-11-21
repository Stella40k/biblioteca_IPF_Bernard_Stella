import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ESPACIO, OPACIDAD, RADIO, TAMANIO, TAMANIO_TEXTO } from '@/constants/tema';
import { useEstilos } from '@/hooks/useEstilos';
import { crearHojas } from '@/lib/estilos';
import { contar } from '@/lib/textos';
import type { Libro } from '@/types';

type Props = {
  libro: Libro;
  disponibles: number;
};

const hojas = crearHojas((c) =>
  StyleSheet.create({
    fila: {
      minHeight: TAMANIO.areaTactilMinima,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ESPACIO.md,
      padding: ESPACIO.md,
      borderRadius: RADIO.normal,
      backgroundColor: c.superficie,
      borderWidth: TAMANIO.bordeFino,
      borderColor: c.borde,
    },
    presionada: {
      opacity: OPACIDAD.presionado,
    },
    datos: {
      flex: 1,
      gap: ESPACIO.xs,
    },
    titulo: {
      color: c.texto,
      fontSize: TAMANIO_TEXTO.normal,
      fontWeight: '600',
    },
    autor: {
      color: c.textoSuave,
      fontSize: TAMANIO_TEXTO.chico,
    },
    chip: {
      paddingHorizontal: ESPACIO.sm,
      paddingVertical: ESPACIO.xs,
      borderRadius: RADIO.pill,
      borderWidth: TAMANIO.bordeFino,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipHay: {
      backgroundColor: c.exitoSuave,
      borderColor: c.exito,
    },
    chipNoHay: {
      backgroundColor: c.peligroSuave,
      borderColor: c.peligro,
    },
    hay: {
      color: c.exito,
      fontSize: TAMANIO_TEXTO.chico,
      fontWeight: '600',
    },
    noHay: {
      color: c.peligro,
      fontSize: TAMANIO_TEXTO.chico,
      fontWeight: '600',
    },
  }),
);

export function FilaLibro({ libro, disponibles }: Props) {
  const estilos = useEstilos(hojas);
  const hayEjemplares = disponibles > 0;
  const disponibilidad =
    hayEjemplares ? contar(disponibles, 'disponible', 'disponibles') : 'Sin ejemplares';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${libro.titulo}, de ${libro.autor}. ${disponibilidad}.`}
      accessibilityHint="Abre la ficha del libro"
      onPress={() => router.push({ pathname: '/libro/[isbn]', params: { isbn: libro.isbn } })}
      style={({ pressed }) => [estilos.fila, pressed && estilos.presionada]}>
      <View style={estilos.datos}>
        <Text style={estilos.titulo}>{libro.titulo}</Text>
        <Text style={estilos.autor}>
          {libro.autor} · {libro.anio}
        </Text>
      </View>
      <View style={[estilos.chip, hayEjemplares ? estilos.chipHay : estilos.chipNoHay]}>
        <Text style={hayEjemplares ? estilos.hay : estilos.noHay}>{disponibilidad}</Text>
      </View>
    </Pressable>
  );
}
