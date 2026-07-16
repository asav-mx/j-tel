# Ficha de Handoff — Modo Rutas: el motor respeta cómo el contrato mide la ruta

**Repo:** `j-tel` — guardar en `docs/Ficha-Handoff-Modo-Rutas.md`. Entra por PR.
**Fecha:** 15 de julio de 2026
**Autoridad:** el Marco Maestro es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco.
**Esto es PRODUCTO, no un caso de la 47.** La 47 es solo el primer contrato en modo "sólo llegada". El código nunca sabe de la 47 ni de Santos Dumont — sabe de contratos con políticas.

---

## El hallazgo raíz (confirmado en código)

El Marco (línea 157) dice: *"Qué tan estricto se mide —recorrido KML completo, o sólo llegada al destino— lo decide el contrato."* Existe el flag `routeStrictness: "destino_only" | "kml_full"`, editable en la UI (Contrato → política → "Solo destino / Ruta completa").

**Pero el motor lo ignora.** En `packages/verification/src/index.ts` (~396-402):

```
servedRoute = arrivalAt !== null && (!hasKml || (routeMatch >= min && corridor >= min))
```

`routeStrictness` nunca entra en esa fórmula. Se copia a la salida (`routeStrictnessApplied`) pero no decide. Por eso un contrato en `destino_only` igual se mide como `kml_full`: exige cobertura completa aunque los camiones lleguen → cae en `no_cumplido` con GPS pegado al corredor. Santos Dumont "funciona" de casualidad porque su KML coincide.

**No es regresión — es un defecto viejo por fin visible.** No cambiar el flag de ningún contrato: la configuración está bien; el motor es el que no la respeta.

---

## El modelo de producto (aprobado por Asav)

El veredicto sigue teniendo **exactamente tres estados de cara al cliente**: `cumplido / no_cumplido / pendiente_evidencia` (Marco 177). No se crea ninguno nuevo. Lo que cambia es **cómo se decide `servedRoute`**, según `routeStrictness`.

### Modo `kml_full` (como hoy)
Se exige recorrido: llegó **y** cubrió el corredor (A ≥ umbral **y** B ≥ umbral de la política). Sin cambios respecto al comportamiento actual.

### Modo `destino_only` (nuevo — verificación anclada en la llegada)
Cinco reglas:

1. **Ancla en la llegada.** Se identifican las unidades que entran a la geocerca destino dentro de la ventana. El vínculo IMEI→unidad se resuelve por la asignación vigente en ese momento (Marco 27, 56: un cumplido siempre tiene unidad observada — nunca hay hora de llegada sin unidad detrás).

2. **Desempate por recorrido.** Como varias rutas pueden compartir la misma geocerca destino, cada unidad que llegó se compara contra esas rutas y se asigna a aquella(s) cuyo recorrido cubre **al menos el mínimo del contrato** (métricas A/B ya existentes). El KML no bloquea el veredicto: **desempata cuál ruta se sirvió.**

3. **Piso de honestidad → `pendiente_evidencia`.** Si una ruta no tiene ninguna unidad que (a) haya llegado y (b) alcance su cobertura mínima, **no se fuerza a cumplido ni se declara no_cumplido a la ligera**: si hubo llegada pero no se puede atribuir con confianza a esa ruta, cae a `pendiente_evidencia` ("llegó una unidad pero no se puede confirmar qué ruta sirvió"). Marco 156: el "no claro" es pendiente, nunca incumplimiento por duda. Si de plano ninguna unidad llegó ni cubrió → `no_cumplido` (Marco 161).

4. **Consolidación (configurable por contrato — flag nuevo `permitirConsolidacion`).**
   - **El concepto (no es una excepción, es el producto):** en la operación real de transporte de personal, una unidad puede cubrir dos rutas por fuerza del mercado (falta de choferes, fallas, clima). Si recogió a los pasajeros de ambas, **el servicio se cumplió** — los trabajadores llegaron. La planta no lo elige; lo tolera. Medir eso con honestidad es parte del valor del producto.
   - **Activado:** una misma unidad **puede acreditar varias rutas** del turno, siempre que cubra el mínimo de cada una. No hay exclusividad.
   - **Desactivado:** aplica exclusividad — una unidad, una ruta; el resto se desempata por mejor match. (El motor ya tiene el flag `exclusiveUnits` en `services/verification.ts` ~280,315 — conectarlo al contrato, no construir de cero.)

5. **El destino nunca basta solo.** Ni con consolidación activada: siempre se exige que el recorrido de la unidad cubra el mínimo de la ruta. Llegar a la planta sin haber hecho el recorrido **no** es cumplir (Marco 157: el destino es parte de la ruta, no la ruta entera; Marco 51: llegar a otra geocerca no cumple salvo que el contrato lo permita).

---

## Indicador de cobertura (transparencia, no veredicto)

Además del veredicto, exponer en el detalle del servicio (leído del hecho/ledger congelado, sin recalcular):

- **% de ruta cubierta** por la unidad acreditada (métrica A). Es un **indicador**, no un umbral que bloquea: en la vida real no se recoge gente en todo el trayecto, así que una cobertura parcial puede ser un servicio perfectamente cumplido. Se muestra para dar contexto, no para juzgar.
- **Llegó a destino dentro de ventana:** sí/no (hora).
- Si el modo es `destino_only`, una línea que aclare: "la cobertura de ruta es informativa; el contrato acredita por llegada".

Esto NO crea un cuarto estado. Es un sub-detalle bajo el chip del veredicto de siempre.

---

## Configurabilidad (UI)

- `routeStrictness` ya está en el formulario (Contrato → política). Confirmar que decide de verdad tras el arreglo del motor.
- **Nuevo:** `permitirConsolidacion` (sí/no) en el `contractPolicySchema` (`packages/domain/src/index.ts`) y en el formulario de política, con etiqueta en cristiano: *"Permitir consolidación de rutas: una unidad puede cubrir varias rutas del turno (situaciones de fuerza operativa). El recorrido mínimo de cada ruta sigue siendo obligatorio."*
- Todos los umbrales de la política, cero constantes hardcodeadas.

---

## 🛑 Puntos de parada (toca el árbitro)

Este trabajo toca el motor de verificación. Antes de escribir código:

1. Cursor presenta el diseño en español simple + **2 ejemplos reales**: un servicio de un contrato `destino_only` que hoy sale `no_cumplido` con GPS pegado al corredor, mostrando cómo quedaría; y un caso de consolidación (una unidad, dos rutas) con el flag activado vs. desactivado.
2. Espera OK de Asav.
3. Tras el OK: rama propia, la suite de tests del motor pasa **idéntica** para `kml_full`, y **tests nuevos** que blinden: `destino_only` con llegada + cobertura mínima → `cumplido`; `destino_only` con llegada sin cobertura de ninguna ruta → `pendiente_evidencia`; consolidación on/off; y que el destino solo nunca acredite sin recorrido mínimo.

---

## Re-verificación (después del arreglo)

Cambiar el motor y re-verificar re-materializa los hechos con la lógica corregida — es legítimo (no es "recalcular la verdad en pantalla"; es re-emitir el hecho con la regla correcta, vía la herramienta de rango existente `jstaff/reverify-day`, solo a petición de Asav). **Aviso:** honrar `destino_only` cambiará veredictos reales (la 47 pasará varios servicios a `cumplido`). Revisar el `routeStrictness` real de cada contrato activo antes de re-verificar masivamente. Los hechos pasados NO se reescriben salvo esta acción explícita.

---

## Reglas de trabajo

- Una rama por pieza; todo por PR; nunca directo a `main`; checks verdes o no hay merge.
- Modelo: Fable 5 u Opus, nunca Auto. Es el corazón del árbitro.
- Modo "avanza y detente"; parar en el punto marcado.

## Prohibido

- Crear un cuarto estado de cara al cliente.
- Que el destino solo, sin recorrido mínimo, acredite `cumplido`.
- Declarar `no_cumplido` cuando hubo llegada pero la atribución es dudosa (eso es `pendiente_evidencia`).
- Umbrales o flags hardcodeados (todo del contrato).
- Cambiar el `routeStrictness` de contratos existentes como parte de esta ficha.
- Tocar el motor antes del OK de Asav sobre el diseño + ejemplos.
