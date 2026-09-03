import Link from "next/link";

/**
 * La página que sale cuando la liga no lleva a ninguna parte.
 *
 * Sin esto, Next sirve la suya —«This page could not be found»— y **en inglés**,
 * en una app cuyo idioma es el español y cuyo usuario es alguien parado en una
 * esquina de Juárez. Un mensaje que no se entiende se lee como una app rota.
 *
 * Es también lo que ve quien abre el QR de una ruta que todavía no se publica,
 * o cuyo slug se escribió mal en un letrero. Por eso no se disculpa ni echa
 * culpas: dice qué pasó y ofrece la única salida que hay.
 */
export default function NoEncontrado() {
  return (
    <main className="puerta">
      <h1>No encontramos esa ruta</h1>
      <p>
        La liga puede estar mal escrita, o la ruta todavía no está publicada. Revisa el código del
        letrero, o vuelve al inicio para ver las rutas disponibles.
      </p>
      <ul>
        <li>
          <Link href="/">Ver las rutas</Link>
        </li>
      </ul>
    </main>
  );
}
