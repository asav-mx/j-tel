# Ficha — Lo que sale del producto: correos y alertas

**Ola 1.b** según `docs/PLAN-v1.md` — *"entrega real de alertas (que lleguen, no que se pinten)"*.
Esa pieza resuelve la **plomería**; esta ficha define el **contenido**, que hoy no existe en ningún lado.

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.

**Reviste:** ninguna ruta — son plantillas de correo, no pantalla.

> **Por qué esta línea existe:** sin ella, contar cuántas pantallas tienen
> diseño obliga a leer las trece fichas y a interpretar. Con ella el conteo se
> rehace solo. La ruta va **en el encabezado y con acentos graves**, para que
> un `grep` la encuentre. Ver `PLAN.md` §8.

---

## 1. Por qué esto importa más de lo que parece

Estos correos llegan a **gente que nunca va a abrir la plataforma**: el jefe del gerente, el dueño del carrier, contabilidad. Para muchos, ese correo es su único contacto con J-Telemetry.

**Y un correo no es una notificación: es un documento.** Se reenvía, se imprime, se archiva, y puede aparecer en una discusión de facturación seis meses después. **Tiene que sostenerse solo, sin acceso al sistema.**

---

## 2. Reglas transversales

Aplican a los cuatro.

### 2.1 Tema claro obligatorio
Sin importar la preferencia del usuario. Un correo oscuro se imprime mal y varios clientes de correo rompen el fondo. Usa la paleta clara del skill (`### Los dos temas`).

### 2.2 El asunto trae el resultado, no un aviso genérico
- **Sí:** `Planta 47 · primer turno del 2026-07-24 — 12 de 14 cumplidos, 2 excepciones`
- **No:** `Tienes una notificación de J-Telemetry`

Se tiene que poder leer sin abrir, y **encontrar por búsqueda dentro de un año**. Lleva siempre la cuenta y la fecha completa.

### 2.3 El sello viaja dentro del correo
Todo correo que reporte resultados incluye, al pie del cuerpo: **cuándo se selló y con qué política**. Reenviado o impreso sigue siendo evidencia.

### 2.4 Una acción principal
Un botón, salvo cuando dos caminos son igual de razonables (el correo 3). Estos correos informan; no son bandeja de trabajo.

### 2.5 Colores
Ámbar para pendientes y avisos del sistema · rojo solo para `no cumplido` · acero para todo lo medido y para avisos operativos del carrier. **Verde solo aparece si el correo reporta un cumplido concreto**, nunca como decoración de "todo bien".

### 2.6 Cada correo dice por qué le llegó
Al pie: el rol y el contrato que lo generan, y un enlace para ajustar preferencias. Excepción: el correo 4.

---

## 3. Los cuatro correos

### 3.1 Cierre del turno · diario · cara planta

**Llega todos los días, incluso cuando todo salió bien.** Si solo llegara con problemas, su llegada sería mala noticia y la gente dejaría de abrirlo.

- **Chip:** `Cerró limpio` (acero) o `Cerró con N excepciones` (ámbar)
- **Titular:** el conteo — *"El primer turno cerró: 12 de 14 servicios cumplidos"*
- **Lede:** hora de sellado completa + *"los resultados están congelados y no se recalculan"*
- **Tabla: solo las excepciones**, con su medida. Los cumplidos se resumen en una línea. Listar 14 renglones esconde los 2 que importan
- **Nota obligatoria si hay pendientes:** que un pendiente **no cuenta como incumplimiento**, y su fecha de cierre
- **Acción:** `Ver el cierre completo`

### 3.2 Pendiente por vencer · por evento · cara planta

El único correo que **pide una decisión con fecha límite**.

- **Único que lleva `Acción requerida` en el asunto.** Si todos lo llevaran, no significaría nada
- **La fecha de cierre exacta en el asunto**, no "pronto"
- **Lede obligatorio:** *"no cuentan como incumplimiento ni como cumplido"*. Sin esa frase, un gerente asume que son fallas y reclama al carrier algo que no pasó
- Tabla con cobertura medida **junto a su umbral**, y fecha de cierre por servicio
- **Se agrupan en un correo**, nunca uno por servicio: tres correos por lo mismo se leen como spam
- Cierra diciendo que si el archivo recupera los puntos, **se verifican solos**

### 3.3 Aviso operativo · por evento · cara carrier

La única alerta **preventiva**: llega mientras todavía se puede hacer algo.

- **Chip en acero**, nunca colores de veredicto: no es resultado de un servicio
- Dice el hecho sin acusar: *"el sistema registra que la unidad operó; no acusa a nadie"*
- **Dice la consecuencia de tardar** — que declarar después queda marcado como tardío. No regaña: explica por qué conviene hoy
- **Reafirma la frontera:** *"tus clientes no ven tus asignaciones ni tu operación interna"*. El carrier debe saberlo en cada contacto
- Dos acciones aquí sí: resolver o investigar primero

### 3.4 Sistema caído · por evento · ambas caras

**El más importante y el que más fácil se hace mal.** Si el archivador se cae y nadie avisa, el silencio se lee como "todo bien".

- **La negación va en el primer párrafo, antes de cualquier dato:**
  > **Esto no significa que las unidades no salieron.** Significa que el sistema no las está viendo.
- **Ámbar, nunca rojo.** No hay veredicto que dar
- Alcance medido: última lectura (fecha completa) · tiempo sin señal como duración · unidades afectadas · servicios en riesgo
- Dice la consecuencia: qué no se podrá verificar mientras dure
- **Y qué pasa si se resuelve:** si la telemetría llega completa, los servicios se verifican con normalidad
- **Único correo que ignora las preferencias de aviso.** Va a todos los roles del contrato: nadie debe operar creyendo que el sistema ve cuando no

---

## 4. Móvil — la mitad que más se lee

Casi nadie abre esto en un escritorio a las seis de la mañana. **La notificación se lee en la pantalla de bloqueo, y muchas veces eso es todo lo que se lee.**

Cada push: **título con el resultado** (≤48 caracteres) y **cuerpo con lo esencial** (≤90). Se sostiene sin abrirse.

| Correo | Título | Cuerpo |
|---|---|---|
| Cierre | `Primer turno cerrado — 12 de 14` | 2 excepciones: Sierra Vista 3 no cumplido, Zaragoza 12 pendiente. |
| Pendiente | `3 pendientes cierran el 26 de julio` | Sin evidencia adicional, la decisión pasa a la planta. |
| Sistema | `Sin telemetría desde las 04:12` | Las unidades pueden estar operando; el sistema no las ve. |

---

## 5. Auditoría de datos

*Requisito de PLAN-v1 §0.*

**Confirmado (mismo origen que las pantallas ya construidas):** resultados del cierre con su hora de sellado y la política aplicada · cobertura medida y su umbral por servicio · estado de pendientes y su cobertura · última lectura de telemetría y el corte del heartbeat (`IngestHealthService.checkHeartbeat`, alertas `heartbeat_stale`).

**Respondido — investigación previa a construir (schema real: Drizzle, `packages/db/src/schema/index.ts`):**

1. **El plazo de cierre del pendiente** (las 48 h del correo 2) — sigue sin existir como regla, es la decisión pendiente de PLAN-v1 §4. **Va en modo demo, declarado**, igual que en la pantalla. Nunca un número horneado que parezca acordado.

2. **A quién se le envía cada correo: ¿ya existe destinatario por rol y contrato, o hay que crearlo?**
   **Hay que construirlo — bloquea el correo 2, tal como anticipaba esta pregunta.** Sí existen los roles (`ClientRole` y `CarrierRole` en `packages/domain/src/index.ts:198-215`) y la tabla puente `userMemberships` (`packages/db/src/schema/index.ts:585-603`, con `accountId` · `clerkUserId` · `role` · `scopeType` · `scopeId`), que resuelve "¿puede este usuario acceder a X?" — pero no la consulta inversa que hace falta aquí: "dame todos los usuarios con rol Y en la cuenta/contrato Z". Además faltan dos piezas: el **email real no vive en la base** (el usuario es solo `clerkUserId`; el correo hay que resolverlo contra la API de Clerk), y `userMemberships` no está vinculado a `service_contracts` — el `scopeType` `"contract"` existe como valor de enum pero ningún membership lo usa hoy. El único mecanismo de envío que existe (`apps/web/src/lib/alertas/canal.ts`, `CanalResend`/`CanalConsola`) no resuelve nada de esto: `leerDestinatarios()` toma una lista fija de la variable de entorno `ALERTAS_DESTINATARIOS`, la misma para toda corrida, y hoy solo sirve para avisos internos de salud de ingesta (J-Staff), no para correos dirigidos a cliente/carrier por contrato.

3. **Preferencias de aviso: ¿existe la tabla?**
   **No existe.** Lo único parecido es `notifications` (`packages/db/src/schema/index.ts:652`), que es una bandeja *in-app* — apunta a un `userId` individual, sin canal ni concepto de "qué avisos quiero recibir por correo". `ingestAlerts` (línea 803) es interno y sin destinatario. **El enlace de "ajustar qué avisos recibo" no se pone todavía** — no se promete lo que no existe.

**Si un dato no existe, ese bloque del correo no se envía.** No se inventa el número ni se manda un cero falso.

---

## 6. Lo que NO llevan

- **Cifras de cumplimiento agregadas** (porcentaje del mes, tendencias). Son juicio, y aplica la misma razón que en el inicio: esperan a Ola 3
- **Gráficas o imágenes.** Se rompen en la mitad de los clientes de correo y pesan
- **Bloque de consecuencias** — enforcement está fuera de v1
- **Adjuntos** en v1. El acta se descarga desde la plataforma, no viaja por correo
- **Tono de disculpa o de alarma.** El registro es el mismo que en pantalla: preciso y tranquilo. La calma es la competencia
