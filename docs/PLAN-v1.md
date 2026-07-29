# J-Telemetry — Plan de v1

**Corte: 30 de julio de 2026.** Este documento existe para una razón concreta:
que el plan completo NO viva en la cabeza de nadie. Si se pierde un chat, se
cambia de asistente o pasan tres semanas, esto se lee y se retoma sin perder
nada.

`DESPUES.md` es el backlog (qué hay que hacer, con su razón).
**Este documento es el orden** (en qué secuencia, y qué desbloquea qué).
El `Marco-Limpio-J-Telemetry-MAESTRO.md` manda sobre los dos.

---

## 0. Cómo se usa este plan

**Tres papeles, y no se cruzan:**

| Quién | Qué hace |
|---|---|
| **Asav** | Decide producto, hace las llamadas que solo él puede hacer, mergea los PR. **No necesita recordar el plan** — lo lee aquí. |
| **El chat de arquitectura** | Sostiene el mapa. Valida contra el Marco. Antes de cada pantalla, saca su auditoría de datos. Redacta los recados a Devin. |
| **Devin** | Construye. Corre cadenas completas sin parar en cada paso; se detiene solo en decisiones de producto, escritura sobre veredictos sellados, o algo que contradiga el plan. |

**La regla que hace esto posible:** cada ola tiene una **compuerta de salida**
medible. No se pasa a la siguiente ola por sensación de "ya quedó", sino porque
la compuerta se cumplió con evidencia. Eso es lo que evita que algo se quede
suelto.

**Antes de construir cualquier pantalla:** auditoría de datos primero — de dónde
sale cada número, qué existe en la base, qué falta. Nada de cifras inventadas.
Esa regla ya salvó el proyecto varias veces.

---

## 1. La meta que define el fin de v1

> **≥90% de servicios correctamente resueltos** contra verdad de campo
> (cumplidos que sí fueron · no cumplidos con expediente · pendientes solo por
> observación insuficiente), **sostenido dos semanas**, con **cero acusaciones
> sin evidencia**.

No es "todas las pantallas perfectas". Es que el árbitro sea creíble. Esa cifra
es la que levanta capital para el GPS propio.

**Segunda condición de salida, no negociable:** ninguna cara de cliente accesible
sin autenticación. Hoy `/cliente/*` no tiene llave.

---

## 2. Los dos candados (esto ordena todo lo demás)

**Candado 1 — La identificación confiable manda sobre las pantallas de juicio.**

Hoy el match contra KML hace dos trabajos con una sola señal frágil: identificar
quién hizo la ruta, y juzgar si cumplió. Cuando el mapa o el corredor se mueve,
se pierden las dos. Prueba: 8 unidades entraron a la geocerca y el sistema dictó
"sin servicio detectado".

Consecuencia para el plan: **toda pantalla que muestre "quién cumplió / quién no
/ por qué" espera a la Ola 2.** Construirla antes es ponerle números que todavía
no son de fiar — y una pantalla bonita sobre un dato falso hace dudar del
veredicto, que es el único activo del producto.

**Candado 2 — `auth-rbac` cierra antes del primer login real.**

No bloquea *construir*, pero sí bloquea *enseñar*. Es ley de la Pieza 4 del
Marco: una planta jamás ve otra planta. Arranca temprano (Ola 1) y cierra en
Ola 4, antes de que cualquier cliente vea su primera pantalla real.

---

## 3. Las cuatro olas

### Ola 0 — cerrar lo que está en vuelo

Lo que ya está en la mesa y no debe quedarse a medias.

| Pieza | Estado |
|---|---|
| PR #102 — Cierre del turno (con los tres arreglos) | Listo para merge |
| PR #100 — bandera `--sql` | Abierto, chico |
| PR #101 — el hecho autosuficiente + geocercas | **Ya en `main`** — verificar qué quedó cubierto y qué no |
| Turno B de Planta 47 | **Decisión de Asav — llamada a la Planta** |
| Regla del pendiente por evidencia | **Decisión de Asav** — hoy en modo demo |

**Compuerta de salida:** los tres PR en `main`, desplegados y verificados en
producción. El Turno B confirmado o explícitamente aplazado por escrito.

---

### Ola 1 — lo que ya se puede construir sin esperar nada

Todo lo de aquí lee **hechos ya sellados** o es plomería. Ninguna pieza depende
de que la identificación mejore, así que se puede construir hoy y no se va a
tener que rehacer.

**1.a — Plomería de operación (Fase 0 restante).** No es pantalla bonita, pero es
lo que evita otro apagón silencioso de 13 horas.

- Bitácora `cron_runs` — que quede registro de cada corrida
- **Entrega de alertas** — que las notificaciones de verdad lleguen, no solo se
  pinten en pantalla
- Semáforo de J-Staff

**1.b — Pantallas sobre hechos sellados.**

- **`pendiente-por-evidencia`** (cara planta) — la primera. El estado más
  honesto del producto hecho pantalla. La regla de cierre va en modo demo hasta
  que Asav la defina con la planta y legal.
- **`historia-del-sello`** — componente, no pantalla. Se enchufa en Cierre del
  turno y en el expediente. Falta la columna de causa.
- **`oficina-contrato`** (configuración) — gana su lugar temprano por una razón
  medida: Planta 47 nos enseñó que **los errores de configuración causan
  veredictos malos**. Una buena pantalla de config sube el número de v1 sin
  tocar el motor.
- **`flota-dia-completo` / `unidad-dia`** (cara carrier) — censo propio del
  carrier. Ya empezó con la vista de Recorrido.

**1.c — Sin datos, en paralelo.**

- **`landing-jtel` / `parvada-ciudad`** — el landing es excepción total del
  lenguaje de producto; no trata datos ni veredictos. Se puede trabajar sin
  bloquear nada.

**1.d — Arranca `auth-rbac`** (conectar el paquete a endpoints reales).

**Compuerta de salida:** las alertas llegan de verdad a un destinatario real y se
comprueba. Las cuatro pantallas en producción con su auditoría de datos hecha —
cero números sin origen.

---

### Ola 2 — el árbitro confiable (la obra grande)

**Aquí vive el 90%.** Es la ola más larga y la más importante. Todo lo de la
Ola 3 espera a que esto cierre.

**2.a — Separar identificar de juzgar (identificación por capas).**

Señales independientes que acumulan confianza, en vez de una sola señal frágil:

1. **Llegada a geocerca** — señal primaria, robusta, ya existe
2. **Corredor (métrica B)** — confirma el camino, tolerante al temblor del GPS
3. **Match fino (métrica A)** — califica fidelidad, **solo con densidad suficiente**
4. **Huella histórica** contra viajes ya aceptados — autocalibrante
5. **Patrón de paradas** — inferido, habilita modo pasajero a futuro
6. **Rol declarado del coordinador** — **opcional siempre** (la autonomía es la promesa del producto)

La torre identifica **provisional** en vivo con % de confianza; la llegada
**confirma**. Monitoreo en tiempo real y veredicto robusto conviven sin
contradecirse.

**2.b — Compuerta de densidad.** Compuerta, no normalizador. El umbral se deriva
de la geometría (ping × velocidad × separación), no se adivina. Si no se vio con
calidad suficiente — `pendiente_evidencia`, nunca acusación.

**2.c — Verificar qué dejó pendiente el #101.** El hecho debe cargar todo lo
necesario para reproducirse: política —, versión de trazado, forma de la
geocerca, versión del motor. Confirmar con evidencia cuáles quedaron cubiertos —
es prerrequisito de Lenore.

**Compuerta de salida — la más importante del plan:** medir contra verdad de
campo y alcanzar el **≥90% sostenido dos semanas**, con cero rojos sin
expediente. Esta compuerta es la que dice si v1 existe.

---

### Ola 3 — ver y explicar (ya sobre datos confiables)

Aquí aterriza casi todo el diseño. Cada pantalla de aquí muestra juicio, y por
eso esperó a la Ola 2.

- **`expediente-carrier` / `expediente-dos-recortes`** — la Ley 2 hecha pantalla:
  todo `no_cumplido` carga su evidencia y su porqué medido. Ahora el "porqué" es
  confiable.
- **`cumplimiento` + `preventivo-jtel`** — tendencias y lo que se está formando
  antes de que explote. Sobre datos limpios, no basura.
- **`mapa-instrumento`** — capas prendibles: resultados, huecos de señal,
  kilómetro muerto. (Sin la capa de quejas — quejas está fuera de v1.)
- **`vista-de-ruta`**
- **Pieza 2 + Tablero de calibración** — se alimenta de la identificación de la
  Ola 2.

**Compuerta de salida:** cada pantalla con su auditoría de datos. Ningún
`no_cumplido` en pantalla sin su expediente al lado.

---

### Ola 4 — vendible

- **`auth-rbac` cerrado** — ninguna cara de cliente sin llave. **Bloqueante.**
- **Lenore v1** (vigía + narradora) — la desbloquea el hecho autosuficiente.
  Lenore narra, correlaciona y audita; **jamás opina dentro del veredicto.**
  La matemática decide, la AI explica.
- **J-Staff — altas y demos** — dar de alta cuentas y montar demos sin tocar código.
- **Landing `j-tel.io` + pase de UI final.**

**Compuerta de salida:** un cliente nuevo se da de alta, entra con su usuario, ve
solo lo suyo, y el número del ≥90% se sostiene. Eso es v1 en producción.

---

## 4. Las decisiones que solo Asav puede tomar

Esta es la lista corta que sí conviene tener presente. Todo lo demás lo carga el
plan.

| # | Decisión | Cuándo se necesita | Estado |
|---|---|---|---|
| 1 | **Turno B de Planta 47** — hora real del turno de tarde. Llamada a la Planta. Vale ~36 servicios. NO está en el Gmail. | Ola 0 | Pendiente |
| 2 | **Regla del pendiente por evidencia** — cuánto dura y qué pasa al vencer (con la planta y legal). | Ola 1 (hoy en modo demo) | Pendiente |
| 3 | **Los 294 hechos viejos** con hora mala — ¿se corrigen o se dejan? | Antes de cerrar Ola 2 | Aplazada |
| 4 | **`jornada-instrumento`** — ¿quedó superseded por Cierre del turno? | Ola 3 | Por confirmar |

---

## 5. Fuera de v1 — por decisión, no por olvido

Esto no está en las olas porque Asav lo sacó del alcance a propósito. Queda
escrito para que no se relea como hueco.

| Qué | Por qué fuera | A dónde va |
|---|---|---|
| **Quejas** (`queja-expediente`) | Circuito completo, no cabe en v1 | Después de v1 |
| **Caminos candidatos** (`como-reconoce-caminos`, Ficha 3) | La identificación de la Ola 2 corre sobre variantes **ya aprobadas**; descubrirlas es otra obra | v1.1 |
| **Ficha 4 — incidentes** | Circuito carrier — planta — re-juicio | Después de v1 |
| **Enforcement / bloque de consecuencias** | Primero el árbitro confiable. Encenderlo antes multiplica errores en vez de corregirlos | Después del ≥90% |
| **Map matching** (red de calles) | Idea fuerte y determinista, sin investigar. Probar barato antes de comprometerse | v1.1 |
| **Modo pasajero** | Depende de jrz-pass | Futuro |

---

## 6. Los 17 mockups — dónde vive cada uno

Para que ninguno quede flotando.

| Mockup | Ola | Nota |
|---|---|---|
| `cierre-del-turno` | — **Construido** | PR #102 |
| `pendiente-por-evidencia` | Ola 1 | La primera de la ola |
| `historia-del-sello` | Ola 1 | Componente, no pantalla |
| `oficina-contrato` | Ola 1 | Config previene veredictos malos |
| `flota-dia-completo` | Ola 1 | Cara carrier |
| `unidad-dia` | Ola 1 | Cara carrier |
| `landing-jtel` | Ola 1 | Excepción del lenguaje de producto |
| `parvada-ciudad` | Ola 1 | Landing |
| `expediente-carrier` | Ola 3 | Espera identificación |
| `expediente-dos-recortes` | Ola 3 | Espera identificación |
| `cumplimiento` | Ola 3 | Espera identificación |
| `preventivo-jtel` | Ola 3 | Espera identificación |
| `mapa-instrumento` | Ola 3 | Sin capa de quejas |
| `vista-de-ruta` | Ola 3 | Espera identificación |
| `como-reconoce-caminos` | **Fuera de v1** | Ficha 3 — v1.1 |
| `queja-expediente` | **Fuera de v1** | Quejas |
| `jornada-instrumento` | **Por confirmar** | ¿Superseded por Cierre del turno? |

---

## 7. Las reglas de trabajo que no cambian

- **Una rama por tarea. Todo por PR. El merge lo hace Asav.** Nunca directo a `main`.
- **Nunca mergear sin el check de Vercel en verde**, y siempre revisar la pestaña
  "Files changed" para confirmar que el código esperado sí entró (lección del #53).
- **Antes de afirmar, verificar.** No inferir como hecho. Simular antes de
  escribir sobre datos vivos.
- **El código nunca conoce nombres.** Los documentos sí los usan como ejemplo.
  El motor trata todo genérico: cualquier perfil, cualquier contrato, cualquier
  variante.
- **Modelos:** el modelo fuerte para arquitectura, validación de Marco y lógica
  del árbitro; el mecánico para UI, PR triage y trabajo de solo lectura.
- **Si dos asistentes trabajan a la vez**, se reparten por área y no por archivo.
  Nunca dos manos sobre `main`.
- **`jrz-drone-os` está congelada** — fuente de datos históricos únicamente,
  jamás referencia de código ni de diseño.

---

## 8. Las leyes de producto (el filtro de toda decisión)

Si algo choca con esto, está mal por definición.

1. **Un problema de observación jamás se convierte en veredicto.** Sin calidad
   suficiente — `pendiente_evidencia`. Nunca una acusación.
2. **Todo `no_cumplido` carga su evidencia y su porqué medido.** Un rojo sin
   trazo y sin motivo cuantificado es una acusación sin expediente y no debe
   existir.
3. **La matemática decide, la AI explica.** El veredicto es determinista y
   reproducible. Lenore narra; jamás opina dentro del veredicto.
4. **Tres estados y nada más:** `cumplido` · `no_cumplido` ·
   `pendiente_evidencia`. "Tarde" es un motivo bajo `cumplido`, nunca un cuarto
   estado.
5. **El hecho se calcula una vez y se congela.** Cambiar la política nunca
   reescribe veredictos pasados.
6. **La geocerca es la frontera de la evidencia.** Las trazas se cortan en la
   llegada. Lo que la unidad hizo después no se muestra a nadie.
7. **El cliente jamás ve la operación interna del carrier.**
8. **Todo umbral es configurable por contrato.** Nunca horneado en código.
9. **El vigilante no comparte nada con lo vigilado** — ni runtime, ni base, ni
   credenciales.
10. **Nunca rotar credenciales sin redesplegar en el mismo movimiento.**

---

## 9. El loop de aprendizaje (el marco conceptual de fondo)

J-Tel ve la misma operación repetirse todos los días. Cada valor declarado es una
hipótesis sobre esa operación. **Divergencia sostenida entre lo declarado y lo
observado es información**, no un error a castigar.

**La forma:** declarado — observado — divergencia sostenida — propuesta —
aprobación humana — la configuración aprende.

**El reparto, que es la clave:**
- **La planta APRUEBA lo normativo** — qué cuenta como cumplido. Es su contrato,
  ella lo paga.
- **El carrier SEÑALA lo factual** — cuándo medimos mal. Es su operación, solo él
  lo sabe.
- **El árbitro no calibra nada. Aplica.**

**La trampa, crítica:** no se pueden calibrar umbrales contra la operación que se
juzga. Afinar el corredor hasta que todo pase convierte al árbitro en decorado.
**La calibración se ancla en la aprobación de la planta, no en el deseo de que se
vayan los rojos.**

---

*Este plan se actualiza cuando una ola cierra su compuerta, o cuando una decisión
de la sección 4 se resuelve. No se edita para acomodar prisa.*
