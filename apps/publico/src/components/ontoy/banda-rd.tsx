/**
 * La banda que dice qué es esto, arriba de todo lo del pase.
 *
 * La pide la ficha de pagos en su §1, y no es adorno: quien abra esta pantalla
 * —un probador, alguien de planta, Asav enseñándola en una junta— tiene que
 * saber **sin preguntar** que los viajes son de mentira y que nada aquí cobra.
 *
 * Va en cada una de las tres pantallas del pase, no sólo en la primera: a la
 * pantalla del QR se puede llegar y quedarse, y es justo la que más parece de
 * verdad.
 */
export function BandaRd() {
  return (
    <p className="ontoy-banda-rd cifra">
      R&amp;D interno · datos falsos · nada de esto cobra dinero real · las reglas de ley son
      suposiciones hasta el abogado
    </p>
  );
}
