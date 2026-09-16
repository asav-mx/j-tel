import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/guardia-pagina";
import { CASAS } from "@/lib/casa/casas";
import { RUTA_FLOTA } from "@/lib/casa/flota";

/**
 * La casa del transportista — cimiento: Compás.
 *
 * Compra Compás aunque nunca tenga contrato; Vernier se enciende encima cuando
 * lo consigue. Su puerta responde «¿dónde está mi flota?», y desde C2 esa
 * pregunta tiene cuarto: Flota en vivo, el primer lugar del primer grupo. La
 * casa ya no se dibuja vacía; lleva a su puerta, con la cuenta si venía.
 *
 * La guardia sigue siendo `exigirSesion`: aquí no se lee un dato de nadie. La
 * guardia por cuenta la pone el cuarto al que se llega.
 */
export default async function CasaTransportista({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion();
  const params = await searchParams;
  const cuenta = typeof params.account === "string" && params.account ? params.account : null;
  // La puerta sale del menú, no de una constante suelta: si cambia el orden, cambia aquí.
  const puerta = CASAS.transportista.grupos[0]?.lugares[0]?.ruta ?? RUTA_FLOTA;
  redirect(cuenta ? `${puerta}?account=${encodeURIComponent(cuenta)}` : puerta);
}
