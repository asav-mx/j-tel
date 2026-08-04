# J-Telemetry — El Plan

**Corte: 3 de agosto de 2026.**
**Última edición: 3 de agosto de 2026, tarde** (Clerk resuelto · dominio
resuelto · hallazgo del landing público).

Este es el único plan. Reemplaza a `PLAN-v1.md`, a `Plan-Camino-a-v1.md`, a
`docs/marco-limpio/Despues.md` y a la parte de orden de `DESPUES.md`.

**La jerarquía, completa:**

| Documento | Qué es |
|---|---|
| `Marco-Limpio-J-Telemetry-MAESTRO.md` | **La ley.** Manda sobre todo, incluido este plan |
| **Este documento** | **El orden.** Qué se hace, en qué secuencia, y qué desbloquea qué |
| `DESPUES.md` | **El backlog.** Lo que decidimos no hacer ahora, y por qué. Sin orden ni fechas |

Tres documentos vivos. Ninguno más.

---

## 0. La regla de este documento

> **Toda actualización se hace editando este documento. Nunca creando uno nuevo.**

Si algo cambia, se edita aquí. Si aparece un frente nuevo, se agrega aquí. Si
algo sale del plan, se mueve a `DESPUES.md` y se borra de aquí.

Un plan nuevo con otro nombre no es una actualización: es una contradicción
futura. Ya nos costó — llegamos a tener cinco documentos gobernándose entre sí,
con once contradicciones medidas entre dos de ellos.

**Corolario:** una ficha de handoff describe *cómo* se construye una pieza, no
*cuándo*. Las fichas pueden multiplicarse; el orden vive solo aquí.

---

## 1. Qué es v1

> **v1 es el conjunto de tareas documentadas, terminadas y corriendo en
> producción.**

No es una calificación. Es un estado funcional.

**Y el 90% no mide acierto: mide capacidad de mostrar.**

En el cierre de cada turno, el sistema puede **enseñar evidencia** del ≥90% de
los perfiles y rutas:

- Si **cumplió** → sale como ya está diseñado.
- Si **no cumplió** → se puede mostrar **qué se hizo** y decir **por qué no
  cumplió**, con números auditables.

Esta definición reemplaza a la anterior ("≥90% contra verdad de campo sostenido
dos semanas"). La vieja dependía de que alguien externo declarara cuál era la
verdad. Esta se mide sola: ¿puedes abrir el expediente y explicarlo? Sí o no.

**Lo que la definición nueva arrastra, y hay que decirlo:**

1. **El expediente del no cumplido deja de ser adorno y pasa a ser el corazón de
   v1.** Sin esa pantalla, "explicar por qué no cumplió" es buena intención: el
   motor puede medir el porqué y nadie lo ve.
2. **"El hecho debe bastarse a sí mismo" pasa a ser bloqueante.** Si un veredicto
   no puede explicarse sin salir a buscar cosas que ya cambiaron debajo de él,
   entonces no se puede cumplir esta definición.
3. **Sigue vigente la segunda condición:** ninguna cara de cliente accesible sin
   autenticación.

---

## 2. Reglas de trabajo

**Del repo:**

- Una rama por tarea · todo por PR · nunca directo a `main`.
- **Un carril a la vez**, salvo carpetas distintas (`packages/` vs `apps/web`) y
  worktrees separados.
- **Asav mergea** cuando el PR toca: el motor o cómo se sella un hecho · una
  migración de base · secretos, credenciales o variables · el Marco o este plan.
  **Devin mergea** lo demás: pantallas, reportes, vistas de solo lectura,
  documentos, pruebas, higiene. Si mezcla o hay duda, es de Asav.
- **`main` protegida** (activado el 3 de agosto): checks obligatorios y rama al
  día antes de mergear.

**De la verdad:**

- **Antes de afirmar, verificar.** Si no se midió, se dice como inferencia.
- **Las pruebas deben fallar contra código roto** antes de contar como cobertura.
- **Validar la medición no valida la interpretación.**
- **Cuando lo medido contradice una garantía, el sospechoso es el medidor.**
- **Cada hallazgo tiene derecho a una medición y a un arreglo.** Medir tres veces
  sin construir es no avanzar.

**Las ganadas por las malas:**

1. **Una migración se aplica ANTES de mergear el código que la necesita.** Con
   SQL directo, en transacción. Nunca `pnpm db:migrate` contra producción.
2. **Ordenar por fecha sin techo devuelve el futuro.** El generador crea
   ocurrencias por adelantado.
3. **El fallo silencioso que devuelve de menos es peor que el que revienta.**
4. **Si el default es un secreto, credencial, identidad o URL de base, no lleva
   default: revienta.**
5. **Una rotación de credencial se acompaña de redespliegue en el mismo
   movimiento.**
6. **Antes de mergear una rama vieja, revisar si toca archivos que cambiaron
   mientras esperaba.**

**De producto:**

> *"¿Esto tendría sentido para una planta en Bogotá cuyas rutas nunca hemos
> visto?"* Si sí, es producto. Si solo tiene sentido por una ruta específica, es
> caso de uso y va mal.
>
> **Planta 47 es el laboratorio, no el paciente.**

**Lo que es real y lo que no:** la única cuenta con operación real es **Tecma**.
Honeywell y PRUEBA REAL son cuentas de ejemplo. Ningún análisis, conteo ni
conversación con cliente las incluye.

---

## 3. Lo que solo Asav puede desbloquear

**Esta sección va primero a propósito.** El cuello de botella del plan no es
código: son las entradas que esperan a una persona. Varias están en la ruta
crítica y detienen tramos enteros.

**Al 3 de agosto por la tarde quedan nueve.** Empezaron siendo trece; Clerk y el
dominio se resolvieron el mismo día.

### 3.1 Trámites

| # | Trámite | Qué desbloquea | Estado |
|---|---|---|---|
| **T1** | **Clerk** | Todo el candado, el login real y el tramo vendible | ✅ **Hecho.** Aplicación `J-Telemetry` creada · **sin organizaciones** (verificado contra el código) · **solo Email** · llaves de test en Vercel: la pública en los 3 entornos sin sensitive, la secreta en Production y Preview con sensitive. Las llaves de producción se generan al conectar el dominio |
| **T2** | **Resend** — verificar dominio, API key, tres variables | Que las alertas salgan de verdad. Hoy `/api/cron/alertas` responde 503 cada 5 min: el sistema detecta y no puede avisar | **Pendiente.** Alta. El instrumento existe y no tiene bocina |
| **T3** | **Dominio** | Los subdominios del producto | ✅ **Resuelto: `j-telemetry.com`.** `j-tel.io` queda descartado — pero ver la deuda que deja, abajo |
| **T4** | **Rotar la contraseña del readonly** | `jtel_readonly` y `neondb_owner` comparten contraseña | **Pendiente.** Media. Con redespliegue en el mismo movimiento |
| **T5** | **`CRON_SECRET`** | — | ✅ Rotado. Queda anotado que el valor viejo sigue en el historial de git |

**Deuda que deja T3:** `j-tel.io` **no vive solo en documentos — está en el
landing público**, en `landing/page.tsx`, su CSS, nueve archivos de prueba, el
Brief de identidad y tres fichas del Marco. Cambiar el dominio toca la cara de
afuera del producto. **No es configuración: es un frente.** Va junto con la
portada (Tramo 1, pieza 1.f).

### 3.2 Decisiones

Cada una lleva **la recomendación del chat** y el porqué. Asav decide.

---

**D1 · Los 294 hechos sellados con el deadline mal calculado**

*Qué pasa:* el deadline dependía de dónde corrió el generador. Ya hay corrección
de código; la pregunta es qué se hace con los **294 hechos ya sellados** bajo la
regla vieja.

*Recomendación:* **corregirlos, con firma y motivo canónico.** Un hecho sellado
contra un deadline equivocado es una acusación mal medida, y la ley dice que la
política cambia hacia adelante pero un **error** de cálculo no es un cambio de
política: es un defecto. Se corrige como re-verificación explícita y auditada, no
en silencio.

*Bloquea:* el orden es primero el código, después los datos.

---

**D2 · Turno B de Planta 47 — declarado 18:00, operado ~14:00**

*Qué pasa:* falla 6 de 6 días, 36 de 86 fallos. **No es código: es una
conversación con la Planta** para confirmar la hora real y a qué turno pertenecen
esas rutas.

*Recomendación:* **tener esa conversación antes de tocar el árbitro.** Es
probablemente parte del 6.7% de Planta 47 que no tiene causa identificada, y
arreglar el motor sin resolver esto mete ruido en la medición.

*Ojo:* `PLAN-v1.md` lo declaraba ✅ resuelto. **Estaba equivocado.** Ver §7, F1.

---

**D3 · Regla de cierre del pendiente por evidencia**

*Qué pasa:* hay **71 servicios de Tecma** atorados en `pendiente_evidencia` desde
hace más de 48 h (54 de Planta 47, 17 del Campus, del 9 al 31 de julio). **Los 71
tienen evidencia guardada.** No están pendientes por falta de datos: el motor,
teniendo los puntos, no logró atribuir unidad.

*Qué hay que decidir, con la Planta y con legal:* cuánto tiempo puede un servicio
quedarse en pendiente, y qué pasa después.

*Recomendación:* **no decidir esto hasta entender por qué no atribuyó.** Si la
causa es del motor, la regla de cierre sería tapar un defecto con una política.
Primero la investigación de atribución (§5, C3), después la regla.

---

**D4 · Re-verificación de las 300 congeladas**

*Qué pasa:* 300 ocurrencias de Planta 47 con deadline corrido. El PR #124 está
abierto a propósito como foto de referencia. La simulación del 30 de julio con el
motor arreglado dio **139/160/1**, contra 91/209/0 con la ventana rota.

*Recomendación:* **no re-verificar todavía.** Esperar a que el árbitro esté
afinado y `route_traversal_measurements` tenga historia real. Cada
re-verificación mete una versión más en la historia del hecho: no es gratis.

---

**D5 · Cómo se le cuenta a Tecma que su número cambia**

*Qué pasa:* cuando se re-verifiquen las 300, el número de cumplimiento de Tecma
va a moverse. Hacia arriba, y por verdad — pero se mueve.

*Recomendación:* **preparar el mensaje antes de que el número cambie, no
después.** El encuadre correcto es que el árbitro estaba siendo injusto **contra
el carrier** y se corrigió; eso fortalece la neutralidad del producto en vez de
debilitarla. Decidir esto antes de D4.

---

**D6 · Qué contratos permiten que la planta modifique la política sin acuerdo del
carrier**

*Qué pasa:* hoy la política se sobrescribe al editarse. La pieza de "acuerdo de
las partes" está anclada a `auth-rbac`, pero **la política de producto es
decisión de Asav**, configurable por contrato.

*Recomendación:* **configurable, con un piso no negociable.** Hay contratos donde
la planta se reserva el derecho de modificar a su criterio, y eso es legítimo. Lo
que **nunca** es opcional es que exista método de comunicación: el carrier se
entera del cambio, siempre, aunque no tenga que aprobarlo. Una tolerancia que
cambia sin que el auditado lo sepa rompe al árbitro ante quien lo mira.

---

**D7 · Dirección visual del producto**

*Qué pasa:* marcada en rojo y **bloquea pantallas**. Necesita tres respuestas de
Asav que este plan no puede suplir.

*Recomendación:* **resolverla en sesión con el chat de diseño**, no aquí. Pero
resolverla pronto: hay trabajo de interfaz esperando y no está esperando a Devin.

---

**D8 · Qué dominio manda** — ✅ **RESUELTA el 3 de agosto**

**El dominio del producto es `j-telemetry.com`.** `j-tel.io` queda descartado y
sale del plan como trámite. Lo que queda es la deuda de sacarlo del landing y del
código, que va en el Tramo 1 junto con la portada.

---

**D9 · El modelo de altas** — ✅ **DECIDIDA el 3 de agosto, sin diseñar**

*El criterio, ya fijado:* una cuenta **no se crea sola, se invita.** Dos caminos
de entrada: **invitación de J-Tel**, o **solicitud del cliente, planta o carrier**
aprobada desde la configuración de cuentas de J-Staff. Una cuenta puede tener
**uno o varios usuarios** monitoreando su servicio, según el cliente.

*Dónde vive:* Tramo 7, junto con el interruptor de J-Staff y la administración de
usuarios. **No se diseña todavía** — decorar una casa sin puerta es el orden
equivocado. La decisión queda tomada para no volver a discutirla cuando llegue.

*Estado hoy, y es importante:* **el único usuario del sistema es Asav.** No
existe el flujo de altas, no hay personas reales de Tecma ni de Juárez Bus
entrando. El mapeo de identidad (Tramo 1) mapea **una sola identidad**; las otras
tres filas del seed se quedan intactas hasta que haya gente real.

---

### 3.3 Trabajo humano que no es código ni decisión

**H1 · Las tres rutas con falla real** — Huertas-B, Centro-A, Parajes del Sur-A,
~43 servicios. Necesitan que **una persona abra el KML en un visor y lo compare a
ojo**. No lo puede hacer el motor ni Devin. Es falla real de trazado, no del
reloj.

---

## 4. El orden de construcción

**Regla:** un tramo se cierra antes de abrir el siguiente. Si algo aparece a
media obra, se anota en `DESPUES.md` y se replantea al cerrar el tramo, no a
media fase.

### Tramo 0 — El incendio · ✅ CERRADO el 3 de agosto

Lote del INSERT · `sin_evidencia_posible` · tope de cola · consulta acotada ·
rastro en el ledger · contador de fallos mudos (2 h) y de pendientes estancados
(48 h) · `/api/salud` mide verificación · **el archivador es la única puerta al
proveedor** · **la llave demo cerrada**.

PRs #203 · #204 · #205 · #206 · #207 · #208. `main` protegida.

---

### Tramo 1 — El candado

**Por qué primero, y ahora con evidencia:** el 3 de agosto se abrió
`j-telemetry.com` y **la portada muestra, sin login**, tres tarjetas que entran
directo a Cara Cliente, Cara Carrier y J-Staff, con enlaces nombrados «Tecma» y
«Juárez Bus», más un bloque «Estado del sistema» que imprime los nombres de los
clientes.

Son **dos defectos distintos** y hay que decirlos por separado:

1. **No hay login.** La portada entra a los datos sin preguntar quién eres.
2. **Filtra nombres de clientes en una página pública.** Contra la ley de que una
   planta jamás ve otra — y el mundo no debería ver a ninguna.

Hoy solo lo tapa la protección de despliegue de Vercel. Eso no es un candado: es
una cortina.

| Pieza | Qué | Orden |
|---|---|---|
| **1.a** | **Mapeo de identidad.** Ligar la identidad de Clerk de Asav a `jstaff_admin` (global). **Se agrega, no se reemplaza** — las cadenas del seed son lo que hoy sostiene el acceso; reemplazarlas deja las pantallas en blanco sin error. Tres piezas: `vincular()` en `MembershipRepository` · archivo de mapeo versionado con `user_...`, sin correos · ejecutor en seco por omisión | **Primero.** Destraba la ficha de permisos entera |
| **1.b** | `lib/guardia-pagina.ts`, hermana de `guardia-api.ts`, **reutilizando `decidir`, no duplicándola**. Hace `redirect()`, no HTTP. Falla cerrado | |
| **1.c** | Aplicarla en las **65 páginas** (`jstaff` 9 · `cliente` 41 · `carrier` 15), empezando por `/jstaff` — es donde vive el razonamiento del árbitro | |
| **1.d** | **Junto aquí, no aparte:** el filtro de unidades por membresía del #138 cerrado, en `inicio-corporativo-data.ts:121`. Conservar sus dos advertencias como texto | |
| **1.e** | Cerrar el default `tecma_admin`. **Va después de 1.c** o quedamos todos fuera | |
| **1.f** | **La portada.** Una ruta con dos caras: **sin sesión → landing público; con sesión → portada**, y la portada **enseña solo lo tuyo** (de las membresías, no de `listByType`). **Sin nombres de clientes.** El bloque «Estado del sistema» **se quita, no se protege** — ya vive en `/jstaff` y en `/api/salud`. Aquí entra también sacar `j-tel.io` del landing y su CSS | |
| **1.g** | Quitar el valor viejo de `CRON_SECRET` del historial y de los documentos | |

**Regla de oro mientras dure este tramo:** **no iniciar sesión en Clerk hasta que
1.a esté hecho.** La sesión de Clerk gana sobre el bypass de desarrollo; entrar
antes convierte la identidad en un `user_...` sin membresías, y como el candado
todavía no cierra puertas, las pantallas abren **vacías en vez de dar error**. Se
ve como producto roto. `JTEL_DEV_USER=jstaff_admin` sigue puesto en Vercel.

**El candado no puede preguntar "¿hay identidad?".** Con `JTEL_DEV_USER` puesto,
el bypass le da identidad a **todo el mundo**: un visitante anónimo de producción
*es* `jstaff_admin` con sus membresías. La guardia tiene que exigir **sesión de
Clerk real** — el campo `sesionActiva` de `getIdentidad()` existe para eso. Por
eso 1.a va antes que 1.b, y no al revés.

**Prueba de aceptación (ya escrita en el código):** `/quien-soy` debe decir
`origen: clerk` con las membresías **pobladas**, no vacías.

**Compuerta:** ventana anónima contra `/jstaff/*` → redirección, nunca contenido ·
un usuario con membresía solo de carrier no abre ninguna pantalla de cliente ·
**la portada pública no nombra a ningún cliente.**

---

### Tramo 2 — Ordenar el árbitro (no arreglarlo)

**No toca el motor.** Es leer, medir y ordenar. Ver §5, que es esta ficha viviendo
dentro del plan.

**Por qué existe:** las causas se solapan sobre las mismas rutas. Arreglar una sin
saber cuál movió el número reproduce el problema.

**Compuerta:** cada causa de §5 tiene medición, dependencia y ruta compartida
declarada.

---

### Tramo 3 — Arreglar el árbitro

En el orden que el Tramo 2 determine, **no en el orden en que están listadas**.

- **Nada se sella hasta que se pueda medir el efecto por separado.**
- Una causa por PR. No se mezclan dos cambios de comportamiento del motor.
- Cada arreglo trae su medición de antes y después.

**Aquí vive la identificación por capas** — seis señales que acumulan confianza y
ninguna condena sola: llegada a geocerca (la más robusta, ya existe) · corredor ·
match fino (solo con densidad suficiente) · huella histórica · patrón de paradas ·
rol declarado (**opcional siempre**; si el sistema depende de que alguien declare,
dejó de ser autónomo).

---

### Tramo 4 — Que el hecho se baste a sí mismo

**Bloqueante para la definición de v1.** Un hecho sellado tiene que contener —o
referenciar de forma inmutable— todo lo que hizo falta para producirlo. Hoy sale a
buscar cosas del catálogo que pudieron cambiar debajo de él.

| Qué le falta cargar | Estado medido |
|---|---|
| Política del contrato | ✅ se congela byte a byte |
| Unidad de cada punto de evidencia | ✅ anclada |
| Asignación equipo ↔ unidad | ✅ temporal, resuelta por fecha |
| Versión de trazado | 🟡 referenciada en 92.5% **pero el motor no la lee** — re-resuelve por fecha |
| Conjunto de variantes evaluadas | ❌ no se congela |
| Forma de la geocerca | ❌ no se versiona, y el campo guardado no es el que el motor usó (546 divergen) |
| Versión del motor | ❌ |

**Por qué es bloqueante y no deuda:** sin esto, explicar un no cumplido de julio
leyendo el motor de agosto **miente sin querer**. Y explicar es la mitad de la
definición de v1.

---

### Tramo 5 — Ver y explicar

**Aquí se cumple la segunda mitad de la definición de v1.**

| Pieza | Qué |
|---|---|
| **Expediente del no cumplido** | **El corazón.** Mapa con los dos trazos encimados —contratado punteado, real sólido—, divergencias resaltadas, enunciados medidos al lado, y para la planta el botón "aprobar esta variante hacia adelante" |
| Diff estructural | Dónde dejó el trazado, cuántos km por fuera, dónde lo retomó, qué tramo omitió. **Números auditables** |
| Cumplimiento (dos caras) | Las cifras de juicio, que hasta aquí no se muestran |
| `mapa-instrumento` · `vista-de-ruta` · `preventivo-jtel` | |
| Tablero de calibración | |
| Módulo de choferes | |

---

### Tramo 6 — Re-verificar y sostener

- Simulación nueva con el motor afinado, contra 139/160/1 y 91/209/0.
- **Con el número en mano**, decidir si se re-verifica formalmente (D4), con firma
  y motivo canónico.
- Sostener el ≥90% **de capacidad de mostrar** dos semanas · cero rojos sin
  expediente · ningún hecho sellado sobre cuenta no declarada · ningún hecho cuya
  frontera de evidencia viva fuera de él.

---

### Tramo 7 — Vendible

| Pieza | Qué |
|---|---|
| `auth-rbac` cerrado | Guardia por alcance, no por cuenta · administración de usuarios · retirar el bypass |
| **Lenore-vigía** | Alertas preventivas durante la operación: *"6 unidades no reportan y el turno cierra en 20 minutos"*. **No está bloqueada por nada técnico** — necesita T2 (que las alertas salgan) y saber a quién avisar |
| **Lenore-narradora** | El diff estructural contado en cristiano dentro del expediente. **Bloqueada por el Tramo 4** |
| Interruptor de J-Staff | Activar / desactivar / eliminar cuentas y contratos. Hoy la única vía es tocar la base a mano, y eso no es producto. **Desactivar es hacia adelante y no toca el pasado; eliminar abre la pregunta de qué pasa con los hechos ya sellados.** Y J-Staff **enuncia, no esconde**: los excluidos por cuenta de ejemplo se muestran con su motivo |
| **J-Staff altas y demos** | Con el modelo ya decidido en **D9**: invitación de J-Tel o solicitud del cliente aprobada desde J-Staff · uno o varios usuarios por cuenta |
| Pase de interfaz final | |

**Compuerta de v1:** un cliente nuevo se da de alta, entra con su usuario, ve solo
lo suyo, y el ≥90% de capacidad de mostrar se sostiene.

---

## 5. Las causas del árbitro

**Esta es la ficha de consolidación.** Vive aquí, no en un documento aparte.

**Son once, no seis.** El plan viejo decía seis en una línea y listaba ocho en su
propia tabla; el 3 de agosto se sumaron tres más.

| # | Causa | Qué se sabe | Estado |
|---|---|---|---|
| **C1** | **Cuentas demo con veredictos vinculantes** | 84 hechos sellados sobre cuentas no declaradas (52 de ellos `no_cumplido`). Crecía ~11/semana | **Llave cerrada** (#206). Falta limpiar los 84 — con firma y motivo |
| **C2** | **La cadena de auditoría rota** | 374 de 580 filas de historial (64.5%) perdieron la referencia a qué las reemplazó. El borrado en cada reintento deja `replaced_by_fact_id` en nulo | Sin construir. **Toca la promesa comercial**: sin cadena, un veredicto no puede probar de dónde vino |
| **C3** | **Se juzga antes de que llegue el expediente** | ~175 intentos por servicio. El archivador va ~7 h detrás (p95: 30 h) y nada retrasa el primer intento | Sin construir. **Arreglar esto probablemente elimina la mayor parte de C2** |
| **C4** | **La geocerca congelada no es la que se usa** | El hecho guarda `expectedGeofenceId`; el motor juzga contra `profile.geofence`. **546 ocurrencias divergen** | Sin construir. Requiere D-decisión: congelar el polígono, qué pasa con el campo huérfano, cómo se re-verifica un hecho viejo |
| **C5** | **Ventana derivada vs. match observable** | No afinados entre sí: +50 se enderezan por uno, −2 se caen por el otro | Espera historia en `route_traversal_measurements`. **No es trabajo, es tiempo** |
| **C6** | **Trazado KML que no corresponde** | Huertas-B, Centro-A, Parajes del Sur-A · ~43 servicios | **Trabajo humano** (H1), no código |
| **C7** | **`maxRouteDurationMinutes` fijo en 60** | Segundo "cuánto dura una ruta" sin derivar. Hoy no causa falsos negativos | **Tarea propia, no se mezcla.** Dos derivaciones cambiando juntas hacen inatribuible el resultado |
| **C8** | **Identificación en vivo** | La sala no sabe qué unidad cubre qué ruta antes del cierre | Se piensa junto con C1 y C4 |
| **C9** | **Nombre del chofer sin congelar** | Falta congelarlo en `complianceFacts` al sellar | Toca el camino del árbitro |
| **C10** | **Planta 47 sella 6.7% vs Campus 55.2%** | Diferencia medida, **causa no identificada** | Probablemente conectada con D2 (Turno B) y con C11 |
| **C11** | **71 de Tecma con evidencia y sin atribución** | 54 de Planta 47, 17 del Campus. **Todos tienen evidencia guardada.** El motor no logró atribuir unidad | **En investigación.** Puede ser causa nueva o manifestación de otra |

**Rutas compartidas:** Huertas-B aparece en C5 y en C6. Planta 47 aparece en C10,
C11 y D2. Ninguna de esas se arregla sin saber cuál movió el número.

**Dependencias conocidas:** C3 → C2 (arreglar cuándo se juzga reduce el borrado) ·
C5 espera datos, no trabajo · C4 y C1 comparten la pregunta "qué se congela dentro
del hecho", que es el Tramo 4.

---

## 6. Lo que NO entra en v1

Queda en `DESPUES.md`. No bloquea.

**Sin diseñar:** Diésel · Taller · Rastreadores · Inspecciones · Reportes ·
J-Staff completo · móvil.

**Bloqueado por datos, se llena solo:** duración esperada de ruta · rendimiento de
diésel · lectura del cambio de rastreador.

**Legales, no bloquean v1:** qué contiene un export con evidencia · qué hace
probatorio un documento en una disputa.

**Conceptos v2:** Sandbox · map matching como capa de explicación · promoción de
variantes · **modo pasajero** · pre-nómina · Lenore-auditora · Lenore-copiloto de
configuración · Lenore-detección de deriva · Lenore-copiloto general.

**Advertencia que no se puede perder:** la perilla `destino_only` de
`routeStrictness` **está reservada para el modo pasajero y no se usa como
estabilizador**. Ponerla para que un contrato deje de salir rojo es apagar la
verificación de ruta y llamarlo otra cosa.

---

## 7. Contradicciones resueltas

Registro de las once contradicciones medidas entre `PLAN-v1.md` y `DESPUES.md`, y
cuál ganó. Se conserva para que nadie las reabra.

| # | Qué | Resolución |
|---|---|---|
| **F1** | **Turno B de Planta 47** | `PLAN-v1` decía ✅ resuelto. **Falso.** Gana `DESPUES.md`: falla 6 de 6 días y está bloqueado por una conversación con la Planta que no ha ocurrido — **D2** |
| **F2** | Las 300 | La simulación **ya se corrió** (139/160/1 el 30-jul). El bloqueo es otro: falta afinar C5 e historia en `route_traversal_measurements` — **D4** |
| **F3** | Historia de la política | **Entregada** en #125 y en producción. `PLAN-v1` la listaba como faltante |
| **F4** | Historial / vista de flota | **Construido** y ya conectado al resumen. Se resuelve a favor de `PLAN-v1` |
| **F5** | Política como acuerdo vivo | Es **v1**: pieza 1 hecha, pieza 2 (cláusula) pendiente, pieza 3 anclada a `auth-rbac` — **D6** |
| **F6** | `maxRouteDurationMinutes` | Entra a v1 como **C7**, tarea propia |
| **F7** | Historia del sello | v1, componente parcial: falta la columna de causa |
| **F8** | **Lenore v1** | **No estaba en el camino, ni programada ni excluida.** Resuelto: vigía y narradora entran en v1, Tramo 7. La narradora bloqueada por el Tramo 4; **la vigía no está bloqueada por nada técnico** |
| **F9** | Auth / seguridad | Es **condición no negociable de v1**. Tramo 1 y Tramo 7 |
| **F10** | `jrz-pass` | **Descartado.** `jrz-drone-os` es fuente de datos, nunca de código ni de diseño |
| **F11** | Las tablas de decisiones no coincidían | Reemplazadas por §3 de este documento, que es la única |

**Contradicción interna de `DESPUES.md`** (sobre si la zona horaria empeoró el
cálculo o si nunca se leyó): **queda abierta.** Requiere medición antes de
escribirse aquí como hecho. No se arrastra a este plan.

**Resuelto también, fuera de esas once:** el número de hechos demo. Los documentos
decían 73; la medición del 3 de agosto dio **84**, porque el cron siguió sellando
mientras la llave estaba abierta.

---

## 8. Estado del repo

`asav-mx/j-tel` · Next.js, Neon/Postgres, Vercel (`j-tel-web`).
Paquetes: `db` · `domain` · `verification` · `services` · `gps-umbrella` ·
`auth-rbac` · `reports`.

**Construido y en producción:** las dos caras completas (13 pantallas, datos
reales, dos temas — **el frente visual está cerrado**) · cinco expedientes ·
26 de 26 rutas de API guardadas · identidad sin enforcement · historia de la
política · plomería de alertas · el árbitro con sus cuatro arreglos de ventana.

**La foto de referencia del 3 de agosto** de los documentos viejos vive en
`docs/corte-2026-08-03/`. Es foto, no ley. No se edita.

---

## 9. Bitácora de ediciones

Toda edición de este documento se anota aquí, con fecha y qué cambió. Es la forma
de saber por qué el plan dice hoy algo distinto a la semana pasada, sin tener que
adivinar.

**3 de agosto de 2026 — creación.** Unifica `PLAN-v1.md`, `Plan-Camino-a-v1.md` y
los dos `Despues.md`. Resuelve las once contradicciones medidas entre los dos
primeros (§7). Adopta la definición nueva de v1 (§1), que sube el expediente del
no cumplido a corazón de v1 y convierte "el hecho debe bastarse a sí mismo" en
bloqueante.

**3 de agosto de 2026, tarde.**
- **T1 Clerk: hecho.** Sin organizaciones (verificado contra el código: el
  alcance de seis niveles no cabe en una organización plana, y un usuario
  necesita varias cuentas a la vez). Solo Email. Llaves de test en Vercel.
- **T3/D8 dominio: `j-telemetry.com`.** `j-tel.io` descartado; queda la deuda de
  sacarlo del landing y su CSS — pieza 1.f.
- **D9 modelo de altas: decidido**, sin diseñar. Invitación o solicitud aprobada
  desde J-Staff.
- **Hallazgo: la portada pública entra a los datos sin login y nombra a los
  clientes.** Nuevo, no estaba en ningún documento anterior. Sube el Tramo 1 y le
  agrega la pieza 1.f.
- **El mapeo de identidad se simplifica:** hoy el único usuario del sistema es
  Asav. Una sola identidad se mapea; las otras tres filas del seed quedan
  intactas. Y **se agrega, no se reemplaza** — reemplazar dejaría las pantallas
  en blanco sin error.
- Bloqueos de §3: de trece a nueve.
