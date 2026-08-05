# J-Telemetry — El Plan

**Corte: 3 de agosto de 2026.**
**Última edición: 3 de agosto de 2026, tarde** (Clerk resuelto · dominio
resuelto · hallazgo del landing público).

Este es el único plan. Reemplaza a `PLAN-v1.md`, a `Plan-Camino-a-v1.md`, a
`docs/marco-limpio/Despues.md` y a la parte de orden de `DESPUES.md`.

**La jerarquía, completa:**

| Documento | Qué es |
|---|---|
| `Marco-Limpio-J-Telemetry-MAESTRO.md` | **La ley.** Manda sobre todo, incluido este plan |
| **Este documento** | **El orden.** Qué se hace, en qué secuencia, y qué desbloquea qué |
| `DESPUES.md` | **El backlog.** Lo que decidimos no hacer ahora, y por qué. Sin orden ni fechas |

Tres documentos vivos. Ninguno más.

---

## 0. La regla de este documento

> **Toda actualización se hace editando este documento. Nunca creando uno nuevo.**

Si algo cambia, se edita aquí. Si aparece un frente nuevo, se agrega aquí. Si
algo sale del plan, se mueve a `DESPUES.md` y se borra de aquí.

Un plan nuevo con otro nombre no es una actualización: es una contradicción
futura. Ya nos costó — llegamos a tener cinco documentos gobernándose entre sí,
con once contradicciones medidas entre dos de ellos.

**Corolario:** una ficha de handoff describe *cómo* se construye una pieza, no
*cuándo*. Las fichas pueden multiplicarse; el orden vive solo aquí.

---

## 1. Qué es v1

> **v1 es el conjunto de tareas documentadas, terminadas y corriendo en
> producción.**

No es una calificación. Es un estado funcional.

**Y el 90% no mide acierto: mide capacidad de mostrar.**

En el cierre de cada turno, el sistema puede **enseñar evidencia** del ≥90% de
los perfiles y rutas:

- Si **cumplió** → sale como ya está diseñado.
- Si **no cumplió** → se puede mostrar **qué se hizo** y decir **por qué no
  cumplió**, con números auditables.

Esta definición reemplaza a la anterior ("≥90% contra verdad de campo sostenido
dos semanas"). La vieja dependía de que alguien externo declarara cuál era la
verdad. Esta se mide sola: ¿puedes abrir el expediente y explicarlo? Sí o no.

**Lo que la definición nueva arrastra, y hay que decirlo:**

1. **El expediente del no cumplido deja de ser adorno y pasa a ser el corazón de
   v1.** Sin esa pantalla, "explicar por qué no cumplió" es buena intención: el
   motor puede medir el porqué y nadie lo ve.
2. **"El hecho debe bastarse a sí mismo" pasa a ser bloqueante.** Si un veredicto
   no puede explicarse sin salir a buscar cosas que ya cambiaron debajo de él,
   entonces no se puede cumplir esta definición.
3. **Sigue vigente la segunda condición:** ninguna cara de cliente accesible sin
   autenticación.

---

## 2. Reglas de trabajo

**Del repo:**

- Una rama por tarea · todo por PR · nunca directo a `main`.
- **Un carril a la vez**, salvo carpetas distintas (`packages/` vs `apps/web`) y
  worktrees separados.
- **Asav mergea** cuando el PR toca: el motor o cómo se sella un hecho · una
  migración de base · secretos, credenciales o variables · el Marco o este plan.
  **Devin mergea** lo demás: pantallas, reportes, vistas de solo lectura,
  documentos, pruebas, higiene. Si mezcla o hay duda, es de Asav.
- **`main` protegida** (activado el 3 de agosto): checks obligatorios y rama al
  día antes de mergear.

**De la verdad:**

- **Antes de afirmar, verificar.** Si no se midió, se dice como inferencia.
- **Las pruebas deben fallar contra código roto** antes de contar como cobertura.
- **Validar la medición no valida la interpretación.**
- **Cuando lo medido contradice una garantía, el sospechoso es el medidor.**
- **Cada hallazgo tiene derecho a una medición y a un arreglo.** Medir tres veces
  sin construir es no avanzar.

**Las ganadas por las malas:**

1. **Una migración se aplica ANTES de mergear el código que la necesita.** Con
   SQL directo, en transacción. Nunca `pnpm db:migrate` contra producción.
2. **Ordenar por fecha sin techo devuelve el futuro.** El generador crea
   ocurrencias por adelantado.
3. **El fallo silencioso que devuelve de menos es peor que el que revienta.**
4. **Si el default es un secreto, credencial, identidad o URL de base, no lleva
   default: revienta.**
5. **Una rotación de credencial se acompaña de redespliegue en el mismo
   movimiento.**
6. **Antes de mergear una rama vieja, revisar si toca archivos que cambiaron
   mientras esperaba.**
7. **Un `redirect()` desde un layout NO impide que la página hija se
   renderice.** Next las renderiza en paralelo, así que la respuesta sale con
   el código de la redirección **y el payload de la página dentro**. La guardia
   va **en el layout y en la página**: el layout como red para lo que nadie ha
   escrito todavía, la página como la comprobación que cuenta.
   **Y se verifica midiendo el cuerpo de la respuesta, no el código de
   estado.** Medido el 4 de agosto de 2026: `/cliente?account=tecma` contestaba
   **307 con 35 901 bytes** de payload RSC y «Tecma Planta 47 (73) y Campus
   Santos Dumont (25)» adentro. Una puerta que dice que no y pasa el expediente
   por debajo. Ver un 307 y darlo por bueno era lo fácil.

8. **Una defensa que ninguna prueba distingue de su ausencia no cuenta como
   defensa.** No basta con que las pruebas pasen: hay que poder quitar cada
   comprobación y ver cuál se cae. Si al borrarla nada se pone en rojo, o sobra
   —otra capa la tapa— o no sirve —ninguna entrada la dispara—, y las dos cosas
   se arreglan distinto pero ninguna se arregla dejándola ahí. Salió del
   validador de `?volver=` (#229): con las comprobaciones estructurales y la
   lista blanca en una sola función, **quitar la comprobación de origen no ponía
   nada en rojo** porque la lista blanca atajaba los mismos casos un paso
   después. Se partió en dos capas con batería propia cada una, y ahí sí: las
   seis mueren en rojo al quitarlas. De paso se descubrió una séptima que
   ninguna entrada podía disparar, y se borró — **un candado que no cierra nada
   solo infla la cuenta de candados.** Es el mismo criterio que la pared entre
   carriers: cerrado por construcción, no por disciplina repetida.
   **Y se aplica al instrumento tanto como al código.** Un medidor que devuelve
   cero cuando no midió nada se ve idéntico a uno que midió y encontró todo
   limpio: la compuerta de este mismo tramo dio verde en su primera corrida
   **con el servidor caído** —`curl` contestando `000`, cuerpo vacío, y contar
   ocurrencias sobre nada da cero—. La corrección es la misma de los dos lados:
   **contar también algo que TIENE que estar**, no solo lo que no debe estar.

**De producto:**

> *"¿Esto tendría sentido para una planta en Bogotá cuyas rutas nunca hemos
> visto?"* Si sí, es producto. Si solo tiene sentido por una ruta específica, es
> caso de uso y va mal.
>
> **Planta 47 es el laboratorio, no el paciente.**

**Las dos caras no son simétricas. El carrier es producto, no anexo.**

La cara del cliente y la del carrier no son dos vistas del mismo sistema con
distinta pintura. Son **dos productos que se tocan en el contrato**.

Para el carrier, sus unidades son **una sola operación**. El mismo camión sirve a
una planta el lunes y a otra el martes; su mantenimiento, su diésel, su chofer y
su historial son los mismos sin importar a quién sirvió ese día. El carrier ve
**todo su universo, sin partir por contrato**. Partírselo sería romperle su
realidad para acomodar la de otro.

Sobre estos cimientos se construyen pisos: la suite del carrier crece hacia sus
propias unidades y actividades, y esa suite se vuelve más valiosa cuando
J-Telemetry sustituya a los proveedores de GPS actuales —obsoletos y casi
imposibles de programar alrededor. El carrier además puede ofrecer la
verificación como **valor agregado** de su operación frente a la planta.

**Las dos líneas que no se cruzan**, y son del Marco («Las leyes (intocables)»):

1. El carrier ve **todo lo suyo**, y **nada de lo interno del cliente** — ni
   otros carriers de la misma planta, ni operación que no sea suya.
2. El cliente **jamás** ve la operación interna del carrier.

**Consecuencia para las guardias:** el alcance del carrier se resuelve contra
**su universo**, no contra el contrato por el que llegó. Por eso `/carrier`
necesita la misma procedencia por fila que `/cliente` — no para partirle la
vista, sino para que la pared entre carriers la sostenga la estructura y no la
memoria de quien escribe cada pantalla.

**Y esto último hay que decirlo medido, porque la primera redacción de este
párrafo sugería que hoy los carriers se alcanzan entre sí, y es falso.** El 4
de agosto de 2026 se armó el escenario en la rama desechable —dos
transportistas sirviendo a la misma planta— y se pidió, desde B, todo lo de A:
la unidad, el contrato, el servicio, el lienzo con la unidad ajena por
parámetro y el lienzo entrado por el servicio ajeno. **Los seis caminos
niegan.**

Lo que sí es cierto es otra cosa, y es la que manda el trabajo:

> `/carrier` está cerrado **por disciplina repetida, no por construcción.**
> Son cinco comprobaciones escritas cinco veces, en cinco archivos, cada una
> dependiendo de que quien escribió esa pantalla se acordara de filtrar por
> carrier. `/cliente` tiene **un solo** `exigirRecurso`, en un lugar.

El riesgo, entonces, no es lo que hoy se ve. Es **la pantalla dieciséis**: la
que alguien escriba mañana y olvide el filtro. No rompe nada, no falla ninguna
prueba, y filtra en silencio. Es la forma exacta del `[0]` de
`resolveAccountByType` que cerró el #222 — invisible mientras haya una sola
cuenta de ese tipo, y una fuga el día que haya dos.

**Lo que es real y lo que no:** la única cuenta con operación real es **Tecma**.
Honeywell y PRUEBA REAL son cuentas de ejemplo. Ningún análisis, conteo ni
conversación con cliente las incluye.

---

## 3. Lo que solo Asav puede desbloquear

**Esta sección va primero a propósito.** El cuello de botella del plan no es
código: son las entradas que esperan a una persona. Varias están en la ruta
crítica y detienen tramos enteros.

**Al 3 de agosto por la tarde quedan nueve.** Empezaron siendo trece; Clerk y el
dominio se resolvieron el mismo día.

### 3.1 Trámites

| # | Trámite | Qué desbloquea | Estado |
|---|---|---|---|
| **T1** | **Clerk** | Todo el candado, el login real y el tramo vendible | ✅ **Hecho.** Aplicación `J-Telemetry` creada · **sin organizaciones** (verificado contra el código) · **solo Email** · llaves de test en Vercel: la pública en los 3 entornos sin sensitive, la secreta en Production y Preview con sensitive. Las llaves de producción se generan al conectar el dominio |
| **T2** | **Correo — y son dos cosas, no una.** (a) **Resend**: verificar dominio, API key, tres variables. (b) **Que exista `hola@j-telemetry.com`** | (a) Que las alertas salgan de verdad. Hoy `/api/cron/alertas` responde 503 cada 5 min: el sistema detecta y no puede avisar. (b) Que un cliente pueda escribir. **(b) es de negocio, no de sistema** | **Pendiente.** Alta. El instrumento existe y no tiene bocina — y el landing no tiene buzón |
| **T3** | **Dominio** | Los subdominios del producto | ✅ **Resuelto: `j-telemetry.com`.** `j-tel.io` queda descartado — pero ver la deuda que deja, abajo |
| **T4** | **Rotar la contraseña del readonly** | `jtel_readonly` y `neondb_owner` comparten contraseña | **Pendiente.** Media. Con redespliegue en el mismo movimiento |
| **T5** | **`CRON_SECRET`** | — | ✅ **Cerrado.** Rotado en Vercel · el valor viejo fuera de los documentos desde el 2 de agosto (comprobado sobre `main` el 4: cero archivos versionados) · **permanece en el historial de git, rotado y sin efecto** — no se reescribe historia por esto (decisión de Asav, 4 de agosto) |

**Deuda que dejó T3 — ✅ saldada el 3 de agosto** (#212 y el PR de fichas).
`j-tel.io` salió del landing, su CSS, nueve archivos de prueba, el Brief de
identidad, el skill de interfaz y las tres fichas del Marco. Solo sigue escrito
donde se le nombra **como descartado**: aquí, en `DESPUES.md` y en la foto de
`corte-2026-08-03/`.

**Y destapó algo peor que el dominio viejo.** Los dos botones de contacto del
landing —«Solicitar demo» y «Hablar con el equipo»— apuntaban a
`hola@j-tel.io`, **un buzón en un dominio que nunca se compró**. Es decir:
el botón de solicitar demo lleva muerto desde que el landing existe. Cambiarlo
a `hola@j-telemetry.com` no lo revive por sí solo — hace falta que el buzón
exista. Por eso T2 tiene ahora dos mitades.

### 3.2 Decisiones

Cada una lleva **la recomendación del chat** y el porqué. Asav decide.

---

**D1 · Los 294 hechos sellados con el deadline mal calculado**

*Qué pasa:* el deadline dependía de dónde corrió el generador. Ya hay corrección
de código; la pregunta es qué se hace con los **294 hechos ya sellados** bajo la
regla vieja.

*Recomendación:* **corregirlos, con firma y motivo canónico.** Un hecho sellado
contra un deadline equivocado es una acusación mal medida, y la ley dice que la
política cambia hacia adelante pero un **error** de cálculo no es un cambio de
política: es un defecto. Se corrige como re-verificación explícita y auditada, no
en silencio.

*Bloquea:* el orden es primero el código, después los datos.

---

**D2 · Turno B de Planta 47 — declarado 18:00, operado ~14:00**

*Qué pasa:* falla 6 de 6 días, 36 de 86 fallos. **No es código: es una
conversación con la Planta** para confirmar la hora real y a qué turno pertenecen
esas rutas.

*Recomendación:* **tener esa conversación antes de tocar el árbitro.** Es
probablemente parte del 6.7% de Planta 47 que no tiene causa identificada, y
arreglar el motor sin resolver esto mete ruido en la medición.

*Ojo:* `PLAN-v1.md` lo declaraba ✅ resuelto. **Estaba equivocado.** Ver §7, F1.

---

**D3 · Regla de cierre del pendiente por evidencia**

*Qué pasa:* hay **71 servicios de Tecma** atorados en `pendiente_evidencia` desde
hace más de 48 h (54 de Planta 47, 17 del Campus, del 9 al 31 de julio). **Los 71
tienen evidencia guardada.** No están pendientes por falta de datos: el motor,
teniendo los puntos, no logró atribuir unidad.

*Qué hay que decidir, con la Planta y con legal:* cuánto tiempo puede un servicio
quedarse en pendiente, y qué pasa después.

*Recomendación:* **no decidir esto hasta entender por qué no atribuyó.** Si la
causa es del motor, la regla de cierre sería tapar un defecto con una política.
Primero la investigación de atribución (§5, C3), después la regla.

---

**D4 · Re-verificación de las 300 congeladas**

*Qué pasa:* 300 ocurrencias de Planta 47 con deadline corrido. El PR #124 está
abierto a propósito como foto de referencia. La simulación del 30 de julio con el
motor arreglado dio **139/160/1**, contra 91/209/0 con la ventana rota.

*Recomendación:* **no re-verificar todavía.** Esperar a que el árbitro esté
afinado y `route_traversal_measurements` tenga historia real. Cada
re-verificación mete una versión más en la historia del hecho: no es gratis.

---

**D5 · Cómo se le cuenta a Tecma que su número cambia**

*Qué pasa:* cuando se re-verifiquen las 300, el número de cumplimiento de Tecma
va a moverse. Hacia arriba, y por verdad — pero se mueve.

*Recomendación:* **preparar el mensaje antes de que el número cambie, no
después.** El encuadre correcto es que el árbitro estaba siendo injusto **contra
el carrier** y se corrigió; eso fortalece la neutralidad del producto en vez de
debilitarla. Decidir esto antes de D4.

---

**D6 · Qué contratos permiten que la planta modifique la política sin acuerdo del
carrier**

*Qué pasa:* hoy la política se sobrescribe al editarse. La pieza de "acuerdo de
las partes" está anclada a `auth-rbac`, pero **la política de producto es
decisión de Asav**, configurable por contrato.

*Recomendación:* **configurable, con un piso no negociable.** Hay contratos donde
la planta se reserva el derecho de modificar a su criterio, y eso es legítimo. Lo
que **nunca** es opcional es que exista método de comunicación: el carrier se
entera del cambio, siempre, aunque no tenga que aprobarlo. Una tolerancia que
cambia sin que el auditado lo sepa rompe al árbitro ante quien lo mira.

---

**D7 · Dirección visual del producto**

*Qué pasa:* marcada en rojo y **bloquea pantallas**. Necesita tres respuestas de
Asav que este plan no puede suplir.

*Recomendación:* **resolverla en sesión con el chat de diseño**, no aquí. Pero
resolverla pronto: hay trabajo de interfaz esperando y no está esperando a Devin.

---

**D8 · Qué dominio manda** — ✅ **RESUELTA el 3 de agosto**

**El dominio del producto es `j-telemetry.com`.** `j-tel.io` queda descartado y
sale del plan como trámite. Lo que queda es la deuda de sacarlo del landing y del
código, que va en el Tramo 1 junto con la portada.

---

**D9 · El modelo de altas** — ✅ **DECIDIDA. Completada el 4 de agosto. Sin diseñar**

*El criterio, ya fijado:* una cuenta **no se crea sola, se invita.** Una cuenta
puede tener **uno o varios usuarios** monitoreando su servicio, según el cliente.

*Las cinco reglas, completas:*

**1. El alta la hace cada cuenta, no J-Staff.** El **admin corporativo** da de
alta a su gente; el **admin del carrier**, a la suya. J-Staff deja de ser el
cuello de botella de cada usuario nuevo.

**2. Nadie crea a alguien con más alcance del que él tiene.** Un usuario de
planta solo crea usuarios **de su planta** — nunca corporativos, nunca de otra
planta. **Sin esta ley un usuario se asciende solo**, creándose a sí mismo un
segundo usuario con más alcance. Es la regla que sostiene a las otras cuatro.

**3. El permiso de dar de alta es un interruptor por contrato, no automático
por ser admin.** Hay plantas que van a querer que todo pase por J-Tel y otras
que quieren autonomía; las dos son legítimas y la diferencia se configura.

**4. Cuenta nueva: la crea J-Staff, y con ella su primer admin.** Ese primer
admin es la semilla desde la que la cuenta se administra sola. **Solo J-Staff
crea J-Staff.**

**5. El demo del landing es una presentación, no un modo de la app.** No toca
la base, no tiene cuenta, y **nunca comparte superficie con datos reales**. Un
demo que vive dentro de la aplicación termina teniendo una cuenta, y una cuenta
termina teniendo hechos sellados — que es exactamente cómo nacieron los 84 de
la causa C1.

*Dónde vive:* el alta **del lado del cliente** se fue al **Frente del alcance
fino** (al cerrar el Tramo 2), junto con 1.h y el `admin_planta`. Lo de J-Staff
—crear cuentas y su primer admin— se queda en el Tramo 7, junto con el
interruptor de J-Staff y la administración de
usuarios. **No se diseña todavía** — decorar una casa sin puerta es el orden
equivocado. La decisión queda tomada para no volver a discutirla cuando llegue.

*Estado hoy, y es importante:* **el único usuario del sistema es Asav.** No
existe el flujo de altas, no hay personas reales de Tecma ni de Juárez Bus
entrando. El mapeo de identidad (Tramo 1) mapea **una sola identidad**; las otras
tres filas del seed se quedan intactas hasta que haya gente real.

---

**D10 · Falta el rol de admin de planta** — ✅ **DECIDIDA el 4 de agosto. Sin
diseñar**

*Qué falta.* Hoy no existe un administrador **dentro** de una planta. La
administración vive entera en el corporativo: `admin_corporativo` tiene
`client.manage` y `usuario_planta` no —solo `plant.read`, `compliance.read` e
`inspection.manage`—, así que un usuario de planta puede operar e inspeccionar
pero **no puede dar de alta a nadie**.

*Por qué es un hueco y no una preferencia.* Choca de frente con la **regla 2 de
D9**, que es la que sostiene a las otras cuatro: *«nadie crea a alguien con más
alcance del que él tiene · un usuario de planta solo crea usuarios de su
planta»*. Esa regla **presupone un admin dentro de la planta**, y ese rol no
existe. Sin él, la única forma de que una planta administre su gente es darle un
`admin_corporativo` —que ve todas las plantas de la cuenta— y eso es exactamente
lo que la regla 2 prohíbe. **El hueco no se ve hoy porque el único usuario del
sistema es Asav; se ve el día que un cliente tenga diez plantas.**

*Decisión:* **se declara el rol ahora, con la lista de permisos vacía.** Mismo
trato de fondo que `chofer` (`Ficha-Diseno-Permisos.md` §5): existe, nombrado, y
no puede hacer nada todavía. **Los permisos se definen en el Frente del alcance
fino** —al cerrar el Tramo 2—, junto con 1.h y la pantalla de altas, porque las
tres se necesitan entre sí: un admin de planta sin alcance fino no tiene sobre
qué mandar, y sin pantalla de altas es un rol decorativo. Ahí entra también el
interruptor de altas por contrato de la regla 3 de D9.

> **Ojo con el precedente, porque no es exacto y conviene saberlo antes de
> copiarlo:** la ficha dice que `chofer` quedó «sin permisos activos», pero en el
> código tiene `["self.read"]`. Es una diferencia chica y sin efecto —nadie
> entra con ese rol— pero el rol nuevo se declara con lista **vacía de verdad**,
> no con un permiso nominal. Queda anotado, no arreglado.

*Y aquí va una corrección, porque la razón que se dio al pedirlo no se
sostiene y el registro tiene que ser exacto.* Declararlo **no evita una
migración**: `user_memberships.role` es una columna de **texto**, no un enum de
Postgres —el que sí es enum es `scope_type`—, así que un rol nuevo nunca costó
migración. Lo que declararlo sí evita es peor que una migración:

> Mientras el rol no exista, quien necesite que una planta administre a su gente
> va a alcanzarle lo único que hay — `admin_corporativo` — y eso **rompe la
> regla 2 sin que nada lo señale**. Un rol declarado y vacío es una respuesta
> que ya existe cuando llegue la pregunta.

*Y hay un segundo motivo, que es la regla 8 aplicada a los roles.*
`hasPermission` resuelve `ROLE_PERMISSIONS[rol] ?? []`, así que **un rol que
nadie declaró se comporta exactamente igual que un rol declarado sin permisos:
sin ninguno.** Los dos estados son indistinguibles desde el código. Declararlo
es lo que convierte «no lo hemos definido» en algo que se puede leer, en vez de
en un silencio que se ve idéntico a una decisión.

*Nota de higiene que sale de mirar esto:* `ClientRole` está declarado en
`@jtel/domain` con seis roles y **no lo valida nadie** — cero llamadores fuera
de su propia definición. Es la misma forma de `canAccessPlant`. Declarar el rol
ahí no cierra nada por sí solo; que la validación exista es trabajo del Tramo 7.

---

**D11 · J-Staff crece sin rol nuevo** — ✅ **DECIDIDA el 4 de agosto**

Los roles del equipo de J-Tel **ya existen**: `admin_plataforma`, `soporte` y
`comercial`, con sus permisos repartidos en `@jtel/auth-rbac`. Cuando entre gente
al equipo, entra **bajo `admin_plataforma`** con el rol que le toque de esos
tres. **No hace falta inventar ninguno**, y por la regla 4 de D9 **solo J-Staff
crea J-Staff**.

Se anota justamente para que nadie lo abra como pendiente: es el caso donde la
respuesta correcta es que no hay nada que hacer.

---

### 3.3 Trabajo humano que no es código ni decisión

**H1 · Las tres rutas con falla real** — Huertas-B, Centro-A, Parajes del Sur-A,
~43 servicios. Necesitan que **una persona abra el KML en un visor y lo compare a
ojo**. No lo puede hacer el motor ni Devin. Es falla real de trazado, no del
reloj.

---

## 4. El orden de construcción

**Regla:** un tramo se cierra antes de abrir el siguiente. Si algo aparece a
media obra, se anota en `DESPUES.md` y se replantea al cerrar el tramo, no a
media fase.

### Tramo 0 — El incendio · ✅ CERRADO el 3 de agosto

Lote del INSERT · `sin_evidencia_posible` · tope de cola · consulta acotada ·
rastro en el ledger · contador de fallos mudos (2 h) y de pendientes estancados
(48 h) · `/api/salud` mide verificación · **el archivador es la única puerta al
proveedor** · **la llave demo cerrada**.

PRs #203 · #204 · #205 · #206 · #207 · #208. `main` protegida.

---

### Tramo 1 — El candado · ✅ CERRADO el 4 de agosto

**Por qué primero, y ahora con evidencia:** el 3 de agosto se abrió
`j-telemetry.com` y **la portada muestra, sin login**, tres tarjetas que entran
directo a Cara Cliente, Cara Carrier y J-Staff, con enlaces nombrados «Tecma» y
«Juárez Bus», más un bloque «Estado del sistema» que imprime los nombres de los
clientes.

Son **dos defectos distintos** y hay que decirlos por separado:

1. **No hay login.** La portada entra a los datos sin preguntar quién eres.
2. **Filtra nombres de clientes en una página pública.** Contra la ley de que una
   planta jamás ve otra — y el mundo no debería ver a ninguna.

Hoy solo lo tapa la protección de despliegue de Vercel. Eso no es un candado: es
una cortina.

| Pieza | Qué | Orden |
|---|---|---|
| **1.a** | ✅ **Hecha (#209).** **Mapeo de identidad.** Ligar la identidad de Clerk de Asav a `jstaff_admin` (global). **Se agrega, no se reemplaza** — las cadenas del seed son lo que hoy sostiene el acceso; reemplazarlas deja las pantallas en blanco sin error. Tres piezas: `vincular()` en `MembershipRepository` · archivo de mapeo versionado con `user_...`, sin correos · ejecutor en seco por omisión | **Primero.** Destraba la ficha de permisos entera |
| **1.b** | ✅ **Hecha (#214).** `lib/guardia-pagina.ts`, hermana de `guardia-api.ts`, **reutilizando `decidir`, no duplicándola**. Hace `redirect()`, no HTTP. Falla cerrado | |
| **1.c** | ✅ **Hecha (#215 · #220 · #222 · #226).** Aplicarla en las **65 páginas** (`jstaff` 9 · `cliente` 41 · `carrier` 15), empezando por `/jstaff` — es donde vive el razonamiento del árbitro | |
| **1.d** | ✅ **Hecha (#227).** El filtro de unidades por membresía, con las dos advertencias del #138 y una tercera medida al construirlo: **hoy no le cambia la pantalla a nadie**, porque un usuario de planta no pasa de `resolveAccountByType` —que pregunta por cuenta— y nunca llega al filtro. Lo que entra es la estructura para 1.h. Y la mitad que no era obvia: recortar la lista sin recortar las cifras habría sido §D con el eje del lugar | |
| **1.e** | ✅ **Hecha (#230).** Sin señal no hay identidad: `userId` pasa a `string \| null` y el origen `default-heredado` se llama `anonimo`. **En producción no cambia nada hoy** —`JTEL_DEV_USER=jstaff_admin` está puesto—; cierra local, CI y cualquier despliegue al que le falte esa variable | |
| **1.f** | ✅ **Hecha (#216 · #218).** **La portada.** Una ruta con dos caras: **sin sesión → landing público; con sesión → portada**, y la portada **enseña solo lo tuyo** (de las membresías, no de `listByType`). **Sin nombres de clientes.** El bloque «Estado del sistema» **se quita, no se protege** — ya vive en `/jstaff` y en `/api/salud`. Aquí entra también sacar `j-tel.io` del landing y su CSS | |
| **1.g** | ✅ **Hecha (#231).** `CRON_SECRET` fuera de los documentos. Resultó ser más chica de lo escrito: el valor salió del `README.md` y de `DESPUES.md` el 2 de agosto, en el mismo commit que quitó el respaldo de las siete rutas. Lo que quedaba era la redacción — `DESPUES.md` seguía diciendo en tres lugares que **faltaba rotarlo**, y ya estaba rotado. **Del historial NO se quita:** ahí se queda, rotado y sin efecto, como registro y no como llave | |
| **1.i** | ✅ **Hecha (#228).** **`/entrar` como puerta limpia.** Hoy el botón de iniciar sesión vive en `/quien-soy`, que es **pantalla de diagnóstico**: enseña el origen de la identidad, las membresías y si el encabezado fue rechazado. Pedirle a alguien que entre por ahí es hacerle leer el tablero del taller para abrir la puerta | **Después de cerrar `/cliente` y `/carrier`.** Antes no urge: hoy el único que entra sabe qué es `/quien-soy` |
| **1.j** | ✅ **Hecha (#229),** con la validación de `?volver=` revisada por Asav antes del merge. **Volver al destino después de entrar.** Quien llega por un enlace profundo —el correo de una alerta, un expediente compartido— hoy termina en `/quien-soy` y tiene que volver a navegar a mano. La guardia ya sabe a dónde iba: falta llevarlo de vuelta al entrar. **Ojo al diseñarlo:** el destino viaja en la URL, así que hay que validarlo como ruta propia y relativa — un `?volver=` sin comprobar es un redirector abierto | **Con 1.i**, que es su puerta |
| **1.h** | 🔶 **NO entra en este tramo — sale abierta y es lo único que queda.** **La guardia por alcance, no por cuenta.** 1.c cierra a nivel **cuenta**: pregunta «¿es tu cuenta?», que es lo que sabe `canAccessClientAccount`. Falta la pregunta fina — «¿tu alcance cubre **esta planta**?» — y con ella **la regla del campus de `Ficha-Diseno-Permisos.md` §2.2, que no está implementada**: `canAccessPlant` resuelve alcance `plant` y `account`, pero **no tiene rama para `plant_group`**. **Sin diseñar todavía** | **Después de 1.c.** Hoy no protege a nadie —la única identidad real es global— y mezclarlo con 1.c serían dos cambios de comportamiento en un PR |

**Regla de oro mientras dure este tramo:** **no iniciar sesión en Clerk hasta que
1.a esté hecho.** La sesión de Clerk gana sobre el bypass de desarrollo; entrar
antes convierte la identidad en un `user_...` sin membresías, y como el candado
todavía no cierra puertas, las pantallas abren **vacías en vez de dar error**. Se
ve como producto roto. `JTEL_DEV_USER=jstaff_admin` sigue puesto en Vercel.

**El candado no puede preguntar "¿hay identidad?".** Con `JTEL_DEV_USER` puesto,
el bypass le da identidad a **todo el mundo**: un visitante anónimo de producción
*es* `jstaff_admin` con sus membresías. La guardia tiene que exigir **sesión de
Clerk real** — el campo `sesionActiva` de `getIdentidad()` existe para eso. Por
eso 1.a va antes que 1.b, y no al revés.

**Prueba de aceptación (ya escrita en el código):** `/quien-soy` debe decir
`origen: clerk` con las membresías **pobladas**, no vacías.

### Cómo se niega el paso, y qué NO se cierra con eso

Dos negativas distintas, y la diferencia es lo que impide que un extraño
averigüe qué existe:

| Caso | Respuesta | Por qué no filtra |
|---|---|---|
| **Sin sesión** | redirección a `/quien-soy?motivo=sin-sesion` | Se decide **antes de mirar el recurso**, así que es idéntica exista o no |
| **Con sesión, el recurso no es tuyo** | **404**, igual que si no existiera | Decir «no perteneces a esa cuenta» **confirmaría que el id existe** |

**La existencia de un servicio solo es distinguible desde dentro de la cuenta
que lo posee.** Fuera de ella, no existe.

> ⚠ **Límite conocido, y queda escrito para que nadie lo descubra creyendo que
> estaba resuelto: los dos 404 no son indistinguibles en el tiempo.** Un 404 por
> id inexistente hace una consulta; uno por recurso ajeno hace una o dos. Con
> suficientes intentos y un cronómetro, esa diferencia es un canal. **No se
> cierra en este tramo** — hacerlo es trabajo de otra naturaleza (respuesta de
> tiempo constante) y hoy no compite con lo que sí está abierto. Si alguien
> decide que importa, entra como pieza propia, no como parche.

### La compuerta, corrida el 4 de agosto de 2026

No se da por buena de memoria. Se levantó producción en local contra la base
desechable —nunca la de producción— y **se midió el cuerpo de cada respuesta, no
el código de estado**, que es la regla 7.

**1 · Ventana anónima contra `/jstaff/*` → redirección, nunca contenido.** ✅
Las cinco pantallas probadas contestan **307 a `/entrar?motivo=sin-sesion`**, con
cuerpos de 8 099 a 8 696 bytes que traen el armazón de la redirección y nada
más: **cero nombres de cliente y cero contenido propio de J-Staff** —ni cuentas,
ni ledger, ni autopsia, ni resync—.

> **Y una del oficio, porque casi se cuela:** la primera corrida de esta
> comprobación dio **cero en todo** con el servidor **caído**. `curl` devolvía
> `000` y cuerpo vacío, y contar ocurrencias sobre nada da cero — que se lee
> idéntico a una pantalla limpia. Por eso la comprobación cuenta también algo
> que **tiene** que estar: el marcador de la redirección. Un verde que no
> distingue «limpio» de «no hubo respuesta» es la regla 8 aplicada al medidor en
> vez de al código.

**2 · Un usuario con membresía solo de carrier no abre ninguna pantalla de
cliente.** ✅ **en el dato, y hay que decir cómo.** `jb_admin` no obtiene **ni un
nombre de cliente** en ninguna pantalla de `/cliente`, y en una pantalla de
recurso —`/cliente/planta/<id>` con un id real— recibe **404** mientras
`tecma_admin` recibe 200. Ésa es la pared, y la sostiene `exigirRecurso`.

> **El matiz, que es de la familia del `[0]` del #222 y por eso se escribe:** en
> el índice `/cliente` la respuesta es **200 con «No hay cuentas cliente»**, no
> una negativa. Lo que lo vacía es que `resolveAccountByType` no resuelve
> ninguna cuenta para él, no una guardia diciendo que no. **El dato no se fuga
> —medido— pero el mecanismo es ausencia de cuenta, no denegación.** Entra como
> insumo de 1.h.

**3 · La portada pública no nombra a ningún cliente.** ✅ `/` contesta 200 con
**cero ocurrencias** de Tecma, Juárez Bus, Honeywell, Planta 47, Santos Dumont y
PRUEBA REAL.

### Qué queda abierto al cerrar el tramo

**Una sola pieza: 1.h, la guardia por alcance.** Y no es un pendiente
administrativo — es la pregunta fina que este tramo no supo hacer.
**Ya no viaja suelta:** es una de las tres piezas del **Frente del alcance fino**,
que se coloca al cerrar el Tramo 2.

- **`canAccessPlant` no la llama nadie.** Comprobado sobre `main`: cero
  llamadores fuera de sus propias pruebas.
- **Y no tiene rama para `plant_group`**, así que **la regla del campus de
  `Ficha-Diseno-Permisos.md` §2.2 y §2.3 —confirmada por Asav el 31 de julio—
  sigue sin implementarse en la guardia.** Vive implementada en el filtro de
  presentación de 1.d (`alcance-cliente.ts`), que **enseña** el campus a quien
  alcanza una de sus plantas; lo que falta es que la guardia **abra** por esa
  misma regla.
- **Consecuencia hoy, dicha sin adorno:** el candado cierra a nivel **cuenta**.
  Un usuario de planta no ve de más — ve **de menos**: `canAccessClientAccount`
  lo rechaza y `/cliente` le dice «No hay cuentas cliente». Nadie está expuesto
  por esto, y nadie de planta puede trabajar todavía.

**Dos límites conocidos que el tramo deja escritos y no cierra:** el canal de
tiempo entre los dos 404 (arriba), y que `/carrier` está cerrado por disciplina
repetida y no por construcción (§2).

**Lo que este tramo NO era:** el login real. `JTEL_DEV_USER=jstaff_admin` sigue
puesto en Vercel y es lo que sostiene el acceso. El candado exige sesión de
Clerk en producción; lo que falta para que eso sea la puerta de todos es el
Tramo 7.

---

### Tramo 2 — Ordenar el árbitro (no arreglarlo)

> **1.h no entra aquí, y ya no viaja suelta.** Este tramo no toca guardias.
> 1.h pasó a ser una de las tres piezas del **Frente del alcance fino**, que se
> coloca al cerrar este tramo — abajo, después de la compuerta.

**No toca el motor.** Es leer, medir y ordenar. Ver §5, que es esta ficha viviendo
dentro del plan.

**Por qué existe:** las causas se solapan sobre las mismas rutas. Arreglar una sin
saber cuál movió el número reproduce el problema.

**Compuerta:** cada causa de §5 tiene medición, dependencia y ruta compartida
declarada.

---

### Frente — El alcance fino y quién administra dentro de él

**Sale del Tramo 7 y se coloca al cerrar el Tramo 2.** No es un tramo: es un
frente de tres piezas que **se necesitan entre sí**, y por eso se sacan de donde
estaban repartidas y se ponen juntas.

| Pieza | Qué | De dónde viene |
|---|---|---|
| **1.h — el alcance fino** | La guardia deja de preguntar «¿es tu cuenta?» y pregunta «¿tu alcance cubre **esta planta**?». Arrastra **la regla del campus** de `Ficha-Diseno-Permisos.md` §2.2 y §2.3: `canAccessPlant` resuelve `plant` y `account` y **no tiene rama para `plant_group`** | Lo único que quedó abierto del Tramo 1 |
| **El admin de planta** | `admin_planta` con **permisos de verdad**. Hoy está declarado y parqueado con lista vacía (D10) | D10, y la regla 2 de D9 que lo presupone |
| **La administración de usuarios** | La pantalla donde un admin da de alta a su gente. **No existe** — hoy dar de alta a alguien es trabajo manual de J-Staff | Tramo 7, y `Ficha-Diseno-Permisos.md` §6 |

**Por qué las tres juntas, y no en tres momentos distintos:**

> **Un admin de planta sin alcance fino no tiene sobre qué mandar** — la guardia
> solo sabe de cuentas, así que administrar «su planta» no tiene referente.
> **Y sin pantalla de altas es un rol decorativo:** existe, tiene permisos, y no
> hay dónde ejercerlos.
>
> Las tres por separado son media pieza cada una. Es la misma forma del problema
> que resolvieron juntas: dar `admin_corporativo` porque es el único admin que
> existe rompe la regla 2 de D9 **sin que nada lo señale**.

### Lo que hoy hace imposible probarlo, y es la razón de que no se empiece ya

**La única identidad real del sistema tiene alcance `global`.** Contra ella, una
guardia por alcance **pasa siempre** — y una batería de pruebas contra esa
identidad **entraría en verde sin haber probado nada**.

Es exactamente lo que pasó en `/carrier`: las comprobaciones parecían sostener la
pared entre transportistas, y **hasta que no hubo un segundo carrier en la rama
desechable (#225) no se supo si sostenían algo.** Los seis caminos negaron, pero
eso se supo **midiendo con dos**, no razonando con uno.

**Consecuencia para este frente:** antes de escribir la guardia por alcance hace
falta **el escenario** — una cuenta con varias plantas, un campus, y usuarios de
alcance `plant` y `plant_group` de verdad. Sin eso, cualquier verde que salga es
del tipo que la regla 8 nombra: no distingue una guardia que funciona de una que
no está.

**El lugar exacto se decide al cerrar el Tramo 2**, con el dato de los **71
pendientes de Tecma** (D3) en mano — porque ese dato puede mover el orden de lo
que sigue, y ordenar este frente antes de tenerlo sería elegir a ciegas.

**Lo que este frente NO es:** el login real. Eso sigue en el Tramo 7, con retirar
el bypass.

---

### Tramo 3 — Arreglar el árbitro

En el orden que el Tramo 2 determine, **no en el orden en que están listadas**.

- **Nada se sella hasta que se pueda medir el efecto por separado.**
- Una causa por PR. No se mezclan dos cambios de comportamiento del motor.
- Cada arreglo trae su medición de antes y después.

**Aquí vive la identificación por capas** — seis señales que acumulan confianza y
ninguna condena sola: llegada a geocerca (la más robusta, ya existe) · corredor ·
match fino (solo con densidad suficiente) · huella histórica · patrón de paradas ·
rol declarado (**opcional siempre**; si el sistema depende de que alguien declare,
dejó de ser autónomo).

---

### Tramo 4 — Que el hecho se baste a sí mismo

**Bloqueante para la definición de v1.** Un hecho sellado tiene que contener —o
referenciar de forma inmutable— todo lo que hizo falta para producirlo. Hoy sale a
buscar cosas del catálogo que pudieron cambiar debajo de él.

| Qué le falta cargar | Estado medido |
|---|---|
| Política del contrato | ✅ se congela byte a byte |
| Unidad de cada punto de evidencia | ✅ anclada |
| Asignación equipo ↔ unidad | ✅ temporal, resuelta por fecha |
| Versión de trazado | 🟡 referenciada en 92.5% **pero el motor no la lee** — re-resuelve por fecha |
| Conjunto de variantes evaluadas | ❌ no se congela |
| Forma de la geocerca | ❌ no se versiona, y el campo guardado no es el que el motor usó (546 divergen) |
| Versión del motor | ❌ |

**Por qué es bloqueante y no deuda:** sin esto, explicar un no cumplido de julio
leyendo el motor de agosto **miente sin querer**. Y explicar es la mitad de la
definición de v1.

---

### Tramo 5 — Ver y explicar

**Aquí se cumple la segunda mitad de la definición de v1.**

| Pieza | Qué |
|---|---|
| **Expediente del no cumplido** | **El corazón.** Mapa con los dos trazos encimados —contratado punteado, real sólido—, divergencias resaltadas, enunciados medidos al lado, y para la planta el botón "aprobar esta variante hacia adelante" |
| Diff estructural | Dónde dejó el trazado, cuántos km por fuera, dónde lo retomó, qué tramo omitió. **Números auditables** |
| Cumplimiento (dos caras) | Las cifras de juicio, que hasta aquí no se muestran |
| `mapa-instrumento` · `vista-de-ruta` · `preventivo-jtel` | |
| Tablero de calibración | |
| Módulo de choferes | |

---

### Tramo 6 — Re-verificar y sostener

- Simulación nueva con el motor afinado, contra 139/160/1 y 91/209/0.
- **Con el número en mano**, decidir si se re-verifica formalmente (D4), con firma
  y motivo canónico.
- Sostener el ≥90% **de capacidad de mostrar** dos semanas · cero rojos sin
  expediente · ningún hecho sellado sobre cuenta no declarada · ningún hecho cuya
  frontera de evidencia viva fuera de él.

---

### Tramo 7 — Vendible

| Pieza | Qué |
|---|---|
| `auth-rbac` cerrado | **Retirar el bypass** y el login real. La guardia por alcance, los permisos del `admin_planta` y la administración de usuarios **ya no viven aquí**: se fueron juntas al **Frente del alcance fino**, que se coloca al cerrar el Tramo 2 |
| **Lenore-vigía** | Alertas preventivas durante la operación: *"6 unidades no reportan y el turno cierra en 20 minutos"*. **No está bloqueada por nada técnico** — necesita T2 (que las alertas salgan) y saber a quién avisar |
| **Lenore-narradora** | El diff estructural contado en cristiano dentro del expediente. **Bloqueada por el Tramo 4** |
| Interruptor de J-Staff | Activar / desactivar / eliminar cuentas y contratos. Hoy la única vía es tocar la base a mano, y eso no es producto. **Desactivar es hacia adelante y no toca el pasado; eliminar abre la pregunta de qué pasa con los hechos ya sellados.** Y J-Staff **enuncia, no esconde**: los excluidos por cuenta de ejemplo se muestran con su motivo |
| **J-Staff altas y demos** | Con el modelo ya decidido en **D9**: invitación de J-Tel o solicitud del cliente aprobada desde J-Staff · uno o varios usuarios por cuenta |
| **La suite del carrier** | **No es una cara pendiente de pulir: es un producto con piso propio** (§2, «las dos caras no son simétricas»). Lo que entra a v1 son **los cimientos** — que el carrier vea todo lo suyo, con el alcance resuelto contra **su universo** y no contra el contrato por el que llegó. Su alcance completo —sus propias unidades y actividades, sustituir a los proveedores de GPS, la verificación como valor agregado frente a la planta— **vive más allá de v1**, en `DESPUES.md` |
| Pase de interfaz final | |

**Compuerta de v1:** un cliente nuevo se da de alta, entra con su usuario, ve solo
lo suyo, y el ≥90% de capacidad de mostrar se sostiene.

---

## 5. Las causas del árbitro

**Esta es la ficha de consolidación.** Vive aquí, no en un documento aparte.

**Son once, no seis.** El plan viejo decía seis en una línea y listaba ocho en su
propia tabla; el 3 de agosto se sumaron tres más.

| # | Causa | Qué se sabe | Estado |
|---|---|---|---|
| **C1** | **Cuentas demo con veredictos vinculantes** | 84 hechos sellados sobre cuentas no declaradas (52 de ellos `no_cumplido`). Crecía ~11/semana | **Llave cerrada** (#206). Falta limpiar los 84 — con firma y motivo |
| **C2** | **La cadena de auditoría rota** | 374 de 580 filas de historial (64.5%) perdieron la referencia a qué las reemplazó. El borrado en cada reintento deja `replaced_by_fact_id` en nulo | Sin construir. **Toca la promesa comercial**: sin cadena, un veredicto no puede probar de dónde vino |
| **C3** | **Se juzga antes de que llegue el expediente** | ~175 intentos por servicio. El archivador va ~7 h detrás (p95: 30 h) y nada retrasa el primer intento | Sin construir. **Arreglar esto probablemente elimina la mayor parte de C2** |
| **C4** | **La geocerca congelada no es la que se usa** | El hecho guarda `expectedGeofenceId`; el motor juzga contra `profile.geofence`. **546 ocurrencias divergen** | Sin construir. Requiere D-decisión: congelar el polígono, qué pasa con el campo huérfano, cómo se re-verifica un hecho viejo |
| **C5** | **Ventana derivada vs. match observable** | No afinados entre sí: +50 se enderezan por uno, −2 se caen por el otro | Espera historia en `route_traversal_measurements`. **No es trabajo, es tiempo** |
| **C6** | **Trazado KML que no corresponde** | Huertas-B, Centro-A, Parajes del Sur-A · ~43 servicios | **Trabajo humano** (H1), no código |
| **C7** | **`maxRouteDurationMinutes` fijo en 60** | Segundo "cuánto dura una ruta" sin derivar. Hoy no causa falsos negativos | **Tarea propia, no se mezcla.** Dos derivaciones cambiando juntas hacen inatribuible el resultado |
| **C8** | **Identificación en vivo** | La sala no sabe qué unidad cubre qué ruta antes del cierre | Se piensa junto con C1 y C4 |
| **C9** | **Nombre del chofer sin congelar** | Falta congelarlo en `complianceFacts` al sellar | Toca el camino del árbitro |
| **C10** | **Planta 47 sella 6.7% vs Campus 55.2%** | Diferencia medida, **causa no identificada** | Probablemente conectada con D2 (Turno B) y con C11 |
| **C11** | **71 de Tecma con evidencia y sin atribución** | 54 de Planta 47, 17 del Campus. **Todos tienen evidencia guardada.** El motor no logró atribuir unidad | **En investigación.** Puede ser causa nueva o manifestación de otra |

**Rutas compartidas:** Huertas-B aparece en C5 y en C6. Planta 47 aparece en C10,
C11 y D2. Ninguna de esas se arregla sin saber cuál movió el número.

**Dependencias conocidas:** C3 → C2 (arreglar cuándo se juzga reduce el borrado) ·
C5 espera datos, no trabajo · C4 y C1 comparten la pregunta "qué se congela dentro
del hecho", que es el Tramo 4.

---

## 6. Lo que NO entra en v1

Queda en `DESPUES.md`. No bloquea.

**Sin diseñar:** Diésel · Taller · Rastreadores · Inspecciones · Reportes ·
J-Staff completo · móvil.

**Bloqueado por datos, se llena solo:** duración esperada de ruta · rendimiento de
diésel · lectura del cambio de rastreador.

**Legales, no bloquean v1:** qué contiene un export con evidencia · qué hace
probatorio un documento en una disputa.

**Conceptos v2:** Sandbox · map matching como capa de explicación · promoción de
variantes · **modo pasajero** · pre-nómina · Lenore-auditora · Lenore-copiloto de
configuración · Lenore-detección de deriva · Lenore-copiloto general.

**Advertencia que no se puede perder:** la perilla `destino_only` de
`routeStrictness` **está reservada para el modo pasajero y no se usa como
estabilizador**. Ponerla para que un contrato deje de salir rojo es apagar la
verificación de ruta y llamarlo otra cosa.

---

## 7. Contradicciones resueltas

Registro de las once contradicciones medidas entre `PLAN-v1.md` y `DESPUES.md`, y
cuál ganó. Se conserva para que nadie las reabra.

| # | Qué | Resolución |
|---|---|---|
| **F1** | **Turno B de Planta 47** | `PLAN-v1` decía ✅ resuelto. **Falso.** Gana `DESPUES.md`: falla 6 de 6 días y está bloqueado por una conversación con la Planta que no ha ocurrido — **D2** |
| **F2** | Las 300 | La simulación **ya se corrió** (139/160/1 el 30-jul). El bloqueo es otro: falta afinar C5 e historia en `route_traversal_measurements` — **D4** |
| **F3** | Historia de la política | **Entregada** en #125 y en producción. `PLAN-v1` la listaba como faltante |
| **F4** | Historial / vista de flota | **Construido** y ya conectado al resumen. Se resuelve a favor de `PLAN-v1` |
| **F5** | Política como acuerdo vivo | Es **v1**: pieza 1 hecha, pieza 2 (cláusula) pendiente, pieza 3 anclada a `auth-rbac` — **D6** |
| **F6** | `maxRouteDurationMinutes` | Entra a v1 como **C7**, tarea propia |
| **F7** | Historia del sello | v1, componente parcial: falta la columna de causa |
| **F8** | **Lenore v1** | **No estaba en el camino, ni programada ni excluida.** Resuelto: vigía y narradora entran en v1, Tramo 7. La narradora bloqueada por el Tramo 4; **la vigía no está bloqueada por nada técnico** |
| **F9** | Auth / seguridad | Es **condición no negociable de v1**. Tramo 1 y Tramo 7 |
| **F10** | `jrz-pass` | **Descartado.** `jrz-drone-os` es fuente de datos, nunca de código ni de diseño |
| **F11** | Las tablas de decisiones no coincidían | Reemplazadas por §3 de este documento, que es la única |

**Contradicción interna de `DESPUES.md`** (sobre si la zona horaria empeoró el
cálculo o si nunca se leyó): **queda abierta.** Requiere medición antes de
escribirse aquí como hecho. No se arrastra a este plan.

**Resuelto también, fuera de esas once:** el número de hechos demo. Los documentos
decían 73; la medición del 3 de agosto dio **84**, porque el cron siguió sellando
mientras la llave estaba abierta.

---

## 8. Estado del repo

`asav-mx/j-tel` · Next.js, Neon/Postgres, Vercel (`j-tel-web`).
Paquetes: `db` · `domain` · `verification` · `services` · `gps-umbrella` ·
`auth-rbac` · `reports`.

**Construido y en producción:** las dos caras completas (13 pantallas, datos
reales, dos temas — **el frente visual está cerrado**) · cinco expedientes ·
26 de 26 rutas de API guardadas · **las 65 páginas guardadas y el Tramo 1
cerrado** —`/entrar` como puerta, vuelta al destino validada, sin identidad por
omisión— · historia de la política · plomería de alertas · el árbitro con sus
cuatro arreglos de ventana.

**El candado ya no es «identidad sin enforcement».** Lo que falta de él es una
pieza nombrada —1.h, que vive en el **Frente del alcance fino**— y el login real
del Tramo 7.

**La foto de referencia del 3 de agosto** de los documentos viejos vive en
`docs/corte-2026-08-03/`. Es foto, no ley. No se edita.

---

## 9. Bitácora de ediciones

Toda edición de este documento se anota aquí, con fecha y qué cambió. Es la forma
de saber por qué el plan dice hoy algo distinto a la semana pasada, sin tener que
adivinar.

**3 de agosto de 2026 — creación.** Unifica `PLAN-v1.md`, `Plan-Camino-a-v1.md` y
los dos `Despues.md`. Resuelve las once contradicciones medidas entre los dos
primeros (§7). Adopta la definición nueva de v1 (§1), que sube el expediente del
no cumplido a corazón de v1 y convierte "el hecho debe bastarse a sí mismo" en
bloqueante.

**3 de agosto de 2026, tarde.**
- **T1 Clerk: hecho.** Sin organizaciones (verificado contra el código: el
  alcance de seis niveles no cabe en una organización plana, y un usuario
  necesita varias cuentas a la vez). Solo Email. Llaves de test en Vercel.
- **T3/D8 dominio: `j-telemetry.com`.** `j-tel.io` descartado; queda la deuda de
  sacarlo del landing y su CSS — pieza 1.f.
- **D9 modelo de altas: decidido**, sin diseñar. Invitación o solicitud aprobada
  desde J-Staff.
- **Hallazgo: la portada pública entra a los datos sin login y nombra a los
  clientes.** Nuevo, no estaba en ningún documento anterior. Sube el Tramo 1 y le
  agrega la pieza 1.f.
- **El mapeo de identidad se simplifica:** hoy el único usuario del sistema es
  Asav. Una sola identidad se mapea; las otras tres filas del seed quedan
  intactas. Y **se agrega, no se reemplaza** — reemplazar dejaría las pantallas
  en blanco sin error.
- Bloqueos de §3: de trece a nueve.

**3 de agosto de 2026, noche.**
- **Pieza 1.a cerrada.** El mapeo se construyó (#209), se ligó la identidad de
  Asav (#211) y se aplicó a producción: `admin_plataforma` · alcance global ·
  cuenta J-Staff. Se comprobó que `/quien-soy` dice `origen: clerk` con 1
  membresía. Las tres filas del seed restantes, intactas.
- **La deuda del dominio, saldada** (#212 y este PR). Verificado en el
  navegador, no solo compilando.
- **T2 pasa a tener dos mitades**, y la segunda no la resuelve el sistema: que
  exista `hola@j-telemetry.com`. El botón «Solicitar demo» del landing llevaba
  apuntando a un buzón inexistente desde que se construyó.
- **Ficha-Cara-De-Producto §4.1 corregida**: decía que el dominio no estaba
  comprado. Ya lo está; lo que sigue pendiente son los subdominios y las llaves
  de producción de Clerk.

**4 de agosto de 2026.**
- **1.b y la primera tanda de 1.c, hechas** (#214, #215). `/jstaff` cierra en
  producción: nueve páginas más su layout, comprobado contra el build **con
  `JTEL_DEV_USER` puesto** — el bypass no abre la puerta.
- **1.f hecha** (#216), y era **fuga activa**: `www.j-telemetry.com` servía
  «Tecma» y «Juárez Bus» sin login, ya sin la cortina de Vercel. La raíz pasa a
  ser una ruta con dos caras y la portada enseña solo lo tuyo.
- **Los dos dominios son uno.** `j-telemetry.com` responde **308 permanente** a
  `www.j-telemetry.com`; el ápex nunca sirve contenido, así que las guardias
  cubren las dos direcciones por construcción.
- **Pieza 1.h abierta:** la guardia por alcance. 1.c cierra a nivel cuenta; el
  alcance fino va aparte, y arrastra la regla del campus de la ficha §2.2, que
  **no está implementada** en `canAccessPlant`.
- **Queda escrito el límite del canal de tiempo** entre los dos 404. No se
  cierra en este tramo, y ahora está donde se ve.
- **La tanda de `/cliente` cerrada** (#220): 41 páginas, con la cuenta sacada
  de la fila del recurso y no de `?account=`. Barrido contra el build de
  producción: 25 rutas, cero con datos reales en el cuerpo.
- **Regla 7 de «las ganadas por las malas»**, salida de ahí: un `redirect()` de
  layout no impide que la hija se renderice, y por eso se verifica el cuerpo y
  no el código de estado.
- **El fallback de `resolveAccountByType`, cerrado** (#222, la tanda que cerró
  `/carrier`). Y resultaron ser **dos agujeros, no uno**: sin `?account=` la
  función terminaba en `listByType(type)[0]` y devolvía la primera cuenta de la
  tabla, fuera de quien fuera; y **con** `?account=` tampoco comprobaba nada —
  el parámetro elegía contra quién compararse. Ahora el default sale del
  **alcance** de quien pregunta, no del orden de la tabla: con parámetro, la
  cuenta tiene que existir, ser del tipo y estar dentro de tu alcance; sin
  parámetro, si tu alcance cubre exactamente una, esa, y si cubre varias o
  ninguna, `null` y que decida quien llama. Un solo cambio arregló los 26
  sitios que lo llamaban.
- **1.f solo era el escaparate, y hay que decirlo:** comprobado contra
  producción, `/cliente?account=tecma` responde **200 sin sesión** y entrega
  «Tecma Planta 47 (73) y Campus Santos Dumont (25)». Quitar los nombres de la
  portada **no cerró el acceso**. Por eso `/cliente` pasa delante de `/carrier`
  en 1.c: es la fuga más urgente, no la más simple.
- **`tieneAlcanceGlobal`** (#218): la portada leía membresías en vez de
  alcance, y una identidad global tiene una sola fila. La regla vive en
  `@jtel/auth-rbac` y la usan también las funciones de acceso — ofrecer una
  puerta que no abre es la misma mentira al revés.
- **D9 completada** con sus cinco reglas. La segunda es la que sostiene a las
  demás: nadie crea a alguien con más alcance del que tiene.
- **Piezas 1.i y 1.j abiertas:** `/entrar` como puerta limpia, y volver al
  destino tras entrar. Las dos van después de cerrar `/cliente` y `/carrier`.
- **§2 corregido, y la corrección es del tipo que este plan existe para
  registrar.** El párrafo del carrier sugería que hoy los carriers se alcanzan
  entre sí. **Medido con dos transportistas de verdad en la rama desechable
  (#225): los seis caminos con id niegan lo ajeno.** Lo que sí falla es la
  forma: cerrado por disciplina repetida —cinco comprobaciones en cinco
  archivos— y no por construcción. El riesgo es la pantalla dieciséis, no la
  quince. Y lo que lo destapó fue exigir la medición antes de escribir la
  guardia: leer cinco archivos era exactamente lo que iba a fallar.
- **La tanda chica del Tramo 1, cerrada o en la puerta: 1.d, 1.e, 1.g, 1.i y 1.j.**
  Cada una se clasificó por el lado de §2 **antes** de abrirla, como quedamos.
- **1.d resultó ser estructura, no cambio visible, y hay que decirlo así.** Un
  usuario de planta no llega al filtro: `resolveAccountByType` pregunta
  `canAccessClientAccount`, que exige alcance de cuenta, y ahí se queda —
  medido con el seed contra la base desechable, no inferido. Lo que entra sirve
  para cuando 1.h abra la puerta.
- **Y destapó un §D que habría nacido con el filtro.** Las cifras del titular
  —total de pendientes, antigüedad del más viejo— salen de consultas de
  **cuenta**. Recortar la lista de sitios sin recortarlas habría dejado un
  total contando sitios que no aparecen: la misma mentira de «contar desde
  siempre», cambiando el eje del tiempo por el del lugar.
- **1.i movió la puerta y destapó una contradicción de pantalla.** Con
  producción levantada en local, `/entrar` decía «Necesitas entrar para ver
  eso» y en la esquina el distintivo decía `tecma_admin · variable`: le
  anunciaba a un visitante sin sesión un identificador interno y que el bypass
  está puesto. No era redundancia, era contradicción.
- **1.j: la comprobación obvia del `?volver=` no alcanzaba, y se supo por
  medir.** Antes de escribir el validador se corrieron cadenas de ataque contra
  el parser de Node: `new URL("/..//evil.com", centinela)` **conserva el
  origen** y devuelve `pathname` `//evil.com`, que el navegador lee como
  externo. De ahí la regla del archivo — se comprueba la cadena que se va a
  **devolver**, no la que llegó.
- **Y las pruebas de mutación cambiaron el diseño, no solo lo confirmaron.**
  Con el validador en una sola función, quitarle la comprobación de origen **no
  ponía nada en rojo**: la lista blanca atajaba los mismos casos un paso
  después. Una defensa que ninguna prueba distingue es una defensa que no sabes
  si tienes. Se partió en dos capas con batería propia cada una; de paso se
  borró una comprobación que ninguna entrada podía disparar.
- **1.e retira la muleta, y el tipo hizo el trabajo.** `userId: string | null`
  obligó a decidir qué hace cada pantalla sin identidad; TypeScript encontró
  los cuatro consumidores exactos. **En producción no cambia nada hoy** porque
  `JTEL_DEV_USER` está puesto: lo que cierra es local, CI y el despliegue al
  que le falte esa variable.
- **1.g era más chica de lo que este plan decía.** El valor de `CRON_SECRET`
  salió de `README.md` y `DESPUES.md` el 2 de agosto, en el mismo commit que
  quitó el respaldo. Comprobado sobre `main` el 4: **cero archivos versionados**
  lo contienen. Lo que quedaba era documentación mintiendo — `DESPUES.md` decía
  en **tres lugares** que faltaba rotarlo, y ya estaba rotado.
- **Del historial no se quita, y queda escrito por qué.** Estando rotado, ese
  valor no abre nada: es un registro de lo que pasó, no una llave. No se
  reescribe historia por esto.

- **Frente nuevo: el alcance fino y quién administra dentro de él.** Sale del
  Tramo 7 y se coloca **al cerrar el Tramo 2**. Tres piezas juntas —1.h, el
  `admin_planta` con permisos de verdad, y la pantalla de altas— porque **cada
  una sin las otras dos es media pieza**: un admin de planta sin alcance fino no
  tiene sobre qué mandar, y sin pantalla de altas es un rol decorativo.
- **Y la razón de que no se empiece ya no es de agenda, es de medición.** La
  única identidad real tiene alcance `global`, así que una guardia por alcance
  **pasa siempre** contra ella y una batería de pruebas **entraría en verde sin
  probar nada**. Es lo mismo que pasó en `/carrier`: hasta que no hubo un
  **segundo** carrier en la rama desechable (#225) no se supo si las
  comprobaciones sostenían algo. Antes de escribir la guardia hace falta el
  escenario: varias plantas, un campus, y usuarios de alcance `plant` y
  `plant_group` de verdad.
- **El lugar exacto se decide al cerrar el Tramo 2**, con el dato de los 71
  pendientes de Tecma (D3) en mano.

- **Regla 8 extendida al instrumento.** Un medidor que devuelve cero cuando no
  midió nada se ve idéntico a uno que midió y encontró todo limpio. La
  corrección es la misma de los dos lados: contar también algo que **tiene** que
  estar.
- **D10 abierta y decidida: falta el rol de admin de planta.** Se declara sin
  permisos activos, como `chofer`; los permisos se definen en el Frente del
  alcance fino.
- **Y su justificación se corrigió al verificarla.** Se pidió como «evita una
  migración», y **no la evita**: `user_memberships.role` es columna de texto, no
  enum de Postgres. Lo que evita es peor — que alguien alcance
  `admin_corporativo` por ser el único admin que existe, rompiendo la regla 2 de
  D9 sin que nada lo señale.
- **Y hay un segundo motivo, que es la regla 8 aplicada a los roles:**
  `hasPermission` resuelve `ROLE_PERMISSIONS[rol] ?? []`, así que un rol **no
  declarado** se comporta igual que uno declarado **sin permisos**. Los dos
  estados son indistinguibles; declararlo es lo que hace legible la diferencia.
- **Y el precedente de `chofer` no era exacto:** la ficha lo declara «sin
  permisos activos» y el código le da `["self.read"]`. Sin efecto —nadie entra
  con ese rol— pero el rol nuevo va con lista vacía de verdad. Anotado, no
  arreglado.
- **D11: J-Staff crece sin rol nuevo.** `admin_plataforma`, `soporte` y
  `comercial` ya existen y alcanzan. Se anota para que no se abra como
  pendiente: la respuesta correcta es que no hay nada que hacer.
- **Higiene detectada de paso:** `ClientRole` está declarado en `@jtel/domain` y
  **no lo valida nadie** — misma forma que `canAccessPlant`. Queda anotado, no
  arreglado.

- **TRAMO 1 CERRADO.** Diez piezas, 1.a a 1.j. Nueve hechas; **1.h sale
  abierta**, y desde el frente nuevo se coloca al cerrar el Tramo 2. La
  compuerta se corrió y se midió el 4 de
  agosto —el cuerpo de cada respuesta, no el código de estado— y quedó escrita
  arriba con sus tres resultados.
- **Nota de conteo, para que el registro sea exacto:** este cierre se pidió con
  «once piezas». Son **diez** — de `1.a` a `1.j`, sin hueco. La numeración salta
  a la vista porque `1.h` está escrita al final de la tabla, después de `1.i` y
  `1.j`, por el orden en que se abrió.
- **Lo que queda abierto del candado tiene nombre y una consecuencia medida.**
  `canAccessPlant` no la llama nadie y no tiene rama para `plant_group`, así que
  **la regla del campus de la ficha §2.2 y §2.3 no está implementada en la
  guardia** — vive solo en el filtro de presentación de 1.d. Hoy eso no expone a
  nadie: un usuario de planta ve **de menos**, no de más.
- **Regla 8 de «las ganadas por las malas», salida del #229:** una defensa que
  ninguna prueba distingue de su ausencia no cuenta como defensa. Es el mismo
  criterio que ya aplicábamos a la pared entre carriers —por construcción, no
  por disciplina repetida— dicho ahora del lado de las pruebas.
- **Y el caso que la produjo, porque es de los que se ven correctos y no lo
  son:** `new URL("/..//evil.com", centinela)` **conserva el origen** y devuelve
  un `pathname` que el navegador lee como externo. La comprobación razonable
  pasa y el resultado es un redirector abierto.

- **El carrier queda encuadrado como producto, no como anexo.** Entra a §2 «De
  producto» y gana fila propia en el Tramo 7. Las dos caras no son simétricas:
  para el carrier sus unidades son una sola operación, así que ve todo su
  universo sin partir por contrato. De ahí sale la consecuencia para las
  guardias — el alcance se resuelve contra su universo, no contra el contrato
  por el que llegó — y el encuadre de v1: **lo que entra son los cimientos**, y
  la suite completa vive en `DESPUES.md`.
