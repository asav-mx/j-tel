# Ontoy — declaración de datos para las tiendas (borrador)

**Para:** Asav, cuando llene los formularios de Google Play («Seguridad de los datos») y
del App Store («Privacidad de la app»). **Fecha:** 21 de septiembre de 2026; revisada el 22 (Ontoy 2.0: PR 1, las paradas cerca de ti; PR 3, «aquí estás» sobre la ruta; PR 3b, los camiones de tus rutas favoritas en una sola consulta; PR 4a, los avisos de la concesión en esas respuestas; PR 4b, la campana y los avisos ya vistos en el teléfono).

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
| **Paradas cerca de ti** | Un `GET /api/circuitos/paradas-de-la-ciudad` **sin parámetros**, igual para todos: baja las paradas públicas de la ciudad (por ruta: id público, nombre, color; por parada: id público, ruta, nombre, sentido, posición — **cero mediciones**). El cruce con la ubicación ocurre en el teléfono. Se pide en Inicio (sin paradas guardadas y con ubicación) y en el Mapa de la ciudad (para marcar tus paradas guardadas). | `app/api/circuitos/paradas-de-la-ciudad/route.ts`, `lib/paradas-de-la-ciudad.ts` (y su prueba) |
| **Las rutas de tus paradas guardadas** | Para enseñar sus camiones en Inicio y en el Mapa de la ciudad, un `GET /api/circuitos/en-vivo?rutas=‹ruta›,‹ruta›` cada 15 s, **una sola consulta para todas** (antes, una por tarjeta). Lleva **cuáles rutas** —ids públicos, ordenados, como mucho 8—, **no cuáles paradas**, ni ubicación, ni identificador. El servidor contesta y **no la guarda**; como con cualquier petición, la plataforma puede anotar la dirección pedida (y con ella esa lista) en sus registros técnicos por un tiempo corto. Es lo mismo que ya pasaba al pedir cada ruta por su nombre, ahora junto. | `app/api/circuitos/en-vivo/route.ts`, `lib/rutas-pedidas.ts`, `lib/ontoy/en-vivo.ts` |
| **Búsqueda** | Corre en el teléfono sobre las paradas ya bajadas. **No hace petición.** No hay buscador de direcciones (decisión del 2 sep, `DESPUES.md` §6). | `lib/buscar-lugar.ts` |
| **Letras** | Servidas del mismo sitio (`next/font`), no de Google. | `app/layout.tsx` |

**Las peticiones que hace la app, completas:** las paradas de la ciudad (`GET /api/circuitos/paradas-de-la-ciudad`, sin parámetros), la forma de la ruta (`GET /api/circuitos/‹ruta›`),
los camiones en vivo de la ruta abierta (`GET …/unidades`, cada 15 s) y los de tus rutas favoritas (`GET /api/circuitos/en-vivo?rutas=…`, cada 15 s, una para todas), la apertura (`POST …/apertura`, vacío) y
**las teselas del mapa, a un tercero** (ver abajo). Las respuestas de los camiones traen además **los avisos de la concesión** que valen en ese momento (título, detalle, fechas; nada de quién los capturó) — datos públicos de la ruta, no del pasajero, desde la 0052. Ninguna petición lleva ubicación, nombre, correo,
teléfono ni identificador del aparato.

### El tercero: el mapa de fondo

Hoy las teselas se piden a **OpenStreetMap** (`tile.openstreetmap.org`), directo desde el
teléfono. OpenStreetMap recibe **la IP del pasajero y qué zona del mapa está viendo** (por
las coordenadas de la tesela). Nosotros no le mandamos nada. Está en
`lib/ontoy/mapa-base.ts` (`hayTercero: true`) y la página pública lo dice.

**Esto cambia antes del lanzamiento:** los tiles públicos de OSM no permiten uso de
producción, y el camino decidido es **Protomaps en almacenamiento propio** (21 sep). Con
eso, `hayTercero` pasa a `false`, la página se corrige sola, y **esta declaración se
revisa** (desaparece el tercero). Declarar hoy con OSM y lanzar con Protomaps sin revisar
sería declarar algo que ya no es cierto — en cualquiera de los dos sentidos.

### El contador de aperturas subcuenta, y hay que decirlo

La huella sale de la IP. Detrás de un NAT de red celular, **media colonia sale con la
misma IP**: varios teléfonos distintos cuentan como uno. El número es un **indicio de
demanda** (Marco 9.4), no un conteo de personas, y siempre **por debajo** del real. La
página pública lo dice con esas palabras.

### Lo que no entra en esta declaración

**La flota.** Los camiones, sus posiciones y su número económico son datos del servicio,
no del pasajero; la declaración de la tienda es sobre el usuario de la app.

---

## 2. Google Play — «Seguridad de los datos»

Google cuenta como **recopilado** lo que sale del aparato hacia nosotros o un tercero, y
permite no declarar lo que se procesa **de forma efímera** (sólo en memoria, para
contestar la petición).

| Pregunta | Respuesta propuesta | Por qué |
|---|---|---|
| ¿La app recopila o comparte datos del usuario? | **Sí** | La apertura guarda una huella; el mapa manda la IP a un tercero |
| **Ubicación** (aproximada / precisa) | **No recopilada** | Se usa en el teléfono y no sale (tabla de arriba) |
| Información personal, financiera, de salud, mensajes, fotos, audio, archivos, contactos, calendario | **No** | La app no toca nada de eso |
| **Actividad en la app → Interacciones con la app** | **Recopilada**, no compartida | «Se abrió la ruta X hoy», con una huella diaria |
| · ¿Se procesa de forma efímera? | **No** | Se guarda por día |
| · ¿Es obligatoria? | Sí (automática; no hay forma de apagarla en la app) | Nadie la configura |
| · Propósito | **Análisis** | Medir la demanda por ruta |
| · Y las rutas favoritas (`en-vivo?rutas=`) | **No se declaran aparte: procesamiento efímero** | La lista viaja para contestar la petición y el servidor no la guarda. Es el mismo caso que pedir una ruta por su nombre, que ya se hacía. **Revisar con el abogado de Ontoy 3.0** si el registro técnico de la plataforma cambia esa respuesta |
| **Identificadores de dispositivo u otros** | **No** | La huella viaja dentro de la interacción de arriba (ya declarada), rota cada día y no identifica al aparato entre días; la IP entra al cálculo y se descarta. Si la revisión de Google lo pregunta, ésa es la explicación |
| **Compartidos con terceros** | **Revisar con el tercero del mapa**: mientras sea OSM, el teléfono le pide teselas directo, con su IP. Google considera «compartir» enviar datos a un tercero; lo prudente es declarar **Ubicación aproximada → compartida → funcionalidad de la app**, con la nota de que es la zona de la tesela, no la ubicación. **Con Protomaps, esta fila desaparece.** | Ver «el tercero» arriba |
| ¿Los datos se cifran en tránsito? | **Sí** | Todo va por HTTPS |
| ¿Se puede pedir que se borren? | **No aplica / no hay cuenta**: no hay nada ligado a una persona que borrar; lo del teléfono lo borra el pasajero | — |
| Enlace a la política de privacidad | `https://‹dominio›/privacidad` | Espera el dominio |

## 3. App Store — «Privacidad de la app»

Apple pregunta qué datos **recopilas** (tú o tus socios), si se **vinculan** a la
identidad del usuario, y si se usan para **rastreo** (cruzar con datos de otras
empresas para publicidad).

| Categoría | Respuesta propuesta |
|---|---|
| **Ubicación** | **No recopilada** por nosotros. Nota sobre el tercero del mapa: igual que en Play — mientras sea OSM, declarar **Ubicación aproximada, no vinculada, no rastreo, funcionalidad**. Con Protomaps se quita |
| **Datos de uso → Interacción con el producto** | **Recopilado**, **no vinculado** a la identidad, **no usado para rastreo**, propósito **Análisis** |
| Contacto, salud, finanzas, contenido del usuario, historial de búsqueda y de navegación, identificadores, compras, diagnósticos | **No recopilados** |
| ¿Rastreo? | **No** |
| URL de la política | `https://‹dominio›/privacidad` |

La etiqueta resultante debería leer: **«Datos no vinculados a ti: Datos de uso»** (y, mientras
el mapa sea de OSM, **Ubicación**). Nada en «Datos usados para rastrearte».

---

## 4. Lo que falta antes de enviar

1. **El dominio** (TWA y la URL de la política).
2. **`NEXT_PUBLIC_CONTACTO_PRIVACIDAD`** en Vercel: la página dice «el correo de contacto
   todavía no está configurado» mientras no exista, y ambas tiendas exigen un contacto.
3. **Decidir el mapa del lanzamiento** (Protomaps): cambia las filas del tercero.
4. **El límite de peticiones en `/unidades`** — requisito antes de publicar en tiendas
   (traspaso del 21 sep), no de esta declaración.
5. **`JTEL_SECRET_KEY` en la app pública:** sin ella el contador deja de contar (y lo grita
   en el registro del servidor); la declaración sigue siendo cierta, pero el indicio
   quedaría en cero.
