# Ficha de Handoff — La torre no recalcula la verdad

> **Fecha:** 14 de julio de 2026
> **Repo:** `j-tel`
> **Rama sugerida:** `fix/torre-no-recalcula-verdad`
> **Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md` es la única fuente de verdad. Donde esta ficha y el Marco choquen, **gana el Marco**.

---

## El síntoma

Campus **Santos Dumont**, **Primer Turno**, `2026-07-14`:

- **Cumplimiento:** 14 de 14 servicios cumplido.
- **Monitoreo (torre):** 6 "llegó" / 8 "alerta".

Mismo día, mismo turno, misma flota. **Cumplimiento tiene razón. La torre está equivocada.**

---

## Causa raíz (confirmada en código)

En `apps/web/src/lib/monitoreo-data.ts`:

```ts
const telem = await repos.telemetry.getForImeis(imeis, windowStart, now);
```

La ventana es `windowStart → now`, **sin techo**. Para un turno ya terminado, la torre evalúa a cada unidad con **todo el resto del día encima**.

`computeCorridorPrecisionPct` (métrica B) mide el % de puntos GPS de la unidad que caen dentro del corredor. Si la unidad hizo la ruta a las 06:00 y luego anduvo por Juárez hasta las 15:00, su B se desploma → cae bajo `ON_CORRIDOR_MIN_PCT` → la torre no la reconoce → alerta: *"Sin unidad identificada"*.

**La torre se vuelve más incorrecta conforme avanza el día. Es un cronómetro sin botón de stop.**

### Agravantes

- **Umbrales hardcodeados** (`IDENTIFY_MIN_PCT = 10`, `ON_CORRIDOR_MIN_PCT = 40`, `ADVANCING_MIN_PCT = 60`) que no son los del contrato. Viola la ley: **todos los umbrales se leen de la política del contrato.**
- **Segunda implementación de la lógica de match**, en paralelo a la del motor. Aunque hoy se arreglen los números, va a volver a divergir en el próximo cambio del árbitro.

---

## Causa profunda (esto es lo que importa)

Esos 14 servicios ya tienen **hecho congelado**. El árbitro ya emitió su veredicto. La torre, en vez de leerlo, está **recalculando la verdad en pantalla** con su propia matemática.

Ese es exactamente el defecto fatal del sistema viejo (`jrz-drone-os`), que el Marco prohíbe:

> *"la verdad se calcula una vez y se guarda; nadie recalcula su propia verdad."*

Si esto no se corrige de raíz, el cliente verá **"alerta"** en la torre y **cumplido** en el acta para el mismo servicio. El activo defendible del producto es la **confianza en el veredicto**. Esa contradicción lo destruye.

---

## Tarea 1 — Ley: la torre no piensa sobre lo ya cerrado

Esta es la corrección principal. Elimina la clase entera de contradicción.

Para cada ocurrencia que la torre va a mostrar:

- Si la ocurrencia **YA tiene `complianceFact`** → la torre **no calcula nada**. No corre match, no corre métricas, no infiere estado. Muestra que el servicio está **cerrado** y punto. El detalle del veredicto vive en Cumplimiento / el expediente, **no en la torre**.
- Si **NO tiene hecho** (servicio aún abierto) → la torre sí estima, y solo entonces.

**Consecuencia:** la torre y el acta **nunca** opinan sobre el mismo servicio al mismo tiempo. El pronóstico se apaga en cuanto existe el registro.

---

## Tarea 2 — Ventana con techo (para los servicios abiertos)

Para las ocurrencias **sin hecho**, la ventana de GPS de la torre debe tener techo, **exactamente el mismo del árbitro**:

```
ventanaFin = min(now, deadline + verificationGraceMinutes + evidenceMarginMinutesAfter)
```

Nunca `now` sin límite. En vivo, la ventana crece con el reloj pero **se detiene en el fin de la ventana de evidencia** — igual que la del árbitro.

---

## Tarea 3 — Umbrales de la política, no constantes

Eliminar `IDENTIFY_MIN_PCT`, `ON_CORRIDOR_MIN_PCT`, `ADVANCING_MIN_PCT` como constantes del archivo.

La torre lee de la **política del contrato** de esa ocurrencia: `kmlMatchMinPct` (A), `kmlCorridorMinPct` (B), `kmlCorridorMeters`. Los estados intermedios en vivo (`en_ruta` / `avanzando`) **pueden derivarse** de esos umbrales (ej. `avanzando = A ≥ umbral A del contrato`), pero **no pueden tener números propios inventados**.

**Ninguna constante de umbral hardcodeada. Nada de Santos Dumont ni Tecma en el código.**

---

## Tarea 4 (estructural) — Una sola matemática

Extraer la identificación **unidad↔ruta** a una **sola función compartida** en `@jtel/verification`, usada por el árbitro y por la torre. La torre = esa función evaluada con el reloj en `now` y la ventana truncada.

**Prohibido:** que la torre mantenga una segunda implementación del match. Si hay dos implementaciones, van a divergir otra vez — es cuestión de tiempo.

No cambia el veredicto ni el motor. Es **refactor**: mismo comportamiento del árbitro, ahora reutilizable.

---

## Tarea 5 — El pronóstico nunca se disfraza de acta

Reglas de presentación de la torre (**no negociables**):

- La torre **jamás** usa las palabras *cumplido* / *no cumplido* / *pendiente de evidencia*.
- La torre **jamás** usa los colores del veredicto (verde cumplido / rojo no cumplido / ámbar pendiente). Vive en otra paleta — **azules y grises, luz de radar**.
- **Leyenda siempre visible**, como parte del diseño y no como disclaimer chiquito: *"Vista en vivo. El veredicto se emite al cierre."*
- Un servicio **ya cerrado** se ve visualmente distinto (apagado / neutro) y **enlaza a su expediente**. No se le pinta estado en vivo.

---

## Pruebas mínimas

- [ ] Turno del `2026-07-14` (14 servicios con hecho cumplido): la torre muestra **0 alertas** — los 14 salen como cerrados, sin recálculo.
- [ ] Servicio abierto sin hecho, unidad dentro del corredor antes del deadline → estado en vivo estimado normalmente.
- [ ] Servicio abierto cuya unidad ya llegó a la geocerca → la huella se corta en la llegada (regla vigente: la geocerca es la frontera de evidencia).
- [ ] Un servicio abierto cuyo turno terminó hace 4 horas: la ventana de la torre **no crece** con las horas; sus métricas son **idénticas** a las que usará el árbitro.
- [ ] Cambiar `kmlCorridorMinPct` en la política del contrato **cambia el comportamiento** de la torre (prueba de que lee la política, no constantes).
- [ ] La torre **no escribe**: cero llamadas a `saveFact`, cero escrituras al ledger.

---

## Reglas de trabajo

- **Una rama por tarea**; todo por PR; **nunca directo a `main`**.
- Checks en verde o **no hay merge**.
- Modo **"avanza y detente"**: parar ante cualquier ambigüedad contra el Marco.
- La **Tarea 4** toca `@jtel/verification` (código del árbitro). Es refactor **sin cambio de comportamiento**: exigir que la suite de tests del motor pase **idéntica** antes y después. Si algún test cambia de resultado, **parar y avisar a Asav**.

---

## Prohibido

- Que la torre escriba hechos, ledger o veredictos.
- Que la torre recalcule el estado de una ocurrencia que ya tiene hecho.
- Umbrales hardcodeados en cualquier parte.
- Reverificar días pasados como efecto colateral de esta ficha.
- Estados nuevos de cara al cliente: los tres de siempre, y la torre **no usa ninguno de ellos**.
