# Auditoría · símbolos de la app ¿Ontoy?

Fuente: repo `asav-mx/j-tel` · `apps/publico/src` (leído 2026-09-24), `Universo Ontoy.dc.html` (secciones 06, 08, 10) y `App Inicio.dc.html`.
Meta: **todo símbolo que ve el pasajero sale del universo.** Si no existe, se genera con la misma construcción: formas planas, sin contornos, redondas, ojos blancos con pupila carbón.

## 0. Lo que encontré
- Hoy la app usa **íconos de línea genéricos** (trazo de 1.7 a 2.4 px): la barra, la estrella, el chevron, la lupa y el cerrar. El universo no tiene contornos, así que chocan con él.
- El repo también usa **caracteres tipográficos como íconos**: `← → ▴ ▾ ✕ ✓`. El propio repo avisa que esos símbolos no vienen en las fuentes (`app/fuentes/LEEME.md`).
- En `App Inicio` copié esos mismos íconos del repo. **Hay que sustituirlos ahí también.**
- Ya existen piezas del universo que cubren varios huecos, pero en tamaño de ilustración (40–160 px), no de glifo (20–24 px).

## 1. Inventario · qué hay y qué falta

### Barra (4)
| Símbolo | Hoy (repo) | Pieza del universo que ya existe | Qué falta |
|---|---|---|---|
| Inicio | casita de línea | `s-casa` (casa rosa con ojos) | **Generar** glifo de 24 |
| Mapa | plano doblado de línea | ninguna | **Generar**: plano con línea de ruta y un Tino chiquito |
| Ir a | lupa | `s-pasajero` (con linterna = buscar el rumbo) | **Generar** glifo de 24 |
| Pase | tarjeta de línea | `s-ontoy-boleto` (personaje) | **Generar** glifo: boleto con banda |

### Acciones
| Símbolo | Dónde | Hoy | Del universo | Qué falta |
|---|---|---|---|---|
| Guardar / guardada | atajo-de-parada, hoja, paradas | estrella rellena | `s-paradito-estrella` | **Generar** estrella del universo en dos estados |
| Abrir / siguiente | filas de ruta | chevron › | — | **Generar** |
| Volver | cabeza-de-ruta, privacidad | ← | — | **Generar** |
| Cerrar | hoja, panel de rutas | ✕ | — | **Generar** |
| Ver más / menos | «Ver todas las rutas» | ▾ ▴ | — | **Generar** |
| Sentido ida / vuelta | vista-mapa, cabeza-de-ruta | → ← | trompa de Cami de lado (`s-trompa-lado`) | **Generar**: flecha o trompa de Cami |
| Buscar (campo) | vista-ira | lupa | pasajero con linterna | **Generar** (el mismo de «Ir a») |
| Centrar donde estás | vista-mapa | mira de línea | `s-pasajero` | **Generar** glifo del pasajero |
| Usar mi ubicación | Inicio, primera vez | sin ícono | `s-pasajero` | Reusar el glifo del pasajero |
| Reintentar | sin red, lista de paradas | solo texto | — | **Generar** ↻ |
| Ver / ocultar ruta en el mapa | tira-de-rutas | solo texto | **ojo del universo** | **Generar**: ojo abierto = se ve · cerrado = oculta |
| Día / noche | ontoy.tsx (piel) | sol y luna de línea | Ontoy dormido | **Generar** sol y luna |
| Avisos (+ nuevos) | ontoy.tsx | campana de línea | `s-paradito-aviso` | **Generar** glifo de aviso + punto carbón de no visto |
| Instalar (PWA) | tarjeta en Inicio | — | — | **Generar**: teléfono con Ontoy asomado |

### Estados y datos
| Símbolo | Dónde | Del universo | Qué falta |
|---|---|---|---|
| Carita de estado de ruta (en vivo, por arrancar, cerrada, sin señal) | filas de ruta en Inicio | `s-est-*` ya existen (60 px) | Probarlas a 20–24 px y **usarlas en la fila de ruta** (hoy no las usa) |
| Punto en vivo / dato viejo | atajo-de-parada | — | **Generar**: punto con edad (sin pulsar, sin alarma) |
| Sin señal (en línea) | avisos, atajo | `s-ontoy-sinred` (personaje) | **Generar** glifo chico |
| Caminar N min | resultados de Ir a | pasajero | **Generar** pasajero caminando |
| Cuenta del QR | vista-pase | — | **Generar** anillo que se vacía (quieto con reduced-motion) |
| Sube el brillo | vista-pase | — | **Generar** sol (el mismo de día/noche) |
| Notificación del teléfono | sistema | ícono de la app | Ya existe |

### Lector (validador)
| Lado | Hoy | Qué falta |
|---|---|---|
| Lo que ve quien sube | «✓ SUBE» y «✕ NO PASA» en texto | Caras de Ontoy (listo, leído, no válido, sin red). Ya están en el estándar; **falta dibujarlas a tamaño de lector** |
| Lado del operador | los mismos caracteres | **Generar** palomita y tache **neutros, sin caritas** (es frontera) |

**Total por generar:** unos **22 glifos** y **4 caras de lector**. Además hay que **redibujar a tamaño de glifo** 5 piezas que ya existen: casa, pasajero, estrella de Tino, aviso de Tino y caritas de estado.

## 2. Propuesta de construcción (a decidir)
- **Retícula de 24**, zona útil de 20. Formas **rellenas** en carbón, sin contornos y con esquinas redondas. Las flechas se hacen con trazo grueso y punta redonda (como una línea de calle), nunca de 1.5 px.
- **Dos familias:**
  - **Objetos** (barra, guardar, avisos, instalar, ubicación): mini-objetos del mundo **con ojos**.
  - **Señales** (chevron, volver, cerrar, más/menos, sentido, reintentar): **sin ojos**, son puntuación.
- **Estado activo** en la barra: se queda la pastilla carbón. El glifo pasa a hueso y **abre los ojos al frente**.
- **Color:** carbón y hueso nada más. Ni barrio ni ruta ni naranja. La excepción es Ontoy (el ícono de la app y la instalación), que siempre va naranja.

## 3. Choques de reglas que hay que resolver
1. `readme`: los objetos del mundo usan **colores de barrio**, por ejemplo la casa rosa. Pero `Estándar §0.7` y el readme dicen que el barrio **nunca va en la interfaz**. ¿La barra es interfaz (carbón) u objeto (color)?
2. `Estándar G`: ojos cerrados = cerrado o descansando. Si en la barra la pestaña inactiva cierra los ojos, se lee como «cerrado». **Propuesta:** inactivo = sin ojos, o con ojos pero sin pupila.
3. `Universo 06` dice que la ruta cerrada lleva «Tino aburrido»; el `Estándar` dice «ojos cerrados». En `App Inicio` usé ojos cerrados. Hay que confirmar cuál se queda.
4. Legibilidad: unos ojos de 3 px a 22 px pueden ensuciar. Hay que probarlo en un teléfono real antes de aprobar.

## 4. Orden sugerido
1. Hoja de glifos: las 2 familias, en día y noche, a 20/24/32 px.
2. Sustituirlos en `App Inicio` (barra, estrella, chevron, más/menos) y usar las caritas de estado en las filas de ruta.
3. Caras del lector.
4. Seguir con Mapa + hoja de parada, ya con los glifos nuevos.
