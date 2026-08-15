Acta — Cierre de Bloque C (Tramo 3)
Documento de decisión. Define qué significa terminar Bloque C, qué trabajo queda, qué se recorta y por qué. Subordinado al Marco Maestro.

Fecha de decisión: 15 de agosto de 2026.
Base: reporte de estado verificado contra repo y producción (solo lectura) del mismo día.


A. La regla que gobierna este documento y todos los que sigan
Ningún bloque se abre sin línea de meta escrita. Nada entra a un bloque a medio camino: lo que aparezca durante el trabajo se anota en DESPUES.md y se decide en la frontera entre bloques. Un bloque sin criterio de terminado no se termina nunca.


B. La línea de meta de Bloque C
Bloque C existe por una razón: el motor produjo 397 acusaciones de incumplimiento que no se sostenían con la evidencia observada. Por lo tanto:

Bloque C está cerrado cuando:
1. El motor ya no puede producir una acusación sin unidad atribuida detrás (la separación atribución/cumplimiento gobierna los veredictos nuevos).
2. La clase de error que produjo la mayoría de las 397 está eliminada hacia adelante (C25).
3. La compuerta de aviso está probada de verdad: el resumen llega a una bandeja humana y sus conteos son conteos medidos, no ceros por falla.

Nada más pertenece al cierre. Todo lo demás es afinación y vive en DESPUÉS.


C. El trabajo restante, en orden

1. C21 — probar la compuerta.
   Primera mitad: cumplida. El 15 de agosto Asav vio llegar el resumen diario a su bandeja (corrida de las 07:00, resumen del día anterior). La plomería —cron, plantilla, envío, entrega— funciona de punta a punta.
   Segunda mitad: pendiente. El mismo correo reporta un chequeo fuera de umbral: no pudo contar los servicios vencidos sin veredicto. Por lo tanto el "0 servicios sin veredicto" del encabezado no es un cero medido: es un cero que puede significar "ninguno" o "no pude contar". Esa es la clase de error que este proyecto ya tiene nombrada: correcto como conteo, falso como afirmación.
   C21 cierra cuando el chequeo cuente de verdad y el resumen distinga en pantalla un cero medido de un dato no disponible. Una compuerta que no puede contar no está probada, y un aviso que presenta un no-dato como un cero es peor que no avisar.

2. Corrección de backlog — hecha. (PR #323, abierto para revisión de Asav.)
   DESPUES.md afirmaba que la migración de la columna borrada "falta aplicarla a producción". Está aplicada y verificada, y la entrada ya lo dice, con el límite de esa comprobación escrito al lado: se comprobó el efecto, no la ejecución. El rótulo "sin aplicar" de la 0021 no estaba en DESPUES.md — vive en el título del commit #296 y en una entrada fechada de bitácora de PLAN.md que ya se corrige a sí misma más abajo, y una bitácora fechada no se reescribe. Un backlog que miente enseña a ignorar el backlog; se corrigió antes de que envenenara otra decisión.

3. Pasos 3 y 4 — la separación gobierna. (Decisión: GO.)
   La instrumentación existe y corre en producción con gobierna: false. El bloqueo del 13 de agosto (cero rankings sellados, nada contra qué medir) se levantó: hay 82 entradas de ledger con ranking y los hechos nuevos cargan sus dos fotos. Se construye:
   - Un término por PR — la regla del nudo se mantiene.
   - Paso 3 primero; se mide su efecto contra los rankings ya sellados antes de que el paso 4 entre.
   - Paso 4 después, con efecto esperado concentrado en el Campus (Planta 47 ya corre en destino_only); esa concentración se verifica, no se asume.
   - El principio que gobierna la forma (de la Pieza 1 y de este tramo): una acusación requiere unidad atribuida. Donde la atribución no se sostenga, el veredicto es pendiente de evidencia, jamás incumplido.
   - Los hechos ya sellados no se tocan. La separación gobierna hacia adelante.

4. C25 — la Ley 1 evadida por grano. (Última pieza de construcción.)
   Es la de mayor rendimiento: sola elimina 372 de las 397 hacia adelante. No tiene ficha; la ficha se escribe antes de construir, con el mismo formato de las demás. Entra después de que el paso 3 esté medido, para no revolver dos efectos en la misma ventana de medición.

Dimensionamiento honesto: el motor sella 48 servicios por día, no 90 como estimó el plan. Toda ventana de "medir antes y después" se calcula con 48.


D. Lo que se recorta de Bloque C y por qué
Se van a DESPUES.md, con esta acta como referencia. Ninguno es necesario para que las acusaciones falsas dejen de producirse:

- C14 (routeStrictness, la puerta sin salida) — endurecimiento de configuración; no produce acusaciones falsas hoy. Tiene ficha; espera su turno.
- C22 (evidencia duplicada sin candado) — robustez; los sensores ya la detectan.
- C16 (divergencia del corredor del Campus: pactado 60%, corre 50%) — la divergencia es hacia la lenidad; no acusa a nadie en falso. La regla del Marco ya contesta qué hacer cuando se corrija: la política cambia hacia adelante y lo sellado no se reescribe. Queda pendiente únicamente decidir el cuándo, junto al cliente.
- C26 (las dos defensas que no coinciden en qué cuenta como cambio) — inconsistencia interna a documentar y alinear; no mueve veredictos.
- C5 (afinar la ventana derivada) — ya estaba en "ola 2"; ahí sigue.
- Las tres rutas con falla real (~43 servicios) — pide ojo humano sobre el KML, ningún cambio de motor. Es tarea de datos, no de bloque.

Nota de registro: la entrada "compuerta de densidad de observación — diseño aprobado, sin construir" de DESPUES.md estaba desactualizada; el piso quedó en 60 segundos y el paso 1 ya lo mide y congela. Corregida en el mismo PR de backlog (#323).


E. Qué sigue después del cierre (la frontera ya decidida)
Para que nadie improvise el siguiente frente cuando Bloque C cierre, el orden ya está decidido y viene de las decisiones de suite del 15 de agosto:

1. Las fichas de pantalla del esqueleto de navegación, una por una, empezando por Cuenta del carrier — que define el molde de siete preguntas. El esqueleto ya es ley de diseño (ficha en docs/, PR #322).
2. La independencia de GPS (Fierro/Servidor/Repo), que paga doble: libera del proveedor actual y regala la telemetría base del carrier (el cuarto "Flota" de la suite).
3. La piel, al final, vistiendo un esqueleto firme — empezando por la frase del sentimiento.

Las dos historias nuevas (contract_policy_history y shift_history, hoy en cero filas) verán su primera escritura real cuando alguna política o turno cambie de verdad; no se fuerzan.


F. Reglas de trabajo vigentes (recordatorio)
- Un término por PR en el nudo del motor.
- Una rama por tarea; todo entra por PR; Asav revisa Files Changed y mergea.
- Un frente toca main a la vez.
- Los hechos sellados no se reescriben jamás; toda corrección es hacia adelante.
- Las decisiones de producto se toman en el chat de estrategia y se validan contra el Marco antes de construir.
