# J-Telemetry — Plan de v1

**Corte: 30 de julio de 2026 (segunda versión).** Reemplaza la versión del mismo
día. Cambió por un hallazgo grande: el árbitro tiene un defecto que hace
**imposible aprobar 194 de 439 servicios juzgados**, sin importar cómo maneje el
carrier.

`DESPUES.md` es el backlog (qué hay que hacer, con su razón).
**Este documento es el orden** (en qué secuencia, y qué desbloquea qué).
El `Marco-Limpio-J-Telemetry-MAESTRO.md` manda sobre los dos.

---

## 0. Cómo se usa este plan

| Quién | Qué hace |
|---|---|
| **Asav** | Decide producto, hace las llamadas que solo él puede hacer, mergea los PR. **No necesita recordar el plan** — lo lee aquí. |
| **El chat de arquitectura** | Sostiene el mapa. Valida contra el Marco. Redacta los recados a Devin. |
| **Devin** | Construye. Se detiene solo en decisiones de producto, escritura sobre veredictos sellados, o algo que contradiga el plan. |

**Regla nueva, aprendida el 30 de julio — medir tiene un tope.**
Medir antes de construir salvó el proyecto dos veces. Pero medir también se
puede volver una forma de no avanzar. **Cada hallazgo tiene derecho a una
medición y a un arreglo, no a tres mediciones y ningún arreglo.** Cuando una
medición ya identificó la causa, lo siguiente es construir — la afinación se
investiga después, con el instrumento en la mano.

**Regla de tramos — cuándo Devin corre largo y cuándo se frena.**
No depende del tamaño de la tarea sino de qué toca:
- **Verde (corre largo, sin parar):** no toca datos reales, no escribe en
  producción, no cambia cómo juzga el motor. Pantallas sin datos, refactors,
  scripts de solo lectura, el landing.
- **Rojo (corta corto, con verificación entre tramos):** escribe en la base
  real, toca un veredicto sellado, o cambia la lógica del árbitro.

**Regla de scripts — lo que produce un número que decide, se guarda.**
Un script que solo cuenta es desechable. Un script cuyo resultado va a decidir
algo grave **es evidencia**: se guarda en el repo, versionado y reproducible.
Se aprendió por las malas: el número que justificaba re-verificar 300 veredictos
vivía en un archivo temporal que se borró, y al reconstruirlo dio distinto.

**La prueba de producto vs. caso de uso.**
Ante cualquier arreglo, preguntar: *"¿esto tendría sentido para una planta en
Bogotá cuyas rutas nunca hemos visto?"* Si sí — es producto. Si solo tiene
sentido porque cierta ruta mide 29 km — es caso de uso, y va mal.
**Planta 47 es el laboratorio, no el paciente.**

---

## 1. La meta que define el fin de v1

> **≥90% de servicios correctamente resueltos** contra verdad de campo,
> **sostenido dos semanas**, con **cero acusaciones sin evidencia**.

**Segunda condición, no negociable:** ninguna cara de cliente accesible sin
autenticación.

---

## 2. EL HALLAZGO DEL 30 DE JULIO — la ventana no cubre la ruta

**Esto es lo más importante del documento.** Es un defecto de producto, no de un
cliente.

### Qué pasa

El motor abre una **ventana de observación** para mirar el GPS (105–115 minutos
según el contrato). Pero muchas rutas **tardan más que eso**. Cuando ocurre, el
sistema **no observa el arranque de la ruta** — y luego califica al carrier
contra el trazado **completo**, incluyendo el tramo que nunca miró.

### Medido

| Dato | Valor |
|---|---:|
| Rutas medidas (Tecma 47 + Campus Santos Dumont) | 48 |
| **Rutas matemáticamente condenadas** (match máximo < 60%) | **16** |
| **Acusaciones `no_cumplido` imposibles de aprobar por construcción** | **194 de 439 (44%)** |
| Ventana configurada | 105–115 min |
| Duración real de las rutas | 42–370 min |

Caso extremo: una ruta de **370 minutos** con ventana de **115** — la ventana es
255 minutos más corta que el servicio que juzga.

### Lo que NO es

- **No son los mapas.** En Huertas-B el **96% de los puntos GPS caen a menos de
  150 m del trazado**, mediana **60 m**. El trazado es correcto.
- **No es el carrier.** Con esa precisión, la unidad hace la ruta bien.
- **No es Planta 47.** Campus Santos Dumont tiene el mismo defecto (41 de 171).

### Por qué es grave — viola la Ley 1

La Ley 1 dice: *un problema de observación jamás se convierte en veredicto.*
Aquí el sistema **no pudo observar** medio recorrido y, en vez de declarar
`pendiente_evidencia`, dictó **`no_cumplido`** — una acusación por un tramo que
nunca miró.

Lo agrava un segundo defecto: el motor reporta **"cobertura 100%, sin huecos"**
porque mide qué tan bien vio *su ventana*, no si su ventana cubría *la ruta*.
**Cree que tiene evidencia perfecta cuando está ciego a la mitad.**

### Los tres arreglos, en orden

1. **Detener la acusación falsa (urgente, chico).** Antes de juzgar, el motor
   pregunta: *"¿mi ventana cubrió la ruta?"* Si no — `pendiente_evidencia`.
   Deja de acusar injustamente **hoy**.
2. **Calificar sobre lo observable.** Hoy el match se calcula contra el KML
   completo, incluyendo el tramo no observado — como calificar como malas las
   preguntas que nunca se entregaron. Debe calcularse sobre el tramo observable,
   declarando qué fracción de la ruta representa. **No baja el estándar: lo hace
   honesto.**
3. **Ventana suficiente por contrato.** Derivada de la duración real medida.
   **No es aflojar el umbral** — es asegurar que el árbitro vea la película
   completa antes de calificar.

---

## 3. Los dos candados

**Candado 1 — la identificación confiable manda sobre las pantallas de juicio.**
Hoy una sola señal frágil (el match contra el KML) hace dos trabajos: identificar
quién hizo la ruta y juzgar si cumplió. Cuando falla, se pierden las dos.

**Candado 2 — `auth-rbac` cierra antes del primer login real.**
Una planta jamás ve otra planta. No bloquea construir; bloquea enseñar.

---

## 4. Las olas

### Ola 0 — cerrada

| Pieza | Estado |
|---|---|
| PR #102 — Cierre del turno | ✅ en `main` |
| PR #103 — PLAN-v1 | ✅ en `main` |
| PR #104 — Pendiente por evidencia | ✅ **en producción** |
| PR #106 — Lista congelada de las 300 | ✅ en `main` |
| Turno B de Planta 47 | ✅ **corregido por Asav** |

---

### Ola 1 — construir sobre hechos sellados

**1.a — El arreglo del árbitro y su instrumento (NUEVO, va primero).**

Se adelantó desde la Ola 3 por una razón medida: descubrir este defecto costó
**horas** de scripts temporales y análisis manual. Con instrumento, cuesta un
vistazo. **Construir la Ola 2 sin poder ver lo que el motor mide es construir a
ciegas.**

- **Tablero de diagnóstico (cara J-Staff, interno).** Un servicio a la vez:
  trazado contratado **con su banda de corredor dibujada**, recorrido real
  encima, **la ventana de observación marcada** (y qué tramo quedó fuera), y los
  cuatro números con su umbral al lado — match, corredor, forma, cobertura —
  más una línea de por qué el motor decidió lo que decidió.
  Es un microscopio, **no** una cara de cliente.
- **Arreglo 1 de §2** — ventana insuficiente → `pendiente_evidencia`.
- **Arreglo 2 de §2** — match sobre el tramo observable.
- **Arreglo 3 de §2** — ventana derivada de la duración real, por contrato.

**Compuerta de salida:** cero servicios acusados por un tramo no observado. El
tablero muestra el caso Huertas-B y se entiende de un vistazo.

**1.b — Plomería de operación (Fase 0 restante).**
Bitácora `cron_runs` · **entrega real de alertas** · semáforo de J-Staff.

**1.c — Pantallas sobre hechos sellados.**
`oficina-contrato` (config — gana lugar temprano: los errores de configuración
causan veredictos malos, ya se demostró) · `historia-del-sello` (falta la columna
de causa) · `flota-dia-completo` / `unidad-dia` (cara carrier).

**1.d — Sin datos, en paralelo.** `landing-jtel` · `parvada-ciudad`.

**1.e — Arranca `auth-rbac`.**

**1.f — Higiene que quita fricción (medio día, alto retorno).**
- **Credenciales de un solo lugar.** Hoy la contraseña vive pegada a mano en dos
  sitios y se desincroniza en cada rotación.
- **Base de práctica desechable.** Para ensayar escrituras sin tocar producción.

---

### Ola 2 — el árbitro confiable (la obra grande)

**Aquí vive el 90%.**

**2.a — Identificación por capas.** Señales independientes que **acumulan
confianza**; ninguna condena sola:

1. **Llegada a geocerca** — la más robusta, ya existe
2. **Corredor** — banda de 120 m configurable, tolerante al temblor del GPS
3. **Match fino** — solo con densidad y observación suficientes
4. **Huella histórica** contra viajes ya aceptados
5. **Patrón de paradas** — dónde se detiene el camión **de forma repetida** a lo
   largo de muchos días. Los semáforos son azarosos; las paradas de recolección
   son constantes. **No requiere identificar pasajeros.**
6. **Rol declarado del coordinador** — opcional siempre

**2.b — El juicio cambia de pregunta.** De *"¿siguió el dibujo?"* a **"¿recogió
donde debía y llegó cuando debía?"**, con el trazado como calificador
configurable. Sale de la operación real: lo que importa es la recolección, no las
vías exactas del trayecto.

**2.c — Compuerta de densidad.** Umbral derivado de la geometría, no adivinado.

**2.d — Reconocer caminos, mitad motor.** Que el árbitro **pueda juzgar
honestamente sin KML fino** — geocerca + corredor + paradas, con el trazado
opcional. **Sí es v1**: sin ello el producto no sirve para su mercado (§7).

**Compuerta de salida:** **≥90% sostenido dos semanas**, cero rojos sin
expediente.

---

### Ola 3 — ver y explicar (cara cliente)

`expediente-carrier` / `expediente-dos-recortes` · `cumplimiento` +
`preventivo-jtel` · `mapa-instrumento` · `vista-de-ruta` · Pieza 2 + Tablero de
calibración · **módulo de choferes**.

---

### Ola 4 — vendible

`auth-rbac` cerrado · **Lenore v1** (narra, correlaciona, audita; jamás opina
dentro del veredicto) · J-Staff altas y demos · landing + pase de UI final.

**Compuerta de salida:** un cliente nuevo se da de alta, entra con su usuario, ve
solo lo suyo, y el ≥90% se sostiene. **Eso es v1 en producción.**

---

## 5. Las 300 — CONGELADAS

**No se escribe ni un hecho.** Dos razones encimadas:

1. **El número no era confiable.** El 161/139/0 salió de un script que se borró y
   no se puede auditar. Reconstruido de forma reproducible dio **91/209/0** — 70
   veredictos de diferencia. Escribir sobre el primero habría metido 70
   absoluciones falsas.
2. **La ventana estaba rota al medir.** El 91 se calculó con la ventana angosta,
   así que buena parte de esos 209 `no_cumplido` probablemente también son falsos.

**El orden correcto:** primero se arregla el árbitro (§2), después se re-verifica
con el motor honesto. La ficha
`docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md` sigue vigente en su
procedimiento y sus guardas; solo cambia **cuándo** se ejecuta.

**Riesgo aceptado mientras tanto:** esas acusaciones falsas siguen visibles. No
cobran nada (enforcement apagado) y no empeoran.

---

## 6. Las decisiones que solo Asav puede tomar

| # | Decisión | Cuándo | Estado |
|---|---|---|---|
| 1 | Turno B de Planta 47 | Ola 0 | ✅ **resuelta** |
| 2 | Regla de cierre del pendiente por evidencia (planta + legal) | Ola 1 | Pendiente — hoy en modo demo |
| 3 | Re-verificación de los hechos viejos | Después de arreglar el árbitro | **Congelada por decisión** |
| 4 | ¿`jornada-instrumento` quedó superseded por Cierre del turno? | Ola 3 | Por confirmar |
| 5 | Cómo se le cuenta a Tecma que su número sube al corregir | Antes de re-verificar | Pendiente |

---

## 7. El mercado — por qué "sin KML fino" es requisito, no lujo

**La mayoría de las plantas no tienen sus rutas bien definidas.** Viven en la
cabeza de los carriers y se transmiten de boca en boca cuando una planta cambia
de proveedor. La informalidad de los datos es **el estado normal del mercado**,
no una anomalía.

Consecuencia: **un árbitro que exige trazados perfectos está peleado con su
propio mercado.** El que juzga honestamente con lo que hay —y de paso formaliza
lo informal— atiende el dolor de frente. Esa es la cuña de venta.

---

## 8. Fuera de v1 — por decisión

| Qué | Por qué | A dónde |
|---|---|---|
| **Quejas** (`queja-expediente`) | Circuito completo | Después de v1 |
| **Descubrimiento y promoción de caminos con su UI** | La mitad motor sí entra a v1 (§4, 2.d); proponer y aprobar variantes es obra aparte | **v1.1 — candidato a subir** |
| **Ficha 4 — incidentes** | Circuito carrier → planta | Después de v1 |
| **Enforcement** | Primero el árbitro confiable | Después del ≥90% |
| **Map matching** (red de calles) | Ayuda con "se fue por la calle paralela", **no** con "no vimos media ruta". Afinación, no arreglo | v1.1 |
| **Expediente de pasajero / modo pasajero** | Requiere hardware para registrar quién sube. **Las paradas se infieren del GPS sin identificar personas** (§4, capa 5) | Futuro (jrz-pass) |

---

## 9. Los mockups

| Mockup | Ola |
|---|---|
| `cierre-del-turno` | ✅ **construido** |
| `pendiente-por-evidencia` | ✅ **construido** |
| **Tablero de diagnóstico (J-Staff)** | **Ola 1 — nuevo, va primero** |
| `oficina-contrato` | Ola 1 |
| `historia-del-sello` | Ola 1 (componente) |
| `flota-dia-completo` · `unidad-dia` | Ola 1 |
| `landing-jtel` · `parvada-ciudad` | Ola 1 |
| `expediente-carrier` · `expediente-dos-recortes` | Ola 3 |
| `cumplimiento` · `preventivo-jtel` | Ola 3 |
| `mapa-instrumento` · `vista-de-ruta` | Ola 3 |
| `como-reconoce-caminos` | v1.1 (mitad motor en Ola 2) |
| `queja-expediente` | Fuera de v1 |
| `jornada-instrumento` | Por confirmar |

---

## 10. Reglas de trabajo

- **Una rama por tarea. Todo por PR. El merge lo hace Asav.** Nunca directo a `main`.
- **Nunca mergear sin el check en verde**, y revisar "Files changed".
- **Antes de afirmar, verificar.** Simular antes de escribir sobre datos vivos.
- **El código nunca conoce nombres.** Todo genérico.
- **Modelos:** el fuerte para arquitectura, validación de Marco y lógica del
  árbitro; el mecánico para UI, lectura y ejecución.
- **`jrz-drone-os` congelada** — fuente de datos históricos, jamás de código.

---

## 11. Las leyes de producto

1. **Un problema de observación jamás se convierte en veredicto.** Sin
   observación suficiente → `pendiente_evidencia`. **Esta es la ley que se está
   violando hoy (§2), y el primer arreglo de la Ola 1.**
2. **Todo `no_cumplido` carga su evidencia y su porqué medido.**
3. **La matemática decide, la AI explica.**
4. **Tres estados y nada más.** "Tarde" es motivo, no estado.
5. **El hecho se calcula una vez y se congela.** Solo cambia por re-verificación
   explícita y auditada, con firma y motivo.
6. **La geocerca es la frontera de la evidencia.**
7. **El cliente jamás ve la operación interna del carrier.**
8. **Todo umbral es configurable por contrato.**
9. **El vigilante no comparte nada con lo vigilado.**
10. **Nunca rotar credenciales sin redesplegar en el mismo movimiento.**

---

## 12. El loop de aprendizaje

Declarado → observado → divergencia sostenida → propuesta → **aprobación
humana** → la configuración aprende.

- **La planta APRUEBA lo normativo** — qué cuenta como cumplido.
- **El carrier SEÑALA lo factual** — cuándo medimos mal.
- **El árbitro no calibra nada. Aplica.**

**La trampa:** no se pueden calibrar umbrales contra la operación que se juzga.
Afinar hasta que todo pase convierte al árbitro en decorado.

**Corolario aprendido hoy:** ampliar la ventana de observación **NO es
calibrar**. Medir cuánto dura una ruta es un hecho; el umbral de cumplimiento no
se toca. La diferencia entre corregir un instrumento y aflojar un estándar es la
línea que separa un árbitro de un adorno.

---

*Se actualiza cuando una ola cierra su compuerta o cuando una decisión de §6 se
resuelve. No se edita para acomodar prisa.*
