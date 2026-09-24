import Link from "next/link";

/**
 * Lo que ve quien escanea un letrero que no lleva a ninguna parte.
 *
 * Son **dos casos con una sola respuesta**, a propósito: un `qr_slug` que no
 * existe y una parada cuyo circuito todavía no se publica. Distinguirlos sería
 * decirle a quien pregunta que el segundo existe, y lo no publicado no existe
 * para la app (8.4).
 *
 * No se disculpa ni echa culpas, y **no es un 404 mudo**: dice qué pasó, en
 * español, a alguien parado en una esquina de Juárez, y ofrece la única salida
 * que hay.
 */
export default function ParadaNoEncontrada() {
  return (
    <main className="puerta">
      <h1>No encontramos esta parada</h1>
      <p>
        El código del letrero puede estar mal escrito, o su ruta todavía no está publicada. Abre
        el inicio para ver las rutas que sí puedes seguir.
      </p>
      <ul>
        <li>
          <Link href="/">Ver las rutas</Link>
        </li>
      </ul>
    </main>
  );
}
