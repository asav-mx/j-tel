---
name: jtel-diseno
description: Lenguaje visual y reglas de interfaz de J-Telemetry (repo asav-mx/j-tel). Úsalo SIEMPRE que se diseñe, construya, revise o modifique cualquier pantalla, componente, gráfico, tabla, correo o vista de J-Tel — Compás·flota, Vernier, J-Staff, las apps de pasajero o el landing. Aplícalo aunque la petición no hable de diseño; vale igual para "agrega una columna", "haz el endpoint y su pantalla", "arregla este componente", "muestra los veredictos", "hazme un gráfico", "mapa", "playback", "alertas", "reportes". Si el trabajo produce algo que un humano va a ver dentro de J-Tel, este skill aplica. REEMPLAZA al skill j-telemetry-ui, borrado el 15 de septiembre de 2026.
---

# J-Tel — Lenguaje de interfaz

Escrito el 15 de septiembre de 2026, en sesión de ASAV y Claude, después de descartar por completo la piel anterior. El `Marco-Limpio-J-Telemetry-MAESTRO.md` manda sobre este documento: si algo aquí choca con el Marco, gana el Marco.

**Su documento hermano:** `docs/Mapa-De-La-Casa.md` — la navegación, la organización y el flujo. Este skill dice **cómo se ve** una pantalla; el mapa dice **qué pantallas hay y cómo se llega a ellas**. Antes de inventar un lugar, una entrada de menú o un camino, se lee el mapa. El Marco manda sobre los dos.

---

## La regla que gobierna todo

> **Si hay que leerlo, no se usa.**

Quien abre J-Tel a las seis de la mañana quiere **ver** su flota, no **leerla**. Un muro de texto —por correcto que sea cada renglón— hace que la pantalla se sienta trabajo, y una pantalla que se siente trabajo se deja de abrir.

De ahí salen las cuatro consecuencias que gobiernan cada decisión:

1. **Símbolos antes que palabras.** El estado se ve; no se lee.
2. **Un número por cosa.** Si hay dos cifras compitiendo, una sobra o va en otro lado.
3. **Aire.** Las cosas separadas se distinguen; las apretadas se vuelven una mancha.
4. **Lo apagado se apaga.** El ojo tiene que ir solo a lo que está vivo, sin buscarlo.

### Un número, o el número con su umbral: depende del momento

«Un número por cosa» y «todo número con su umbral» no se contradicen: son **momentos distintos**, y cada superficie es de uno o del otro.

| Momento | Dónde | Qué va |
|---|---|---|
| **El vistazo** | Listas, mapas, piezas | **Un solo número.** Ahí el ojo barre; dos cifras compiten y el vistazo se rompe |
| **La decisión** | Un aviso, un veredicto, un renglón de cobro | **El número con su umbral:** `47.3 min · umbral 30 min`. Sin el umbral, quien lee tiene que calcular, y ésa es la trampa del Marco |

La pregunta para saber de cuál es: **¿con este número alguien decide algo?** Si sí, lleva su umbral. Si sólo se mira, va solo.

Decidido por ASAV el 15 de septiembre de 2026, a raíz del correo de avisos: ese correo es del segundo momento y se queda con su umbral.

Esto no contradice la honestidad del Marco — la sirve. Un dato que nadie mira no protege a nadie. Lo que el Marco exige es que **nada afirme lo que no comprobó**; lo que este skill agrega es que además **se pueda ver de un vistazo**.

---

## La pieza: la unidad básica del lenguaje

Nada se muestra como renglón de tabla. Todo se muestra como **pieza**: un objeto con su glifo, su nombre, su dato y su estado, con aire alrededor.

```
┌──────────────────────────────────────────┐
│  ◤   10254                        14 s   │
│      42.7 km/h                  AL AIRE  │
└──────────────────────────────────────────┘
```

Cuatro partes, siempre en este orden:

| Parte | Qué lleva | Regla |
|---|---|---|
| **Glifo** | La forma que dice el estado | Nunca decorativo. Si no dice algo, no va |
| **Nombre** | El número económico, el nombre de la ruta, lo que la identifica | Grande, tipografía de titular |
| **Apoyo** | Una frase de dos o tres palabras | Nunca una oración |
| **Dato y etiqueta** | El único número que importa, con su palabra | A la derecha, monoespaciado |

Una lista de piezas se lee como cuatro objetos, no como una tabla de cuatro filas. Ésa es toda la diferencia.

**Cuándo sí se usa tabla:** cuando el usuario va a *comparar columna contra columna* entre decenas de filas — un estado de cuenta, una conciliación. Ahí la tabla es la herramienta correcta. Para todo lo demás, piezas.

---

## Los glifos: la forma carga el estado

**El color nunca carga el significado solo.** Un daltónico, una pantalla mala, o el sol de Juárez a las siete de la mañana bastan para que el color desaparezca. La forma sobrevive a todo eso.

Los cuatro estados de una unidad:

| Estado | Glifo | Por qué esa forma |
|---|---|---|
| En movimiento | Flecha llena, **rotada al rumbo real** | La punta dice a dónde va. Información, no adorno |
| Detenida | Círculo lleno | Presente pero sin dirección |
| En destino | Anillo punteado | Está, pero ya no se le mira: la geocerca es la frontera de la evidencia |
| Sin transmitir | Flecha hueca | La silueta de lo que había, vacía |

**Regla de extensión:** cuando haga falta un estado nuevo, se inventa una **forma** nueva, no un color nuevo. Si dos estados comparten forma y se distinguen sólo por color, está mal.

### La vigencia de un papel

Los papeles del expediente (Marco, Pieza 6 §H; `docs/Ficha-Expedientes.md` §4) tienen cinco estados. Aprobados por ASAV el 16 de septiembre de 2026. Son la **tercera familia de formas**: las unidades son flechas y círculos (se mueven), los dispositivos son cuadros (se instalan) y los papeles son **hojas** —rectángulo vertical con la esquina superior derecha doblada—. No usan el cuadrado: ya es del dispositivo, y en el cuarto de Expedientes las dos familias aparecen juntas; un cuadro lleno diría «vigente» y «en unidad» a la vez. Boceto: https://claude.ai/artifact/RcGFprV2kaHpSRoqqmvwnS

| Estado | Glifo | Por qué esa forma | Tinta |
|---|---|---|---|
| Vencido | Hoja hueca, **tachada** con una sola diagonal | La hoja sigue ahí, pero ya no vale | `--tinta` |
| Por vencer | Hoja hueca con la mitad inferior **llena en diagonal** | Se está gastando | `--tinta` |
| Falta | **Contorno punteado** de hoja | El lugar existe; la hoja no | `--tinta` |
| Vigente | Hoja llena | Hoja entera | `--tenue` |
| Sin vencimiento | Hoja llena con una **raya hueca** horizontal | Hoja entera sin fecha que corra | `--tenue` |

- **Lo que pide hacer algo va en tinta; lo que está al día, en tenue.** Es la ley de «lo apagado se apaga»: el ojo va solo a los tres primeros.
- **Ni cobre ni colores de veredicto.** Un papel vencido no es un servicio no cumplido, y la vigencia no es vida.
- En el vistazo, el dato es **un número**: los días que faltan (`en 12 d`) o los que lleva vencido (`hace 3 d`). La fecha exacta va en el expediente.

### Los tres estados de una parte del expediente

Cada parte de un expediente declara uno de tres estados (`docs/Ficha-Expedientes.md` §3). Ninguno se esconde, y ninguno usa esqueleto: un esqueleto finge contenido que no va a llegar.

| Estado | Cómo se ve |
|---|---|
| Con datos | El dato, con su edad si es algo vivo |
| Vacía | Una frase corta en `--tenue` que dice qué falta: `Sin choferes asignados` |
| Aún no disponible | Una frase corta en `--tenue` con de dónde va a llegar: `Aún no disponible · llega con Flota en vivo` |

**La frontera:** «aún no disponible» sólo cuando nada alimenta esa parte. Decirlo de algo que la base ya tiene es una afirmación falsa (Marco 6.19).

---

## La edad: el número que nunca falta

Toda cosa viva muestra **la edad de su último dato**, siempre, sin excepción.

`hace 14 s` · `hace 3.8 h` · `06:41`

Esto es la Pieza 1 §D hecha regla de interfaz. Un punto de hace tres horas dibujado igual que uno de hace diez segundos es un dato correcto que afirma algo falso. La edad escrita impide esa mentira.

**Dos precisiones:**

- Una unidad que llegó a su destino **no está "sin señal"**. Su traza se corta al llegar porque así lo manda el Marco. Se muestra la hora de llegada, no la edad — y nunca en el grupo de las calladas.
- Una geocerca corta la traza **según su rol**. Destino corta; paradero de circuito no. El corte lo decide el rol, no la geocerca por serlo.

---

## Los colores

Tinta azul profunda, cobre como único color señal, y verde sólo para el latido de lo vivo. Nace **claro**; la piel oscura es un interruptor, no un tema aparte.

### Piel clara — la de nacimiento

```
--papel     #FAFAFC   fondo de la aplicación
--pieza     #FFFFFF   tarjetas y piezas
--tinta     #1C2148   texto principal
--tenue     #6A7192   apoyo, etiquetas, lo secundario
--linea     #E4E5EE   separadores y bordes
--senal     #B05A0F   cobre — SÓLO donde hay vida
--vivo      #1B9E6B   el latido de «en vivo»
```

**Los dos valores que subieron, y por qué.** `--tenue` nació `#757C9B` y el
cobre `#EE8A32`. Medidos sobre `--papel` daban **3.94:1** y **2.42:1** — por
debajo del 4.5:1 que este mismo skill exige en su lista de entrega, y el cobre
ni siquiera alcanzaba el 3:1 de lo que no es texto. En la pantalla de un
coordinador a las siete de la mañana, con el sol de frente, eso no se lee: es la
condición exacta para la que este skill eligió la forma sobre el color. Se
bajaron en luz conservando el tono —el cobre sigue en 28°, el apoyo en 230°— y
hoy dan **4.67:1** y **4.59:1**. El cobre de la piel clara es más oscuro que el
de la oscura a propósito: cada piel tiene sus propios valores, no los mismos
volteados.

### Piel oscura

```
--papel     #0B0D18
--pieza     #141829
--tinta     #EDEEF8
--tenue     #7A81A0
--linea     #232842
--senal     #FFA24D
--vivo      #2FCB8B
```

### Las leyes del color

1. **El cobre sólo aparece donde hay vida.** Un dato fresco, una unidad transmitiendo, un valor que cambia ahora. Nunca en bordes, botones inertes, encabezados ni decoración. Si el cobre está en todos lados, deja de significar.
2. **Lo apagado suelta el color** y baja a 60% de opacidad. Una unidad que llegó o se calló se va a gris. El contraste hace la jerarquía.
3. **El verde es del latido, no de un veredicto.** Marca que el sistema respira.
4. **Los colores de veredicto viven aparte y no se tocan.** El Marco reserva significado a cumplido, no cumplido y pendiente. Esos tres nunca se usan para nada más, y el cobre nunca se usa para un veredicto.
5. **Las dos pieles se diseñan juntas.** Ninguna pantalla se da por terminada sin verse en las dos. La piel clara no es la oscura con los fondos volteados: cada una tiene sus propios valores.

**Por qué el cobre, y por qué no el morado de Juárez Bus:** Juárez Bus es un cliente de J-Tel, no J-Tel. Si la plataforma se viste de sus colores, el siguiente transportista abre su cuenta y ve los colores de su competencia. El cobre guarda el parentesco de temperatura con el ámbar del logo familiar sin ser su marca.

---

## Tipografía

Tres papeles, sin excepción:

- **Bricolage Grotesque** (700/800) — lo que identifica: números económicos, títulos, la marca. Ancha, con carácter, con letras apretadas entre sí.
- **Inter** (400/500/600) — lo que se lee de corrido: frases de apoyo, etiquetas, prosa.
- **JetBrains Mono** (400/500) — todo lo que es medición: edades, horas, porcentajes, IMEIs, folios. Con `font-variant-numeric: tabular-nums` para que las columnas de números alineen.

El mono en las mediciones es deliberado: hace que el dato se lea como lectura de instrumento, no como texto de aplicación.

---

## El movimiento

**Se mueve lo que está vivo. Nada más.**

J-Tel es un árbitro, y lo que vende es que le creas. Las cosas en las que confiamos se mueven poco. El movimiento gratuito es de las cosas que quieren gustarte, no de las que quieren que les creas.

**Permitido**, porque significa algo:
- El latido del indicador «en vivo» — el sistema respirando.
- Un camión avanzando en el mapa, porque avanzó de verdad.
- El playback corriendo, porque el tiempo corre.
- Una traza dibujándose mientras se recorre.

**Prohibido:**
- Entradas con rebote, pulsos decorativos, transiciones de adorno.
- Cualquier animación sobre un veredicto.
- Esqueletos que fingen contenido que todavía no llega.

Y siempre: `prefers-reduced-motion` respetado.

---

## Nombrar

**Las pantallas de detalle no llevan sustantivo propio.** Se nombran por lo que muestran:

`Ver 10254` · `Ver Ruta Poniente` · `Ver TK-FTC927-003`

«Expediente» sí se usa: es sustantivo del Marco (Pieza 6 §H, 6.30–6.33) — la vista completa de una cosa, con sus cuatro familias: identidad, actividad, relaciones y documentos. No es una carpeta de papeles. El título de la pantalla sigue siendo `Ver ‹x›`, como dice el mapa de la casa. No «perfil» (el Marco ya define «perfil de servicio»; dos cosas con el mismo nombre es la trampa de la UNIDAD, Pieza 1 §D caso 6).

**Idioma:** español mexicano de operación. Los usuarios son coordinadores de transporte y gente de planta, no ingenieros. Nada de jerga técnica en las caras de cliente y carrier.

---

## Lo honesto puede verse peor, y así se queda

Del Marco, Pieza 1 §E. Se nombra aquí porque es donde más se rompe:

- **El playback no se desliza por los huecos.** Se detiene, lo dice, y salta al otro lado. Una línea que cruza un hueco afirma un camino que nadie observó.
- **Una traza rota se dibuja rota.** No se suaviza, no se interpola, no se rellena.
- **Un vacío se ve vacío** y dice por qué. No se maquilla con un promedio ni con un cero.

Cuando la versión honesta se vea peor que la falsa —y se va a ver— la tentación de arreglarla no es un error de una vez: es un riesgo permanente. La prueba, antes de dibujar: *¿esto lo midió el sistema, o lo estoy completando yo?*

---

## Las caras

Mismo idioma, distinto aire. No es la misma pantalla con permisos apagados.

| Cara | Quién | Registro |
|---|---|---|
| **Compás · flota** | El carrier | Piezas y mapa. El producto que vale sin contrato |
| **Vernier — planta** | Vive la operación diaria | Detalle por servicio. Más densa, pero sigue siendo piezas |
| **Vernier — corporativo** | Ve todas sus plantas | Panorama. Comparar, no operar |
| **J-Staff** | El operador de la plataforma | Puede ser más cruda: aquí el usuario es experto y quiere el razonamiento completo |
| **Apps de pasajero** | Público | Lo más calmado de todo: una decisión por pantalla |
| **Landing** | Público | Excepción total. No trata datos ni veredictos; puede ser todo lo expresivo que quiera |

---

## Celular y computadora

**Mismo idioma, distinta densidad.** La pieza es idéntica; cambia cuántas caben y qué hay alrededor.

- **Celular:** una columna de piezas, una decisión por pantalla, nada compite. El interruptor Lista/Mapa arriba y ya.
- **Computadora:** las piezas a la izquierda, el mapa a la derecha. Más piezas visibles, misma calma.

Responsivo real en 375 / 768 / 1024 / 1440. Lo ancho —tablas, mapas, trazas— se desplaza dentro de su propio contenedor; el cuerpo de la página nunca se va de lado.

---

## Anti-patrones

Si aparece cualquiera de éstos, el lenguaje se disolvió:

- Un renglón de tabla donde debía ir una pieza.
- Una oración donde bastaba una palabra.
- Un estado que se distingue de otro sólo por color.
- Un dato vivo sin su edad al lado.
- El cobre usado como decoración, en bordes o en cosas apagadas.
- Colores de veredicto fuera de un veredicto.
- Una pantalla que sólo existe en una piel.
- Emojis como iconos. Iconos SVG, y sólo cuando dicen algo.
- Componentes de catálogo dentro del producto: heroes, tarjetas prehechas, iconos decorativos. En el landing sí; en el producto no.
- Números redondeados o con «~». Los instrumentos no redondean.
- Cualquier cosa que se pueda crear y no se pueda corregir desde la pantalla (Marco 6.18).

---

## Antes de entregar

- [ ] ¿Cada estado se distingue por su **forma**, no sólo por color?
- [ ] ¿Todo dato vivo trae su edad?
- [ ] ¿El cobre aparece **sólo** donde hay vida?
- [ ] ¿Lo apagado está apagado de verdad?
- [ ] ¿Se ve bien en las **dos** pieles?
- [ ] ¿Se puede entender sin leer una oración completa?
- [ ] ¿Las trazas se cortan según el **rol** de la geocerca?
- [ ] ¿El playback se detiene en los huecos en vez de deslizarse?
- [ ] ¿Sólo aparecen los tres veredictos del Marco, con el detalle como motivo debajo?
- [ ] ¿Ningún nombre de cliente, planta o ruta está horneado en el componente?
- [ ] ¿Lo que se puede crear aquí, se puede corregir aquí?
- [ ] Oficio: foco visible con teclado, contraste ≥ 4.5:1, `prefers-reduced-motion` respetado, cursor de mano en lo clickeable.

---

## Pendiente

`docs/Trampas-De-Medicion.md` guarda, en su Parte 2, cinco reglas rescatadas del skill anterior sobre **qué afirma una pantalla**, marcadas como candidatas al Marco y **sin ratificar**. Mientras no se comparen contra el Marco, no se construye nada citándolas: se cita el Marco o se pregunta. Cuando se resuelvan, las que sobrevivan entran aquí o al Marco, y esta sección se borra.
