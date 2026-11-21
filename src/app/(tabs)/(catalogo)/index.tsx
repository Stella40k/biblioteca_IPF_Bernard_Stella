import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { EncabezadoCatalogo } from '@/components/EncabezadoCatalogo';
import { EstadoLista } from '@/components/EstadoLista';
import { FilaLibro } from '@/components/FilaLibro';
import { ESPACIO } from '@/constants/tema';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import { useColores } from '@/hooks/useColores';
import { useEstilos } from '@/hooks/useEstilos';
import { useLibros } from '@/hooks/useLibros';
import { crearHojas } from '@/lib/estilos';

const hojas = crearHojas((c) =>
  StyleSheet.create({
    lista: {
      backgroundColor: c.fondo,
    },
    contenido: {
      padding: ESPACIO.lg,
      gap: ESPACIO.sm,
    },
  }),
);

export default function Catalogo() {
  const estilos = useEstilos(hojas);
  const colores = useColores();
  const { libros, cargando, error, reintentar } = useLibros();
  const { disponibles } = useBiblioteca();

  return (
    <FlatList
      style={estilos.lista}
      contentContainerStyle={estilos.contenido}
      contentInsetAdjustmentBehavior="automatic"
      data={cargando || error ? [] : libros}
      keyExtractor={(libro) => libro.isbn}
      renderItem={({ item }) => <FilaLibro libro={item} disponibles={disponibles(item)} />}
      ListHeaderComponent={<EncabezadoCatalogo onRecargar={reintentar} />}
      refreshControl={
        <RefreshControl
          refreshing={cargando}
          onRefresh={reintentar}
          colors={[colores.primario]}
          tintColor={colores.primario}
        />
      }
      ListEmptyComponent={
        <EstadoLista
          cargando={cargando}
          error={error}
          onReintentar={reintentar}
          mensajeCargando="Cargando el catálogo…"
          mensajeVacio="El catálogo está vacío por ahora."
        />
      }
    />
  );
}
