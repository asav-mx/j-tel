# Ficha — La reconciliación: dónde el transportista pone su versión

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Sin código.** Define el frente; no lo construye.

**Vive en:** `carrier/servicio/[id]`, **justo debajo del expediente sin
atribución** — donde el árbitro acaba de decir que no pudo atribuir.

---

## 1. El hueco, dicho como se ve

Hoy el árbitro dice **«no pude»** y ahí se acaba.

El transportista mira una acusación que **el sistema mismo admite no poder
sostener** —«el sistema observó llegadas y no pudo atribuir ninguna a esta
ruta»— y **no puede aportar una sola cosa**. Ni decir qué unidad fue, ni que el
GPS venía fallando, ni que hubo un cierre vial, ni adjuntar la bitácora del
chofer.

**Y el tamaño está medido:** **608** acusaciones sin unidad acreditada, de las
cuales **404** tienen una llegada que el sistema vio y no pudo atribuir, y
**205** ninguna llegada — con **156** de ésas mostrando alguna unidad sobre el
corredor del trazado. **Ninguna tiene dónde poner la versión del auditado.**

Eso no es un hueco de interfaz: **es la mitad que falta del arbitraje.** Un
árbitro que solo escucha a una parte no es un árbitro, y J-Telemetry ya declara
—en su propia pantalla— los casos en los que no pudo ver.

---

## 2. Las tres leyes, y la primera es la que sostiene el producto

> **1 · El transportista agrega CONTEXTO. Nunca cambia su veredicto.**
> Si pudiera, **J-Tel deja de ser árbitro** y pasa a ser un formulario de
> apelaciones con logo. El hecho está sellado y sigue sellado: lo que se agrega
> vive **al lado**, con su firma y su hora, y se ve como lo que es.

> **2 · Se apoya en los motivos excusables que la política YA define.**
> No se inventa un catálogo nuevo por pantalla. Un excusable es una **eximente**
> —cambia lo que se cobra— así que es política del contrato: cambia hacia
> adelante y deja historia. Una lista editable sin historia sería C13 otra vez
> con otro nombre.

> **3 · La planta decide si eso mueve algo.**
> El transportista aporta; **el cliente resuelve**. El sistema no arbitra la
> reconciliación: la registra, la enruta y deja constancia de quién decidió qué
> y cuándo.

**La consecuencia de las tres, junta:** el resultado sellado **nunca cambia por
esta vía**. Si la planta acepta el contexto, lo que cambia es la **consecuencia
económica** —el enforcement—, no el veredicto. Son dos cosas distintas y el
producto ya las separa.

---

## 3. Qué se puede construir HOY, sin depender de ninguna decisión

**Esto es lo que preguntaste, y la respuesta es: la mitad, y es la mitad útil.**

### ✅ Sin decisiones — se puede empezar

| Pieza | Por qué no depende de nadie |
|---|---|
| **La caja de aportación** — texto libre del transportista sobre un servicio, con firma y hora | No toca el veredicto ni la política. Es una nota atribuida |
| **Adjuntar evidencia propia** — bitácora, foto, reporte de taller | Igual: se guarda al lado del hecho, no dentro de él |
| **Declarar qué unidad dice él que fue** | El dato ya existe como concepto: `occurrence_ground_truth` guarda hoy el veredicto del operador y su unidad. **Es la misma forma, del otro lado del mostrador** |
| **El estado de la aportación** — enviada · vista · resuelta | Es máquina de estados propia, no una regla de contrato |
| **Que la planta la vea y responda** | La ruta y el aviso ya existen; el contenido es nuevo |

⚠ **Y una que parece de decisión y no lo es:** **el catálogo de excusables ya
está en la política** (`excusableReasons`) y el motor ya lo lee. Ofrecerlo como
lista al transportista **no exige decidir nada nuevo** — lo que exige decisión es
*cambiarlo*, y eso es otro frente.

### ⚠ Espera decisión tuya

| Pieza | Qué hay que decidir |
|---|---|
| **Si una aportación aceptada mueve la consecuencia económica** | Es enforcement. Hoy `enforcementRules` va vacío a propósito |
| **Quién de la planta puede aceptar** | Roles: Cumplimiento acepta incidentes, pero falta confirmarlo |
| **Plazo para aportar** | Igual que el plazo de los pendientes: regla de contrato, no de sistema |
| **Si el catálogo de excusables se edita desde la interfaz** | Es política: cambia hacia adelante y deja historia |

**El corte recomendado:** construir la columna de la izquierda entera. **El
transportista puede aportar desde el primer día**, la planta lo ve, y lo que
falta decidir es solo **qué consecuencia tiene** — que es exactamente la parte
que debe decidir un humano.

---

## 4. La pantalla, en su sitio

Va **debajo del expediente sin atribución**, en la misma página, porque es la
respuesta a lo que acaba de leer. Con un encabezado que no promete de más:

> **Tu versión de este servicio**
> El resultado ya está sellado y **esto no lo cambia**. Lo que aportes queda
> junto al expediente, con tu firma y su hora, y lo revisa la planta.

**Tres piezas, en este orden:**

1. **Qué dice el transportista** — un motivo del catálogo del contrato, más
   texto libre. El motivo va primero porque es lo que la planta puede procesar
   sin leer.
2. **Con qué lo sostiene** — la unidad que él declara, y adjuntos.
3. **En qué quedó** — el estado, con quién y cuándo. **Nunca se borra.**

**El vocabulario, y no es cosmético:** se escribe *«tu versión»*, *«aportar»*,
*«la planta lo revisa»*. **No** *«apelación»*, *«disputa»* ni *«defensa»* — eso
convierte cada servicio en un litigio y le enseña al transportista que el camino
normal es pelear. La palabra de la casa es **reconciliar**: las dos partes miran
el mismo hecho y agregan lo que la otra no podía ver.

---

## 5. Lo que NO lleva

- **Un botón que cambie el veredicto.** Ni «solicitar re-verificación»: eso es
  D4, con firma, y no se dispara desde la cara del auditado.
- **Un campo de puntaje, umbral o candidata** que el transportista pueda editar.
  Aporta contexto, no calibración.
- **Lenguaje de juzgado.** Ver §4.
- **Una aportación anónima.** Sin firma no sirve para reconciliar nada.
- **Borrado.** Una aportación retirada se marca; no desaparece.
- **Notificar al cliente sin que él lo haya pedido.** El canal de avisos tiene su
  propio frente y su propia llave.

---

## 6. Lo que hay que medir antes de construir

Ninguna de estas bloquea el diseño, pero las tres cambian el tamaño:

1. **Cuántos servicios tendrían aportación si existiera** — proxy: los 608 sin
   unidad acreditada, pero la pregunta real es cuántos disputa hoy el
   transportista por fuera del sistema. **Eso no está en la base: hay que
   preguntárselo a él.**
2. **Qué excusables declara cada contrato hoy.** Está medido que **difieren entre
   los dos contratos reales y que la diferencia no fue una decisión: era el
   catálogo sin definir.**
3. **Si `occurrence_ground_truth` sirve como cimiento o hay que crear tabla
   aparte.** Guarda el veredicto del OPERADOR; esto es del TRANSPORTISTA. Misma
   forma, otra voz — y confundirlas sería C20 otra vez.

---

## 7. Por qué esta pantalla y no otra

Podría vivir en una bandeja aparte —«mis disputas»— y **sería peor**.

El transportista llega aquí porque está mirando **este** servicio y **esta**
acusación. Ponerlo en otra pantalla obliga a reconstruir el contexto, y **separa
la aportación del hecho que la motiva** — que es justo lo que el expediente
acaba de juntar.

Y hay una razón más fuerte: **la aportación se lee junto a la evidencia que la
contradice o la sostiene.** Un transportista que dice «sí fuimos» al lado de un
recorrido que no pisó el trazado está aportando algo verificable. En una bandeja
aparte sería una queja; aquí es un hecho contrastable.
