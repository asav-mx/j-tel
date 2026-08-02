# Ficha — Monitoreo (cara transportista)

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Reemplaza la piel de** `carrier/` (inicio) en su parte viva. **Ruta nueva:** `carrier/monitoreo`.
**Bloqueada por auth-rbac** en su acceso, no en su construcción.

---

## 1. Qué es, y la ley que la ordena

La sala de control del transportista. Responde: *¿qué está en riesgo ahora mismo, en cualquiera de mis clientes?*

**Tres leyes la gobiernan:**

> **Esta pantalla mira el ahora.** Mirar hacia atrás es el Workbench. No se mezclan: en Monitoreo los segundos importan y se actúa; en el Workbench se piensa.

> **Todos los contratos en una sola sala.** Un transportista con tres clientes no puede tener tres pantallas abiertas. Los servicios de todos sus contratos se ordenan por cuál cierra primero, sin importar de quién sea.

> **Ningún color de veredicto.** El resultado se emite al cierre. Acero para lo medido, ámbar solo como aviso del sistema.

---

## 2. Estructura

### 2.1 Titular
Enuncia lo accionable, no el estado: *"Dos cosas puedes arreglar antes del cierre."* Si no hay nada prevenible, lo dice: *"Todo en orden · 29 servicios en vuelo."*

Subtítulo con el conteo total, número de clientes y la hora.

### 2.2 Leyenda permanente
Banda de tinte acero, punto que pulsa, hora de actualización. Texto: *"Vista en vivo, todos tus contratos. El resultado se emite al cierre."*

**Nunca dice "veredicto".** Vocabulario congelado.

### 2.3 Lo que todavía se puede evitar — **el corazón de la pantalla**
Bloque con borde ámbar. Cada renglón es una situación accionable, **con el nombre del cliente como etiqueta** para que se sepa a quién afecta.

Cada uno trae lo que hace falta para actuar, incluida información que la planta no ve:
- *"Riberas 9 · U-214 no reporta desde 14:04 — R. Medina · último punto a 11.4 km · su rastreador falló 9 veces este mes"*
- *"Zaragoza 12 · U-205 llega con 4 min de margen — salió 11 min tarde · tienes 3 unidades en reserva"*

Al margen: cuánto falta para el cierre más próximo.

**Esta zona es el enchufe del vigía.** Hoy la llena el sistema con lo que mide. Cuando exista Lenore, hablará aquí. Construirla con esa forma no es adelantarse: es no tener que rehacerla.

### 2.4 La banda de estado
Cifras en acero. Las tres primeras son del cumplimiento y **son idénticas a las del cliente**; las dos últimas son suyas y llevan marca de borde:
- En ruta (de N) · Ya llegaron · Sin salir
- Fuera de servicio · Km muerto hoy — **con la leyenda "solo tú ves esto"**

### 2.5 El mapa
Todos los clientes con sus geocercas en el mismo lienzo. **Los clientes se distinguen por tono dentro del acero**, nunca por color de resultado.

Capas agrupadas por familia:
- *En servicio*: un renglón por cliente, con su conteo
- *Tu flota*: fuera de servicio (apagada por defecto), sin señal

**La traza corta al entrar a la geocerca**, igual que del lado de la planta. Al pie, la puerta: *"para ver hacia atrás, abre el Workbench"*.

### 2.6 La lista, agrupada por urgencia
Tres grupos con su conteo: **Necesitan atención · En ruta · Ya llegaron.**

Cada renglón: ruta con su cliente · unidad con su chofer declarado · llegada estimada con su margen. Las que no reportan muestran `—` con la hora de su última señal.

### 2.7 Su capa interna
Panel aparte con borde de acero y encabezado *"Solo tú ves esto"*: diésel del turno, km muerto con su comparación, unidades de reserva, cuántas declaraciones de chofer faltan.

---

## 3. La promesa del espejo

**Los números compartidos son idénticos a los del cliente.** Mismas rutas, mismos deadlines, mismas medidas, mismas horas de llegada.

**Esto no es una preferencia de diseño: es la condición de que el árbitro sirva.** Si el transportista ve 94% y la planta 95%, la discusión deja de ser sobre la operación y pasa a ser sobre el instrumento — y ahí el árbitro perdió.

Su capa propia va **encima**, nunca **en vez de**.

---

## 4. Voz

**Los datos se enuncian sin sujeto** — no *"declarado por el transportista"* en la cara del transportista.

**La frontera se menciona una sola vez, al pie:** *"nada de esta pantalla llega a los clientes."*

---

## 5. AUDITORÍA DE DATOS

**Confirmado que existe:**
- La torre por contrato ya está construida para la cara planta (`monitoreo-data.ts`, PR #159 y #165) — misma carga, distinto alcance
- ETA con procedencia (`monitoreo-eta.ts`, PR #165)
- `SIN_SENAL_MINUTOS` en el dominio (`packages/domain/src/senal.ts`), compartido por la marca ámbar y el corte de la ETA
- `edadSenalMinutos` por unidad
- `deviceAssignments` — "su rastreador falló N veces este mes" es construible desde el historial de huecos

**Debe confirmar desarrollo:**
1. **Cargar varios contratos a la vez.** Hoy la torre carga por alcance de una unidad operativa. Aquí el alcance es *todos los contratos de un carrier*. **Es el cambio de motor más grande de esta pantalla** — confirmar si `occurrenceConditions()` lo permite o hay que extenderlo.
2. **Km muerto.** Requiere distinguir recorrido en servicio de recorrido fuera de servicio. Confirmar si se puede calcular hoy; si no, ese renglón no se muestra.
3. **Unidades de reserva.** No existe el concepto. Si no se puede derivar (unidades activas sin servicio asignado hoy), no se muestra.
4. **Diésel del turno.** `fuelRecords` existe pero no está ligado a turnos. Confirmar.
5. **Rendimiento con todos los contratos.** La torre de un contrato tardaba ~14 s antes del arreglo de conteos. Con tres contratos, medir antes de asumir.

**Si un dato no existe, ese bloque no se muestra.**

---

## 6. Lo que NO lleva

- **Colores de veredicto.** Ninguno, en ninguna parte
- **Nada hacia atrás.** El histórico es el Workbench
- **La flota completa como vista principal.** Es una capa apagable, no el tema
- **Cifras de cumplimiento agregado.** Eso espera Ola 2 y vive en su pantalla
- **Datos de un cliente visibles a otro.** Cada servicio lleva su cliente; ningún cliente ve esta pantalla
