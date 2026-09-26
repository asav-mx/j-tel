/**
 * **La banda de ENSAYO** — lo primero que se ve en un teléfono con la llave de
 * ensayo (`lib/ensayo.ts`), en todas las pantallas de la app.
 *
 * Existe para que nadie confunda lo que ve con el servicio: ese teléfono enseña
 * camiones de rutas que todavía no arrancan, y cualquiera que lo mire por encima
 * del hombro —o una captura que circule— tiene que poder leerlo sin preguntar.
 * Por eso dice también lo que el público ve, que es lo que está en juego.
 *
 * **Sale cuando el servidor ya contestó como ensayo**, no cuando el teléfono
 * tiene una llave guardada: una llave que nadie ha comprobado no abre nada, y la
 * banda estaría diciendo algo que no pasa.
 *
 * No lleva la llave, ni una forma de apagarla: se apaga con `#ensayo=salir`, o
 * sola si el servidor deja de reconocer la llave.
 */
export function BandaDeEnsayo() {
  return (
    <p className="ontoy-banda-rd ontoy-banda-ensayo" role="status">
      <b>ENSAYO</b> · este teléfono ve las rutas como si ya hubieran arrancado. El público, no.
    </p>
  );
}
