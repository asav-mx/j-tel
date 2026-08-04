# Ficha — El inicio (cara planta y cara carrier)

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`. Si algo aquí choca con ellos, ellos ganan.

**Relación con `Ficha-Cara-De-Producto.md` (#137):** la **continúa, no la reemplaza.** Aquella estableció el encuadre —subdominios, alcance por rol, y la razón para no pintar cifras de juicio todavía— y todo eso sigue vigente. Esta agrega lo que le faltaba: la **arquitectura visual**, ahora que el skill la tiene (#139) junto con los dos temas (#141).

**El diagnóstico corto:** la ficha anterior especificó *qué no debe llevar* el inicio y acertó. No especificó *cómo debe verse*, y por eso salió un directorio de texto. Las dos cosas eran ciertas a la vez.

---

## 1. La regla que concilia ambas

**Se construye la arquitectura completa desde ahora. Las cifras de juicio esperan a Ola 3.**

La distinción que lo hace posible: **no todo número es juicio.**

| Clase | Ejemplos | ¿Va hoy? |
|---|---|---|
| **Hecho contable** | 3 pendientes abiertos · 2 unidades sin chofer declarado · 3 credenciales vencen · 52 unidades · última hora de sellado | **Sí.** No dependen del afinado del motor |
| **Juicio agregado** | 95.4% de cumplimiento · margen mediano · rendimiento comparado · tendencias | **No hasta Ola 3.** Se mueven cuando se afine el árbitro |

Un conteo de pendientes abiertos es el mismo número mañana aunque el motor mejore. Un porcentaje de cumplimiento no. **Esa es la línea.**

---

## 2. Estructura, idéntica en las dos caras

Ambos inicios comparten arquitectura; cambia el contenido, nunca la forma.

### 2.1 Navegación lateral permanente
Según `## La arquitectura de la plataforma` del skill. Grupos por cara:

| Cara planta (`portal.j-telemetry.com`) | Cara carrier (`carrier.j-telemetry.com`) |
|---|---|
| **Operación:** Inicio · Monitoreo · Cierre del turno · Cumplimiento · Pendientes | **Operación:** Inicio · Torre · Flota del día · Sin declarar |
| **Contrato:** Oficina · Rutas y turnos · Quejas *(atenuado)* | **Recursos:** Unidades · Choferes · Asignaciones · Diésel |
| **Vistas:** Panorama *(atenuado si la cuenta es de planta)* | **Contratos:** Mis clientes · Cumplimiento · Quejas y Pre-nómina *(atenuados)* |

Abajo: identidad del usuario (rol hasta `auth-rbac`) y **el interruptor de tema**, junto al engrane.

### 2.2 Encabezado — el titular
Una frase en Archivo 800 que responde "¿estoy bien?" antes de leer nada más. Se arma con **conteos, no con juicio**:

- Planta: *"Tres cosas te necesitan, y una **vence mañana**."*
- Carrier: *"Cuatro cosas antes de que se vuelvan problema."*
- Cero abiertos: *"Hoy nada te necesita."*

El énfasis en ámbar solo cuando hay algo con fecha límite. Debajo, línea de contexto en mono: fecha completa, hora, y el dato ancla de la cara (último sellado en planta; conteo de flota y contratos en carrier).

### 2.3 La bandeja — la zona dominante
Es lo que el usuario vino a ver, y **manda sobre todo lo demás**. Cabecera con el conteo de abiertos y filtros (Todos · Urgentes/Hoy · Esta semana · Resueltos).

Cada renglón: marca cuadrada de color con su cifra · afirmación · detalle en mono con **fechas completas** · cuándo (ámbar si urge) · botón de acción.

**Orden: lo prevenible antes de lo ya sellado.**

**Contenido de planta:**
1. Pendientes por evidencia próximos a vencer *(ámbar)*
2. No cumplidos del último cierre *(rojo)*
3. Hallazgo preventivo — *espera a Ola 3, ver §3*

**Contenido de carrier:**
1. Unidades que se movieron sin chofer declarado *(ámbar)*
2. Credenciales por vencer *(ámbar)* — cuando exista el módulo de choferes (Ola 3)
3. Unidad que concentra huecos de señal *(acero)*
4. No cumplidos que selló la planta *(rojo)*

### 2.4 Los widgets — acompañan, nunca dominan
Un renglón de tarjetas debajo de la bandeja, cada una puerta a su sección.

**Regla dura del skill:** si los widgets crecen más que la bandeja, la pantalla se vuelve un tablero de monitoreo — lo que el producto existe para eliminar.

### 2.5 Módulos no contratados
Al final, en tarjetas con borde punteado y su requisito declarado. Nunca se esconden.

---

## 3. Qué lleva cada widget HOY y qué espera a Ola 3

Aquí es donde esta ficha se aparta de los mockups aprobados, **a propósito**.

| Widget | Hoy (Ola 1—2) | Ola 3 |
|---|---|---|
| **Cierre del turno** (planta) | *"Último cierre 06:50:00 · 14 servicios sellados"* — conteo y hora, ambos hechos | + resultado desglosado |
| **Monitoreo / Torre** | *"Sin turno activo · el segundo abre 13:45"* o *"Turno en curso"* | + unidades en ruta con confianza |
| **Cumplimiento** | **Espacio reservado.** Nombre, descripción de una línea, y leyenda: *"Disponible cuando la verificación alcance su umbral de confianza."* Se ve, se entiende, no se entra | La cifra del mes con su sparkline |
| **Flota** (carrier) | Estados de la flota: en servicio · patio · taller · sin señal. **Conteos, no juicio** | + rendimiento y kilómetro muerto |
| **El día · turnos** | Línea del día con turnos sellados, actual y próximos. Hechos de calendario | igual |
| **Mis clientes** (carrier) | Lista de contratos con rutas y turnos. **Sin porcentaje** | + cumplimiento por contrato |

**El espacio reservado es deliberado y honesto:** el usuario ve que la plataforma tiene esa capacidad y por qué todavía no la muestra. Es la misma disciplina del `pendiente por evidencia` aplicada al producto entero — **no afirmamos lo que todavía no podemos sostener.**

**Prohibido:** sparklines sobre cifras de juicio, comparaciones contra el mes anterior, y cualquier porcentaje de cumplimiento en el inicio antes de Ola 3.

---

## 4. Estados vacíos

Según la sección del skill. Los tres casos:

- **Bandeja en cero (el día bueno):** *"Hoy nada te necesita."* + el conteo de lo verificado. **Tranquilo, no vacío.** Es el estado al que aspira el producto.
- **Cuenta nueva:** el inicio muestra la cadena de configuración, no un tablero vacío.
- **Archivador caído:** banda ámbar arriba de la bandeja — *"No estamos recibiendo señal desde las 04:12"*. **Nunca** *"no hay servicios"*.

---

## 5. Los dos temas

Ambos inicios nacen con oscuro y claro, según `### Los dos temas` del skill. Ningún color escrito a mano; si falta un tinte, se agrega el token a las dos paletas.

---

## 6. Auditoría de datos

*Requisito de PLAN-v1 §0.*

**Confirmado que existe:** conteo de pendientes abiertos · resultados del último cierre con su hora de sellado · turnos y sus horarios (`route_shifts` / `shifts`) · estado de unidades y última telemetría · contratos activos por carrier.

**Respondido — investigación previa a construir (ORM real del repo: Drizzle, no Prisma; schema en `packages/db/src/schema/index.ts`):**

- **¿El conteo de "sin chofer declarado" se puede calcular hoy, o espera al módulo de choferes (Ola 3)?**
  **No se puede.** No existe tabla ni campo de "chofer declarado por viaje/turno". Lo más cercano es `jrzPassDriverId` en `units` (`packages/db/src/schema/index.ts:181-191`) — un identificador heredado del sistema predecesor `jrz-drone-os`, no una declaración operativa — y el rol `"chofer"` en RBAC (`packages/domain/src/index.ts:213`, `packages/auth-rbac/src/index.ts:30`), que es control de acceso, no dato de flota. `apps/web/src/app/carrier/reportes/page.tsx:24` lista "Lista de choferes" como texto estático sin query detrás. Depende enteramente del módulo de choferes de Ola 3 — **ese renglón de la bandeja del carrier no se construye todavía**, tal como anticipa §3.

- **¿La hora del próximo turno sale de `route_shifts` directamente, o hay que derivarla?**
  **Hay que derivarla.** `route_shifts` (`packages/db/src/schema/index.ts:251-269`) solo tiene relaciones (cuenta, planta, ruta, turno) y no guarda hora. La hora vive en `shifts.startTime` (`packages/db/src/schema/index.ts:236-249`), una hora nominal fija del día, sin duración ni recurrencia. Ya existe `pickActiveShift` en `apps/web/src/lib/local-time.ts:37-55`, que resuelve el **turno activo** comparando `startTime` contra la hora local — pero no resuelve "próximo turno" cuando ya pasaron todos los del día. Esa extensión hay que construirla antes de la línea de contexto de §2.2.

- **¿Existe el conteo de unidades sin reportar en la última hora, para la barra de flota?**
  **No por unidad.** Existe `IngestHealthService.checkHeartbeat` (`packages/services/src/ingest-health.ts`) y `TelemetryRepository.latestPointAgeMinutes` (`packages/db/src/repositories/index.ts:2873-2883`), que generan alertas `heartbeat_stale` — pero agregados por `carrierAccountId` (la flota completa), no desagregados por `unitId`. Tampoco existe ningún concepto de "en servicio / patio / taller" en el schema. Para la barra de flota de §3 hace falta una query nueva, agrupando `telemetryPoints` por unidad vía `deviceAssignments`, reusando el patrón existente pero desagregado.

**NO existe todavía:** los hallazgos preventivos (deriva, clustering). Ese renglón de la bandeja se construye en Ola 3.

**Si un dato no existe, el renglón no se muestra.** No se inventa el número ni se pinta un cero falso.

---

## 7. Lo que NO lleva

- Selector de cuentas como pantalla de entrada — eso es herramienta interna, y desaparece con `auth-rbac`
- Cifras de cumplimiento, márgenes o tendencias antes de Ola 3
- Gráficas de cualquier tipo en el inicio: los widgets llevan una línea de estado, no visualizaciones
- Colores de veredicto en cualquier agregado. Verde, ámbar y rojo solo en las marcas de la bandeja, donde cada una **sí** representa servicios concretos
