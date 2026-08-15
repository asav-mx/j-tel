Ficha — El esqueleto de navegación
Documento de diseño subordinado al Marco Maestro. El Marco manda; esta ficha acomoda.

Qué define esta ficha
Cómo se navega todo el sistema: qué tipos de pantalla existen, cómo se llega a cada cosa, y qué concepto de agrupación gobierna. No define apariencia (colores, tipografía, componentes): eso es la piel, que se viste encima de este esqueleto y se decide aparte.


A. Los dos planos
Todo el sistema tiene exactamente dos tipos de pantalla. No hay un tercero.

Plano 1 — Las vistas. Las entradas del menú. Son preguntas respondidas: pantallas que juntan información de muchas cosas para contestar una sola pregunta que el usuario trae en la cabeza al abrir. No son dueñas de nada; solo acomodan y ligan.

Plano 2 — Los expedientes. Cada sustantivo del sistema con identidad propia es un lugar al que se puede ir. Cada unidad, cada chofer, cada servicio, cada ocurrencia tiene su página con dirección estable.

La regla que amarra los dos planos: todo sustantivo que aparezca en pantalla es liga hacia su expediente. Nunca hay un nombre muerto. Se navega por las cosas mismas, brincando de una a otra por sus relaciones; las migas de pan registran el descenso.

Consecuencia deliberada: los "módulos" desaparecen como concepto. No existe "el módulo de unidades" con su tabla adentro. Cuando se dude dónde va algo nuevo, la pregunta es binaria: ¿es una pregunta que alguien trae? → vista. ¿Es una cosa con identidad e historia? → expediente. Todo lo demás es una liga o una foja.


B. Las vistas por cara
Cada entrada se nombra por la pregunta que responde, jamás por un objeto de la base de datos. No hay pestaña "Rutas" ni "Unidades": esos sustantivos aparecen dentro de las vistas, al servicio de la pregunta.

Carrier — cinco entradas:
Hoy — ¿cómo va mi operación ahorita? (operación viva + avisos preventivos)
Flota — ¿qué hacen mis unidades? (telemetría base: historial, kilómetros, velocidades, geocercas propias)
Cuenta — ¿cuánto me deben y por qué? (estado de cuenta + justificaciones)
Expediente — ¿estoy en regla? (documentos, vencimientos, inspecciones)
Taller — ¿cómo mejoro mis rutas? (el sandbox de planeación)

Cliente / planta — tres entradas:
Hoy — ¿llegó mi gente? (seguimiento del día + lo que pide decisión)
Cuenta — ¿qué voy a pagar y por qué? (su lado del estado de cuenta)
Expediente — ¿mi transportista está en regla? (el espejo; su cobertura legal)

Cliente / corporativo — una entrada:
Panorama — ¿cómo comparan mis plantas? (agregado; comparar, no operar)

Pasajero — una pregunta: ¿alcanzo el camión?

Operador de la plataforma — todo, más el razonamiento completo.

Nota sobre la vista "Expediente": es una vista, no un expediente. Responde "¿estoy en regla?" juntando las fojas documentales de todos los expedientes de unidades y choferes de la cuenta, ordenadas por vencimiento. La palabra significa lo mismo en ambos planos; la vista es el atajo que enseña lo que está por vencer en todos ellos.

Nota sobre lo preventivo: los avisos no son un lugar. Llegan a "Hoy" y por los canales; cada aviso es un dedo que señala hacia un expediente. Lo preventivo que obliga a ir a buscarlo ya llegó tarde.


C. La anatomía del expediente
Todo expediente, sin importar de qué cosa sea, tiene la misma forma:

Identidad — qué es y sus valores actuales.
Historial — todo lo que le ha pasado, en orden. Solo se agrega; nada se arranca. (Espejo directo de la ley: los hechos se sellan y el pasado no se reescribe.)
Relaciones — con qué otros expedientes se conecta, como ligas vivas.
Evidencia — los hechos sellados y documentos que lo respaldan.

Un solo expediente por cosa. No hay "versión planta" y "versión carrier": hay uno, y las reglas de visibilidad de la Pieza 2 deciden qué fojas ve cada cara. Una sola verdad, muchas lecturas.

Dirección estable. Cada expediente tiene URL fija. Esto es prerequisito del copiloto futuro: señalar "míralo aquí" exige un "aquí" al que apuntar.


D. La regla que separa expediente de foja
Expediente es lo que vive en el tiempo y acumula historia.
Foja es lo que ocurre una vez y queda congelado dentro del historial de otro.
Excepción deliberada: también es expediente aquello a lo que un aviso necesita apuntar con dirección estable, aunque sea un evento. Por eso la ocurrencia califica.


E. La clasificación de los sustantivos del Marco

Expedientes de primera clase:
Unidad — dispositivos que ha traído, servicios ejecutados, inspecciones, mantenimiento, documentos con vencimiento.
Dispositivo (GPS) — separado de la unidad por ley. Sus asignaciones, su salud de emisión, su historial.
Chofer — con el espacio reservado para la identidad rica que llegará después; no bloquea nada.
Contrato — la raíz de negocio: políticas con vigencia (cambios hacia adelante), sus servicios.
Servicio — la identidad recurrente ruta×turno en una planta (el "perfil" del Marco). Genera ocurrencias.
Ocurrencia — el átomo: el servicio de una fecha, con su hecho, su evidencia, su justificación.
Geocerca — dueño, rol, y fronteras que cambian con el tiempo.
Planta — y su contraparte, el carrier visto desde la planta.
Grupo de plantas / campus — expediente ligero: existe y tiene página porque un servicio compartido produce un hecho visible para sus plantas, pero es delgado.

Fojas (viven dentro de un expediente; no se navega "a" ellas):
El hecho sellado — foja de la ocurrencia.
La justificación — foja adjunta al hecho, con su evidencia.
La evidencia GPS — foja de la ocurrencia.
La inspección — foja de la unidad, con su acta y sus fotos.
Cada documento (póliza, licencia, examen, capacitación) — foja de la unidad o del chofer, con su vencimiento.
La asignación dispositivo—unidad — foja en ambos expedientes.
El turno y la política — fojas del contrato.
Cada versión de trazado (KML) — foja del servicio; los hechos pasados quedan atados a su versión.
Los avisos — señaladores hacia expedientes; pueden quedar como foja en el historial de aquello que señalaron.

No son ninguna de las dos:
La cuenta — es la casa donde todo vive, no una página dentro de ella.
Las entradas del menú — son el Plano 1.


F. El concepto que se retira
"La ruta" deja de ser cosa navegable. El Marco establece que la misma ruta puede existir en varios turnos y que el trazado pertenece a la combinación ruta×turno. Por lo tanto "Ruta Norte" a secas es un nombre compartido por servicios distintos, no una identidad. El expediente se llama Servicio (ruta×turno); "ruta" queda como apellido: se busca por ella, se agrupa por ella, no se navega a ella.


G. Validación contra el Marco
Esta ficha no toca ninguna ley; las hereda:
El historial de solo-agregar es la forma navegable de "la verdad se calcula una vez y se guarda".
Un expediente por cosa con visibilidad por cara es "cada quien lee su parte del mismo hecho".
El expediente del dispositivo separado del de la unidad es "el GPS es un dispositivo, no la unidad".
El servicio como ruta×turno es "ruta y turno son variables separadas; el KML pertenece a la combinación".
Las direcciones estables son el prerequisito del copiloto anotado en la Pieza 5.


Qué sigue de esta ficha (no es parte de ella)
Una ficha de pantalla por cada vista, usando el molde de siete preguntas: la pregunta del usuario, lo primero que ve, el descenso, las acciones, lo que NO está, los estados feos, y la ley que la gobierna. La primera será Cuenta del carrier y define el molde. Al final, la tabla de reacomodo: cada página actual con su destino (se queda, se funde, se retira).
