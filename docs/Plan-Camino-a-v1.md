> # ⛔ SUPERSEDED — este documento ya no manda
>
> **Reemplazado el 3 de agosto de 2026 por [`docs/PLAN.md`](PLAN.md), que es el
> único plan.** No se edita y no se sigue: se conserva como registro de cómo se
> veía el camino el 2 de agosto.
>
> Lo que este documento aportaba —el orden de fases y sus compuertas— vive ahora
> en `PLAN.md` §4, y sus causas del árbitro en `PLAN.md` §5, donde son **once y
> no ocho**.
>
> Si buscas qué se construye y en qué orden, la respuesta está en `PLAN.md`.

---

# Plan — el camino de aquí a v1

**Corte: 2 de agosto de 2026.** `main` en `7000926`. PRs #151–#199 mergeados.

**Qué es esto:** el orden de aquí al fin de v1. No reemplaza al `PLAN-v1.md`
(que dice en qué ola va cada cosa) ni a `DESPUES.md` (que es el backlog). Este
dice **qué se hace primero y por qué**, para no perder tiempo eligiendo camino.

**Regla del documento:** una fase se cierra antes de abrir la siguiente. Si algo
aparece en el camino, se anota en `DESPUES.md` y se replantea al cerrar la fase
en curso — no a media fase.

---

## El estado, en cinco líneas

- **Las dos caras están construidas.** 13 pantallas, datos reales, dos temas.
  El frente visual está cerrado.
- **Las 26 rutas de API están guardadas.** Las **65 páginas** no.
- **`CRON_SECRET` sigue cayendo a un secreto publicado.** Verificado hoy.
- **El árbitro tiene seis modos de falla conocidos**, ninguno arreglado.
- **Las 300 siguen congeladas.** El #124 es la foto de referencia.

---

## Fase 1 — Cerrar el candado (corta, y desbloquea todo)

**Por qué primero:** hoy Deployment Protection de Vercel tapa todo de afuera. En
el momento que entre el primer usuario real de Tecma o Juárez Bus, **65 páginas
sin guardia son 65 puertas abiertas** — incluidas las que muestran el
razonamiento interno del árbitro.

### 1.a — `CRON_SECRET`

Las siete rutas conservan un valor de respaldo fijo detrás de `??`, y ese valor
está publicado en **dos lugares**: `README.md:64` y `docs/DESPUES.md:1064`. No se
transcribe aquí — un plan que lo repita es un tercer lugar donde queda escrito.

Matiz confirmado: `verificar-env.mjs` sí exige la variable al arrancar, **pero
eso valida el entorno, no quita el respaldo del código.** Si falta en runtime, el
`??` sigue entregando el secreto publicado.

- Quitar el respaldo de las siete — sin variable, **503 y registro**.
- Un solo `lib/guardia-cron.ts` con comparación en tiempo constante
  (`identidad-dev.ts` ya la tiene; hoy hay dos criterios en el mismo repo).
- Quitar el valor de los dos documentos.
- 👤 **Rotar el secreto en Vercel** — asumirlo comprometido.

### 1.b — Guardia de páginas

65 páginas (`jstaff` 9 · `cliente` 41 · `carrier` 15), **cero llaman a una
guardia**. `middleware.ts` lo declara: `auth.protect()` está "deliberadamente
ausente".

- `lib/guardia-pagina.ts`, hermana de `guardia-api.ts` — **reutilizando
  `decidir`, no duplicándola** — que hace `redirect()` en vez de responder HTTP.
  Falla cerrado.
- Aplicarla en las 65, empezando por `/jstaff` (es donde vive el razonamiento
  del árbitro).
- **Junto aquí, no aparte:** el filtro de unidades por membresía que quedó del
  #138 cerrado. Su lugar es `inicio-corporativo-data.ts:121`, no un archivo
  nuevo. Conservar sus dos advertencias como texto: que **el filtro es
  presentación y no candado**, y el respaldo de "sin membresías → se enseña
  todo" para no ocultar por accidente lo que ya se veía.

### 1.c — Cerrar el default heredado

`USUARIO_HEREDADO = "tecma_admin"` sigue vivo.

**Matiz que cambió y hay que respetar:** ya **no falla abierto en la API** —
`exigir` decide por membresía, no por identidad, y hay una prueba explícita que
niega a `tecma_admin`. **En las páginas sigue cargando todo el peso**, porque ahí
no hay nada que lo compruebe.

> **1.b y 1.c son el mismo agujero visto de dos lados. 1.c va después de 1.b**, o
> quedamos todos fuera.

**Compuerta de la fase:** ventana anónima contra `/jstaff/*` → redirección, nunca
contenido · un usuario con membresía solo de carrier no abre ninguna pantalla de
cliente · sin `CRON_SECRET`, las siete rutas responden 503.

---

## Fase 2 — La ficha de consolidación del árbitro

**No toca el motor.** Es leer, medir y ordenar.

**Por qué existe:** las causas del árbitro están dispersas en `DESPUES.md` y **se
solapan sobre las mismas rutas** — Huertas-B aparece en una entrada de reloj y en
otra de trazado. Arreglar una sin saber cuál movió el número reproduce el
problema. Y **cada re-verificación mete una versión más en la historia del hecho:
no es gratis.**

La ficha debe traer tres cosas, en este orden:

1. **Qué se puede medir sin sellar nada** — eso va primero, siempre.
2. **El orden de dependencia, no de gravedad** — cuál desbloquea a cuál.
3. **Qué causas comparten ruta**, explícito.

**Las causas conocidas hoy** (la ficha las ordena, no las inventa):

| Causa | Qué se sabe |
|---|---|
| **Cuentas demo con veredictos vinculantes** | 73 hechos sellados sobre cuentas que nadie declaró. `accounts.isDemo` existe y el motor **no la lee**. Prioridad alta |
| **La geocerca congelada no es la que se usa** | El hecho guarda `expectedGeofenceId`; el motor juzga contra `profile.geofence`. **546 ocurrencias divergen.** Una edición de configuración cambia en silencio cómo se re-verifica algo de hace semanas |
| **Ventana derivada vs. match observable** | No están afinados entre sí: +50 se enderezan por uno, −2 se caen por el otro |
| **Trazado KML que no corresponde** | Huertas-B, Centro-A, Parajes del Sur-A — ~43 servicios. Falla real, no del reloj |
| **`maxRouteDurationMinutes` fijo en 60** | Segundo "cuánto dura una ruta" sin derivar |
| **Identificación en vivo** | La sala no puede decir qué unidad cubre qué ruta antes del cierre |
| **Planta 47 sella 6.7% vs. Campus 55.2%** | Diferencia medida, **causa no identificada** |
| **Nombre del chofer sin congelar** | Falta congelarlo dentro de `complianceFacts` al sellar. Toca el camino del árbitro |

**Compuerta:** la ficha existe, está mergeada, y cada causa tiene medición,
dependencia y ruta compartida declarada.

---

## Fase 3 — Ejecutar la lista

En el orden que la Fase 2 determine, **no en el orden de esta tabla.**

Reglas que no cambian:
- **Nada se sella hasta que se pueda medir el efecto por separado.**
- Una causa por PR. No se mezclan dos cambios de comportamiento del motor.
- Cada arreglo trae su medición de antes y después.

---

## Fase 4 — Re-verificar y medir

**Las 300 se descongelan aquí, no antes.** El #124 es la foto contra la cual
comparar.

- Simulación nueva con el motor ya afinado.
- Comparar contra 139/160/1 (medición del 30 de julio) y contra 91/209/0 (con la
  ventana rota).
- **Con el número en mano**, decidir si se re-verifica formalmente — con firma,
  motivo canónico e historia del sello, como manda la ficha de re-verificación.

👤 **Decisión de Asav antes de sellar:** cómo se le cuenta a Tecma que su número
cambia.

**Compuerta:** una línea base honesta y reproducible de Planta 47.

---

## Fase 5 — Sostener el 90%

La compuerta de Ola 2, con su tercera condición ganada:

> **≥90% sostenido dos semanas · cero rojos sin expediente · y ningún hecho
> sellado sobre una cuenta que nadie declaró.**

La tercera existe porque ese tipo de rojo **pasaba sin hacer ruido**: tiene
expediente, evidencia y razón escrita.

Aquí se encienden las pantallas que esperaban cifras de juicio: **Cumplimiento**
(las dos caras) y los bloques de métricas de ruta, unidad y contrato.

---

## Fase 6 — Login real y cierre de v1

- **Clerk** — 👤 crear cuenta y llaves. Mapeo de `clerk_user_id` (hoy guarda
  cadenas del seed).
- **Guardia por alcance**, no por cuenta — con la regla del campus de
  `Ficha-Diseno-Permisos.md` §2.2.
- **Administración de usuarios** — hoy dar de alta a alguien es trabajo manual de
  J-Staff.
- **Retirar el bypass de desarrollo.**

**Compuerta de v1:** un cliente nuevo se da de alta, entra con su usuario, ve
solo lo suyo, y el ≥90% se sostiene.

---

## Lo que NO entra en este camino

Queda en `DESPUES.md`, no bloquea v1:

- **Sin diseñar:** Diésel · Taller · Rastreadores · Inspecciones · Reportes ·
  J-Staff · móvil.
- **Bloqueado por datos, se llena solo:** duración esperada de ruta · rendimiento
  de diésel · lectura del cambio de rastreador · choferes.
- **Legales, no bloquean:** qué contiene un export con evidencia · qué hace
  probatorio un documento en una disputa.
- **Conceptos v2:** Sandbox · map matching · promoción de variantes · modo
  pasajero · pre-nómina.

---

## 👤 Trámites de Asav, por fase

| Fase | Qué |
|---|---|
| 1 | Rotar `CRON_SECRET` en Vercel |
| 4 | Decidir cómo se le cuenta a Tecma que su número cambia |
| 6 | Crear cuenta en Clerk + dos llaves |
| Sin fase | Comprar `j-tel.io` · Resend (dominio + API key + tres variables) · rotar la contraseña del readonly |

---

## Las reglas que se ganaron por las malas

1. **Una migración aditiva se aplica ANTES de mergear el código que la
   necesita.** Escribir el `.sql`, probarlo y declararlo en el esquema son tres
   pasos que se sienten como terminar y no lo son. Costó producción entera.
2. **Antes de mergear una rama que lleva tiempo abierta, revisar si toca archivos
   que cambiaron mientras esperaba.**
3. **Validar la medición no valida la interpretación.** Un instrumento correcto
   midiendo bien un campo que significa otra cosa. Costó una afirmación retirada.
4. **Cuando lo medido contradice una garantía, el sospechoso es el medidor.**
5. **El fallo silencioso que devuelve de menos es peor que el que revienta.**
6. **Ordenar por fecha sin techo devuelve el futuro.** Ya costó dos
   investigaciones.
