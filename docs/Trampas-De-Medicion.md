# Trampas de medición

**Qué es.** Trece lecciones de método, cada una con el caso que la enseñó. Son para
cualquiera que vaya a decidir algo contra un número medido: una columna, un
hallazgo, una consulta, una cifra en pantalla.

**De dónde salen.** Vivían dentro del skill `j-telemetry-ui`, en su sección
«Trampas de medición», y **sólo ahí**. El skill se borró el 15 de septiembre de
2026 porque la piel y el lenguaje viejos se rehacen, no se reforman (#407). Estas
lecciones no son piel: compartían archivo con ella. Se rescatan aquí, **tal cual**,
antes de borrarlo. Es lo mismo que casi pasa con las secciones D, E y F del Marco.

**Qué gobierna.** Nada visual. El skill nuevo, cuando exista, gobierna las
pantallas; esto gobierna cómo se mide lo que se va a decidir. Si algo de aquí choca
con el `Marco-Limpio-J-Telemetry-MAESTRO.md`, gana el Marco.

**Único cambio respecto del original:** el nombre de la ficha de datos no
declarados es ahora un enlace a donde vive.

La versión original sigue en la historia:
`git show fe3b36d:.claude/skills/j-telemetry-ui/SKILL.md`.

---


Muchas decisiones de este producto se toman contra un número medido: si una columna se muestra, si un hallazgo es real, si una consulta se sostiene. **Un número mal medido decide igual de fuerte que uno bien medido**, y no se nota. Estas son las que ya cayeron, con el caso que las enseñó.

**Medir sobre un entorno que uno mismo pisó.** Correr `pnpm build` con el servidor de desarrollo vivo sobrescribe `.next`, y lo que se mide después no es la aplicación: es el servidor recompilando encima de sus propios archivos rotos. Sobre esa medición se quitaron columnas de producto.

Y la parte que importa más: al rehacerla con servidor limpio, el número se sostuvo. **Eso no valida la primera.** Una medición contaminada que por casualidad coincide con la buena sigue sin ser evidencia — la conclusión sobrevivió, el método no. Se dice así, no como "ya lo confirmé".

**Culpar a la forma de pedir el dato cuando el costo está en el volumen.** Treinta ventanas de un día costaron lo mismo que una ventana de treinta: el trabajo era recorrer un mes de puntos por unidad, y ninguna forma de pedirlo lo cambia. Antes de rediseñar la llamada, medir la versión colapsada. Si cuesta igual, el problema es cuánto se lee, no cómo se pide.

**Medir con una fuente que el motor no usa.** El árbitro lee `evidence_points` por viaje; `telemetry_points` es otro archivo, con otra cobertura. Un cruce armado sobre el segundo responde una pregunta que nadie hizo. Antes de cruzar: buscar en el código qué lee el motor, no qué tabla suena parecido.

**Publicar un instrumento sin probarlo contra casos conocidos.** Antes de usar una prueba propia —una geometría, un cruce, una heurística— pásala por los hechos que el motor **ya selló** y cuya respuesta se conoce. Si no reproduce lo que el árbitro ya decidió, el instrumento está mal y todo lo cruzado con él también. El caso: una prueba de punto-en-polígono que reprodujo 51 de 60 llegadas selladas; las 9 que falló apuntaban todas a la misma geocerca, y ahí estaba el error.

**Creerle al nombre de una columna.** Un campo llamado `expected_geofence_id`, congelado dentro de un hecho sellado, se lee como la geocerca que el árbitro aplicó. No lo es: el motor juzga contra la geocerca **viva** del perfil y guarda ese campo por separado. Sobre esa suposición se escribió una ficha entera —"333 servicios acusados contra el destino equivocado"— y era falsa.

La lección es más fina que la anterior y por eso duele más: **el instrumento geométrico sí se había validado contra hechos sellados. Lo que no se validó fue la interpretación del campo.** Validar la medición no valida lo que se cree que la medición significa.

Cómo se atrapa: **buscar en el código quién LEE la columna**, no solo quién la escribe. Si nadie la lee, no describe nada. Y cuando el dato guardado se puede contrastar contra un hecho físico —una llegada tiene coordenadas— se contrasta antes de escribir la conclusión. Aquí bastaba probar 24 llegadas selladas contra los dos polígonos: **cero cayeron en la geocerca que el campo nombraba.**

**Contar filas que son reintentos.** Un servicio re-verificado deja varias entradas de ledger. Contar entradas en vez de servicios multiplicó por ocho el tamaño aparente de un hallazgo. Deduplicar por la cosa de la que se habla, no por la fila que la registra.

**Medir sobre datos que nadie declaró.** Datos sembrados tienen forma de datos, y un hallazgo construido sobre ellos describe la siembra, no el producto. Antes de medir: declarar de quién es cada fila y qué cuentas son de demostración. Ver [`Ficha-Diagnostico-Datos-No-Declarados`](marco-limpio/Ficha-Diagnostico-Datos-No-Declarados.md).

**Un vigilante que no ejerce el camino que puede romperse.** `/api/salud` devolvió 200 durante toda una caída de la cara cliente. No por casualidad: leía cuentas, marcas de agua y alertas **con listas explícitas de columnas**, y una lista explícita no se entera de que falte una columna que no nombra. Las pantallas usan la API relacional, que pide todas las columnas de la tabla, y ahí es donde reventaba.

**Un vigilante que no puede ver la falla es peor que no tener vigilante: da tranquilidad falsa.** La regla que queda: un sondeo de salud ejerce **la misma consulta** que sirve a las pantallas, no una parecida. Y como toda valla, no cuenta hasta **verla fallar** — se reproduce el estado roto contra la base desechable y se comprueba que se pone roja. Una puerta que nadie vio fallar es una suposición con nombre de garantía.

**Medir mal un algoritmo correcto produce evidencia falsa contra el algoritmo.** Douglas-Peucker garantiza, por construcción, que ningún punto quede a más de la tolerancia de la línea simplificada. La medición dio **102 m para una tolerancia de 8 m**, y el número se iba a publicar como "desvío máximo" de un instrumento de defensa. El algoritmo estaba bien: el medidor muestreaba cada segmento en cinco puntos en vez de calcular la perpendicular real, así que medía a un punto cualquiera de la recta y no al más cercano. Corregido, el desvío da exactamente la tolerancia.

La regla que queda: **cuando lo medido contradice una garantía del algoritmo, el sospechoso es el medidor, no el algoritmo.** Una garantía por construcción no se refuta con una corrida — se refuta con una demostración. Y la trampa es doblemente peligrosa porque el número falso era plausible y conservador: nadie discute un desvío que suena grande, y sobre él se habría decidido que la simplificación no servía.

**Ordenar por fecha sin techo devuelve el futuro. Ya pasó dos veces.** El generador crea ocurrencias por adelantado, así que cualquier consulta que ordena por `serviceDate` descendente y no acota a hoy trae servicios que todavía no ocurren. La primera vez costó una investigación entera: 1 056 ocurrencias "sin hecho" que eran de agosto y septiembre. La segunda salió en una tabla llamada **"últimos servicios" encabezada por el 1 de septiembre**, todos sin sellar, y se atrapó mirando las fechas contra el calendario — no compilando.

El patrón es siempre el mismo y por eso conviene reconocerlo de lejos: **correcto como consulta, falso como afirmación.** La consulta hizo exactamente lo que se le pidió; lo que miente es el título encima. Regla: toda consulta sobre ocurrencias lleva techo, y el techo lleva su porqué escrito al lado, para que nadie lo quite pensando que sobra.

**El fallo silencioso que devuelve de menos.** Una consulta agregada nueva reventó en el primer intento porque el controlador HTTP no sabe enlazar un `Date` en SQL crudo, y se atrapó porque la pantalla dio 500. Ese fue el modo de falla afortunado.

El mismo error puede fallar del otro lado: un `timestamptz` mal enlazado que se interpreta como un instante distinto no revienta — **filtra de más y devuelve de menos.** Entonces no hay 500 que mirar, solo una gráfica de huecos de señal con menos huecos de los que hubo, dibujada con todos los tokens correctos y perfectamente legible.

**En una pantalla de evidencia, el fallo silencioso que devuelve de menos es peor que el que revienta, porque se ve normal.** Un error visible cuesta una hora; un archivo incompleto que parece completo se defiende en una disputa. La regla que queda: cuando una consulta nueva acota por tiempo, se comprueba contra un total conocido —cuántas filas hay sin el filtro, cuántas con él— antes de creerle al número. Y si el resultado se puede contar por otro camino, se cuenta.

**El denominador de otro universo.** Si el numerador cuenta servicios contratados y el denominador cuenta la flota entera, la fracción no habla de nada. Es §D, eje del ALCANCE, y en una cifra se ve limpia: "45 de 82 unidades no cubrieron ningún servicio" era cierta en los dos números y falsa como afirmación. Cuando los dos lados vienen de universos distintos, o se cambia el denominador o se declara el alcance junto al número.

**Un conteo que el lector no puede reconstruir con lo que le enseñas debajo.** "Rutas del alcance: 27" era correcto —veintisiete registros de ruta— y no cuadraba, porque en la tabla de abajo "Finca" salía dos veces y "Km 30" tres: son rutas distintas, con trazados distintos, que comparten nombre visible. Quien lee cuenta nombres y concluye que el sistema duplica o que el conteo miente. Es §D, eje de la UNIDAD.

El arreglo no es deduplicar por nombre —eso borra rutas reales y da un número más bonito y más falso—: es contar en la unidad que las partes reconocen. Un contrato se contrata en **servicios al día**, y las rutas y turnos pasan a lectura al lado. La pregunta, antes de escribir el rótulo: **¿puede el lector reconstruir este número con lo que le voy a enseñar debajo?**
