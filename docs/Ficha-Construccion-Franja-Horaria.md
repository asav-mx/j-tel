# Ficha de construcción · La promesa por franja horaria (Marco 9.1c)

**Qué es.** El eslabón 1 de la cadena del arranque. Hoy la promesa de un circuito es **un solo número para todo el día** —`circuits.declared_frequency_minutes`— y el Marco dice otra cosa desde el 19-sep: la tabla publicada puede prometer frecuencias distintas por franja («cada 10 min de 6 a 9; cada 20 el resto del día»), y **lo medido se compara contra la promesa vigente de esa franja, nunca contra un promedio del día** (9.1c). Juzgar la hora pico con la tabla del valle es la afirmación falsa del alcance (Marco §D).

**Por qué antes del 22 de septiembre.** Sin esto, los dos días de prueba miden contra nada: el detector de pasos del eslabón 2 necesita una promesa contra la cual calcular adelanto y atraso, y la app del pasajero necesita una tabla que publicar (8.2).

**Proceso:** rama propia. Plan antes de código; lo que choque con el repo se reporta, no se acomoda. Migración en Neon antes del merge. Checks verdes no son aprobación. **El merge es de Asav** — esto es base de datos.

---

## 1 · Lo que ya existe, medido contra `origin/main`

- `circuits.declared_frequency_minutes` — **nullable desde la 0031**, y ese `null` es una decisión ganada: «sin declarar» es la respuesta honesta cuando el concesionario no dio la cadencia, y la app sabe decir que hay servicio sin prometer minutos. **Nada de lo que sigue puede quitar esa respuesta.**
- `circuits.service_start_local` / `service_end_local` / `time_zone` — el horario de apertura diaria, uno solo, que hoy **se sobrescribe al editarlo**. Es un pendiente con nombre del plan vigente («la historia del horario de servicio de los circuitos»), y es exactamente el defecto que esta tabla no debe heredar.
- La forma de versionar que ya usa la casa: `circuit_stop_versions` (una vigente por parada, con candado en la base), la política del contrato, las variantes de trazado. **Cambiar no sobrescribe: cierra la vigente y abre la nueva.**

## 2 · La forma propuesta

Una tabla nueva, aditiva, que **no toca `declared_frequency_minutes`**: el número suelto se queda como la promesa de respaldo del circuito, y la franja manda cuando existe.

```
circuit_promise_bands
  id
  circuit_id          → circuits(id) ON DELETE CASCADE
  sentido             sentido_circuito NULL  -- NULL = promete igual en los dos
  dias                (ver decisión B)
  desde_local         TIME NOT NULL
  hasta_local         TIME NOT NULL
  frequency_minutes   INTEGER NOT NULL CHECK (> 0)
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT now()
  valid_to            TIMESTAMPTZ
  motivo              TEXT
```

Y la regla de lectura, que es la mitad del punto: **para juzgar un paso se busca la franja vigente en el instante del paso**, no la vigente hoy. Un paso de hace tres semanas se juzga contra lo que se prometía hace tres semanas. Es la misma ley que la ventana congelada.

## 3 · Las tres decisiones que esta ficha NO toma sola

**A · ¿Se versiona la franja, o la tabla entera?** Una tabla de franjas es un **conjunto** («6–9 cada 10; 9–22 cada 20»). Si cada renglón lleva su propia vigencia, una corrección a medias deja un conjunto incoherente —dos franjas encimadas, o un hueco a las 9 de la mañana— y la base no lo puede impedir renglón por renglón.

- *Propuesta:* versionar **el conjunto**: una tabla `circuit_promise_tables` con su vigencia, y las franjas colgando de ella. Cambiar la promesa cierra la tabla vigente y abre otra completa. Más filas, pero «la promesa del 12 de octubre» nunca es ambigua, y el candado de «una vigente por circuito» lo puede sostener la base como ya lo hace con las paradas.
- *Costo:* editar una franja obliga a reescribir el conjunto. En una pantalla eso se ve natural — se edita la tabla, se guarda la tabla.

**B · ¿La promesa distingue días?** Un sábado no tiene la frecuencia de un martes, y un domingo menos. Hoy el circuito no distingue día ninguno.

- *Propuesta:* un campo de tipo de día con tres valores —`entre_semana · sabado · domingo`— y no siete. Siete días son siete tablas que nadie va a capturar; tres son las que un concesionario de Juárez sí sabe contestar. **Los días festivos no entran**: son un calendario, y un calendario es otra pieza.
- *Alternativa si Asav lo prefiere más flaco para el 22:* arrancar sin días, con una sola tabla que vale todos los días, y agregar el tipo de día después. La migración aditiva lo permite; el riesgo es medir el sábado contra la promesa del martes durante el arranque.

**C · ¿Qué hace la franja con el horario de servicio que ya existe?** `service_start_local`/`service_end_local` dicen cuándo abre el circuito; las franjas dicen cada cuánto pasa dentro de ese horario. Se pueden contradecir: una franja de 5 a 7 en un circuito que abre a las 6.

- *Propuesta:* la base **no** las cruza; la pantalla avisa al guardar («esta franja empieza antes de que el circuito abra») y deja guardar. Prohibirlo en la base obliga a un orden de captura que nadie adivina.

## 4 · Lo que esta ficha NO construye

- **La historia del horario de servicio del circuito.** Es el pendiente con nombre, y es otro frente: si se arregla de pasada aquí, se arregla a medias.
- **La tabla publicada en la app del pasajero** (8.2). Esta ficha deja el dato; publicarlo es el eslabón 3.
- **Comparar lo medido contra la franja.** Eso es el eslabón 2, y necesita el detector.

## 5 · Pruebas mínimas

1. Un circuito sin franjas sigue contestando «sin declarar» donde hoy contesta eso: la 0031 no se deshace.
2. Guardar una promesa nueva **no borra la anterior**: quedan las dos, una con `valid_to` y una vigente, y el candado impide dos vigentes.
3. Buscar la promesa de un instante pasado devuelve la que valía entonces, no la de hoy.
4. Franjas encimadas o con hueco: la pantalla lo dice antes de guardar (y la prueba comprueba el aviso, no sólo el guardado).
