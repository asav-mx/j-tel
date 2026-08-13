# Ficha — Reconciliación · Parte 2: señalar en vez de escribir

**Gobierna:** el skill `j-telemetry-ui` y el `Marco-Limpio-J-Telemetry-MAESTRO.md`.
**Sin código.**

**Continúa** la `Ficha-Reconciliacion.md` y la caja construida en el #306.
**Vive en:** `carrier/servicio/[id]`, dentro de la caja de aportación.

---

## 1. Por qué la primera mitad es débil, dicho por quien la pidió

Hoy el transportista solo puede **escribir texto**. Y su evidencia **ya está en
el sistema: los puntos son suyos.**

Lo que necesita no es un párrafo. Es **poder señalar lo que ya existe.**

Un párrafo es la palabra del auditado contra el veredicto del árbitro, y en esa
forma siempre pierde: no hay nada que contrastar. Un señalamiento es otra cosa —
apunta a un dato que el sistema ya guardó y que la planta puede mirar. **La
diferencia no es de comodidad: es de qué clase de cosa se está aportando.**

---

## 2. Las dos piezas

### 2.1 El recorrido COMPLETO del día de la unidad que declara

**Qué cambia:** hoy, al declarar una unidad, no pasa nada visible. Con esto, al
declararla **se dibuja su recorrido del día entero — no el recorte de la
ventana**.

**Por qué es la pieza que más pesa.** La ventana es la frontera de lo que el
árbitro miró, y está medido que **se le queda corta**: de los acusados sin
unidad, la ventana de hoy abriría antes en **381 de 397**, y en la población de
ventana corta **el 100 %** tiene puntos guardados de la misma candidata **antes**
de que su ventana abriera. Ahí es donde se ve si la unidad hizo la ruta **antes
de que el árbitro mirara**.

⚠ **Y la ley que lo acompaña, que es la que impide que esto se vuelva trampa:**
el recorrido completo **es evidencia para mirar, no entrada del veredicto**. El
árbitro decidió con la ventana; enseñar fuera de ella explica, y **no puede
re-calificar**. Si algún día un dato de fuera de la ventana mueve un resultado,
la ventana deja de ser la frontera de nada.

**Cómo se dibuja para que no mienta:**

- El tramo **dentro de la ventana** va como siempre — es lo que se juzgó.
- El tramo **fuera** va **atenuado y rotulado**: *«fuera de la ventana con la que
  se juzgó»*. Nunca del mismo peso: dos cosas distintas no se dibujan igual.
- El **borde de la ventana** se marca con su hora.
- Los huecos de señal **siguen sin cruzarse** con línea recta.

### 2.2 Señalar el empalme

**Qué cambia:** hoy la pantalla ya sabe que la unidad acreditó otra ruta ese día
—**150 de 397 (37.8 %)**— y lo enseña como un renglón informativo. Con esto, el
transportista puede **invocarlo como parte de su versión**: *«esta unidad hizo
esta ruta y luego aquella»*.

**Por qué el transportista debe poder invocarlo y no basta con que se muestre.**
Un renglón que el sistema imprime es una observación; **el mismo hecho señalado
por el auditado es una afirmación suya, con su firma**, y eso es lo que la planta
necesita para resolver. Además el transportista sabe cosas que el sistema no:
cuál de las dos rutas era la prioritaria, si hubo una consolidación acordada.

⚠ **Y lo que sigue sin decir, igual que en la Parte 1:** *«por eso no acreditó
aquí»*. Esa conclusión es **C18**, sigue sin construir, y el árbitro todavía le
pregunta a un camión que sirvió dos rutas si cubrió una sola. La pantalla pone
los hechos en fila; **el dictamen no es suyo**.

---

## 3. Qué cabe sin romper la Ley 3 — y es la pregunta que decide la forma

**El cliente no puede ver la flota.** Ni una unidad, ni un puntaje, ni un
recorrido. Eso ya está resuelto para el expediente y **aquí vuelve a aplicar con
un agravante**: una aportación está **hecha para que la planta la lea**.

**La regla que sale de ahí, y hay que escribirla antes de construir:**

> **Lo que el transportista señala, la planta lo ve como AFIRMACIÓN, no como
> evidencia cruda.**

En concreto:

| Pieza | Cara del transportista | Cara del cliente |
|---|---|---|
| Recorrido completo del día | 🟢 El trazo, con su tramo fuera de ventana | 🔴 **No.** Un trazo es la ruta que servía |
| La unidad que declara | 🟢 Con su etiqueta y placa | 🟡 **Solo que declaró una**, sin identificarla |
| El empalme | 🟢 Con el nombre de la otra ruta | ⚠ **Solo si la otra ruta es del MISMO cliente** |
| El texto y el motivo | 🟢 | 🟢 Es su versión, escrita para ser leída |

⚠ **El empalme es el caso delicado y hay que medirlo antes de construirlo.**
Decir *«esta unidad también hizo la ruta X»* a un cliente **nombra la operación
de otro** si la ruta X es de otro contrato. Ya está medido que **en 49 de 397
servicios (12.3 %) alguna unidad que llegó acreditó a OTRO cliente** — así que el
caso existe y no es raro.

**La salida, sin romper nada:** cuando la otra ruta es de otro cliente, la
aportación dice *«esta unidad cubrió otro servicio en ese turno»* **sin
nombrarlo**. El hecho —hubo empalme— sí es del interés de esta planta; **de quién
era el otro servicio, no**. Es la misma forma que el Marco ya usa para
`arrivalOutsideContractGeofence`.

---

## 4. La ley, intacta

> **Nada de esto cambia el veredicto. Es evidencia que la planta mira.**

Y por lo mismo que en la Parte 1, la forma lo hace cumplir: lo que se señala se
guarda **dentro de la aportación** —que no referencia `compliance_facts`—, no
como un campo del hecho. **Señalar un recorrido no lo convierte en prueba
acreditada**: lo convierte en algo que la planta puede mirar.

---

## 5. Qué se puede construir sin decisiones, otra vez

| Pieza | Depende de |
|---|---|
| Dibujar el recorrido completo del día en la cara del transportista | 🟢 **Nada.** Los puntos están; es una consulta sin recorte |
| Que la aportación guarde a qué unidad y a qué día apunta | 🟢 **Nada.** Cabe en `adjuntos`/campos que ya existen |
| Invocar el empalme desde la aportación | 🟢 **Nada** para la cara del transportista |
| Mostrar el empalme al cliente | ⚠ **Medir primero** cuántos son de otro cliente en la población que llegaría a aportarse |
| Que la planta vea el trazo | 🔴 **No cabe.** Ley 3 |

**El corte recomendado:** construir las tres primeras. El transportista gana la
mitad que le faltaba —señalar en vez de narrar— y **la cara del cliente no cambia
ni un píxel**, así que no hay nada que decidir para empezar.

---

## 6. Lo que NO lleva

- **El trazo en la cara del cliente.** En ninguna forma, ni recortado.
- **El nombre de una ruta de otro cliente**, ni siquiera dentro de una
  aportación que el transportista escribió.
- **Un botón de «re-verificar con esta unidad».** Eso es D4, con firma, y no se
  dispara desde la cara del auditado.
- **El recorrido fuera de ventana dibujado igual que el de dentro.** Son dos
  cosas y se ven distinto, o la pantalla afirma que el árbitro miró lo que no
  miró.

---

## 7. Lo que esta ficha deja abierto

- ⚠ **Cuántos empalmes serían de otro cliente** en la población que de verdad
  llegue a aportarse. Los 49 de 397 son la cota de hoy sobre otra población.
- 🔵 **Si la planta puede pedir el trazo** cuando la aportación lo señala. Es una
  excepción a la Ley 3 y **no se toma en una ficha**: la decide Asav, y si la
  respuesta es no, la aportación se lee igual de bien.
