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
| Sin señal | **Círculo hueco** | Presente pero callada: pide esperar. Distinto de la flecha hueca de desconectado, que pide hacer. Aprobado el 16 sep 2026 |
| En destino | Anillo punteado | Está, pero ya no se le mira: la geocerca es la frontera de la evidencia |
| Sin transmitir | Flecha hueca | La silueta de lo que había, vacía. Es DESCONECTADO |
| Sin dispositivo | Flecha hueca **punteada** | Ni siquiera hubo con qué transmitir. Distinta de la de desconectado: una pide revisar el dispositivo, la otra montarle uno. Decisión 7 del cuarto de Compás, 16 sep 2026 |

### Los dispositivos: cuadros

Ratificados el 16 de septiembre de 2026 (boceto de «las dos familias»). Un dispositivo se instala; por eso es una caja.

| Estado | Glifo | Por qué esa forma | Tinta |
|---|---|---|---|
| En unidad | Cuadro lleno | Instalado y hablando | `--senal` |
| En bodega | Cuadro hueco | Existe, espera camión | `--tenue` |
| Desconectado | Cuadro cortado | Montado, y más de 24 h callado | `--tenue` a 60 % |
| De baja | Cuadro tachado con una equis | Su historia queda; él ya no cuenta | `--tenue` a 60 % |

**Regla de extensión:** cuando haga falta un estado nuevo, se inventa una **forma** nueva, no un color nuevo. Si dos estados comparten forma y se distinguen sólo por color, está mal.

### La vigencia de un papel

Los papeles del expediente (Marco, Pieza 6 §H; `docs/Ficha-Expedientes.md` §4) tienen cinco estados. Aprobados por ASAV el 16 de septiembre de 2026. Son la **tercera familia de formas**: las unidades son flechas y círculos (se mueven), los dispositivos son cuadros (se instalan) y los papeles son **hojas** —rectángulo vertical con la esquina superior derecha doblada—. No usan el cuadrado: ya es del dispositivo, y en el cuarto de Expedientes las dos familias aparecen juntas; un cuadro lleno diría «vigente» y «en unidad» a la vez. Boceto: https://claude.ai/artifact/RcGFprV2kaHpSRoqqmvwnS

| Estado | Glifo | Por qué esa forma | Tinta |
|---|---|---|---|
| Vencido | Hoja hueca, **tachada** con una sola diagonal | La hoja sigue ahí, pero ya no vale | `--tinta` |
| Por vencer | Hoja hueca con la mitad inferior **llena en diagonal** | Se está gastando | `--tinta` |
| Falta | **Contorno punteado** de hoja | El lugar existe; la hoja no | `--tinta` |
| Falta la fecha | Hoja hueca de **trazo continuo** | El papel está, pero no dice cuándo vence; pide algo | `--tinta` |
| Falta la regla | Hoja hueca con **el doblez lleno y más grande** que en las demás hojas (a 22 px, con el de tamaño normal, sólo el color la separaba de «falta la fecha») | Espera su regla del catálogo; no pide nada al transportista, pero tampoco deja decir «al día» | `--tenue` |
| Vigente | Hoja llena | Hoja entera | `--tenue` |
| Sin vencimiento | Hoja llena con una **raya hueca** horizontal | Hoja entera sin fecha que corra | `--tenue` |

**No capturado** —un papel opcional que nadie ha capturado— **no lleva pieza**: va en una línea al final, «Opcionales sin capturar: …», cada nombre tocable para capturarlo. Falta la fecha, falta la regla y no capturado, aprobados el 16 de septiembre de 2026.

**Una pieza que liga sin afirmar un estado no lleva glifo.** Una relación —el dispositivo que una unidad trajo antes, la unidad donde estuvo un dispositivo— o una foja ya renovada se dibujan sin forma: ponerles una diría un estado que nadie juzgó.

- **Lo que pide hacer algo va en tinta; lo que está al día, en tenue.** Es la ley de «lo apagado se apaga»: el ojo va solo a los tres primeros.
- **Ni cobre ni colores de veredicto.** Un papel vencido no es un servicio no cumplido, y la vigencia no es vida.
- En el vistazo, el dato es **un número**: los días que faltan (`en 12 d`) o los que lleva vencido (`hace 3 d`). La fecha exacta va en el expediente.

### Los sellos: el veredicto de un hecho (hexágonos)

Ratificados por ASAV el 18 de septiembre de 2026 con Vernier V1 (`docs/Ficha-Construccion-Vernier-V1.md` §4). Son la **cuarta familia de formas**: las unidades son flechas y círculos (se mueven), los dispositivos cuadros (se instalan), los papeles hojas (se vencen) y los veredictos **hexágonos** (se sellan). Ninguna otra familia usa el hexágono.

| Veredicto | Glifo | Por qué esa forma | Color |
|---|---|---|---|
| Cumplido | Hexágono **lleno** | El sello entero | `--sello-ok` |
| Pendiente de evidencia | Hexágono de **contorno punteado** | El lugar del sello existe; la evidencia no alcanzó | `--tinta` |
| No cumplido | Hexágono **hueco tachado** con una diagonal | Se juzgó, y no se cumplió | `--ladrillo` |

- **Los dos colores nuevos son exclusivos del sello.** `--sello-ok` y `--ladrillo` no se usan en ningún otro lugar de la plataforma: ni en bordes, ni en avisos, ni en papeles. Una prueba de fuente lo vigila (`lib/casa/vernier-guardia.test.ts`).
- **`--sello-ok` es un verde sobrio**, deliberadamente distinto de `--vivo`: el latido sigue siendo lo único que brilla. Un cumplido no está vivo; está sellado.
- **`--ladrillo`** tiñe también la palabra «No cumplido» y la hora del sello de un no cumplido en la pieza. Nada más.
- **El timing no lleva glifo.** Temprano, a tiempo y tarde van en palabras junto al veredicto —`Cumplido · tarde`—, y su cifra con su umbral en el acta. El hexágono es del veredicto; una segunda forma para el timing se leería como un cuarto veredicto.
- **Cero cobre donde sólo hay sellos.** Nada sellado está vivo.
- La forma carga el estado; el color acompaña. Sin color, lleno / punteado / tachado siguen distinguiendo los tres.

### Las marcas de la traza: «aquí la medición se interrumpe»

Ratificadas por ASAV el 18 de septiembre de 2026. **No son sujetos, y no entran a la tabla de sujetos** (la flecha es de la unidad, el cuadro del dispositivo, la hoja del papel, el hexágono del veredicto). No dicen qué *es* una cosa: dicen **dónde la traza deja de afirmar un camino**. Por eso son su propia familia, y las dos se leen juntas:

| Marca | Forma | Qué dice | Dónde |
|---|---|---|---|
| Hueco | **Círculo hueco**, trazo continuo, en cada extremo | Nadie midió: el equipo calló más de 15 min | Mapa, cinta, pausa del playback |
| Salto del GPS | **Rombo hueco**, en cada extremo | Se midió, pero los dos puntos se contradicen: ningún camión recorre esa distancia en ese tiempo (más de 300 km/h) | Mapa, cinta, pausa del playback |

**Lo que tienen en común:** en los dos casos la línea entre los dos extremos **no se dibuja**, porque afirmaría un camino que nadie observó. Ningún punto se borra: los dos extremos se marcan. El playback se detiene en cada marca, lo dice, y salta al otro lado.

**Lo que las separa,** y por eso son dos formas: el hueco es silencio —por eso comparte el círculo hueco con SIN SEÑAL de la unidad, que dice lo mismo—; el salto no es silencio —el equipo sí transmitía, y los tramos medidos no se cortan por él—: lo que no se sabe es el camino. Decidir cuál de los dos puntos es el falso sería especular.

- **Un hueco sin desplazamiento también se declara.** Si sus dos extremos quedan a 50 m o menos (`HUECO_QUIETO_METROS`: la deriva de un camión estacionado), sus círculos caen uno encima del otro y la línea se ve continua. Se dice en una **pastilla** con el número y la palabra (`○ 9 huecos`), en la capa de rótulos para que el marcador del playback no la tape. Una pastilla junta sólo los huecos que de verdad caen **encima** en la pantalla; si a simple vista quedan separados, cada uno lleva la suya.
- **La cifra de saltos sólo aparece cuando hay.** «0 saltos» es ruido: lo que no aplica no se muestra.
- **La marca va en `--tinta` sobre `--pieza`**, en las dos pieles. Ni cobre (no es vida) ni colores de veredicto.

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
- La traza se corta **según la modalidad del servicio** (Marco, Pieza 7): en especial, la geocerca de destino corta; en circuito, ninguna corta, ni la misma geocerca de destino (es de paso). EN DESTINO sólo existe en especial.

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
--sello-ok  #2E6A4E   el sello de un cumplido — SÓLO ahí
--ladrillo  #A93636   el sello de un no cumplido — SÓLO ahí
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
--sello-ok  #7FBFA0
--ladrillo  #FF8177
```

Los dos del sello, medidos contra `--pieza` / `--papel` (18 sep 2026): clara `--sello-ok` 6.39 / 6.13 y `--ladrillo` 6.43 / 6.16; oscura 8.27 / 9.09 y 7.26 / 7.98.

### Las leyes del color

1. **El cobre sólo aparece donde hay vida.** Un dato fresco, una unidad transmitiendo, un valor que cambia ahora. Nunca en bordes, botones inertes, encabezados ni decoración. Si el cobre está en todos lados, deja de significar.
   **Vida es cambio frente al usuario, no sólo el tiempo real.** El cobre marca el dato que está cambiando mientras alguien lo mira. En un playback, la velocidad que corre con la reproducción va en cobre; el recorrido ya dibujado, el marcador y la hora del recuerdo detenido van en tinta. Al pausar deja de cambiar y suelta el cobre. Y cuando el playback alcanza el ahora, el marcador pasa a cobre porque ya no es recuerdo. Decidido por ASAV el 16 de septiembre de 2026, al revisar C3 contra su prototipo v5.
2. **Lo apagado suelta el color** y baja a 60% de opacidad. Una unidad que llegó o se calló se va a gris. El contraste hace la jerarquía.
3. **El verde es del latido, no de un veredicto.** Marca que el sistema respira.
4. **Los colores de veredicto viven aparte y no se tocan.** El Marco reserva significado a cumplido, no cumplido y pendiente. Sus colores —`--sello-ok` y `--ladrillo`; el pendiente va en tinta— nunca se usan para nada más, y el cobre nunca se usa para un veredicto.
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
- [ ] ¿Las trazas se cortan según la **modalidad** del servicio (Pieza 7)?
- [ ] ¿El playback se detiene en los huecos **y en los saltos** en vez de deslizarse, y los dos extremos llevan su marca?
- [ ] ¿Sólo aparecen los tres veredictos del Marco, con el detalle como motivo debajo?
- [ ] ¿Ningún nombre de cliente, planta o ruta está horneado en el componente?
- [ ] ¿Lo que se puede crear aquí, se puede corregir aquí?
- [ ] Oficio: foco visible con teclado, contraste ≥ 4.5:1, `prefers-reduced-motion` respetado, cursor de mano en lo clickeable.

---

## Pendiente

`docs/Trampas-De-Medicion.md` guarda, en su Parte 2, cinco reglas rescatadas del skill anterior sobre **qué afirma una pantalla**, marcadas como candidatas al Marco y **sin ratificar**. Mientras no se comparen contra el Marco, no se construye nada citándolas: se cita el Marco o se pregunta. Cuando se resuelvan, las que sobrevivan entran aquí o al Marco, y esta sección se borra.
