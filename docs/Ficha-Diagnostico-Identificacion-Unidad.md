# Ficha de Diagnóstico — Por qué la 47 no identifica unidades

**Repo:** `j-tel` — guardar en `docs/Ficha-Diagnostico-Identificacion-Unidad.md`. Entra por PR.
**Fecha:** 15 de julio de 2026
**Autoridad:** el Marco Maestro es la única fuente de verdad. Donde esta ficha y el Marco choquen, gana el Marco.
**Tipo:** DIAGNÓSTICO — solo investigar y reportar. **PROHIBIDO escribir código de arreglo o tocar datos.** Primero entender con certeza, luego (ficha aparte) arreglar.
**Modelo:** Fable 5 u Opus, nunca Auto. Esto es el corazón del árbitro.

---

## El síntoma (en data REAL, no seed)

Planta 47, pantallas de Cumplimiento y Monitoreo, data de producción:
- Todos los servicios caen en `no_cumplido` / "sin servicio detectado".
- El mapa muestra cientos de puntos GPS reales en ruta (ej. 451 pts) → **hubo movimiento real de un camión.**
- Pero **Unidad observada: —**. Nunca se identifica ninguna unidad, en ninguna pantalla, nunca.
- En contraste, el campus **Santos Dumont SÍ identifica unidades** correctamente (14/14 cumplidos).

## Lo que YA está confirmado (no re-investigar)

1. **Los vínculos dispositivo↔unidad SÍ existen.** Juárez Bus tiene 82 unidades, cada una con su IMEI vinculado (verificado en la UI de flota). NO es un problema de datos faltantes de asignación. No contar huérfanos, no dar de alta nada.
2. **La resolución IMEI→unidad SÍ existe en el servicio.** `packages/services/src/verification.ts`: función `resolveUnit(imei, at)` (~676-680) usando `resolveUnitAtTime`, y mapa `imeiToUnitId` (~527).
3. **El KML del seed de la Ruta Norte NO está vacío.** Tiene `waypoints` con coordenadas reales (seed.ts ~253-256). (Corrección de un diagnóstico previo equivocado: el motor lee `waypoints`, no el string `kmlContent`.)

## Las DOS sospechas a discriminar (el objetivo del diagnóstico)

Hay dos causas candidatas. El diagnóstico debe decir **cuál manda, o si son ambas**, con evidencia. No asumir ninguna.

### Sospecha 1 — Dos caminos de código; solo uno resuelve la unidad
En el motor hay dos formas de asignar la unidad observada:
- **Camino "llegada por geocerca"** (`services/src/verification.ts` ~516-543): resuelve `imeiToUnitId.get(imei)` → **unidad correcta.** (Presunto camino de Santos Dumont.)
- **Camino "match por ruta KML"** (`packages/verification/src/index.ts` ~642): hace `unitId: imei` **directo, sin resolver** → queda el IMEI crudo como "unidad".

Hipótesis: cuando una ocurrencia se resuelve por match-de-ruta (y no por llegada limpia a geocerca), la unidad se pierde porque queda el IMEI crudo. Esto violaría el Marco (línea 41: la evidencia "se resuelve a la unidad por la asignación vigente"; línea 49: "el GPS es un dispositivo, no la unidad").

**Confirmar:** trazar, para un servicio real fallido de la 47, por cuál de los dos caminos pasa, y confirmar si termina con `unitId = imei` sin pasar por `resolveUnitAtTime`. Señalar la(s) línea(s) exacta(s).

### Sospecha 2 — El perfil de la 47 quedó sin ruta válida en PRODUCCIÓN
Contexto de Asav: **se borró una ruta de la 47 en la base real** (la "Ruta Norte" o equivalente) hace un tiempo. Si el contrato/perfil de la 47 sigue apuntando a una ruta borrada, vacía o sin KML vigente, el motor se queda **sin línea contra qué medir** → nunca detecta llegada limpia → cae al camino malo de la Sospecha 1.

**Confirmar en la base real (solo lectura):** para el perfil activo de la 47 (15-jul), ¿tiene una ruta con KML/waypoints vigentes y no vacíos? ¿La geocerca destino de la 47 está bien puesta (polígono con ≥3 puntos)? ¿O quedó huérfano tras el borrado?

## Relación entre las dos sospechas

Probablemente encadenadas: **Sospecha 2 dispara Sospecha 1.** Sin ruta/geocerca válida (2), no hay llegada limpia, y el motor cae al camino que pierde la unidad (1). Pero hay que confirmarlo, no asumirlo — puede que la 1 ocurra incluso con ruta válida, y eso cambia el arreglo.

## Entregable del diagnóstico (a Asav, en español simple)

1. Para un servicio real fallido de la 47: **por cuál camino pasa** y en qué línea se pierde la unidad.
2. Estado real del perfil de la 47 en producción: **¿ruta válida sí/no? ¿geocerca válida sí/no?**
3. Veredicto claro: ¿el problema es **solo código** (camino malo), **solo datos** (perfil 47 roto), o **ambos encadenados**?
4. **Cero arreglos implementados.** Solo el mapa preciso. Si el agente cree tener el fix obvio, lo describe como propuesta y se detiene.

## 🛑 Límites (inviolables en esta ficha)

- Prohibido escribir código de arreglo.
- Prohibido tocar `saveFact`, el motor, o cualquier hecho existente.
- Prohibido crear, borrar o modificar datos (rutas, geocercas, asignaciones) — ni siquiera para "probar".
- Investiga y se detiene. El arreglo va en ficha aparte con punto de parada.

## Reglas de trabajo

- Rama de solo-lectura o reporte dentro del PR de esta ficha; sin cambios de comportamiento.
- Modelo: Fable 5 u Opus, nunca Auto.
- Modo "investiga y detente".
