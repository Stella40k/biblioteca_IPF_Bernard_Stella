import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ESPACIO, TAMANIO_TEXTO } from '@/constants/tema';
import { useEstilos } from '@/hooks/useEstilos';
import { crearHojas } from '@/lib/estilos';

import { Boton } from './Boton';
import { BotonIcono } from './BotonIcono';
import { ListaRecientes } from './ListaRecientes';

type Props = {
  onRecargar?: () => void;
};

const hojas = crearHojas((c) =>
  StyleSheet.create({
    contenedor: {
      gap: ESPACIO.lg,
      paddingBottom: ESPACIO.sm,
    },
    accesos: {
      flexDirection: 'row',
      gap: ESPACIO.md,
    },
    acceso: {
      flex: 1,
    },
    filaTitulo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titulo: {
      color: c.texto,
      fontSize: TAMANIO_TEXTO.subtitulo,
      fontWeight: '700',
    },
  }),
);

export function EncabezadoCatalogo({ onRecargar }: Props) {
  const estilos = useEstilos(hojas);

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.accesos}>
        <View style={estilos.acceso}>
          <Boton titulo="Buscar" icono="search" onPress={() => router.push('/buscar')} />
        </View>
        <View style={estilos.acceso}>
          <Boton
            titulo="Escanear"
            icono="barcode-outline"
            variante="secundario"
            onPress={() => router.push('/escanear')}
          />
        </View>
      </View>
      <ListaRecientes />
      <View style={estilos.filaTitulo}>
        <Text style={estilos.titulo} accessibilityRole="header">
          Todos los libros
        </Text>
        {onRecargar && (
          <BotonIcono icono="refresh" etiqueta="Recargar catálogo" onPress={onRecargar} />
        )}
      </View>
    </View>
  );
}
