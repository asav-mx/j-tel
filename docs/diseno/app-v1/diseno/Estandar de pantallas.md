# ¿Ontoy? · Estándar de pantallas de la app

Cómo se ve, se mueve y habla cada tipo de pantalla. Manda `CLAUDE.md`; los valores salen de `tokens/` (no se inventan hex).
**Versión 1 (1 de octubre):** llegadas en paradas, Ir a como buscador, sin notificaciones. Lo demás marcado «futuro».
Base: teléfono 390×844, margen lateral 16, zonas seguras respetadas, toques ≥ 44 px.

---

## 0. Reglas que valen para todas

**La pantalla es la banqueta; el dato es el protagonista; Ontoy es el mensajero.**

1. **Un Ontoy por pantalla, como máximo.** Aparece solo para decir algo: un estado, una respuesta o un «no sé». Nunca es decoración ni relleno.
2. **Tino y Cami viven donde hay una ruta.** Mapa, hoja de parada y llegadas. Siempre en el color de su ruta (`color_hex`, tal cual se guardó; `contraste-de-ruta` solo elige texto blanco o carbón) y siempre con su placa.
3. **Una tarjeta carbón por pantalla.** Es el dato más importante («tu próximo camión»). Todo lo demás va en hueso con `--ring`.
4. **Cada dato en vivo lleva su edad.** «posición de hace 10 s», «según la concesión · ayer 14:20». Sin edad no se muestra.
5. **Sin dato no se inventa nada.** Placa sin dato: «—». Ontoy mira abajo y lo dice.
6. **Nada de alarmas.** Sin rojos de error, sin parpadeos y sin vibración por defecto.
7. **El color de ruta no toca la interfaz.** No va en botones, fondos ni barra. Solo pinta lo que pertenece a una ruta.
8. **Íconos del universo** (`Simbolos.dc.html`): los objetos van con ojos y en color de barrio; las señales, sin ojos y en carbón. En la barra se usa la variante 2b: la pestaña activa mira al frente y las demás voltean hacia ella.

### Anatomía común
| Capa | Estándar |
|---|---|
| Fondo | `--banqueta` plano |
| Encabezado | Título Bricolage 800 · 28/1 · −0.025em, en tipo oración. Debajo, una línea de contexto de 13 px en `--gris` (edad del dato o de dónde viene). |
| Superficies | Tarjeta `--hueso`, radio 22–26, `--ring`. Sin sombras. |
| Barra | Fija abajo: Inicio · Mapa · Ir a · Pase. Ícono + palabra; el activo lleva pastilla carbón y trazo más grueso. 64 px + zona segura. |
| Botón principal | Pill carbón, texto blanco 700 16. Uno por pantalla. |
| Botón secundario | Pill con borde carbón de 1.5 px. |
| Placa | Carbón, radio 7. Número blanco · divisor · paradas («3 paradas»). «¡ya!» va en el color de la ruta. Minutos: futuro, cuando se mida. |
| Llegada | **Versión 1:** en paradas, «Viene a 3 paradas», con la unidad y la edad del dato. Cifra en Bricolage 800, grande (40–48) en la tarjeta carbón. **Futuro, cuando se mida:** minutos con prima, 3′. |

### Tamaños de personaje
- **En línea con el dato:** 40–64 px.
- **Mensajero de estado:** 96–128 px.
- **Pantallas vacías y de noche:** hasta 160 px.
- **En el mapa:** Tino 28–36 px y Cami (vista superior) 26–34 px.

### Mirada y reacciones (solo por dato real o por una acción)
| Situación | Cara |
|---|---|
| Te habla, respuesta o bienvenida | Al frente, sin boca |
| Viene en camino | De lado, hacia donde viene |
| A 1 parada (**medido**; en el futuro, menos de 2′) | Arriba, boca abierta |
| Llegó | Al frente, sonrisa |
| Se fue | Al otro lado |
| Sin dato o buscando | Abajo, boca en línea |
| Sin red | Abajo, boca ondulada |
| Cerrado o de noche | Ojos cerrados |
| Guardaste una parada (acción) | Sonrisa y salto corto |
| Búsqueda sin resultados | Triste suave; enseguida propone otra cosa |
| Tocas a Ontoy | Reacción que sube con clicks seguidos (guiño → corazones → «¡basta!») |

Toda reacción baja de ritmo antes de volver a su estado original. Con reduced-motion solo cambia la cara.

### Movimiento
- **Curva:** `--ease` para todo.
- **Duraciones:** `--t-fast` 0.2 s para toques, `--t-med` 0.45 s para cambios de dato y `--t-slow` 0.6 s para hojas y pantallas.
- **Hoja inferior:** sube con inercia, sin rebote.
- **Números que cambian:** se desvanecen y suben de a una cifra; no se cuentan de golpe.
- **Mapa:** Cami se desliza entre posiciones con suavizado exponencial. Nunca salta.

### Voz
- **Títulos:** una pregunta o una respuesta corta. «¿Ontás?» · «Tu 51 viene a 3′».
- **Botones:** verbo en tú. «Guarda tu parada» · «Usar mi ubicación».
- **Errores:** qué pasó + qué hacer, nunca «Error». «Sin señal. Te enseño lo último que supe, de hace 2 min.»
- **Avisos:** siempre con fecha y quién lo dijo.

### Modo noche
Fondo `--noche`, superficies `--noche-2`, bordes `--noche-3`, texto `--hueso`. Ontoy sigue naranja. Las placas siguen en carbón, con borde `--noche-3`.

---

## A. Consulta · Inicio, Paradas, Avisos
**Para qué:** saber algo en 2 segundos, sin tocar nada.
- **Anatomía:**
  1. Encabezado.
  2. **Tarjeta carbón** con tu parada principal y su próxima llegada.
  3. Lista de tarjetas hueso: otras paradas guardadas, rutas de la ciudad con su estado.
- **Personajes:** Ontoy de 40 px dentro de la tarjeta carbón, solo si tiene algo que decir («¡Ya viene!», «Sin dato»). Tino de 40 px en cada parada guardada, en su color.
- **Estados de ruta:** abierta muestra a cuántas paradas viene la unidad (versión 1). Cerrada dice «abre a las 5:30» con Tino con los ojos cerrados. Por arrancar dice «arranca el 1 de octubre».
- **Avisos:** una tarjeta por aviso, con la placa de la ruta, el título, la fecha y «según la concesión». Si no lo has visto, lleva un punto carbón (no rojo).
- **Nunca:** carruseles, banners ni conteos de «X rutas activas».

## B. Mapa · Mapa + hoja de parada
**Para qué:** ver dónde viene tu camión.
- **Anatomía:**
  1. Mapa a pantalla completa, con el tinte base cálido (`tinte-del-mapa`).
  2. Buscador flotante arriba (pill hueso).
  3. Hoja inferior con tres alturas: asomada, media y completa.
- **Personajes en el mapa:**
  - Líneas de ruta en su color (8 px) sobre una calle hueso.
  - Tino en cada parada, mirando hacia donde viene Cami.
  - Cami en vista superior, en su color.
  - «Tú estás aquí» es el pasajero 12a, con su linterna apuntando hacia donde miras.
  - **Tótem central** cuando se juntan 2 o más rutas (ver D·2).
- **Hoja de Cami:** tocar a Cami abre su hoja con la misma lógica que Tino: Cami de frente en la cabecera, unidad, sentido y edad del dato, y la lista de sus próximas paradas contadas desde donde va («a 1 parada», «a 2 paradas»). Tu parada va resaltada; tocar una parada abre su hoja. Sin minutos en la versión 1.
- **Hoja de parada:** el nombre de la parada, luego una fila por ruta (placa, destino, paradas y edad del dato) y el botón «Guarda tu parada». Tino de 56 px en la cabecera de la hoja, reaccionando a la llegada más próxima.
- **Nunca:** íconos genéricos de pin, flechas azules ni puntos pulsando como alarma.

## C. Búsqueda · Ir a
**Versión 1: buscador.** Escribes una ruta o una parada y la abre en el mapa.
- **Anatomía:**
  1. Buscador grande, con foco al entrar. «Busca una ruta o una parada».
  2. Resultados en lista: rutas (placa + nombre) y paradas (Tino chiquito en su color + nombre + rutas que pasan). Tocar uno abre el Mapa con esa ruta o esa parada.
- **Personajes:** Ontoy de 64 px mientras busca (mirada abajo). Sin resultados: triste suave y «Prueba con el número de la ruta o el nombre de la calle».
- **Futuro · planeador:** «voy a…» → placa, «Súbete en…», minutos caminando, cuándo pasa y mini mapa; la primera opción en carbón. Chips de tus lugares (Casa, Chamba). No entra en la versión 1.

## D. Credencial · Pase (R&D)
**Para qué:** mostrarlo al subir, rápido y con el sol encima.
- **Anatomía:**
  1. Banda R&D arriba (`banda-rd`).
  2. **Tarjeta carbón grande** con el QR sobre un cuadro blanco (margen de 4 módulos) y el nombre y la vigencia.
  3. Un consejo corto: «Sube el brillo si no lo lee».
- **Personajes:** Ontoy de 48 px en la esquina de la tarjeta, al frente, sin boca. Si no hay red: «Tu pase funciona sin señal».
- **Movimiento:** ninguno sobre el QR. Solo la cara de Ontoy puede moverse.
- **Nunca:** nada que tape o anime el código.

### D·2. Tótem central (en el mapa y en la hoja)
- Aparece cuando 2 o más rutas comparten parada.
- Toma el **color de la ruta que llega primero** (dato). Cuando cambia la próxima ruta, el color cambia en 0.6 s.
- Lleva placas apiladas: una por ruta, con una franja inferior del color de esa ruta.
- Si tocas una placa, el tótem toma el color de esa ruta y la hoja se filtra a ella.
- Sin dato: color de la primera ruta de la lista, mirada abajo y placas en «—».

## E. Operación con cara al pasajero · Lector (pantalla que ve quien sube)
**Regla:** si el pasajero la ve, es imagen de Ontoy y **lleva el universo**.
- **Anatomía:**
  - Fondo `--banqueta`.
  - Arriba, una placa grande con la ruta del camión en su color.
  - Al centro, el estado del lector.
- **Estados:**
  - Listo: Ontoy al frente, «Acerca tu pase».
  - Leído: sonrisa y «¡Súbele!».
  - No válido: boca en línea, sin rojo, con el porqué en una línea («Este pase es de otra ruta»).
  - Sin red: ondulada, «Lo reviso cuando haya señal».
- **Movimiento:** cada respuesta dura 1.5 s y vuelve sola a «Listo». Sonido corto opcional (`pip`), nunca una alarma.

## F. Operación sin cara al pasajero · Lector (lado del operador), J-Staff, planta y carrier
**Regla de frontera:** **sin caritas.** Los mismos neutros y la misma tipografía, sin personajes, sin reacciones y sin naranja.
- Tono sobrio e informativo; datos densos, en tablas y listas.
- La placa de ruta sí se usa, porque es un dato, no un personaje.

## G. Estados de pantalla completa · vacío, noche, sin red, 404
- **Anatomía:** Ontoy de 128–160 px al centro, una línea en Bricolage 800 24, una línea de ayuda en 15 y un solo botón.
- **Copys:**
  - Vacío (sin paradas guardadas): Ontoy al frente, «Guarda tu parada y aquí te digo cuándo pasa».
  - Noche (sin corridas): ojos cerrados, zzz lentos, «Ya no hay corridas. Vuelven a las 5:30». Si lo tocas: «¡cinco minutitos más!».
  - Sin red: ondulada, «Sin señal. Te enseño lo último que supe».
  - 404: al otro lado, «Esta calle no lleva a ningún lado. Te regreso al inicio».

## H. Momentos del sistema · permisos, notificaciones, instalación
- **Sin pantallas de bienvenida. La calle es el onboarding:**
  - **Si abres la app:** caes directo en Inicio. La primera vez, arriba aparece **una sola tarjeta**: Ontoy al frente, «¿Ontás? Dime dónde estás y te digo qué pasa cerca», con «Usar mi ubicación» y «Buscar mi parada». Se va para siempre en cuanto respondes. Si dices que no: «Va. Búscala tú».
  - **Si escaneas el QR de un Tino:** abre directo la hoja de **esa** parada y sugiere «Guárdala».
- **Notificaciones · futuro (fuera de la versión 1).** Cuando entren: se piden solo después de guardar una parada, nunca al abrir. «¿Te aviso cuando ya venga tu 51?»
- **Notificación del teléfono (futuro):** ícono de Ontoy y texto con dato y edad. «¡Ya viene tu 51! · Llega en 2′ a Av. Tecnológico».
- **Instalar (PWA):** tarjeta hueso en Inicio después del tercer uso. «Ponme en tu pantalla de inicio».

---

## Checklist por pantalla
- [ ] ¿Hay un solo Ontoy, y dice algo?
- [ ] ¿Cada cifra en vivo lleva su edad?
- [ ] ¿Solo lo que es de una ruta lleva color de ruta?
- [ ] ¿Hay una sola tarjeta carbón y un solo botón principal?
- [ ] ¿Está definido el estado sin dato?
- [ ] ¿Funciona en modo noche y con reduced-motion?
- [ ] ¿Los toques miden ≥ 44 px y el texto mide ≥ 12 px?
