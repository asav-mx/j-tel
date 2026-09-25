# Auditoría · UI de la app ¿Ontoy?

Fuente: repo `asav-mx/j-tel` · `apps/publico` (leído 2026-09-24) + reglas de `CLAUDE.md` y `readme.md`.
Estructura real: la app **abre en la ciudad** (no en una ruta). Barra fija: **Inicio · Mapa · Ir a · Pase**.

## 1. Pantallas
| # | Pantalla | Archivos del repo | Qué resuelve |
|---|---|---|---|
| 1 | Inicio | vista-inicio, rutas-de-inicio, atajo-de-parada, tira-de-rutas, cabeza-de-ruta | Tus paradas guardadas arriba; rutas de la ciudad con su estado (abierta / cerrada, abre a las… / por arrancar) |
| 2 | Mapa | vista-mapa, panel-de-rutas, hoja-de-parada, pista-del-mapa, tinte-* | Rutas en su color, Cami en vivo, Tino en cada parada, «Tú estás aquí» (pasajero 12a); hoja inferior de la parada con llegadas |
| 3 | Ir a | vista-ira, buscar-lugar, rutas-cerca | Buscar un lugar → qué ruta, dónde subirte, cuánto caminas, cuándo pasa |
| 4 | Paradas | vista-paradas, paradas-guardadas, favoritas | Guardar / quitar paradas, sin cuenta (se quedan en el teléfono) |
| 5 | Avisos | vista-avisos, avisos, avisos-vistos, avisos-del-telefono | Desvíos y horarios con fecha y «según la concesión»; permiso de notificaciones |
| 6 | Pase | vista-pase, codigo-qr, pase-del-telefono, banda-rd | Pase QR del pasajero (R&D, lleva banda) |
| 7 | Lector `/validador` | validador/lector | Lector del camión (R&D, operación) |
| 8 | 404 · Privacidad | not-found, privacidad | Callejón sin salida amable · textos legales |

## 2. Estados que cada pantalla necesita
- **Sin dato** (decir-el-no): Ontoy lo dice, nunca adivina. Placa sin minutos.
- **Dato viejo**: «posición de hace N s» (ritmo-del-sondeo).
- **Ruta cerrada** («abre a las 5:30») · **por arrancar** («arranca el 1 de oct») · **de noche**: Ontoy con los ojos cerrados.
- **Sin red / offline** (service worker) · **cargando**.
- **Ubicación**: pedir, denegada, imprecisa.
- **Vacíos**: sin paradas guardadas, sin avisos, búsqueda sin resultados.
- **Modo noche** (tema.ts) y **reduced-motion** (solo cambia la cara).

## 3. Componentes base
Barra (ícono + palabra, activo con pastilla y trazo) · Placa de ruta (carbón; «¡ya!» en color de ruta) · Tarjeta de llegada · Hoja inferior (mapa) · Buscador + resultados · Chips de ruta · Tira de rutas · Aviso (fecha + fuente) · Botón de guardar parada · QR del pase · Ontoy en sus reacciones ligadas a dato real.

## 4. Flujos a diseñar de punta a punta
1. Primera vez: abrir → permiso de ubicación → paradas cercanas.
2. Guardar mi parada → al volver, Inicio ya dice cuándo pasa.
3. «Voy a…» → ruta → caminar a la parada → ¡ya viene!
4. Llega un aviso de desvío → leerlo → ver la parada alterna en el mapa.
5. De noche / sin servicio → qué dice Ontoy y cuándo vuelve.
6. Pase: mostrar QR al subir (R&D).

## 5. Decisiones (2026-09-24)
- Lector: la cara que ve quien sube **lleva el universo**; el lado del operador, sin caritas.
- El Pase (R&D) **entra**.
- Sin pantallas de bienvenida: una sola tarjeta de Ontoy en Inicio; el QR de un Tino abre esa parada.
- Tótem central en el mapa cuando comparten parada 2 o más rutas.
- Estándar completo en `Estandar de pantallas.md`.

## 7. Avance al 2026-09-24 (versión 1)

### Hecho
| Qué | Archivo |
|---|---|
| Componentes base: barra, placa, tarjeta de llegada, hoja, botones y fila de ruta | App Inicio · 1a |
| Inicio: primera vez, con paradas, sin dato, cerrada y noche | App Inicio · 1b |
| Símbolos del universo: 30 glifos, barra 2b y caritas de estado | Simbolos |
| Mapa: asomada, media, completa, tótem, por arrancar, cerrada, sin dato y sin red, de día y de noche | App Mapa |
| Ir a como buscador (vacío, escribiendo, resultados, sin resultados), Avisos con su vacío, y sin red, 404 y sin paradas | App Ir a y Avisos |
| Pase R&D (QR, sin señal, «pronto») y lector cara al pasajero (listo, leído, no válido, sin red) | App Pase y Lector |
| Paradas (lista y editar), QR de un Tino, ubicación (buscando, denegada, imprecisa) y cargando | App Paradas y estados |
| Prototipo navegable: 3 recorridos, tocar a Ontoy, Cami que avanza y **hoja de Cami** con sus próximas paradas | App Prototipo |
| Tira de rutas (ojo abierto/cerrado) y «Más rutas», Inicio sin red y de noche, lector del operador sin caritas | App Lote 6 |
| Paquete para el equipo: tokens, 30 SVG, especificaciones y 83 capturas | design_handoff_ontoy_app_v1/ |

### Agregado en el camino (decisiones nuevas)
- **Versión 1:** llegadas en paradas, sin minutos; Ir a es solo buscador; sin notificaciones.
- **Color de ruta:** se escoge en J-Staff, **no se ajusta** al dibujar, y «¡ya!» va en el color de la ruta tal cual.
- **Símbolos:**
  - Los objetos llevan ojos y color de barrio; las señales van sin ojos.
  - Barra 2b.
  - Todo «cerrado» duerme con sus zzz.
- **Hoja de Cami:** tocar a Cami enseña sus próximas paradas contadas desde donde va, con la misma lógica que Tino.
- **Ruta por arrancar:** se dibuja punteada y Cami dice «Pronto me verás en la calle», con la fecha y sin frecuencia.
- **Ideas nuevas:**
  - «Mándala» (compartir parada): entra en la versión 1.
  - «¡Sal ya!», Casa y Chamba: quedan para el futuro.

### Falta para la versión 1
1. ~~Lector, lado del operador~~ ✔ (App Lote 6 · 6c)
2. ~~Tira de rutas del mapa~~ ✔ (6a)
3. ~~Inicio sin red y de noche~~ ✔ (6b)
4. ~~Prototipo en modo noche~~ ✔ (App Prototipo noche)
5. Privacidad (texto de la concesión o del abogado).
6. ~~QR real del pase~~ ✔: QR escaneable con corrección M que se renueva cada 5 s (en producción: codigo-qr.tsx con uqr)
7. ~~Regla de íconos en el readme y el estándar~~ ✔
8. ~~Nombre de Tino~~ ✔ se queda **Tino**

### Lanzamiento ✔ (Lanzamiento.dc.html)
- Láminas de Tino (una ruta) y de tótem (varias rutas), 40×60 cm, con QR real de la parada.
- 3 posts 4:5 y 2 historias 9:16 para el 1 de octubre.
- App instalada: ícono en la pantalla de inicio (día y noche) y pantalla de arranque.

### Futuro (fuera de la versión 1)
Minutos «cuando se mida», planeador «voy a…», notificaciones, «¡Sal ya!», Casa y Chamba.
