Ficha de conceptos — La frontera después de Bloque C
Documento de captura. No autoriza construcción. Se decide en la frontera entre bloques, conforme a la regla A del Acta de Cierre de Bloque C.

Fecha: 15 de agosto de 2026.


Por qué existe esta ficha
Tres conceptos aparecieron durante Bloque C. Ninguno entra al bloque: la regla dice que lo que aparece a medio camino se anota y se decide en la frontera. Se capturan aquí completos para que no se pierdan ni se cuelen.

Los tres cayeron dentro del esqueleto de navegación sin forzarlo: dos sustantivos nuevos y un tipo de foja. Eso es evidencia de que el esqueleto era la arquitectura correcta.


A. La salida — el hueco más grande
El motor verifica la entrada. No verifica la salida. Los contratos pagan los dos sentidos, y uno de los contratos analizados trae tablas explícitas de hora de salida de sitio por turno.

Consecuencia hoy: el estado de cuenta solo puede opinar sobre la mitad de los viajes facturables.

Por qué no es "la entrada al revés". Son preguntas de forma distinta:
- Entrada: la unidad debe estar en el destino antes de un deadline. Destino único, geocerca clara, veredicto limpio.
- Salida: lo que importa es que la unidad estuviera en la planta a la hora de salida para llevarse a la gente. El destino final es difuso (muchas casas, dispersas), así que el hecho verificable se parece más a una presencia en origen a tiempo que a una llegada a destino.

Por lo tanto es una pregunta nueva para el árbitro, no una perilla de configuración.

Recomendación: candidato natural a ser el siguiente bloque de motor una vez cerrado Bloque C. Con su línea de meta escrita antes de abrirse, como ya es ley.

Preguntas abiertas: qué constituye cumplimiento de salida (presencia en geocerca de planta dentro de una ventana previa a la hora de salida, probablemente); si la salida genera su propia ocurrencia o si entrada y salida son dos hechos de una misma jornada; cómo se factura hoy en los contratos vigentes.


B. La solicitud — transporte temporal, único o especial
Lo que falta: no hay proceso para asignar rutas temporales, únicas o especiales. Casos reales:
- Tiempo extra: rutas armadas con personas de distintos turnos, distintas cada vez. Un contrato analizado estima decenas de viajes de tiempo extra por semana.
- Transporte especial: ejecutivos, visitas, casos puntuales.
- Rutas ad-hoc que el cliente pide con pocas horas de anticipación.

La forma, dentro del Marco actual: una ocurrencia nace de un perfil. Lo que falta es que un perfil pueda ser de una sola vez, nacido de una solicitud.

Sustantivo nuevo: la solicitud. Es el trámite, no el servicio: quién la pidió, cuándo, para cuántas personas, con qué origen y destino, con qué anticipación. Al aprobarse produce su perfil temporal y su ocurrencia; de ahí en adelante el árbitro la trata igual que a cualquier otra.

Es expediente de primera clase: vive en el tiempo, tiene estados (pedida, aprobada, planeada, ejecutada), acumula historia.

Qué NO es: no es un motor nuevo de creación de rutas. Cuando la ruta hay que planearla, eso es el Taller de Rutas en modo exprés — el mismo Taller con una puerta de entrada más. No se construye un segundo planeador.

Preguntas abiertas: quién puede solicitar y quién aprueba; cómo se cotiza una ruta que no está en el tabulador del contrato; si la solicitud rechazada deja rastro (probablemente sí: es historia).


C. Las quejas — conversación como foja, no como sala de chat
Lo que falta: cada contrato necesita un espacio donde ambos lados hablen del mismo hecho. Hoy eso ocurre por teléfono y WhatsApp, sin dejar rastro que se pueda citar.

La tentación a evitar: construir salas de chat o "workspaces" por contrato. Ese camino termina en un mensajero corporativo mediocre y la conversación queda desligada de los hechos.

La forma correcta, que el esqueleto ya permite: la conversación vive en el expediente. Una queja es una foja adjunta al sustantivo que corresponda —la ocurrencia si la hay, o directamente la unidad o el chofer si no— y aparece en los historiales relacionados por relación, no por copia. Se registra una vez; la ven todos los que abran cualquiera de los expedientes ligados.

Ejemplo trabajado: el sello de la ocurrencia dice que llegó tarde, con su evidencia. Un pasajero se queja de que la unidad iba sucia. La queja se adjunta a esa ocurrencia; a partir de sus relaciones, aparece en el historial de la unidad, del chofer y del servicio. Un solo hecho registrado, tres lecturas.

Esto es la misma ley de siempre —una verdad, muchos lectores— aplicada a la conversación.

Preguntas abiertas: quién puede levantar una queja (¿el pasajero directamente?); si una queja tiene ciclo de vida propio (abierta, respondida, cerrada) o es solo una anotación; cómo se relaciona con la capa de justificaciones de la Pieza 5, que también es conversación adjunta a un hecho; qué ve cada cara.


D. Sobre el grafo
Pregunta que surgió: ¿hace falta una base de datos de grafo?

Respuesta: no. El esqueleto de navegación ya es un grafo — los expedientes son los nodos, la sección de relaciones de cada uno son las aristas, y navegar de unidad a chofer a servicio es caminar el grafo. Postgres sostiene esto sin problema con las relaciones que ya existen. Las bases de grafo se justifican en redes enormes con consultas de muchos brincos, no en este caso.

Lo que sí confirma la pregunta: los tres conceptos de esta ficha cayeron dentro del esqueleto sin deformarlo. Dos sustantivos nuevos (solicitud, y el hecho de salida por definir) y un tipo de foja (la queja). Ninguno pidió una estructura nueva.


E. Cómo se decide esta ficha
En la frontera, cuando Bloque C cierre, y en este orden de prioridad sugerido:
1. La salida — es el hueco que limita el producto hoy y toca el motor.
2. La solicitud — demanda contractual real, se apoya en piezas existentes.
3. Las quejas — valiosa, pero depende de que las fojas de conversación tengan forma definida.

Cada una necesita su propia línea de meta escrita antes de abrirse. Ninguna se empieza mientras otra esté a medias.
