Ficha de construcción — C21, la compuerta que sabe decir "no sé"
Documento de construcción. Subordinado al Marco Maestro y al Acta de Cierre de Bloque C.

Fecha: 15 de agosto de 2026.
Base: diagnóstico verificado contra repo y producción del mismo día.


A. El problema
El resumen diario del 15 de agosto llegó a la bandeja —la plomería funciona de punta a punta— pero reportó un chequeo fuera de umbral: "no se pudo contar los servicios vencidos sin veredicto".

Tres defectos distintos, no uno:

1. El conteo nunca se intenta. Existen dos armados paralelos de la misma muestra de salud: el de la pantalla, que sí pide el conteo, y el del correo, que no. Al agregarse el chequeo, solo se actualizó uno. No hay error de base, ni timeout, ni excepción tragada: falta la consulta. El comentario del armado del correo afirma que está hecho igual que el de la pantalla, y no lo está.

2. El canal de alertas no sabe decir "no sé". La medición que viaja al correo solo tiene dos estados posibles. "No pude medir" se pinta idéntico a "se rompió el umbral"; lo único que los separa son las palabras de la prosa, que no es estado.

3. Un rótulo cruzado. La escalera de etiquetas no tiene rama para este chequeo, así que cae al caso por omisión y se rotula con el nombre de otra población. El correo trae dos renglones con el mismo nombre: uno real y uno que es otra cosa.

Dato verificado en producción: hoy las poblaciones están en cero de verdad, así que el chequeo caído no está escondiendo nada. Pero no es el mismo cero: el del encabezado mira tres días atrás y solo contratos activos; el que falló no tiene ventana de días y usa otro umbral. En cuanto haya algo viejo, uno puede decir cero mientras el otro dice otra cosa.

Nota de causa raíz: el correo se reportó enfermo por no poder medirse, no por estar mal. El título tomó la rama de incidentes por esa razón.


B. Por qué esto importa más de lo que parece
Es la misma enfermedad que Bloque C vino a curar, ahora en el sistema de avisos: un no-dato presentado como si fuera un dato. El Marco ya lo resolvió para los veredictos con un tercer valor —pendiente de evidencia— precisamente para que la falta de evidencia jamás se confunda con una falta. El canal de alertas necesita su propio tercer valor por la misma razón.

Un aviso que presenta un no-dato como un cero es peor que no avisar: enseña a confiar en un número que no se midió.


C. La construcción — tres PRs, en este orden
Un defecto por PR. Cada uno se puede ver, medir y revertir por separado.

PR 1 — Que el conteo exista.
Fundir los dos armados de la muestra de salud en uno solo. El corte va donde el diagnóstico lo puso: la pieza común es armar la muestra y evaluarla; la envoltura HTTP de la ruta (sonda de esquema, respuesta, detalle de error según autenticación, códigos) se queda en la ruta y no se funde.
- El filtro manual de marcas del armado del correo es redundante: el repositorio ya filtra las cuentas de demostración. Se retira al fundir, con esa razón anotada.
- Los datos adicionales que hoy devuelve el armado del correo y que sus llamadores reutilizan se siguen devolviendo desde el armado común; eso no obliga a duplicar nada.
- Efecto declarado, no colateral: al fundir, el renglón pasa a decir la verdad y el correo cambia de estado sin que nadie haya tocado un umbral. Esto se anota en el PR y se verifica mirando el siguiente resumen diario.

PR 2 — Que el canal sepa decir "no sé".
Un tercer estado que viaje desde la evaluación de salud hasta la medición que se pinta: sano / enfermo / no medido. Sin esto, ninguna redacción arregla el problema — el correo no tiene cómo decirlo.
- "No medido" se pinta visualmente distinto de "fuera de umbral". Una violación y una ceguera no pueden verse igual.
- El título del correo no afirma un número cuando el conteo que lo respalda no está disponible.
- Este PR no cambia ningún umbral ni ninguna regla de salud: solo agrega el vocabulario que faltaba.

PR 3 — El rótulo y la valla.
- Agregar la rama de etiqueta que falta, para que el renglón deje de llevar el nombre de otra población.
- Una valla que impida que un chequeo nuevo herede el caso por omisión de la escalera en silencio. Esta es la corrección de fondo: el defecto de origen no fue una consulta olvidada, fue que el sistema permite olvidarla sin avisar.
- Cobertura de prueba del chequeo en el camino del correo, que hoy no existe.


D. Cuándo cierra C21
C21 cierra cuando:
1. El conteo se hace y su resultado es un número medido.
2. El correo distingue en pantalla un cero medido de un dato no disponible.
3. Cada renglón lleva el nombre de la población que reporta.
4. Un resumen diario posterior a los tres PRs llega a una bandeja humana y se lee coherente de arriba a abajo.

El punto 4 lo cierra Asav mirando el correo, igual que la primera mitad. Una compuerta no se da por probada porque el código compile.


E. Reglas que aplican
- Un defecto por PR; el orden importa y no se altera.
- Ningún hecho sellado se toca; esto es plomería de avisos, no motor de veredictos.
- Los umbrales de salud no se mueven en ninguno de los tres PRs. Si alguno pareciera necesitarlo, se detiene y se decide aparte.
- Asav revisa Files Changed y mergea.
