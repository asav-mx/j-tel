import { exigirSesion } from "@/lib/guardia-pagina";

/**
 * La puerta de la cara carrier.
 *
 * Misma forma que la de cliente y por la misma razón: al 4 de agosto de 2026
 * `/carrier` respondía **200 sin sesión** en producción. Exige sesión de Clerk
 * real y nada más — es la pregunta que se contesta **sin leer un dato de
 * nadie**, y por eso vale para las 15 pantallas y para las que no existen aún.
 *
 * **La red, no la comprobación.** Un `redirect()` desde un layout no impide que
 * la página hija se renderice: Next las renderiza en paralelo y el payload
 * viaja en la respuesta aunque el layout redirija. Por eso cada página vuelve a
 * preguntar. Ver la regla 7 del plan.
 */
export default async function CarrierLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  return <>{children}</>;
}
