# Pieza 3 — Reglas de verificación

Implementadas en `packages/verification` y materializadas por `packages/services`.

Estados al cliente: `cumplido | no_cumplido | pendiente_evidencia`

Árbol: evidencia → ruta servida → puntualidad → excusable

**Enmienda del 19 de septiembre de 2026 — 3.10, el árbitro que se rinde.** El
árbitro puede cerrar un caso sin pruebas: si la ventana de evidencia ya se
cerró vacía —el archivador tiene dato más nuevo que su fin y dentro de ella no
dejó ni un punto— se sella «sin evidencia posible» y se deja de preguntar. El
veredicto no cambia: sigue en `pendiente_evidencia`, porque sin evidencia no
es incumplimiento. Es reversible, y el conteo de intentos vive como estado del
viaje, nunca como entradas reescritas del ledger. El texto completo está en el
Maestro; el diagnóstico que lo motivó, en
`docs/Diagnostico-Reverificacion-Infinita-2026-09-19.md`.
