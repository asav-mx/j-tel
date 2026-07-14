# Ficha de Ejecución — Torre no recalcula la verdad

**Repo:** `j-tel` — guardar en `docs/Ficha-Ejecucion-Torre.md`. Entra por PR.
**Fecha:** 14 de julio de 2026
**Autoridad:** el Marco Maestro es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco.
**Spec de referencia:** `docs/Ficha-Handoff-Torre-No-Recalcula.md` (PR #27). Esta ficha es el **cómo y en qué orden**; aquella es el **qué y por qué**.

---

## Antes de escribir una sola línea

```bash
git fetch origin && git checkout main && git pull --ff-only origin main
```

Confirma que existe `apps/web/src/lib/monitoreo-data.ts` con `getForImeis(imeis, windowStart, now)` y las constantes `IDENTIFY_MIN_PCT` / `ON_CORRIDOR_MIN_PCT` / `ADVANCING_MIN_PCT`. **Si no aparece, detente y avisa a Asav.** No crear nada desde cero: la ficha corrige código existente.

---

## Tarea 0 (sin código) — Publicar el Marco en el repo

Copiar el Marco Maestro **tal cual, sin editar ni una palabra**, a:

```
docs/marco-limpio/Marco-Limpio-J-Telemetry-MAESTRO.md
```

Es publicación, no edición. La ley debe vivir donde se construye para que cualquier agente pueda consultarla sin depender del chat.

**Rama:** `docs/marco-maestro` — PR aparte, solo ese archivo.

---

## Bloque A — Ramas `fix/torre-no-recalcula-verdad` (Tareas 1, 2 y 3)

Las tres van en **una sola rama**. Tocan el mismo archivo (`monitoreo-data.ts`) y forman una unidad lógica: la torre deja de recalcular lo cerrado, pone techo a su ventana y lee los umbrales del contrato. Separarlas obligaría a poner dos manos sobre el mismo pedazo.

### Tarea 1 — La torre no piensa sobre lo ya cerrado

Para cada ocurrencia que la torre va a mostrar:

- **Con `complianceFact`** → la torre **no corre match, no corre métricas, no infiere estado**. El servicio se muestra como **cerrado**.
- **Sin `complianceFact`** (servicio abierto) → la torre estima, y solo entonces.

**Matiz importante — no confundir "apagar el cálculo" con "apagar el dibujo":**
Hoy el código usa `complianceFact?.observedArrivalAt` (línea ~294) únicamente para recortar la huella. Al apagar el cálculo, **la huella se conserva**: un servicio cerrado puede seguir dibujando su trazo, leído del hecho y cortado en la llegada (la geocerca es la frontera de evidencia). Lo que se apaga es el **match**, las **métricas** y la **inferencia de estado** — no el trazo.

La torre muestra el recorrido y dice "cerrado". No vuelve a opinar quién fue ni si llegó. Para eso está el expediente, y ahí enlaza.

### Tarea 2 — Ventana con techo (solo servicios abiertos)

```
ventanaFin = min(now, deadline + verificationGraceMinutes + evidenceMarginMinutesAfter)
```

Nunca `now` sin límite. En vivo la ventana crece con el reloj pero **se detiene** en el fin de la ventana de evidencia — el mismo techo del árbitro.

### Tarea 3 — Umbrales de la política, no constantes

Eliminar `IDENTIFY_MIN_PCT`, `ON_CORRIDOR_MIN_PCT` y `ADVANCING_MIN_PCT` del archivo.

La torre lee de la política del contrato de esa ocurrencia: `kmlMatchMinPct` (A), `kmlCorridorMinPct` (B), `kmlCorridorMeters`. Los estados intermedios en vivo (`en_ruta` / `avanzando`) pueden **derivarse** de esos umbrales, pero no pueden tener números propios inventados.

Cero constantes de umbral hardcodeadas. Nada de Santos Dumont ni Tecma en el código.

### 🛑 PUNTO DE PARADA OBLIGATORIO (fin del Bloque A)

Al terminar 1+2+3, **detente antes de abrir el siguiente bloque.** Corre el turno del **2026-07-14, Primer Turno, Campus Santos Dumont** y reporta a Asav:

- Cuántas alertas quedan. **Esperado: cero.**
- Cuántos servicios salen como cerrados. **Esperado: 14.**

**Si no da cero alertas, no avances.** Significa que hay algo que no entendimos y hay que investigarlo antes de escribir más código.

---

## Bloque B — Rama `refactor/match-unificado` (Tarea 4)

Solo después de que el Bloque A esté mergeado y verificado.

Extraer la identificación unidad↔ruta a **una sola función compartida** en `@jtel/verification`, usada por el árbitro y por la torre. La torre = esa función evaluada con el reloj en `now` y la ventana truncada.

**Prohibido** que la torre mantenga una segunda implementación del match. Si hay dos, van a divergir otra vez — es cuestión de tiempo.

**Condición dura:** esta tarea toca código del árbitro. Es refactor **sin cambio de comportamiento**. La suite de tests del motor debe pasar **idéntica** antes y después. Si un solo test cambia de resultado: **parar y avisar a Asav.** No "arreglar" el test.

---

## Bloque C — Rama `feat/torre-lenguaje-visual` (Tarea 5)

Presentación pura. Al final.

- La torre **jamás** usa las palabras `cumplido` / `no cumplido` / `pendiente de evidencia`.
- La torre **jamás** usa los colores del veredicto (verde cumplido / rojo no cumplido / ámbar pendiente). Vive en otra paleta: azules y grises, luz de radar.
- Leyenda siempre visible, como parte del diseño y no como disclaimer chiquito: **"Vista en vivo. El veredicto se emite al cierre."**
- Un servicio cerrado se ve **visualmente distinto** (apagado / neutro) y enlaza a su expediente. No se le pinta estado en vivo.

---

## Pruebas mínimas (Bloque A)

- Turno 2026-07-14, 14 servicios con hecho `cumplido` → la torre muestra **0 alertas** y 14 cerrados, sin recálculo.
- Servicio cerrado → su huella se sigue dibujando, cortada en la llegada.
- Servicio abierto, unidad dentro del corredor antes del deadline → estado en vivo estimado normalmente.
- Servicio abierto cuyo turno terminó hace 4 horas → la ventana de la torre **no crece** con las horas; sus métricas son idénticas a las que usará el árbitro.
- Cambiar `kmlCorridorMinPct` en la política del contrato **cambia** el comportamiento de la torre (prueba de que lee la política, no constantes).
- La torre no escribe: cero `saveFact`, cero escrituras al ledger.

---

## Reglas de trabajo

- Una rama por bloque; todo entra por PR; **nunca directo a `main`**.
- Checks en verde o no hay merge.
- Modo "avanza y detente": parar en el punto marcado y ante cualquier ambigüedad contra el Marco.
- Antes de cada bloque nuevo: `git pull --ff-only origin main`.

## Prohibido

- Que la torre escriba hechos, ledger o veredictos.
- Que la torre recalcule el estado de una ocurrencia que ya tiene hecho.
- Umbrales hardcodeados en cualquier parte.
- Reverificar días pasados como efecto colateral de esta ficha.
- Estados nuevos de cara al cliente: los tres de siempre, y la torre no usa ninguno de ellos.
- Saltarse el punto de parada del Bloque A.
