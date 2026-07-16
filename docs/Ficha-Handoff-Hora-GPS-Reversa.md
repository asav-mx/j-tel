# Ficha de Handoff — Hora local, GPS plausible y verificación anclada en la llegada

**Repo:** `j-tel` — guardar en `docs/Ficha-Handoff-Hora-GPS-Reversa.md`. Entra por PR.
**Fecha:** 15 de julio de 2026
**Autoridad:** el Marco Maestro es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco.
**Contexto:** el "corrimiento de 6 horas" en los deadlines resultó ser SOLO de pantalla (formato sin zona horaria, ver Tarea A). El motor no cambió entre el 14 y el 15 de julio (diff verificado). Los turnos están bien configurados. No hay regresión probada del árbitro.

---

## Tarea A (trivial, URGENTE) — Toda hora visible es hora de Juárez

**Rama:** `fix/hora-local-consistente`

**El bug:** `apps/web/src/components/service-detail-view.tsx` (función `formatDateTime`, ~línea 8) formatea con `toLocaleString("es-MX", …)` **sin `timeZone`**. Renderizado en servidor (UTC) imprime 11:40 cuando la hora real es 5:40 a.m. de Juárez. Otras vistas sí usan la utilería correcta — la inconsistencia entre pantallas ya causó un falso diagnóstico de "turnos corridos".

**El arreglo:** usar la utilería existente `apps/web/src/lib/local-time.ts` (`JTTEL_TZ = "America/Ciudad_Juarez"`) en TODO formato de fecha/hora visible al usuario, en todas las caras. Buscar TODOS los `toLocaleString` / `toLocaleTimeString` / `toLocaleDateString` del frontend que no especifiquen `timeZone` y corregirlos con la misma utilería (crear `formatDateTime` central en `local-time.ts` si no existe).

**Prueba mínima:** el mismo servicio muestra el mismo deadline (5:40 a.m.) en Cumplimiento, en el detalle, en Historial y en Monitoreo. Cero pantallas en UTC.

**Regla nueva de casa:** ninguna fecha se formatea "a pelo" en el frontend; siempre a través de `local-time.ts`.

---

## Tarea B (evidencia — 🛑 punto de parada antes de codear) — Filtro de plausibilidad de GPS

**Contexto:** se observó GPS errático (zigzag en cuadrícula físicamente imposible) en unidades reales. Ruido así puede tumbar un servicio bueno o validar uno malo.

**Principio de Marco:** si la evidencia es basura, el veredicto es `pendiente_evidencia`, no un juicio sobre basura ("sin evidencia ≠ incumplimiento"). No se necesita IA: se necesita física.

**Diseño a presentar a Asav ANTES de codear (en español simple):**
1. **Filtro de plausibilidad** sobre los puntos crudos, previo a las métricas: velocidad implícita máxima entre puntos consecutivos (p. ej. >130 km/h sostenido = implausible para un camión urbano), saltos de teletransporte (distancia grande en segundos), y jitter estacionario (nube de puntos brincando con el vehículo detenido). Los puntos implausibles se **marcan y excluyen de las métricas**, nunca se borran de la base (la evidencia cruda es sagrada).
2. **Etiqueta de calidad** por viaje: % de puntos descartados. Si supera un umbral (configurable por contrato, como todo), el servicio no se juzga con lo que queda a menos que aún alcance cobertura — y si no alcanza, cae a `pendiente_evidencia` con motivo "calidad de GPS degradada" en el ledger.
3. **Nada de "IA" en esta capa:** reglas físicas deterministas, explicables en el expediente. El árbitro debe poder defender cada descarte.
4. Presentar 2 ejemplos reales (el zigzag observado) mostrando qué puntos se descartarían y cómo cambiaría (o no) el veredicto.

**Umbrales:** TODOS en la política del contrato. Cero constantes hardcodeadas.

---

## Tarea C (motor — 🛑🛑 diseño primero, parada dura) — Identificación anclada en la llegada ("verificación en reversa", propuesta de Asav)

**La idea (de Asav, correcta):** hoy el sistema identifica mejor cuando una unidad entra a la geocerca (así funciona Santos Dumont). Formalizarlo como estrategia primaria:

1. **Ancla:** buscar unidades que ENTRAN a la geocerca destino dentro de la ventana (señal fuerte, barata, pocos falsos positivos). El vínculo IMEI→unidad ya existe (82 unidades vinculadas).
2. **Reversa:** para cada unidad anclada, verificar HACIA ATRÁS que esa unidad cubrió el corredor de la ruta antes de llegar (las métricas A/B de siempre, sobre su trazo previo).
3. **Respaldo:** si ninguna unidad ancló (no hubo llegada detectable), recién entonces correr el match-por-ruta actual sobre las candidatas.

**Leyes que NO cambian:**
- Llegar a la geocerca **no** es `cumplido` por sí solo — el destino es parte de la ruta, no la ruta entera. La reversa es estrategia de IDENTIFICACIÓN; el veredicto sigue exigiendo la cobertura de ruta de la política.
- Tres estados intactos. `saveFact` intacto. Umbrales de la política.
- La exclusividad se mantiene (una unidad no puede ganar dos rutas del mismo turno).

**Proceso:** Cursor presenta primero el diseño en español simple + 2 ejemplos con servicios reales (uno que hoy identifica bien y uno de los 3 rojos del 15-jul), mostrando cómo la reversa los trataría. **No se escribe código del motor sin el OK de Asav.** Tras el OK: rama propia, tests del motor intactos + tests nuevos que blinden la reversa, PR, checks verdes.

---

## Diagnóstico manual pendiente (Asav, sin código)

Para los 3 `no_cumplido` del 15-jul en Santos Dumont: abrir cada uno con el mapa de flota (ya disponible) y responder a ojo: ¿se VE un camión haciendo esa ruta a esa hora? Si sí → falla de identificación (la Tarea C lo va a arreglar). Si no → el sistema hizo su trabajo y eran incumplimientos reales. Reportar el resultado antes de arrancar la Tarea C, porque calibra el diseño.

## Reglas de trabajo

- Una rama por tarea; todo por PR; nunca directo a `main`; checks verdes o no hay merge.
- Orden: A ya (trivial) → diagnóstico manual → B y C con sus paradas.
- Modelo: Fable 5 u Opus para B y C. La A puede ir en un modelo rápido.
- Modo "avanza y detente".

## Prohibido

- Borrar puntos GPS crudos de la base (se marcan, no se borran).
- Que la llegada sola produzca `cumplido`.
- Constantes de umbral hardcodeadas.
- Tocar el motor (Tarea C) o el pipeline de evidencia (Tarea B) antes del OK explícito de Asav.
- Formatear fechas sin zona horaria en cualquier pantalla nueva.
