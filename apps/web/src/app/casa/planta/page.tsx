import { exigirSesion } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { CasaVacia } from "@/components/casa/casa-vacia";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";

/**
 * La casa de la planta — cimiento: Vernier.
 *
 * Vive la operación diaria y ve sólo lo suyo: **jamás el Compás de su
 * proveedor.** Su puerta responde «¿qué pasó hoy?».
 *
 * Nace separada de Corporativo, aunque hoy las dos vivan bajo `/cliente` en el
 * árbol anterior. El mapa las parte en dos casas —una opera, la otra compara— y
 * ASAV lo ratificó el 15 de septiembre de 2026: separarlas después habría
 * costado rehacer el marco.
 *
 * Sobre la guardia, lo mismo que en la casa del transportista: `exigirSesion`
 * es lo que se puede comprobar sin leer un dato: la guardia por cuenta llega
 * con el primer cuarto que sepa de qué planta se habla.
 */
export default async function CasaPlanta() {
  await exigirSesion();

  const casa = CASAS.planta;
  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
      <CasaVacia casa={casa} />
    </Marco>
  );
}
