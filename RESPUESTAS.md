# RESPUESTAS — TP N° 4 · App integradora “Biblioteca IPF”

**Alumna:** Stella Bernard · **Fecha de entrega:** 20/11/2026

Respuestas de análisis técnico sobre la aplicación desarrollada para las Partes B a E. Todas las explicaciones se fundamentan en el código fuente de este repositorio, indicando archivos y líneas exactas.

Entorno de ejecución y versiones utilizadas: **Expo SDK 58** (`expo` 58.0.26, `expo-router` 58.0.32, React 19.3.0 con React Compiler habilitado, React Native 0.88.1, `expo-camera` 58.0.14 y `expo-notifications` 58.1.9).

Las pruebas automatizadas de integración y navegación se encuentran implementadas en `__tests__/navegacion.test.tsx` y `__tests__/useBusqueda.test.tsx` utilizando `expo-router/testing-library`, junto con los tests unitarios de estructuras de datos en `src/estructuras/__tests__/`.

---

## Parte B · Estado, efectos y renderizado

### B1. El ciclo de vida de `useLibros`

Implementación: `src/hooks/useLibros.ts`, líneas 8–41.

```ts
export function useLibros() {
  const [libros, setLibros] = useState<Libro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const datos = await obtenerLibros();
        if (activo) setLibros(datos);
      } catch {
        if (activo) setError(MENSAJE_ERROR);
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setError(null);
    setCargando(true);
    setIntento((n) => n + 1);
  }, []);

  return { libros, cargando, error, reintentar };
}
```

#### a) Análisis render por render

**Caso exitoso (carga normal del catálogo):**

| Render | `libros` | `cargando` | `error` | Disparador y eventos |
|---|---|---|---|---|
| **Render 1** | `[]` | `true` | `null` | **Montaje inicial** del componente `Catalogo`. La pantalla dibuja el estado de carga (`EstadoLista` con indicador de actividad). Al finalizar el pintado en pantalla, React ejecuta el efecto y comienza la llamada asíncrona a `obtenerLibros()`. |
| **Render 2** | 20 libros | `false` | `null` | A los ~800 ms se resuelve la promesa de `obtenerLibros()`. Se ejecutan `setLibros(datos)` y `setCargando(false)`. Gracias al *automatic batching* de React 18 y 19, ambas actualizaciones dentro de la continuación de la microtarea asíncrona se procesan juntas en un **único ciclo de render**. La pantalla renderiza la lista completa de libros con sus tarjetas y badges. |

Total: **2 renders**. Como la dependencia `intento` permanece inalterada (vale 0), el efecto no vuelve a dispararse.

**Caso con fallo y acción de “Reintentar”:**

| Render | `libros` | `cargando` | `error` | Disparador y eventos |
|---|---|---|---|---|
| **Render 1** | `[]` | `true` | `null` | Montaje inicial del componente y lanzamiento del pedido de datos en el efecto. |
| **Render 2** | `[]` | `false` | `"No pudimos cargar..."` | La promesa es rechazada por el fallo simulado (20% de probabilidad). En el bloque `catch` y `finally`, React agrupa `setError(MENSAJE_ERROR)` y `setCargando(false)` en un solo render. La UI muestra la tarjeta de error con el botón “Reintentar”. |
| **Render 3** | `[]` | `true` | `null` | La persona usuaria presiona el botón “Reintentar”. La función `reintentar()` ejecuta `setError(null)`, `setCargando(true)` e `setIntento(n => n + 1)`. Al ejecutarse en el mismo manejador de evento, se procesan en un único render. Inmediatamente después, React ejecuta la **función de limpieza** del efecto anterior (fijando `activo = false`) y vuelve a disparar el efecto porque `intento` cambió de 0 a 1. |
| **Render 4** | 20 libros | `false` | `null` | Concluye exitosamente el segundo pedido a la API: se asignan los datos y se apaga el indicador de carga en un nuevo render consolidado. |

*(Nota técnica: En desarrollo bajo React Strict Mode, los efectos se montan, desmontan y vuelven a montar intencionalmente para validar la limpieza. La bandera booleana `activo = false` descarta la primera resolución impidiendo condiciones de carrera).*

#### b) ¿Se desmonta el Catálogo al navegar?

- **Al cambiar a la pestaña “Mis reservas”: NO se desmonta.** Las pestañas de Expo Router (`js-tabs` o pestañas nativas) preservan las pantallas visitadas vivas en memoria; únicamente alternan la propiedad de visibilidad y foco.
- **Al ingresar al detalle de un libro (`/libro/[isbn]`): TAMPOCO se desmonta.** El detalle se apila en el Stack anidado propio de la pestaña Catálogo (`src/app/(tabs)/(catalogo)/_layout.tsx`). En la arquitectura de pilas de navegación, las pantallas inferiores permanecen montadas debajo de la cima.

Para comprobarlo experimentalmente, agregué temporalmente un `console.log('CLEANUP useLibros')` en la función de retorno del efecto y realicé el recorrido completo: Catálogo → Mis Reservas → Catálogo → Detalle. El mensaje no se imprimió durante ninguna de esas transiciones. Únicamente se ejecutó al destruir la aplicación o al tocar “Reintentar”.

**Situaciones reales en las que se ejecuta la limpieza:**
1. Cuando cambia el valor de la dependencia `intento` al presionar “Reintentar” (React limpia el efecto previo antes de correr la nueva instancia).
2. Si ocurriera un desmontaje real del árbol de componentes (por ejemplo durante Fast Refresh en desarrollo, o si el layout padre decidiera desmontar el navegador completo). La bandera `activo = false` garantiza que la respuesta asíncrona de 800 ms no intente mutar el estado de un componente ya inexistente en el árbol (*no-op on unmounted component*).

#### c) ¿Por qué no se puede pasar una función `async` directamente a `useEffect`?

Porque la firma esperada por React para el callback de `useEffect` debe devolver exclusivamente `void` (`undefined`) o una **función sincrónica de limpieza** (`() => void`).
Toda función declarada con `async` devuelve invariablemente una `Promise`. Si hiciéramos `useEffect(async () => ...)`, React recibiría una promesa en lugar de la función de limpieza, lo cual causaría una advertencia de error y haría imposible que React ejecute la limpieza en el momento sincrónico exacto en que necesita limpiar el ciclo de vida anterior.

La solución implementada consiste en definir una función asíncrona interna (`async function cargar()`) dentro del cuerpo sincrónico del efecto, invocarla inmediatamente, y retornar sincrónicamente la función de limpieza:
```ts
useEffect(() => {
  let activo = true;
  async function cargar() {
    // ...await obtenerLibros()...
  }
  cargar();
  return () => {
    activo = false; // Retorno sincrónico de limpieza
  };
}, [intento]);
```

#### d) Implementación de `reintentar` y selección de dependencias

La función de reintento está definida mediante `useCallback`:
```ts
const reintentar = useCallback(() => {
  setError(null);
  setCargando(true);
  setIntento((n) => n + 1);
}, []);
```
Lo que desencadena la reejecución del pedido es la presencia de `intento` en el array de dependencias (`[intento]`). Al incrementarse el valor numérico, la comparación por referencia estricta de React (`Object.is(nuevoIntento, viejoIntento)`) evalúa a `false`, disparando la secuencia de limpieza y nuevo montaje del efecto.

**¿Por qué un contador numérico `intento` y no otra variable?**
- **No `error`:** El error cambia automáticamente cuando falla la solicitud; si dependiéramos de él, un fallo generaría un bucle automático infinito de reintentos sin intervención del usuario.
- **No `libros`:** Como la API simulada retorna copias nuevas en cada resolución (`map(libro => ({ ...libro }))`), cada respuesta modificaría la referencia del array provocando un bucle infinito de pedidos.
- **No un booleano:** Aunque alternar `true`/`false` funcionaría, un contador numérico es conceptualmente representativo de cada intento sucesivo y facilita el seguimiento en herramientas de depuración.

---

### B2. La condición de carrera del buscador

Implementación: `src/hooks/useBusqueda.ts`, líneas 22–37.
La búsqueda lee el parámetro `q` desde la URL con `useLocalSearchParams`, aplica un *debounce* de 300 ms y controla la respuesta con una bandera de vigencia local y una clave de consulta unívoca (`clave = `${consulta}#${intento}``).

#### Tabla comparativa ante escritura rápida:

| Momento | Qué pasa | Sin limpieza: qué se ve | Con mi código: qué se ve |
|---|---|---|---|
| **t = 0 ms** | Escribe “bor” → se inicia pedido para “bor” (tardará 1.400 ms). | “Buscando…” | “Buscando…” (temporizador de 300 ms esperando). |
| **t = 200 ms** | Escribe “borges” → se inicia pedido para “borges” (tardará 300 ms). | “Buscando…” (dos pedidos asíncronos en vuelo simultáneo). | “Buscando…”. La limpieza del efecto cancela el temporizador de “bor” (`clearTimeout`) y marca `vigente = false`. |
| **t = 500 ms** | Llega la respuesta de “borges”. | Libros de Borges. | Libros de Borges. |
| **t = 1.400 ms** | Llega la respuesta atrasada de “bor”. | **Inconsistencia grave:** la pantalla se pisa con los resultados de “bor” (Borges + *La borra del café*), a pesar de que el campo de búsqueda dice “borges”. | **Sin cambios:** La respuesta vieja es descartada inmediatamente porque `vigente` está en `false` y la clave no coincide. Se mantienen visibles los libros de Borges. |

*(Nota: En nuestra aplicación, gracias al debounce de 300 ms, si el usuario escribe la segunda palabra a los 200 ms, el pedido a la API de “bor” ni siquiera llega a emitirse al servidor gracias al `clearTimeout`. Si el usuario pausara 350 ms y luego continuara, la respuesta de 1.400 ms se descarta de forma 100% segura mediante `vigente = false`).*

#### a) Funcionamiento exacto de la limpieza
La función de limpieza del efecto cancela el temporizador pendiente con `clearTimeout(temporizador)` y cambia el valor de la variable local `vigente = false`. Debido al mecanismo de clausura (*closure*) de JavaScript, cada ejecución del efecto tiene su propia instancia de la variable `vigente`. Cuando la promesa vieja finalmente concluye, el bloque de resolución evalúa `if (vigente)`: como encuentra `false`, omite actualizar el estado.
Se ejecuta en dos momentos precisos:
1. Cuando el usuario modifica el texto `q` en la URL (React limpia el efecto anterior antes de ejecutar el siguiente).
2. Cuando la pantalla de búsqueda se desmonta.

Adicionalmente, se incluye una validación de clave (`respuesta?.clave === clave`), asegurando que jamás se muestren resultados de una consulta obsoleta.

#### b) Análisis de la propuesta: `if (texto === q) setResultados(datos)`
**No funciona.** La función callback dentro de `.then()` forma una clausura léxica que retiene las variables del ámbito en el cual fue instanciada (es decir, el render original en el que se inició ese pedido específico). Por lo tanto, el identificador `q` dentro de ese callback no lee el valor "en vivo" actual del componente ni de la URL, sino el valor estático que tenía `q` en aquel momento histórico. Como `texto` es idéntico a ese valor original, la condición `texto === q` evalúa siempre a `true`, renderizando la respuesta retrasada e introduciendo el error.
Para que funcionara con ese enfoque se requeriría una referencia mutable compartida (`useRef`), lo cual equivaldría a rehacer manualmente lo que el mecanismo nativo de limpieza de `useEffect` soluciona de forma limpia.

#### c) La URL y el botón atrás durante la escritura
En mi implementación utilizo `router.setParams({ q })` (`src/app/buscar.tsx`, línea 42). Este método actualiza los parámetros de la ruta actual sobre el mismo registro del historial, sin insertar entradas adicionales en la pila de navegación. Si el usuario escribe "borges", la URL evoluciona de forma reactiva (`/buscar?q=b`, `/buscar?q=bo`, etc.), pero con **un único toque en el botón Atrás** regresa inmediatamente a la pantalla previa del catálogo.
Si hubiésemos utilizado `router.push`, cada pulsación de tecla apilaría una nueva ruta en el Stack de navegación. El usuario tendría que presionar Atrás seis veces consecutivas para desandar la palabra letra por letra, y en cada tecla la pantalla se desmontaría y montaría nuevamente, perdiendo el foco y cerrando el teclado en pantalla.

---

### B3. Mutar o reemplazar

Fragmento analizado:
```ts
const [espera] = useState(() => new Cola<string>());
function anotarme() {
  espera.encolar('Ana');
}
return (
  <>
    <Text>Personas en espera: {espera.tamanio}</Text>
    <Button title="Anotarme" onPress={anotarme} />
  </>
);
```

#### a) Resultado tras presionar “Anotarme” tres veces
El texto continúa mostrando **“Personas en espera: 0”**.
**Razón:** El método `encolar` muta directamente las propiedades internas de la instancia en memoria, pero no se invocó ninguna función despachadora de estado (`set...`). Para React no ha ocurrido ningún evento de actualización de estado que programe un ciclo de renderizado. Aun si se llamara a `setEspera(espera)`, React utiliza el algoritmo de igualdad referencial `Object.is`: al verificar que la referencia del objeto es idéntica a la anterior, descarta el re-renderizado (*bailout*).

#### b) El efecto secundario al escribir en un TextInput
Al tipear en un campo controlado de la misma vista, se invoca `setTexto(valor)`. Esa actualización dispara un re-render del componente completo. Durante la ejecución de la función del componente, la expresión `espera.tamanio` vuelve a evaluarse sobre el objeto mutado en memoria, el cual efectivamente ya contenía 3 elementos, por lo que el número salta repentinamente a 3.
**Peligro de los errores intermitentes:** Un error intermitente que surge "a veces" es mucho más dañino y costoso de depurar porque enmascara la causa raíz: parece funcionar en ciertas pruebas de forma fortuita debido a renders colaterales, y cuando falla desorienta a los desarrolladores haciéndolos sospechar erróneamente de componentes no relacionados (como el `TextInput`). Además, optimizadores como el React Compiler descartan renders redundantes, provocando que estos efectos colaterales de mutación sean todavía más erráticos e impredecibles.

#### c) Solución adoptada en nuestro Context y comparativa técnica
En nuestro proyecto (`src/context/BibliotecaContext.tsx`, líneas 58–62 y `src/lib/biblioteca.ts`, líneas 95–101), administramos el estado mediante `useReducer` aplicando **inmutabilidad estricta**: ante cada cambio en una lista de espera, se clona la estructura antes de modificarla y se genera un nuevo estado:
```ts
case 'encolar': {
  const actual = estado.esperas[accion.isbn] ?? new Cola<string>();
  if (actual.incluye(accion.persona)) return estado;
  const copia = actual.clonar();
  copia.encolar(accion.persona);
  return { ...estado, esperas: { ...estado.esperas, [accion.isbn]: copia } };
}
```

| Estrategia | Ventajas | Desventajas / Costo |
|---|---|---|
| **Clonación de Cola con `useReducer`** *(Nuestra solución)* | Modifica la referencia del objeto, garantizando que React, `useMemo` y React Compiler detecten el cambio. El reductor es una función pura, predecible y fácilmente testeable. | Costo $O(n)$ en memoria y tiempo para copiar la colección; exige disciplina para no mutar accidentalmente instancias viejas. |
| **Contador de versión (`version++`)** | Muy simple y de costo $O(1)$. | Mantiene la misma referencia de la estructura. Cualquier hook memorizado dependiente de la cola queda obsoleto. En Strict Mode puede duplicar mutaciones internas. |
| **`useReducer` puro sin clonar** | Despacha acciones declarativas bien estructuradas. | Si el reductor muta el objeto interno sin generar una nueva referencia, adolece de los mismos problemas de renderizado fantasma. |
| **Utilizar Arrays nativos de JavaScript** | Compatibilidad directa con React y serialización nativa JSON sin adaptadores. | Se pierde el encapsulamiento de estructura de datos: no garantiza semántica FIFO y permite operaciones ilegales como `splice`. |

---

### B4. ¿Dónde vive cada dato?

| Dato | Dónde vive en la app | Justificación técnica |
|---|---|---|
| **Texto del buscador** | **URL (`/buscar?q=`)** | Permite persistencia de estado en la navegación, restauración por deep link (`bibliotecaipf://buscar?q=...`) y desacopla la entrada del renderizado local. El `TextInput` es no controlado con `defaultValue`. |
| **Préstamos y reservas** | **Context + AsyncStorage** | Estado global compartido entre múltiples rutas independientes (Catálogo, Ficha, Mis Reservas, Mostrador). Requiere persistencia en disco entre reinicios de la aplicación. |
| **Listas de espera** | **Context + AsyncStorage** | Estructuras `Cola<string>` compartidas entre el detalle de libro, la pantalla modal de reserva y la interfaz de mostrador del personal. |
| **Vistos recientemente** | **Context + AsyncStorage** | Estructura `Pila<string>` que se actualiza al visualizar un detalle y se consulta en la cabecera del catálogo. Sobrevive a la sesión. |
| **Sesión del personal** | **Context (en memoria)** | Booleano volátil requerido por `Stack.Protected` en el layout raíz. Por razones de seguridad en un dispositivo compartido de mostrador, la sesión caduca al cerrar la app. |
| **Ejemplares disponibles** | **Se calcula en tiempo de render** | Se obtiene de: `ejemplaresTotales − préstamosActivosDesdeEstante`. Centraliza una única fuente de verdad e impide inconsistencias numéricas. |
| **Estado del permiso de cámara** | **Sistema Operativo (con caché en hook)** | El SO es la autoridad máxima. El hook `usePermiso` consulta el estado nativo y lo refresca activamente mediante `useFocusEffect` y eventos de `AppState`. |
| **ID de la notificación programada** | **Context (en el préstamo) + SO** | La notificación física reside en el SO; el identificador alfanumérico se almacena en el préstamo para permitir su cancelación oportuna ante devoluciones tempranas. |

#### Re-renderizado ante cambios en el `value` del Context
Cualquier modificación en el estado del reductor genera una nueva referencia en el objeto `value` expuesto por `BibliotecaContext.Provider` (memorizado con `useMemo`). En consecuencia, **todos los componentes consumidores suscritos a `useBiblioteca()` se re-renderizan**, incluso si la propiedad que consumen no cambió en ese evento específico. Por ejemplo, al activar una notificación en "Mis reservas", el Catálogo vuelve a renderizarse porque consume el contexto para los libros recientes.

**¿Cómo podría evitarse y vale la pena en esta aplicación?**
Podría evitarse dividiendo el contexto en múltiples proveedores más pequeños (por ejemplo `SesionContext`, `PrestamosContext`, `RecientesContext`), separando el estado de los despachadores de acciones, o adoptando una biblioteca de estado externo con selectores atómicos (`useSyncExternalStore`).
**En una aplicación de esta escala NO se justifica:** La biblioteca gestiona un volumen acotado de datos (20 libros y pocas entidades en memoria); los re-renders son sumamente ligeros, y el React Compiler optimiza automáticamente la reconstrucción de los subárboles de JSX que no sufrieron variaciones.

---

## Parte C · Navegación y rutas

### C1. La pila en la app

Evolución de las pilas (base → cima) a través del flujo de uso:

| # | Acción | Pilas resultantes |
|---|---|---|
| **1** | Abre la app. | **Stack Raíz:** `[(tabs)]`<br>**Tabs:** Activa pestaña Catálogo<br>**Stack Catálogo:** `[index]` |
| **2** | Toca un libro del Catálogo. | **Stack Raíz:** `[(tabs)]`<br>**Stack Catálogo:** `[index, libro/[isbn]]` |
| **3** | Toca “Reservar”. | **Stack Raíz:** `[(tabs), reservar/[isbn] (modal)]`<br>**Stack Catálogo:** `[index, libro/[isbn]]` |
| **4** | Toca “Confirmar”. | **Stack Raíz:** `[(tabs)]` *(el modal se retira de la pila)*<br>**Tabs:** Cambia el foco a la pestaña `reservas`<br>**Stack Catálogo:** Permanece `[index, libro/[isbn]]` |
| **5** | Toca Atrás (Android). | **Stack Raíz:** `[(tabs)]`<br>**Tabs:** Retorna a la pestaña `(catalogo)` por `backBehavior: 'initialRoute'`<br>**Stack Catálogo:** `[index, libro/[isbn]]` *(Se muestra el detalle del libro)* |
| **6** | Toca la pestaña “Catálogo”. | **Stack Raíz:** `[(tabs)]`<br>**Stack Catálogo:** `[index]` *(Efecto popToTop: se vuelve a la lista inicial)* |

#### a) Método utilizado en el paso 4
Se utilizó `router.dismissTo('/reservas')` (`src/app/reservar/[isbn].tsx`, líneas 51–55).
- **Si usáramos `router.push('/reservas')`:** Al estar en un modal de la raíz, el enrutador crearía una **segunda instancia completa** del navegador de pestañas encima del modal (`Raíz: [(tabs), modal, (tabs)']`). Aparecería una interfaz duplicada y al pulsar Atrás se retornaría a la pantalla modal de confirmación, violando la consigna.
- **Si usáramos `router.replace('/reservas')`:** Reemplaza el modal por un nuevo navegador de pestañas anidado, duplicando la jerarquía de navegación y perdiendo el estado de la pila original.
- **Con `router.dismissTo('/reservas')`:** Se desapilan las pantallas modales hasta encontrar el navegador de pestañas existente en la raíz y se activa la tab de destino (`/reservas`). La pantalla de confirmación desaparece limpiamente del historial.

#### b) Visualización en el paso 6: ¿Catálogo o detalle?
Se visualiza el **Catálogo principal (`/`)**.
Cuando una persona usuaria pulsa sobre la pestaña que **ya se encuentra activa o enfocada**, el navegador nativo ejecuta automáticamente la acción `popToTop` sobre la pila interna de esa pestaña. Es el patrón UX estándar en aplicaciones móviles: el botón Atrás permite regresar contextualmente a la ficha del libro, mientras que presionar el ícono de la pestaña funciona como un atajo directo para regresar a la cabecera del catálogo general.

---

### C2. El escáner que dispara de más

Implementación: `src/app/(tabs)/(catalogo)/escanear.tsx`, líneas 53–74.

```ts
const navegado = useRef(false);
const ultimoDesconocido = useRef<string | null>(null);

function abrirLibro(isbn: string) {
  navegado.current = true;
  router.replace({ pathname: '/libro/[isbn]', params: { isbn } });
}

function alLeerCodigo({ data }: BarcodeScanningResult) {
  if (navegado.current || !esIsbnValido(data)) return;
  if (!buscarLibroPorIsbn(data)) {
    if (ultimoDesconocido.current !== data) {
      ultimoDesconocido.current = data;
      setAviso(`El código ${data} no corresponde a ningún libro del catálogo...`);
    }
    return;
  }
  abrirLibro(data);
}
```

#### a) Riesgo de `router.push` sin salvaguarda
El callback `onBarcodeScanned` se ejecuta en el hilo nativo y puede invocar la función de JavaScript hasta 30 o 60 veces por segundo mientras el código permanezca enfocado. Si llamáramos a `router.push` sin control, cada lectura encolaría una nueva acción en la cola de transiciones del enrutador. En cuestión de un segundo se encolarían decenas de pantallas de detalle idénticas para el mismo libro. La aplicación se congelaría procesando animaciones consecutivas, se distorsionaría la pila de libros recientes y el usuario quedaría atrapado teniendo que presionar Atrás decenas de veces.

#### b) ¿`useState` o `useRef`?
Se utilizó **`useRef`**.
Un estado con `useState` (`setEscaneado(true)`) es de carácter asíncrono y difiere su aplicación hasta el siguiente ciclo de render de React. Los cuadros sucesivos de la cámara que llegan milisegundos después continúan ejecutando la función del render actual, cuya clausura retiene `escaneado === false`.
Por el contrario, la mutación de una referencia (`navegado.current = true`) ocurre de forma **inmediata y sincrónica en memoria**. Cuando el siguiente cuadro se dispara un milisegundo después, lee inmediatamente `true` y cancela el procesamiento.

#### c) ¿Por qué `replace` para navegar al detalle?
`/escanear` se encuentra dentro de la pila de la pestaña Catálogo. Con `router.replace`, la pantalla de la cámara se sustituye por la del detalle (`[index, libro/[isbn]]`). Cuando el usuario presiona Atrás en el detalle, regresa directamente al Catálogo de libros, que es el comportamiento natural esperado.
Si utilizáramos `push`, la pila conservaría la cámara (`[index, escanear, libro]`); al presionar Atrás se retornaría a la pantalla de escaneo, la cual tendría su bandera de navegación bloqueada o reactivaría el escáner releyendo el código en bucle.

#### d) Comportamiento ante un ISBN no registrado
Si el código no pertenece a la colección de la biblioteca, la app mantiene la cámara activa y muestra un banner informativo accesible debajo del visor. Para evitar re-renderizados continuos, se utiliza `ultimoDesconocido.current`: el mensaje y el estado solo se actualizan si el código detectado difiere del que ya generó el aviso anterior.

---

### C3. Deep links y rutas protegidas

Comportamiento verificado en Expo Go y entorno de test:

| Enlace probado | Qué visualiza el usuario | Pila subyacente | Componente / Regla responsable |
|---|---|---|---|
| `bibliotecaipf://libro/9780132350884` | Detalle del libro *Clean Code* con título en el encabezado. | Stack Catálogo: `[index]` (Catálogo base). Atrás lleva al catálogo. | Configuración de anclaje `anchor: 'index'` en `src/app/(tabs)/(catalogo)/_layout.tsx` y validación en `useLibro`. |
| `bibliotecaipf://libro/123` | Pantalla de libro inexistente con aviso y botón "Ir al catálogo". | Stack Catálogo: `[index]`. | `useLibro` valida `esIsbnValido(isbn)` (13 dígitos) y renderiza `MensajeLibroInexistente`. |
| `bibliotecaipf://buscar?q=borges` | Buscador con término "borges" precargado y resultados filtrados. | Stack Raíz: `[(tabs)]`. Atrás retorna a pestañas. | Parámetro `q` leído mediante `useLocalSearchParams` en `src/app/buscar.tsx` y `anchor: '(tabs)'` en la raíz. |
| `bibliotecaipf://mostrador` (sin sesión) | Pantalla del Catálogo. | Redirige al anchor de la raíz `[(tabs)]`. | `<Stack.Protected guard={sesion}>` en `src/components/NavegadorRaiz.tsx`. |
| `bibliotecaipf://reserva` | Pestaña "Mis reservas". | Reemplaza ruta raíz por `[(tabs)]` con reservas activa. | `<Redirect href="/reservas" />` en `src/app/reserva.tsx`. |
| `bibliotecaipf://escanear` (cámara bloqueada) | Pantalla de escáner en estado bloqueado con botón "Abrir Ajustes" e input de ISBN manual. | Stack Catálogo: `[index, escanear]`. | Hook `usePermiso('camara')` evaluando `canAskAgain: false` en `src/app/(tabs)/(catalogo)/escanear.tsx`. |

**¿Por qué `/libro/123` alcanza la pantalla de detalle?**
Porque el enrutador de Expo Router resuelve rutas evaluando exclusivamente patrones de nombres de archivo en el sistema de rutas (`libro/[isbn].tsx`). El segmento dinámico `[isbn]` coincide con cualquier cadena de texto presente en esa posición. El router no tiene conocimiento de las reglas de negocio ni del catálogo de libros.
La responsabilidad de validar el parámetro y responder adecuadamente recae íntegramente en la **pantalla receptora y en su capa lógica** (`useLibro` verifica longitud y existencia, mostrando una pantalla con opciones de navegación claras).

---

### C4. Foco, montaje y primer plano

#### a) Eventos detectados por cada herramienta
- **`useEffect` con `[]`:** Detecta exclusivamente el **montaje inicial** y desmontaje del componente en el árbol de React. No vuelve a ejecutarse cuando una pestaña oculta vuelve a ser enfocada.
- **`useFocusEffect`:** Detecta cuándo la pantalla **adquiere o pierde el foco dentro del sistema de navegación** (por ejemplo al alternar entre pestañas o al cerrar una vista modal superior).
- **`AppState`:** Detecta los cambios de estado del **ciclo de vida de la aplicación móvil ante el sistema operativo** (`active`, `background`, `inactive`).

#### b) Respuestas a los escenarios
- Si el usuario sale a **Ajustes del teléfono**, habilita notificaciones y regresa a la app: **Únicamente `AppState` se entera**, cambiando su estado a `'active'`. La navegación no sufrió alteraciones.
- Si el usuario navega a la pestaña **Catálogo y luego retorna a "Mis reservas"**: **Únicamente `useFocusEffect` se entera**, ya que la aplicación permaneció todo el tiempo en primer plano.

#### c) Selección en nuestra app
En `src/hooks/usePermiso.ts` (líneas 27–52) combinamos **`useFocusEffect` y `AppState`**.
Si prescindiéramos de `AppState`, al conceder el permiso en los Ajustes del sistema y volver a la app, la pantalla continuaría mostrando el estado denegado u obsoleto hasta que el usuario navegara hacia otra pantalla. Si prescindiéramos de `useFocusEffect`, al otorgar el permiso desde una pantalla modal dentro de la misma app, la vista inferior no actualizaría su indicador.

---

## Parte D · Permisos en la app

### D1. Recorrido completo de la cámara (Android 14, instalación limpia)

| # | Acción | Qué muestra la aplicación | `status` | `canAskAgain` |
|---|---|---|---|---|
| **1** | Presiona “Escanear” por primera vez. | `/escanear` en estado **preguntable**. Panel informativo con botón "Usar la cámara" y campo de ingreso manual de ISBN. Al tocar "Usar la cámara", abre la modal previa `/permisos/camara` con el botón "Continuar". | `undetermined` | `true` |
| **2** | Toca "Continuar" → Selecciona “No permitir”. | Cierra la modal previa y regresa al escáner en estado **preguntable** con las opciones intactas. | `denied` | `true` |
| **3** | Toca “Usar la cámara” nuevamente. | Se vuelve a abrir la modal previa `/permisos/camara` con el botón "Continuar". | `denied` | `true` |
| **4** | Toca "Continuar" → Selecciona “No permitir”. | El sistema operativo fija el bloqueo permanente. La app muestra el escáner en estado **bloqueado**: texto explicativo, botón "Abrir Ajustes" y campo para ingresar el ISBN manualmente. | `denied` | `false` |
| **5** | Presiona “Escanear” otra vez. | Se visualiza directamente la pantalla en estado **bloqueado** con botón "Abrir Ajustes". No se abre diálogo de sistema. | `denied` | `false` |
| **6** | Toca "Abrir Ajustes" → Activa permiso de cámara → Vuelve a la app. | `AppState` detecta el retorno a primer plano, refresca el permiso y la pantalla transiciona al estado **concedido**: se activa el visor de la cámara. | `granted` | `true` |

#### a) Diferencias en iOS
En iOS el sistema operativo presenta el diálogo de autorización **una única vez**. Tras la primera negativa (paso 2), `status` pasa a `denied` y `canAskAgain` se vuelve `false` de inmediato. Al regresar, la aplicación transiciona directamente al estado **bloqueado** con el botón "Abrir Ajustes". No existe la posibilidad de un segundo diálogo como en Android.

#### b) Línea de decisión entre “Continuar” y “Abrir Ajustes”
Ubicada en `src/lib/permisos.ts`, línea 15:
```ts
return respuesta.canAskAgain ? 'preguntable' : 'bloqueado';
```
Es fundamental evaluar **`canAskAgain`** porque el campo `status` vale `denied` tanto cuando aún es posible volver a consultar al sistema como cuando el permiso quedó bloqueado permanentemente. Si nos basáramos solo en `status`, en un estado bloqueado el botón diría "Continuar", el sistema denegaría la solicitud de forma silenciosa sin abrir diálogo, y la persona percibiría un botón roto que no produce ninguna acción.

#### c) Detección del regreso desde Ajustes
El manejador de eventos de `AppState.addEventListener('change', ...)` en `src/hooks/usePermiso.ts` (líneas 40–52) detecta la transición hacia el estado `'active'` y dispara una nueva consulta nativa del permiso. Sin este listener, la interfaz mantendría el cartel de bloqueo hasta que el usuario cambiara manualmente de pantalla.

---

### D2. Notificaciones y consistencia

#### a) Omisión de cancelación de notificación ante devolución temprana
Si la persona usuaria presiona "Devolver" antes de cumplirse los 15 segundos y la notificación no se cancelara, el sistema operativo ejecutaría la alarma programada de todos modos. El usuario recibiría un recordatorio diciendo "Acordate de devolver el libro..." cuando el ejemplar ya fue entregado físicamente. Esto genera desconfianza y confusión. Por ello, la acción `devolver` invoca previamente `cancelarNotificacionDevolucion(prestamo.notificacionId)` (`src/context/BibliotecaContext.tsx`, líneas 101–108).

#### b) Persistencia y reconciliación del identificador de notificación
El identificador alfanumérico generado por Expo Notifications (`notificacionId`) se guarda asociado al registro del préstamo en el estado persistido con AsyncStorage (`src/lib/persistencia.ts`).
- Si la aplicación se cierra, la notificación programada continúa residiendo en el planificador del sistema operativo móvil y se disparará a los 15 segundos.
- Si no persistiéramos el identificador en disco, al reiniciar la aplicación perderíamos la referencia y ya no podríamos cancelar la notificación si el usuario devolviera el libro luego de reabrir la app.
- **Reconciliación al inicio:** Durante la carga inicial de la aplicación se ejecuta `reconciliarRecordatoriosConSistema()` (`src/lib/biblioteca.ts`, líneas 71–87), consultando `Notifications.getAllScheduledNotificationsAsync()`. Si una notificación ya se emitió en el sistema operativo, se actualiza el estado interno para que el interruptor de "Recordarme" aparezca apagado de forma consistente con la realidad.

#### c) Creación del canal en Android 13+
A partir de Android 13 (API 33), el permiso de notificaciones `POST_NOTIFICATIONS` está vinculado a la existencia de al menos un canal de notificaciones en la app. Si la aplicación intenta solicitar el permiso sin tener ningún canal configurado, el diálogo del sistema operativo puede no desplegarse y la solicitud es rechazada automáticamente. Por ello, en `src/lib/notificaciones.ts` (líneas 20–32) se ejecuta `prepararCanal()` creando el canal `"prestamos"` antes de invocar la solicitud de permisos.
En Android 12 e inferiores, el permiso no se solicitaba en tiempo de ejecución (venía habilitado por defecto al instalar la aplicación), aunque los canales de notificación continuaban siendo obligatorios para canalizar y categorizar los avisos sonoros y visuales.

#### d) Flujo ante permiso de notificaciones denegado
Si el permiso está denegado y se realiza una entrega desde el mostrador, el usuario recibe un **aviso interno dentro de la app** en la parte superior de la pantalla "Mis reservas", acompañado de un botón de descarte accesible.
El método `avisarEntrega` (`src/lib/notificaciones.ts`, líneas 77–90) evalúa activamente `notificacionesPermitidas()` consultando el estado actual mediante `Notifications.getPermissionsAsync()`. Es crucial **consultar el permiso en tiempo real** en lugar de utilizar un valor almacenado en caché, ya que la persona usuaria puede haber modificado los permisos en Ajustes mientras la app estaba en segundo plano.

---

### D3. Lo que la app pide y lo que no

| Plataforma | Clave o Permiso | Justificación en la app | Origen de la declaración |
|---|---|---|---|
| **Android** | `android.permission.CAMERA` | Lectura del código de barras EAN-13 con la cámara. | Plugin de `expo-camera` en `app.json`. |
| **Android** | `android.permission.POST_NOTIFICATIONS` | Alertas de recordatorio de préstamos y aviso de entrega. | Manifiesto de `expo-notifications`. |
| **Android** | `android.permission.RECEIVE_BOOT_COMPLETED` | Reprogramación de alarmas de recordatorios ante reinicio del teléfono. | Manifiesto de `expo-notifications`. |
| **Android** | `android.permission.INTERNET` | Conexión con Metro en desarrollo y comunicación con APIs. | Plantilla base de Expo / React Native. |
| **iOS** | `NSCameraUsageDescription` | Texto institucional explicativo en el diálogo de cámara. | Configurado en el bloque `plugins` de `app.json`. |
| **iOS** | Notificaciones locales | Avisos de vencimiento locales (sin `aps-environment`). | Plugin de `expo-notifications`. |
| **Android** | `blockedPermissions` | Bloqueo preventivo de `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `READ_MEDIA_*`, etc. | Sección `android.blockedPermissions` de `app.json`. |

#### a) Exclusión de `RECORD_AUDIO`
El plugin de `expo-camera` incluye soporte de audio por defecto para grabación de video. En `app.json` lo desactivamos explícitamente:
```json
["expo-camera", {
  "cameraPermission": "Usamos tu cámara para leer el código de barras del libro y abrir su ficha sin escribir el ISBN.",
  "microphonePermission": false,
  "recordAudioAndroid": false,
  "barcodeScannerEnabled": true
}]
```
Y lo bloqueamos en `android.blockedPermissions` para impedir que dependencias transitivas lo soliciten.

#### b) Requerimiento hipotético: Seleccionar foto desde galería
Se utilizaría la librería `expo-image-picker` invocando `launchImageLibraryAsync`. En sistemas modernos (Android 13+ Photo Picker y iOS 14+ PHPicker), la selección delegada al sistema no requiere permisos de almacenamiento completos.
**No alcanza con una actualización OTA (Over The Air):** Se requiere generar una **nueva compilación nativa (build)**. Las actualizaciones OTA únicamente distribuyen cambios en el paquete de JavaScript y assets estáticos. Incorporar una nueva librería con código nativo o modificar el manifiesto/Info.plist exige recompilar los binarios nativos de la aplicación.

#### c) Aspectos no verificables íntegramente en Expo Go
En Expo Go no es posible validar al 100%:
1. Los textos de propósito personalizados de `Info.plist`, ya que Expo Go muestra sus propios textos preconfigurados.
2. La exclusión efectiva de `blockedPermissions` (Expo Go incluye todos los módulos nativos en su binario).
3. El esquema URI personalizado directo `bibliotecaipf://` (en Expo Go se canaliza mediante `exp://.../--/`).
Para verificarlos de forma concluyente se requiere generar una **Development Build** mediante `npx expo run:android` o `eas build --profile development`, inspeccionando los artefactos generados con `npx expo prebuild`.

---

## Parte E · Buenas prácticas y decisiones de diseño

### E1. Revisión de código del catálogo

#### a) Cuadro de problemas detectados:

| # | Línea(s) | Clasificación | Causa técnica | Corrección requerida |
|---|---|---|---|---|
| **1** | 13–16 | **Mala práctica / Riesgo de rechazo** | Solicita permisos de cámara y notificaciones al montar la app sin previo aviso ni contexto. | Pedir permisos bajo demanda (*just-in-time*) tras una pantalla explicativa previa. |
| **2** | 15 | **Error de ejecución** | Llama a `requestPermissionsAsync` sin haber registrado el canal de notificaciones en Android 13+. | Invocar `prepararCanal()` antes de la solicitud nativa. |
| **3** | 16 | **Advertencia (Lint)** | El callback de `useEffect` omite `pedirPermiso` en su lista de dependencias (`exhaustive-deps`). | Declarar las dependencias correspondientes o remover el efecto inadecuado. |
| **4** | 18–20 | **Error crítico de ejecución / Rendimiento** | `useEffect` **sin array de dependencias**: se reejecuta tras cada render provocando un bucle infinito de solicitudes a la API. | Implementar hook `useLibros` con array de dependencias controlado `[intento]`. |
| **5** | 19 | **Error de ejecución** | Promesa sin bloque `.catch()`: cuando la API simulada falla (20% de probabilidad), genera un error de promesa no capturada. | Envolver en estructura `try/catch` y exponer estado `error` con reintento. |
| **6** | 19 | **Mala práctica** | Carece de función de limpieza: si la pantalla se desmonta, se intenta mutar el estado en un componente desmontado. | Incluir bandera `activo = false` en la limpieza del efecto. |
| **7** | 10, 22 | **Mala práctica** | Empleo de `any`: anula las garantías del sistema de tipos de TypeScript. | Tipar fuertemente utilizando la interfaz `Libro`. |
| **8** | 22–30 | **Rendimiento / Error de diseño** | Componente `Fila` declarado **dentro** de `Catalogo`: en cada ciclo de render se genera una nueva función componente, destruyendo y recreando las vistas nativas. | Extraer el componente a nivel de módulo en su archivo independiente `src/components/FilaLibro.tsx`. |
| **9** | 24 | **Mala práctica** | Concatenación manual de strings en rutas (`'/libro/' + libro.isbn`) perdiendo la validación de rutas tipadas. | Utilizar navegación tipada: `router.push({ pathname: '/libro/[isbn]', params: { isbn } })`. |
| **10** | 25 | **Mala práctica** | Estilos en línea con colores estáticos (`#333`) que no respetan el sistema de diseño ni el modo oscuro. | Utilizar `StyleSheet.create` y constantes centralizadas en `src/constants/tema.ts`. |
| **11** | 33–36 | **Rendimiento** | Empleo de `ScrollView` y `.map()` sin virtualización: renderiza todos los elementos en memoria a la vez y carece de estados de carga/vacío. | Emplear `FlatList` con `ListEmptyComponent` y virtualización de items. |
| **12** | 35 | **Advertencia / Bug sutil** | Empleo del índice `key={i}`: si la colección se reordena o filtra, React asocia el estado interno a la fila incorrecta. | Asignar clave estable e intrínseca: `keyExtractor={(libro) => libro.isbn}`. |
| **13** | 37–39 | **Accesibilidad** | Botón de ícono sin `accessibilityRole="button"`, sin `accessibilityLabel` y con dimensión menor al área táctil accesible de 44x44. | Utilizar componente accesible `BotonIcono` con etiqueta y tamaño mínimo garantizado. |
| **14** | 11 | **Advertencia** | Variable `permiso` destructurada de `useCameraPermissions` que nunca se utiliza en el código. | Remover variables no utilizadas. |

#### b) Comportamiento del efecto de líneas 18–20 durante el primer minuto
Al no poseer array de dependencias, el efecto se ejecuta después de cada renderizado.
1. En $t = 0$ ms se monta el catálogo y se despacha el primer pedido.
2. A los ~800 ms se resuelve la promesa, invocando `setLibros(datos)`. Esto desencadena un segundo render.
3. Al renderizarse, el efecto vuelve a ejecutarse inmediatamente, emitiendo un segundo pedido.
4. Este ciclo se repite en cascada cada ~800 ms consumiendo procesamiento, memoria y red, hasta que sobreviene un fallo estadístico de la API (20% de probabilidad). Como no hay bloque `.catch`, salta una excepción de promesa no capturada y el bucle se detiene transitoriamente, hasta que cualquier interacción externa provoque otro render que reinicie el ciclo destructivo.
**Si la API retornara siempre el mismo array:** `setLibros` recibiría la misma referencia de memoria; la comparación referencial de React (`Object.is`) cancelaría el renderizado sucesivo, ocultando el error de fondo y haciendo creer erróneamente que el código funciona.

#### c) Pantalla reescrita
Implementada en `src/app/(tabs)/(catalogo)/index.tsx`:
```tsx
export default function Catalogo() {
  const estilos = useEstilos(hojas);
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
      ListHeaderComponent={<EncabezadoCatalogo />}
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
```

#### d) Causa de rechazo en tiendas vs motivo de desinstalación
- **Rechazo en tiendas:** Solicitar permisos nativos sensibles (cámara y notificaciones) inmediatamente al iniciar la app sin explicar su propósito ni contexto de uso. Tanto las guías de revisión de Apple (App Store Review Guidelines 5.1.1) como las de Google Play sancionan y rechazan aplicaciones que exigen permisos sin una acción previa iniciada por la persona usuaria.
- **Motivo de desinstalación inmediata:** El bucle infinito de solicitudes y renderizados continuos: provoca congelamiento de la interfaz, recalentamiento del dispositivo, parpadeos incesantes de pantalla y consumo excesivo de batería y datos móviles.

---

### E2. Organización y acoplamiento

#### a) Flujo de dependencias entre capas del proyecto
```
app ─────────► components, hooks, context (layout raíz), lib, constants, types
components ──► hooks, lib, constants, types
hooks ───────► context, lib, constants, types
context ─────► lib, constants, types
lib ─────────► data, estructuras, constants, types
estructuras ─► (sin dependencias externas)
data ────────► types
constants ───► types
types ───────► (sin dependencias externas)
```
El grafo de dependencias es estrictamente unidireccional hacia abajo. **Ningún módulo interno importa elementos de `src/app`.**
Si un hook o componente importara archivos de `src/app`:
1. Violaría la separación de responsabilidades acoplando la lógica de negocio a rutas de interfaz.
2. Introduciría riesgos de dependencias circulares que en entornos con empaquetadores como Metro pueden traducirse en valores `undefined` durante la carga.
3. Cada archivo dentro de `src/app` es interpretado por Expo Router como una ruta navegable; mezclar lógica allí desvirtúa el enrutamiento.

#### b) Impacto ante una API real de catálogo
Si el catálogo pasara a consumirse desde una API REST o GraphQL real, requeriría modificar:
1. `src/lib/api.ts` (reemplazar la simulación local por peticiones `fetch`).
2. `src/lib/catalogo.ts` (adaptar las búsquedas sincrónicas a asíncronas con caché).
3. `src/hooks/useLibro.ts` (incorporar estados asíncronos de carga y error individuales).
4. Vistas que consumen `buscarLibroPorIsbn` sincrónico (`escanear.tsx`, `reservas.tsx`, `FichaLibro.tsx`).
Que este cambio afecte a más de dos archivos evidencia que existe acoplamiento sincrónico residual en varias pantallas respecto a la disponibilidad inmediata de los datos en memoria. Un desacoplamiento superior se lograría abstrayendo el acceso a través de un repositorio centralizado o reactivo que exponga estados asíncronos uniformes.

#### c) Evaluación del componente contenedor `<ConPermiso>`
- **Ventajas:** Sintaxis declarativa uniforme y reducción de código repetitivo en pantallas comunes.
- **Desventajas:** Resta flexibilidad para adaptar la interfaz a los 4 estados requeridos por la consigna (en el escáner se debe poder ingresar el ISBN manualmente en todos los estados, lo cual se vuelve engorroso de parametrizar con un simple wrapper).
- **Inviabilidad en notificaciones:** El permiso de notificaciones no se solicita al montar una vista, sino en respuesta a un evento interactivo imperativo (activar el switch de recordatorio). Un componente contenedor visual no resuelve esa necesidad, mientras que el hook `usePermiso` satisface ambos requerimientos de forma elegante.

---

### E3. Mapa de fallas

| Situación | Qué experimenta la persona usuaria | Dónde se gestiona (archivo y línea) |
|---|---|---|
| **`obtenerLibros()` falla** | Mensaje de error claro: *"No pudimos cargar el catálogo. Revisá tu conexión e intentá de nuevo."* con botón para reintentar. | `src/hooks/useLibros.ts`, líneas 21–24 y `src/components/EstadoLista.tsx`, líneas 20–25 |
| **Se abre ruta inválida `/libro/abc`** | Título *"Libro no encontrado"*, mensaje informativo y botón para regresar al catálogo. | `src/hooks/useLibro.ts`, líneas 10–15 y `src/app/(tabs)/(catalogo)/libro/[isbn].tsx`, líneas 39–43 |
| **Se escanea un ISBN no catalogado** | Cartel de advertencia debajo del visor indicando que el código no existe en el catálogo, manteniendo la cámara activa. | `src/app/(tabs)/(catalogo)/escanear.tsx`, líneas 53–74 |
| **Cámara bloqueada en el sistema** | Pantalla de escáner en estado bloqueado con botón *"Abrir Ajustes"* y campo habilitado para tipear el ISBN. | `src/app/(tabs)/(catalogo)/escanear.tsx`, líneas 81–115 y `src/lib/permisos.ts`, línea 15 |
| **Permiso de notificaciones denegado** | En "Mis reservas" se exhibe un aviso aclaratorio, el interruptor permanece desactivado y las entregas se notifican mediante banners internos. | `src/app/(tabs)/reservas.tsx`, líneas 55–67, `src/components/TarjetaAviso.tsx` y `src/context/BibliotecaContext.tsx`, líneas 135–161 |
| **Intento de reservar un libro ya reservado** | La vista de detalle deshabilita la opción indicando que el usuario ya posee el ejemplar en préstamo o en espera. Si se ingresa por URL, la modal ofrece volver a "Mis reservas". | `src/app/(tabs)/(catalogo)/libro/[isbn].tsx`, líneas 54–70 y `src/app/reservar/[isbn].tsx`, líneas 57–65 |
| **“Entregar al siguiente” con cola vacía** | El mostrador únicamente lista títulos con solicitantes en espera; si se vacía, se muestra *"No hay libros con lista de espera"*. El método `Cola.desencolar()` devuelve `undefined` con seguridad sin arrojar excepciones. | `src/app/mostrador.tsx`, líneas 37–54 y `src/estructuras/Cola.ts`, líneas 19–28 |
| **Login del personal con contraseña incorrecta** | Cartel de advertencia: *"Usuario o clave incorrectos. Revisalos e intentá de nuevo."*, limpiando el campo de contraseña y reteniendo el foco. | `src/app/login.tsx`, líneas 56–61 |

---

## Parte E4 · Decisiones con argumentos

### a) Identificador: ¿ISBN como parámetro y key, o ID numérico propio?
**Postura elegida: ISBN.**
- **Argumentos técnicos:**
  1. El ISBN es el identificador intrínseco natural del libro físico, impreso directamente en su código de barras (EAN-13). Al escanear el libro, el dato obtenido se mapea directamente a la ruta (`/libro/${data}`) sin requerir búsquedas intermedias en tablas de equivalencia.
  2. Como demostró el TP 2, `useLocalSearchParams` devuelve siempre cadenas de texto (`string`). Usar identificadores numéricos obligaría a aplicar conversiones continuas (`Number()`), lidiar con `NaN` y sortear problemas de igualdad estricta (`'5' !== 5`). El ISBN como string preserva dígitos y ceros a la izquierda de forma natural.
  3. Distintas ediciones de una misma obra poseen ISBNs diferentes, lo cual modela de forma fidedigna los ejemplares físicos de una biblioteca institucional.
  4. Para obras sin ISBN (material de cátedra o folletos), la biblioteca puede generar identificadores estructurados de 13 dígitos bajo un prefijo interno reservado.

### b) Estructuras de datos: ¿Clase `Pila` y `Cola` con `#items` o Arrays simples en el estado?
**Postura elegida: Clases orientadas a objetos con campos privados `#items`, combinadas con inmutabilidad en el reductor.**
- **Aportes de la clase:**
  - Garantiza un estricto encapsulamiento: el campo `#items` es inaccesible externamente, impidiendo mutaciones indebidas como `splice` o inserciones fuera de los extremos.
  - Expresa con claridad semántica las operaciones de dominio (`apilar`, `verTope`, `encolar`, `desencolar`, `tamanio`).
  - La implementación de `Cola` optimiza `desencolar()` en $O(1)$ sin utilizar `shift()`, empleando un puntero interno `#inicio`.
- **Desafíos al integrarlo con React:**
  - React gestiona el renderizado mediante detección de cambios por referencia. Para que el estado reaccione, se implementó el método `clonar()` en las estructuras, generando copias inmutables dentro del reductor antes de cada despacho.
  - Para persistir en AsyncStorage, se desarrollaron los métodos `aArray()` y reconstructores estáticos `Cola.desde(array)` y `Pila.desde(array)`.

### c) Memorización: ¿`useMemo` y `useCallback` aportan o generan ruido?
**Postura adoptada: Memorización selectiva fundamentada.**
- **Dónde aporta valor indiscutible:** En la exposición del `value` de `BibliotecaContext.Provider` (`useMemo`). Sin esta memorización, cada render del componente raíz generaría un objeto nuevo, forzando el re-renderizado masivo de toda la jerarquía de componentes suscriptos. De igual modo, funciones como `registrarVisto` requieren estabilidad referencial con `useCallback` para no disparar efectos colaterales cuando figuran como dependencias de `useEffect`.
- **Dónde resulta innecesario o ruido:** Envolver funciones simples de eventos en pantallas de bajo costo (como el `onPress` de un botón de navegación directa) o memorizar cálculos aritméticos triviales (como formateo de fechas cortas). El overhead de crear la clausura y comprobar el array de dependencias supera el costo de la operación.
- **Validación práctica:** El impacto se corrobora mediante el *Profiler* de React DevTools, activando "Highlight updates when components render" y verificando si componentes pesados se re-renderizan innecesariamente ante cambios de estado no relacionados.

### d) Datos duplicados: ¿Guardar los “ejemplares disponibles” en el estado o calcularlos?
**Postura elegida: Calcularlos dinámicamente en tiempo de render.**
```ts
export function disponibles(estado: EstadoBiblioteca, libro: Libro): number {
  const prestados = estado.prestamos.filter(
    (p) => p.isbn === libro.isbn && p.origen === 'estante',
  ).length;
  return Math.max(0, libro.ejemplares - prestados);
}
```
**Argumentación técnica:**
Mantener un campo redundante como `ejemplaresDisponibles` en el estado abre la puerta a inconsistencias y desincronizaciones (*split-brain*). Si existieran dos fuentes de verdad, cada acción de préstamo, devolución, hidratación desde AsyncStorage o reintento de red tendría que actualizar ambos estados de forma estrictamente sincrónica. Cualquier desfase resultaría en números negativos o libros figurando como agotados cuando hay unidades físicas en el estante.
Al derivar el dato a partir de la colección de préstamos activos y la constante base de ejemplares, existe **una única fuente de verdad inmutable y matemáticamente consistente**.
