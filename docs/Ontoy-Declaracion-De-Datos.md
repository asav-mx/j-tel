# Ontoy — declaración de datos para las tiendas (borrador)

**Para:** Asav, cuando llene los formularios de Google Play («Seguridad de los datos») y
del App Store («Privacidad de la app»). **Fecha:** 21 de septiembre de 2026; revisada el 22 (Ontoy 2.0: PR 1, las paradas cerca de ti; PR 3, «aquí estás» sobre la ruta; PR 3b, los camiones de tus rutas favoritas en una sola consulta; PR 4a, los avisos de la concesión en esas respuestas; PR 4b, la campana y los avisos ya vistos en el teléfono; PR 5a, los recorridos por tramo) **y el 23** (Ontoy 3.0: el pase y sus boletos en el teléfono, y la pregunta «¿ya se usó mi boleto?» del P3.5).

⚠ **El pase llegó con el P2 y no se declaró entonces.** Los boletos viven en el teléfono desde el 22-sep y esta tabla no los nombraba. Se corrige aquí, con su renglón, antes de que el P3.5 agregue la primera petición que los menciona.

**La regla:** esta declaración tiene que coincidir **al pie de la letra** con el código.
Cada respuesta lleva dónde se comprueba. Si un día el texto y el código no coinciden,
**gana el código y se corrige el texto** — aquí, en la página pública
(`apps/publico/src/app/privacidad/page.tsx`) y en el formulario de la tienda.

---

## 1. Lo que hace la app con datos, verificado en el código

| Dato | Qué pasa | Dónde se comprueba |
|---|---|---|
| **Ubicación precisa** | Se lee en el teléfono (`watchPosition`) sólo si el pasajero da permiso. **No se pide al abrir:** se pide al tocar «Ver paradas cerca de mí», y si el permiso ya estaba dado se usa sin volver a preguntar (`navigator.permissions`, que no pregunta). Se usa ahí mismo para escoger las paradas cercanas, marcar «tú» en el mapa y «aquí estás» sobre la ruta abierta, y calcular la llegada hasta él. **No viaja** en ninguna petición nuestra. | `apps/publico/src/lib/ubicacion.ts`, `lib/ontoy/paradas-cerca.ts`; las únicas peticiones de la app son las de la tabla de abajo |
| **Paradas guardadas**, **avisos ya vistos** y **piel clara/oscura** | En el almacenamiento del navegador (`localStorage`), en el teléfono. No viajan. De los avisos se guardan sólo los ids de los vigentes, para apagar el punto de la campana. | `lib/ontoy/paradas-guardadas.ts`, `lib/ontoy/avisos-vistos.ts`, `lib/tema.ts` |
| **Apertura de una ruta** | Un `POST` **sin cuerpo** a `/api/circuitos/‹ruta›/apertura`. El servidor guarda `{circuito, día local, huella}`. La huella es un HMAC de IP + agente + día + circuito; **la IP y el agente no se guardan**, y la huella rota cada día. | `app/api/circuitos/[slug]/apertura/route.ts`, `huellaDeApertura` en `@jtel/domain/publico` |
| **Paradas cerca de ti** | Un `GET /api/circuitos/paradas-de-la-ciudad` **sin parámetros**, igual para todos: baja las paradas públicas de la ciudad (por ruta: id público, nombre, color; por parada: id público, ruta, nombre, sentido, posición — **cero mediciones**). El cruce con la ubicación ocurre en el teléfono. Se pide **al abrir el Mapa** (para dibujar los puntitos de parada del filtro y marcar tus guardadas), en Inicio con ubicación (para ordenar las rutas por cercanía) y en «Ir a» (para emparejar lo que escribes, aquí mismo). Desde el 22-sep el Mapa la pide **aunque no hayas dado ubicación**: un interruptor de paradas que aparece y desaparece según el permiso es peor que esta petición, que es igual para todos y no lleva nada tuyo. | `app/api/circuitos/paradas-de-la-ciudad/route.ts`, `lib/paradas-de-la-ciudad.ts` (y su prueba) |
| **Las rutas de tus paradas guardadas** | Para enseñar sus camiones en Inicio y en el Mapa de la ciudad, un `GET /api/circuitos/en-vivo?rutas=‹ruta›,‹ruta›` cada 15 s, **una sola consulta para todas** (antes, una por tarjeta). Lleva **cuáles rutas** —ids públicos, ordenados, como mucho 8—, **no cuáles paradas**, ni ubicación, ni identificador. El servidor contesta y **no la guarda**; como con cualquier petición, la plataforma puede anotar la dirección pedida (y con ella esa lista) en sus registros técnicos por un tiempo corto. Es lo mismo que ya pasaba al pedir cada ruta por su nombre, ahora junto. | `app/api/circuitos/en-vivo/route.ts`, `lib/rutas-pedidas.ts`, `lib/ontoy/en-vivo.ts` |
| **Búsqueda** | Vive en el lugar «Ir a», y es la única de la app (22-sep). Corre en el teléfono sobre las paradas de la ciudad ya bajadas: **lo que el pasajero escribe no viaja a ningún lado**, porque la petición que lo mandaría no existe. No hay buscador de direcciones (decisión del 2 sep, `DESPUES.md` §6). Tampoco se guarda lo buscado. | `lib/ontoy/buscar-lugar.ts`, `components/ontoy/vista-ira.tsx` |
| **El pase y sus boletos** | En el almacenamiento del navegador (`localStorage`), en el teléfono: los boletos firmados, su estado y los renglones de movimiento. **La llave privada de cada boleto nace y muere en el teléfono** y no viaja nunca. Son **de laboratorio**: se emiten en el propio aparato con la llave de pruebas y **no hay cobro real de por medio** (la valla `pnpm cobro:check` lo vigila). | `lib/ontoy/pase-del-telefono.ts`, `lib/ontoy/pase.ts` |
| **«¿Ya se usó mi boleto?»** | Un `POST /api/boletos/estado` **sólo cuando hay un boleto enseñado y sin confirmar**, cada 20 s hasta que se aclare. Lleva **los folios en uso y nada más** —ni todos los del pase, ni ubicación, ni identificador— y va en el cuerpo, no en la ruta, para que los folios no acaben en el registro del CDN ni en el historial del navegador. El servidor contesta cuáles están quemados y **no guarda la consulta**: esa ruta no escribe una sola fila. | `app/api/boletos/estado/route.ts`, `lib/ontoy/pase-del-telefono.ts` (`useConfirmacionDelPase`) |
| **Letras** | Servidas del mismo sitio (`next/font`), no de Google. | `app/layout.tsx` |

**Las peticiones que hace la app, completas:** los recorridos por tramo (`GET /api/circuitos/recorridos`, sin parámetros, agregados del circuito), las paradas de la ciudad (`GET /api/circuitos/paradas-de-la-ciudad`, sin parámetros), la forma de la ruta (`GET /api/circuitos/‹ruta›`),
los camiones en vivo de la ruta abierta (`GET …/unidades`, cada 15 s) y los de tus rutas favoritas (`GET /api/circuitos/en-vivo?rutas=…`, cada 15 s, una para todas), la apertura (`POST …/apertura`, vacío), **los folios en uso del pase** (`POST /api/boletos/estado`, sólo cuando hay alguno) y
**el mapa de fondo, que es un archivo de este mismo servidor** (ver abajo). Las respuestas de los camiones traen además **los avisos de la concesión** que valen en ese momento (título, detalle, fechas; nada de quién los capturó) — datos públicos de la ruta, no del pasajero, desde la 0052. Ninguna petición lleva ubicación, nombre, correo,
teléfono ni identificador del aparato.

### El mapa de fondo: ya no hay tercero

**El mapa lo servimos nosotros** desde el 25-sep-2026. Es **un archivo** —
`/mapa/juarez-AAAAMMDD.pmtiles`, en el mismo servidor que sirve la app — que el navegador
lee **por rangos**: pide los pedazos que necesita, como se lee un disco. Está en
`lib/ontoy/mapa-base.ts` (`hayTercero: false`), y la página pública lo dice sola porque lee
esa función.

Hasta ese día las teselas se pedían a **OpenStreetMap** (`tile.openstreetmap.org`), directo
desde el teléfono, y OpenStreetMap recibía **la IP del pasajero y qué zona del mapa estaba
viendo** (por las coordenadas de la tesela). **Ese renglón desapareció**: nadie fuera de
nuestro servidor recibe una petición del mapa.

**Los datos del mapa siguen siendo de OpenStreetMap, y el crédito se queda.** Es una cosa
distinta de la anterior y conviene no juntarlas:

| | |
|---|---|
| **El crédito** | Es por los **datos** (ODbL). Va en el mapa, y no cambia porque cambie quién sirve el archivo |
| **La privacidad** | Es por **quién recibe las peticiones**. Cambió: ahora nadie más que nosotros |

Confundirlas produce los dos errores contrarios: quitar el crédito porque «ya no les
pedimos nada», o seguir declarando un tercero porque «el crédito sigue ahí».

### El contador de aperturas subcuenta, y hay que decirlo

La huella sale de la IP. Detrás de un NAT de red celular, **media colonia sale con la
misma IP**: varios teléfonos distintos cuentan como uno. El número es un **indicio de
demanda** (Marco 9.4), no un conteo de personas, y siempre **por debajo** del real. La
página pública lo dice con esas palabras.

### Lo que no entra en esta declaración

**La flota.** Los camiones, sus posiciones y su número económico son datos del servicio,
no del pasajero; la declaración de la tienda es sobre el usuario de la app.

**El lector del camión** (`/validador`, y lo que entrega en `/api/boletos/sincronizar`).
Vive en el mismo sitio, y **no es la app del pasajero**: es un instrumento de a bordo que
usa el chofer. Lo que manda —el folio quemado, su hora, el aparato y la unidad que el plan
le asignaba— son datos **del servicio y del aparato**, no de quien viaja: no llevan nombre,
ni cuenta, ni teléfono, ni ubicación del pasajero.

**Lo que sí hay que tener presente, dicho sin adornos:** un folio queda escrito en el libro
de J-Tel con la hora y el camión, y ese mismo folio estuvo en el teléfono de alguien. Nadie
guarda el par «folio ↔ persona» —no hay cuenta que lo ligue, y el cuerpo del boleto, que
lleva la llave del portador, **no se guarda**—, pero el día que existan cuentas de pasajero
(8.14) ese par empieza a ser posible. **Esa pieza la redacta el abogado**, y esta
declaración se revisa con ella.

---

## 2. Google Play — «Seguridad de los datos»

Google cuenta como **recopilado** lo que sale del aparato hacia nosotros o un tercero, y
permite no declarar lo que se procesa **de forma efímera** (sólo en memoria, para
contestar la petición).

| Pregunta | Respuesta propuesta | Por qué |
|---|---|---|
| ¿La app recopila o comparte datos del usuario? | **Sí** (recopila; **no comparte**) | La apertura guarda una huella. El mapa **ya no manda nada a ningún tercero**: es un archivo de nuestro propio servidor |
| **Ubicación** (aproximada / precisa) | **No recopilada** | Se usa en el teléfono y no sale (tabla de arriba) |
| Información personal, financiera, de salud, mensajes, fotos, audio, archivos, contactos, calendario | **No** | La app no toca nada de eso |
| **Actividad en la app → Interacciones con la app** | **Recopilada**, no compartida | «Se abrió la ruta X hoy», con una huella diaria |
| · ¿Se procesa de forma efímera? | **No** | Se guarda por día |
| · ¿Es obligatoria? | Sí (automática; no hay forma de apagarla en la app) | Nadie la configura |
| · Propósito | **Análisis** | Medir la demanda por ruta |
| · Y los folios del pase (`POST /api/boletos/estado`) | **No se declaran aparte: procesamiento efímero** | El folio viaja para contestar «¿ya se usó?» y **el servidor no guarda la consulta**. Lo que sí queda escrito es el quemado que entregó el lector, que es un dato del servicio (arriba). **Revisar con el abogado de Ontoy 3.0** antes de cualquier cobro real |
| · Y las rutas favoritas (`en-vivo?rutas=`) | **No se declaran aparte: procesamiento efímero** | La lista viaja para contestar la petición y el servidor no la guarda. Es el mismo caso que pedir una ruta por su nombre, que ya se hacía. **Revisar con el abogado de Ontoy 3.0** si el registro técnico de la plataforma cambia esa respuesta |
| **Identificadores de dispositivo u otros** | **No** | La huella viaja dentro de la interacción de arriba (ya declarada), rota cada día y no identifica al aparato entre días; la IP entra al cálculo y se descarta. Si la revisión de Google lo pregunta, ésa es la explicación |
| **Compartidos con terceros** | **No.** Ninguna petición de la app sale hacia un tercero: ni las teselas del mapa, que ahora son un archivo nuestro. Hasta el 25-sep-2026 aquí había que declarar la **ubicación aproximada como compartida** por los mosaicos de OSM —Google cuenta como «compartir» mandar datos a un tercero—; con el mapa propio esa fila dejó de aplicar | Ver «el mapa de fondo» arriba |
| ¿Los datos se cifran en tránsito? | **Sí** | Todo va por HTTPS |
| ¿Se puede pedir que se borren? | **No aplica / no hay cuenta**: no hay nada ligado a una persona que borrar; lo del teléfono lo borra el pasajero | — |
| Enlace a la política de privacidad | `https://ontoy.app/privacidad` | **El dominio se decidió el 23-sep: `ontoy.app`** (`Procedimiento-Dominio-Ontoy-App.md`). Vale en cuanto el DNS apunte |

## 3. App Store — «Privacidad de la app»

Apple pregunta qué datos **recopilas** (tú o tus socios), si se **vinculan** a la
identidad del usuario, y si se usan para **rastreo** (cruzar con datos de otras
empresas para publicidad).

| Categoría | Respuesta propuesta |
|---|---|
| **Ubicación** | **No recopilada.** Se usa en el teléfono y no sale. Hasta el 25-sep-2026 había que declarar además **Ubicación aproximada** por los mosaicos de OSM; con el mapa propio se quitó |
| **Datos de uso → Interacción con el producto** | **Recopilado**, **no vinculado** a la identidad, **no usado para rastreo**, propósito **Análisis** |
| Contacto, salud, finanzas, contenido del usuario, historial de búsqueda y de navegación, identificadores, compras, diagnósticos | **No recopilados** |
| ¿Rastreo? | **No** |
| URL de la política | `https://ontoy.app/privacidad` |

La etiqueta resultante debería leer: **«Datos no vinculados a ti: Datos de uso»**, y nada
más — la **Ubicación** salió de la etiqueta cuando salió el tercero del mapa. Nada en «Datos
usados para rastrearte».

---

## 4. Lo que falta antes de enviar

1. ~~**El dominio**~~ → **decidido el 23-sep-2026: `ontoy.app`.** Falta
   apuntarlo cuando Unstoppable Domains termine el registro
   (`Procedimiento-Dominio-Ontoy-App.md`). El TWA nace ahí, no se migra después.
   El dominio viejo, `juarezbus.digital`, redirige y no se apaga.
2. **`NEXT_PUBLIC_CONTACTO_PRIVACIDAD`** en Vercel: la página dice «el correo de contacto
   todavía no está configurado» mientras no exista, y ambas tiendas exigen un contacto.
3. ~~**Decidir el mapa del lanzamiento** (Protomaps)~~ → **hecho el 25-sep-2026.** El mapa
   es un archivo nuestro y **el tercero desapareció de esta declaración**: la fila de
   «compartidos con terceros» pasó a **No** y la **Ubicación aproximada** salió de la
   etiqueta de Apple. Lo que sigue vivo del mapa es que **sin señal no hay fondo** — ver
   `docs/Ontoy-Mapa-Base.md`; no es un dato del pasajero, así que no cambia nada de aquí.
4. **El límite de peticiones en `/unidades`** — requisito antes de publicar en tiendas
   (traspaso del 21 sep), no de esta declaración.
5. **Ontoy 3.0, antes de cualquier cobro real:** hoy los boletos son de laboratorio y no
   hay dinero de por medio, así que las categorías «Información financiera» y «Compras»
   siguen en **No**. El día que eso cambie, **las dos tiendas piden otra declaración** y
   este documento se rehace con el abogado. La valla `pnpm cobro:check` es lo que hace que
   ese día no pueda llegar sin que nadie lo note.
6. **`JTEL_SECRET_KEY` en la app pública:** sin ella el contador deja de contar (y lo grita
   en el registro del servidor); la declaración sigue siendo cierta, pero el indicio
   quedaría en cero.
