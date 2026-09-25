import { CalleSinSalida, PantallaCompleta } from "@/components/ontoy/pantalla-completa";

/**
 * La página que sale cuando la liga no lleva a ninguna parte.
 *
 * Sin esto, Next sirve la suya —«This page could not be found»— y **en inglés**,
 * en una app cuyo idioma es el español y cuyo usuario es alguien parado en una
 * esquina de Juárez. Un mensaje que no se entiende se lee como una app rota.
 *
 * Es también lo que ve quien abre el QR de una ruta que todavía no se publica,
 * o cuyo slug se escribió mal en un letrero. Por eso no se disculpa ni echa
 * culpas: dice qué pasó y ofrece la única salida que hay (8.10).
 *
 * ## La salida va a `/rutas`, no a `/`
 *
 * Desde el #550 la raíz es la **landing** y la app vive en `/rutas`. Un «Ver las
 * rutas» que lleva a la portada es una salida que no lleva a donde dice — y
 * quien cae aquí ya se topó con una liga que no funcionó.
 */
export default function NoEncontrado() {
  return (
    <PantallaCompleta
      pose="al-otro-lado"
      titular="Esta calle no lleva a ningún lado."
      ayuda="Te regreso al inicio y de ahí seguimos."
      boton={{ texto: "Ir al inicio", a: "/rutas" }}
      adorno={<CalleSinSalida />}
    />
  );
}
