import { exigirSesion } from "@/lib/guardia-pagina";

/**
 * La puerta de la cara cliente.
 *
 * **Esto es lo que cierra la fuga anónima.** Al 4 de agosto de 2026,
 * `www.j-telemetry.com/cliente?account=tecma` respondía **200 sin sesión** y
 * entregaba datos reales: «Tecma Planta 47 (73) y Campus Santos Dumont (25)».
 * Quitar los nombres de la portada no cerró nada — solo dejó de anunciarlos.
 *
 * Exige **sesión de Clerk real y nada más**, a propósito: es la pregunta que se
 * puede contestar **sin leer un solo dato del cliente**, y por eso vale para las
 * 41 pantallas de golpe, incluidas las que todavía no existen.
 *
 * **Lo que este layout NO decide es de quién son los datos.** Eso se pregunta
 * más adentro, donde ya se sabe qué recurso se está mirando:
 *
 * - `planta/[plantId]`, `campus/[groupId]`, `contrato/[contractId]` → su propio
 *   layout, con la cuenta sacada de la fila del recurso.
 * - `ruta/[routeId]`, `servicio/[id]` → en la página.
 *
 * Un layout no se re-renderiza al navegar entre rutas hermanas, así que como
 * única comprobación sería frágil. Aquí no muerde porque lo único que afirma es
 * «hay sesión», y eso no cambia al moverse entre pantallas.
 */
export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  return <>{children}</>;
}
