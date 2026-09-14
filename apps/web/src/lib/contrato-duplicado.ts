/**
 * Qué se le dice a quien intenta crear un contrato cuando ya hay uno abierto
 * con el mismo carrier en el mismo sitio.
 *
 * ## Por qué es una función y no una plantilla en la ruta
 *
 * Decía, para todos los casos: «Actívalo, elimínalo si es borrador, o suspende
 * el anterior». Medido contra la pantalla el 14 de septiembre de 2026, **las
 * tres instrucciones mentían en algún caso**:
 *
 *   · «suspende el anterior» — **no hay botón para suspender un contrato**. El
 *     «suspender» de J-Staff es la autorización comercial, otra cosa.
 *   · «actívalo» — a un contrato que ya está activo.
 *   · «elimínalo si es borrador» — el botón de eliminar sólo aparece en un
 *     borrador **sin servicios**; con servicios no hay forma.
 *
 * Una instrucción que manda a buscar un botón que no existe es peor que no dar
 * instrucción: quien la lee concluye que la pantalla está rota o que él no
 * encuentra lo que debería estar ahí. Ahora cada caso dice sólo lo que la
 * pantalla deja hacer, y el activo —donde la pantalla no deja hacer nada— lo
 * dice así en vez de inventar una salida.
 *
 * **Si algún día existe el botón de suspender, este texto se tiene que cambiar
 * en el mismo trabajo.** Y ese botón no va solo: sin que el árbitro obedezca el
 * estado del contrato, sería una perilla que miente.
 */
export function mensajeContratoDuplicado(existente: {
  status: string;
  nombre: string;
  carrier: string;
  servicios: number;
}): string {
  const etiqueta =
    existente.status === "active"
      ? "activo"
      : existente.status === "draft"
        ? "borrador"
        : existente.status;
  const base = `Ya existe un contrato ${etiqueta} para ${existente.carrier} en este sitio («${existente.nombre}»).`;

  if (existente.status === "active") {
    return `${base} Un sitio no puede tener dos contratos abiertos con el mismo carrier. Para reemplazarlo, contacta a JTEL.`;
  }
  if (existente.status === "draft" && existente.servicios === 0) {
    return `${base} Actívalo o elimínalo.`;
  }
  return `${base} Actívalo.`;
}
