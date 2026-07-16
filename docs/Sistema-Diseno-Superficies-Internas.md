# Sistema de Diseño — Superficies Internas de J-Telemetry

**Uso:** este documento se pega al inicio de cualquier herramienta de diseño o código (Cursor, v0, Claude Code) al construir o rehacer **las caras internas** (portal cliente, cara carrier, J-Staff). Es el hermano del `Brief-Identidad-J-Tel.md` (que cubre la landing pública). Hereda su paleta, tipografía y prohibidos.

**Regla:** subordinado al `Marco-Limpio-J-Telemetry-MAESTRO.md`. Donde choquen, gana el Marco.

---

## 0. La tesis, en una frase

> **La calma es la competencia.** Un centro de control aeroespacial no grita aunque haya una anomalía — la serenidad *es* la señal de que todo está bajo control. Las superficies internas de J-Telemetry se sienten así: frías, precisas, sin pánico. El gerente de Tecma abre a las 6 AM y la pantalla le dice, sin levantar la voz, "tenemos esto".

El desmadre de la operación ya lo resolvió el motor. El trabajo del diseño no es *agregar* calma con decoración — es **no estorbarle** a la calma que el producto ya produjo. Cada elemento que no comunica un hecho, se va.

---

## 1. Los dos mundos (la idea central)

J-Telemetry internamente tiene **dos temperaturas**, y confundirlas es un pecado de producto (fue el bug de la torre). Son mundos visuales deliberadamente distintos:

| | **EL ACTA** (registro) | **LA TORRE** (pronóstico) |
|---|---|---|
| Qué es | El hecho congelado. La verdad. | La estimación en vivo. |
| Momento | Después del cierre | Durante el turno |
| Certeza | Absoluta. No se discute. | Provisional. Honesta sobre lo que no sabe. |
| Se siente | Quieta, notarial, definitiva | Viva, respirando, un radar barriendo |
| Movimiento | Nada se mueve | Una cosa se mueve (la posición) |
| Paleta | Estados del veredicto (verde/rojo/ámbar) | **Otra paleta** (abajo) — nunca los del veredicto |
| Palabras | `cumplido` / `no cumplido` / `pendiente` | jamás esas tres palabras |

**Ley de diseño:** la torre y el acta **nunca se pueden ver iguales.** Si un usuario confunde un pronóstico con un veredicto, se pierde la confianza — que es el activo entero. La distinción visual no es estética; es estructural.

---

## 2. Paleta

### El Acta (hereda del Brief)
Fondo `--acta` `#EDF0EE` (papel frío). Texto `--tinta` `#111A22`. Los tres estados, y **solo** aquí:
- `--cumplido` `#1F7A5C`
- `--no-cumplido` `#A62C24`
- `--pendiente` `#C98A12`

### La Torre (paleta propia, aeroespacial)
Consola oscura. Los estados en vivo **no** son los del veredicto — son luz de instrumento:

| Nombre | Hex | Uso |
|---|---|---|
| `--consola` | `#0C1420` | fondo, azul casi negro (no negro puro) |
| `--consola-panel` | `#131E2E` | tarjetas, paneles elevados |
| `--radar-linea` | `#1E2E44` | cuadrícula, hairlines |
| `--radar-texto` | `#8FA6C4` | texto secundario, etiquetas |
| `--vivo` | `#4DA6FF` | unidad activa, en ruta, avanzando — azul de radar |
| `--espera` | `#5A6B82` | programada, aún no arranca — gris azulado neutro |
| `--atencion` | `#D98A3D` | anomalía en vivo — ámbar **de instrumento**, distinto al `--pendiente` del acta |
| `--cerrado` | `#3A4657` | servicio ya con hecho — apagado, neutro, "esto ya no me toca" |

**Por qué el azul y no el verde:** el verde/rojo/ámbar dicen "veredicto". El azul dice "señal, posición, en curso". El operador nunca debe leer un color de la torre y creer que ya hay fallo. La anomalía en vivo (`--atencion`) usa un ámbar **desaturado, más frío** que el `--pendiente` del acta — parecidos de lejos, distintos de cerca, a propósito.

---

## 3. Tipografía (hereda del Brief, con una ley de datos)

- Display: `Archivo Expanded` — titulares, pocos y grandes.
- Cuerpo: `Inter Tight`.
- **Datos: `JetBrains Mono` — ley dura en ambas superficies.** Toda hora, coordenada, folio, placa, IMEI, minutos-al-deadline, porcentaje, va en monoespaciada. Siempre.

Esa ley es la que hace que el sistema deje de "opinar" y empiece a *reportar*. Un dato en mono se lee como lectura de instrumento; el mismo dato en fuente normal se lee como comentario. En la torre esto importa el doble: `06:47 · faltan 08 min` en mono se siente como un tablero; en fuente normal se siente como un chat.

---

## 4. La jerarquía — una sola cosa por pantalla

> **Cada pantalla entrega un hecho. El razonamiento vive debajo, a un clic, para quien lo pida.**

Esta es la regla que separa "app" de "instrumento", y encaja con la ley del Marco de que el cliente ve el hecho, no la maquinaria.

- **El cliente abre Cumplimiento y ve:** fecha · ruta · **CUMPLIDO**. Nada más. Sin `A≈82 / B≈39`, sin umbrales, sin corredor. La métrica es maquinaria; la maquinaria no se enseña.
- **Si quiere pelear el fallo, hace un clic** → se abre el expediente: ahí sí, todo, en monoespaciada, frío, completo, incontestable.

La confianza no viene de mostrar todo de golpe — viene de que **cuando lo pides, está todo ahí.** Eso es el lujo: la profundidad existe, pero no te la restriegan. Es la diferencia entre el iPhone que te enseña "87%" y el que te enseñaría el ciclo de carga de la batería.

**Regla operativa:** si vas a poner una métrica del motor (A, B, corredor, cobertura) en una pantalla de cara al cliente, no la pongas. Va en el expediente, detrás del clic.

---

## 5. Densidad — matar el 90%

La densidad se lee como ansiedad, y ansiedad es lo contrario de autoridad. En cada pantalla interna:

- Cuenta los elementos que compiten por atención. La mayoría sobran.
- Hairlines de 1px como único separador. Cero sombras difusas. `border-radius` máximo 2px.
- Un solo dato importante por renglón, alineado; los números a la derecha.
- Filtros: colapsados por defecto, no apilados a la vista. El estado por defecto de una lista debería caber en la cabeza sin hacer scroll mental.
- Espacio en blanco (o en `--consola`) es una decisión, no un desperdicio. El vacío alrededor de un veredicto es lo que le da peso.

---

## 6. Movimiento — una cosa se mueve, por una razón

- **El acta:** nada se mueve. Es un documento. Un veredicto que parpadea es un veredicto que dudas.
- **La torre:** se mueve **solo la posición de la unidad** y el barrido de "actualizado hace Ns". Nada más. Cuando todo se anima, nada importa; cuando una sola cosa respira, esa cosa es la vida del tablero.
- Transiciones 180–240ms, mismo easing en todo (`cubic-bezier(0.2, 0, 0, 1)`).
- `prefers-reduced-motion`: la torre se congela en su último frame; el acta ya estaba quieta.

---

## 7. Estados visuales de un servicio

### En el Acta (cara cliente, cara carrier)
- **Cumplido:** chip `--cumplido`, sobrio. No celebra — reporta.
- **No cumplido:** chip `--no-cumplido`. Bajo él, la línea de motivo que ya definimos: "Llegada tarde (+N min, unidad X)" o "Sin servicio detectado". El motivo es lectura del hecho, no recálculo.
- **Pendiente:** chip `--pendiente`. Honesto: "aún no puedo juzgar", no "falló".

### En la Torre (solo servicios abiertos)
- **Programada** (`--espera`): aún no arranca la ventana. Gris azulado, en reposo.
- **En ruta / avanzando** (`--vivo`): la unidad se identificó, deja huella azul. Respira.
- **Llegó** (`--vivo` con marca de llegada): huella cortada en la geocerca (frontera de evidencia — Marco). No dice "cumplido"; dice "llegó".
- **Atención** (`--atencion`): anomalía en vivo. Ámbar de instrumento, no de veredicto.
- **Cerrado** (`--cerrado`): el servicio ya tiene hecho. Se ve **apagado, neutro**, y enlaza a su expediente en el acta. La torre no lo repinta ni opina — solo señala "esto ya se resolvió, ve al registro".

### Leyenda permanente de la torre (parte del diseño, no disclaimer chico)
> **Vista en vivo. El veredicto se emite al cierre.**

Siempre visible. Es lo que evita que un `--vivo` "llegó" a las 6:40 se confunda con un veredicto cuando el árbitro aún no cierra.

---

## 8. El expediente (el clic que da confianza)

Cuando el cliente abre un servicio para ver "por qué":

- Encabezado: veredicto grande, monoespaciado el metadato (fecha, ruta, unidad, hora de llegada).
- Mapa: KML esperado (marca de agua) + GPS observado, **cortado en la llegada** (Marco: geocerca = frontera de evidencia). Lo que la unidad hizo después no se muestra — es operación interna del carrier.
- Debajo, el rastro de auditoría: los pasos del árbitro en lenguaje llano, en orden, con horas en mono. Frío y completo.
- Nada persuasivo. El expediente no vende el veredicto — lo *documenta*. Su frialdad es su credibilidad.

---

## 9. Confidencialidad como diseño (ley del Marco)

- **Cara cliente:** jamás ve geocercas de otros contratos, jamás ve el razonamiento de eliminación de candidatas, jamás el nombre de otro cliente. Si una unidad entró a otra planta, el expediente dice "llegada fuera de la geocerca del contrato" — sin nombrar el destino.
- **Cara carrier:** sí ve sus propias geocercas y su operación (es suya), nunca la de carriers ajenos.
- **Regla visual:** cada cara es una cuenta cerrada. El diseño no debe crear ni un puente accidental entre cuentas (un tooltip, un color, un nombre que se filtre). La muralla entre cuentas es visible y total.

---

## 10. Piso de calidad (no negociable)

Responsivo a móvil. Foco de teclado visible. `prefers-reduced-motion` respetado. Contraste AA (ojo con el azul `--vivo` sobre `--consola` — verificar). Fuentes sin salto de layout. Datos en mono, siempre. Si esto no está, lo demás es humo.

---

## Resumen para quien construye

1. Dos mundos: acta (quieto, veredicto, estados verde/rojo/ámbar) vs. torre (vivo, azul de radar, jamás los colores del veredicto).
2. Una cosa por pantalla; la maquinaria (métricas A/B) vive detrás del clic.
3. Mata el 90%; la densidad es ansiedad.
4. Una sola cosa se mueve, y por una razón.
5. Datos en monoespaciada, siempre.
6. La calma es la competencia. Si la pantalla grita, está mal.
