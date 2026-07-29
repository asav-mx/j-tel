# Correcciones de datos, generadas y guardadas

SQL producido por `corregir-deadlines --sql` y **corrido a mano en la consola de
Neon**. Vive en el repositorio por dos razones:

1. Quien tiene permiso de escritura sobre la base trabaja desde la consola, no
   desde una terminal con el proyecto instalado. El archivo es la forma de que
   le llegue.
2. Es el **registro exacto** de qué se cambió. Un `UPDATE` corrido en una
   consola y no guardado en ningún lado es una edición sin expediente.

## Cómo se corre

Se abre el archivo, se copia entero y se pega en la consola de Neon. Va dentro
de una transacción y **termina en `COMMIT;` con una verificación antes**: el
paso 3 devuelve `descuadradas`, que **tiene que ser 0**. Si no lo es, se corre
`ROLLBACK;` en vez del `COMMIT;` y no pasó nada.

## Por qué se puede pegar tarde sin miedo

Las guardas viajan **dentro del `WHERE`**, no solo en el plan que las calculó:
deadline todavía en el futuro, sin hecho sellado, viaje en `en_espera`, sin
puntos de evidencia anclados. Una ocurrencia que se selló entre que se generó
el archivo y que alguien lo corrió simplemente **no coincide y no se toca** —
los conteos salen más bajos, y eso es información, no una falla.

## Los archivos

| Archivo | Qué corrige | Estado |
|---|---|---|
| `2026-07-28-deadlines-zona.sql` | 843 ocurrencias futuras con el deadline corrido +360 min por el bug de zona, y la ventana de evidencia de sus 843 viajes | Generado y validado contra producción con el rol de solo lectura; **pendiente de correr** |

Las **40 con deriva de −5 min** del Campus **no van aquí**: son otra causa
—configuración vieja, no el bug— y salen con `--con-deriva` en su propio
archivo, para que las dos correcciones no se mezclen en un solo `COMMIT`.
