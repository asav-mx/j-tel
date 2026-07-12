# Ficha de Handoff — Resolución de servicios dudosos por eliminación de candidatas

Repo: j-tel — `docs/Ficha-Handoff-Eliminacion-y-Dudosos.md`. Entra por PR.  
Fecha: 11 de julio de 2026  
**Autoridad:** `Marco-Limpio-J-Telemetry-MAESTRO.md` es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco. Ningún plan, código o comentario previo tiene autoridad sobre esta ficha.

---

## El problema

En el campus Santos Dumont quedan servicios que el árbitro marca `no_cumplido` aunque sí hay evidencia GPS suficiente ese día. No es un problema de memoria ni de cobertura: el sistema ve las unidades, pero no logra afirmar con seguridad que *esta* unidad hizo *esta* ruta. Son ~14 casos entre el 9 y 10 de julio.

## La solución: eliminación

El carrier tiene un universo finito de unidades. Cuando el árbitro ya resolvió con confianza la mayoría de los servicios del día, las unidades que sirvieron esos servicios quedan "ocupadas" en sus ventanas de tiempo. Para los servicios dudosos, el universo de candidatas se encoge por eliminación.

Como pasar lista: si ya sabes dónde están 23 de 27, los asientos vacíos solo pueden ser de los que faltan.

---

## Tarea A (prioridad) — Eliminación de candidatas en el motor

### Alcance del universo (regla dura)

El universo de candidatas es exclusivamente la flota del carrier destinada o disponible para los contratos de ese carrier — el "conjunto de unidades posibles" del perfil/contrato (Marco, Piezas 1 y 3). Nunca unidades de otro carrier, nunca la plataforma completa.

**Visibilidad (ley intocable):** todo el razonamiento de eliminación (universo de flota, candidatas descartadas, asignaciones) vive en el ledger, del lado interno/carrier. El cliente y la planta jamás lo ven — solo ven si sus servicios se cumplieron o no, con los tres estados permitidos: `cumplido` / `no_cumplido` / `pendiente_evidencia`.

### Mecánica

1. El árbitro corre como hoy: matching + asignación exclusiva por traslape de ventanas. Los servicios resueltos con confianza quedan igual.
2. Para cada residual (dudoso): candidatas = flota del carrier para ese contrato menos las unidades ya reclamadas exclusivamente en ventanas que se traslapan con la del residual.
3. Re-evaluar el residual solo contra esas candidatas. Con el universo encogido puede aplicarse un umbral de match ajustado (proponerlo; ver punto de parada).
4. La eliminación encoge la lista de sospechosos; **no dicta la sentencia**. Aunque quede una sola candidata, su GPS debe parecerse plausiblemente a la ruta para declarar `cumplido`. La deducción pura ("solo pudo ser X, ergo cumplió") está **prohibida** — el viaje pudo simplemente no hacerse.
5. Si ninguna candidata pasa → `no_cumplido` se sostiene. Es honesto.
6. Si la cobertura de evidencia de la ventana está incompleta (hueco conocido) → `pendiente_evidencia`, nunca `no_cumplido`.
7. El motor nuevo aplica **hacia adelante** en el cron automático. No reescribe hechos ya materializados de días pasados salvo re-verificación puntual que Asav pida explícitamente.

### Punto de parada obligatorio

Antes de tocar código del árbitro, presentar a Asav en español simple:

- **(a)** cómo se calcula el conjunto de candidatas,
- **(b)** qué umbral ajustado se propone y por qué,
- **(c)** 2–3 ejemplos con los residuales reales del 9–10 jul, mostrando qué veredicto daría.

**No avanzar sin su visto bueno.**

### Pruebas mínimas

- Residual con candidata única cuyo GPS sí matchea → `cumplido`.
- Residual con candidata única cuyo GPS no matchea → `no_cumplido`.
- Residual con hueco de cobertura → `pendiente_evidencia`.
- La misma unidad en turnos que no se traslapan sigue siendo válida (no conflicto).

---

## Tarea B — Etiquetado del carrier (solo verdad de calibración)

Para los dudosos que la eliminación no cierre, el carrier puede etiquetar desde su cara: "sí se hizo, fue la unidad X" / "no se hizo".

**Regla dura:** ese etiquetado escribe únicamente en `occurrence_ground_truth` + una entrada en el ledger (quién, cuándo, unidad, nota). **Nunca** escribe en `saveFact` ni altera el hecho que ve el cliente.

**Por qué:** el Marco manda que "la verdad se calcula una vez y se guarda; nadie recalcula su propia verdad", y el carrier es la parte auditada. Si la parte auditada pudiera voltear el veredicto en dos clics, el veredicto deja de valer para el cliente que decide pagos con él. El réferi no le presta el silbato a uno de los equipos.

**Uso del etiquetado:** medir recall del motor, calibrar umbrales, detectar rutas con KML/geocerca mal configurados.

Si un veredicto quedó genuinamente mal, eso es una **disputa** (apelación con rastro, resuelta por el cliente o proceso auditado). Ese flujo no se construye ahora; es decisión de Marco pendiente de Asav.

---

## Tarea C — Cara del carrier: contexto legible

- Chip/filtro de contrato mostrando nombre de campus/planta, no solo "Tecma".
- Filtro "Dudosos" en cumplimiento del carrier (lectura + acceso al etiquetado de Tarea B).
- Planta 47 y contratos demo: **fuera de alcance**. Cero trabajo hasta que tengan geocercas, turnos y perfiles cargados.

---

## Reglas de trabajo

- Una rama por tarea. Sugeridas: `feat/motor-eliminacion-candidatas` (A), `feat/carrier-etiquetado-gt` (B), `feat/carrier-contexto-dudosos` (C).
- Nunca directo a `main`. Todo entra por PR para revisión de Asav.
- Si Codex y Claude Code trabajan en paralelo: repartir por área (motor vs. UI carrier), jamás el mismo pedazo.
- Modo "avanza y detente": parar en los puntos de decisión marcados y en cualquier ambigüedad contra el Marco.

## Prohibido

- Reescribir hechos pasados como efecto colateral de cualquier acción de usuario.
- Estados nuevos de cara al cliente: solo `cumplido` / `no_cumplido` / `pendiente_evidencia`.
- Exponer al cliente/planta el universo de flota, candidatas o razonamiento de eliminación.
