import { Cascaron } from "@/components/casa/cascaron";

/**
 * La raíz del cascarón.
 *
 * Todo lo que cuelga de `/casa` se dibuja con el lenguaje vigente (skill
 * `jtel-diseno`) y nada de aquí adentro toca las pantallas que todavía viven en
 * el lenguaje anterior. Ésa es toda la idea de construir al lado en vez de
 * reemplazar en sitio: lo vivo sigue funcionando mientras los cuartos se mudan
 * uno por uno.
 *
 * El prefijo `/casa` es andamio, no dirección definitiva: el mapa dice que cada
 * cara termina en su propio subdominio, y ese día el prefijo se cae.
 *
 * **La guardia no está aquí, sino en cada casa.** Las cuatro no piden lo mismo
 * —J-Staff exige su audiencia; las otras tres, sesión— y un layout de Next no
 * se vuelve a renderizar al navegar entre rutas hermanas, así que como única
 * comprobación sería frágil por construcción.
 */
export default function CascaronLayout({ children }: { children: React.ReactNode }) {
  return <Cascaron>{children}</Cascaron>;
}
