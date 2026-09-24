import Link from "next/link";

/**
 * Lo que ve quien escanea un letrero que todavía no lleva a ninguna parte.
 *
 * ## Dos casos, UN texto, palabra por palabra
 *
 * Un `qr_slug` inventado y una parada cuyo circuito no está publicado caen los
 * dos aquí, y leen **exactamente lo mismo**. No es economía de código: es la 8.4.
 * Lo no publicado **no existe para la app**, y cualquier diferencia entre las dos
 * respuestas —una palabra, un enlace de más, un tiempo de carga distinto—
 * confirma que la segunda existe. Quien prueba slugs a ver qué contesta no
 * aprende nada de aquí.
 *
 * Por eso el texto **no dice por qué**. La versión anterior decía «o su ruta
 * todavía no está publicada», y eso ya era nombrar la causa: quien lee eso sabe
 * que la publicación es la respuesta, y con dos intentos sabe cuál de las dos le
 * tocó.
 *
 * ## Y por qué «QR» y por qué «todavía»
 *
 * **«QR» y no «letrero» (ASAV, 24-sep-2026): es lo que la persona acaba de
 * escanear.** Frente al poste hay una lámina, sí, pero lo que hizo con el
 * teléfono fue escanear un código — y el texto le contesta a esa acción.
 *
 * **«Todavía» es del 23-sep.** Desde entonces un QR se puede imprimir de un
 * circuito sin publicar, porque imprimir, repartir y atornillar toma días. Así
 * que este texto es lo que va a leer un pasajero **de un QR recién pegado, que sí
 * va a servir en unos días** — y también lo que lee quien teclea un código que no
 * existe. «Todavía» es lo único honesto que sirve para los dos: no promete una
 * fecha, no niega la parada, y no confirma nada.
 *
 * No se disculpa ni echa culpas, y **no es un 404 mudo**: le habla a alguien
 * parado en una esquina de Juárez y le ofrece la única salida que hay.
 */
export default function LetreroNoActivo() {
  return (
    <main className="puerta">
      <h1>Este QR todavía no está activo</h1>
      <p>
        Revisa que el código esté bien escrito. Mientras, abre el inicio para ver las rutas que
        ya puedes seguir.
      </p>
      <ul>
        <li>
          <Link href="/">Ver las rutas</Link>
        </li>
      </ul>
    </main>
  );
}
