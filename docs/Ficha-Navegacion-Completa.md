Ficha — Navegación completa de J-Tel
Documento de diseño. Extiende Ficha-Esqueleto-Navegacion.md con la capa que faltaba: dónde vive cada acción. Subordinado al Marco Maestro.

Fecha: 17 de agosto de 2026.


Por qué existe
El esqueleto definió dos planos —vistas y expedientes— pero no dijo dónde se EJECUTA una acción. Sin esa regla, cada ficha de pantalla vuelve a decidir lo mismo y el sistema se dispersa otra vez con nombres nuevos. Esta ficha cierra ese hueco antes de que se escriba una sola ficha de pantalla.


A. LA LEY DE ACCIÓN
Una acción se ejecuta en un solo lugar: el expediente del sustantivo al que le pasa.

Las vistas ven, agrupan y ligan. No son dueñas de nada. No guardan nada.

Consecuencias, que no se negocian caso por caso:
· Nunca hay dos lugares donde hacer lo mismo.
· Una acción nueva no necesita decidir "en qué pantalla la pongo": va al expediente de su sustantivo.
· Las vistas quedan ligeras y rápidas; su trabajo es llevarte al lugar correcto.
· Quien audita revisa el historial de un expediente, no cinco pantallas.

Corolario: si una acción no tiene expediente donde vivir, falta un expediente — no sobra una vista.


B. LAS VISTAS (Plano 1)
Se nombran por la pregunta del usuario, nunca por un objeto. Ninguna guarda nada.

CARRIER — 5 entradas
  Hoy           ¿cómo va mi operación ahorita?
  Flota         ¿qué hacen mis unidades?
  Estado de cuenta  ¿cuánto me deben y por qué?
  Expediente    ¿estoy en regla?
  Taller        ¿cómo mejoro mis rutas?

CLIENTE / PLANTA — 3 entradas
  Hoy           ¿llegó mi gente?
  Estado de cuenta  ¿qué voy a pagar y por qué?
  Expediente    ¿mi transportista está en regla?

CLIENTE / CORPORATIVO — 1 entrada
  Panorama      ¿cómo comparan mis plantas?

PASAJERO — 1 pregunta: ¿alcanzo el camión? (producto informacional aparte)

OPERADOR DE PLATAFORMA — todo, más el ledger completo.

Filtro de periodo: presente en Estado de cuenta y en cualquier vista con rango.
Por omisión, la semana en curso desde el lunes. Rango libre disponible siempre.


C. LOS EXPEDIENTES Y SUS ACCIONES (Plano 2)
Cada expediente: Identidad · Historial (solo agrega) · Relaciones · Evidencia.
Aquí vive TODO lo que se hace. La columna de acciones es la parte nueva.

  EXPEDIENTE      ACCIONES QUE VIVEN AHÍ
  Ocurrencia      registrar justificación con su evidencia · levantar o
                  responder una queja · pedir re-verificación (J-Staff)
  Unidad          subir documento con vencimiento · registrar inspección
                  física con fotos · registrar mantenimiento · asignar o
                  retirar dispositivo · dar de alta/baja
  Dispositivo     asignar a unidad · marcar en reparación · dar de baja
  Chofer          subir licencia, examen médico, capacitación · asignar a
                  unidad · registrar incidente
  Servicio        editar trazado (nueva versión, hacia adelante) · cambiar
                  unidad asignada · suspender temporalmente
  Contrato        editar políticas (con vigencia, hacia adelante) · alta de
                  turnos · alta de servicios · adjuntar el contrato firmado
  Geocerca        editar frontera (nueva versión) · cambiar rol
  Planta          editar datos · gestionar contactos
  Solicitud       crear · aprobar o rechazar · planear ruta · convertir en
                  servicio (cuando exista; ver ficha de frontera)

Regla de historial: toda acción de esta tabla deja foja en el historial de su
expediente, con quién y cuándo. Nada se borra; se agrega la corrección.

Regla de vigencia: lo que cambia una regla (políticas, trazados, geocercas)
cambia hacia adelante y nunca reescribe hechos sellados.


D. DÓNDE SE VE VS. DÓNDE SE HACE
La tabla anti-redundancia. Si una función aparece en dos lugares, este es el
corte.

  FUNCIÓN                 SE VE EN                    SE HACE EN
  Justificar un retraso   Estado de cuenta (liga)     expediente de ocurrencia
  Documentos por vencer   vista Expediente (lista)    expediente de unidad/chofer
  Inspección GEMBA        vista Expediente (lista)    expediente de unidad
  Mapa en vivo            Hoy y Flota (lectura)       —(no es acción)
  Historial de recorrido  Flota (lectura)             —
  Avisos preventivos      Hoy y canales               —(señalan expedientes)
  Cambio de política      Estado de cuenta (contexto) expediente de contrato
  Cambio de trazado       Taller (ensayo)             expediente de servicio
  Queja                   historiales relacionados    expediente de ocurrencia
  Exportar periodo        Estado de cuenta            —(no muta nada)

Nota sobre exportar: sacar el periodo para facturar es lectura, no acción sobre
un sustantivo. Vive en la vista y no rompe la ley.


E. CÓMO SE DESCIENDE
· Toda vista es macro→micro: la respuesta arriba, el detalle abajo, el hecho
  individual a un clic.
· Todo sustantivo en pantalla es liga a su expediente. Nunca texto muerto.
· Migas de pan siempre, registrando por dónde se bajó.
· Desde un expediente se salta a otro por Relaciones — así se camina el grafo.
· No hay callejones: de cualquier expediente se vuelve a una vista.


F. LENORE — su asiento
No es una vista ni un expediente: es la mensajera, y vive en el marco superior,
presente en todas las caras desde el primer día.
· Lee hechos sellados y señales vivas. No emite veredictos.
· Cada aviso señala un expediente con dirección estable.
· Sus avisos aparecen además en Hoy y por los canales externos.
· Su asiento se reserva en el marco aunque todavía no haga nada.


G. LO QUE ESTA FICHA PROHÍBE
· Una vista que guarde algo.
· Una acción disponible en dos lugares.
· Una pestaña nombrada como objeto de base de datos.
· Una acción sin expediente donde vivir (falta expediente, no sobra vista).
· Un nombre en pantalla que no sea liga.
· Menú lateral. La navegación es por pestañas arriba y ligas dentro del contenido.


H. QUÉ SIGUE DE ESTA FICHA
Ahora sí, una ficha por pantalla, con el molde de siete preguntas: la pregunta
del usuario, lo primero que ve, el descenso, las acciones (que por esta ley solo
pueden ser ligas hacia expedientes), lo que NO está, los estados feos, y la ley
del Marco que la gobierna.

Orden: Estado de cuenta del carrier (define el molde) → Hoy → Expediente →
Flota → Taller → las tres de planta → Panorama.

Y en paralelo, la tabla de reacomodo: cada página actual del sistema con su
destino (se queda como vista, se convierte en expediente, se funde, se retira).
