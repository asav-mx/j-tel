import { exigirSesion } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { CasaVacia } from "@/components/casa/casa-vacia";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";

/**
 * La casa del corporativo — cimiento: Vernier.
 *
 * **Comparar, no operar.** Agrupa sus plantas y puede tener varios
 * transportistas; su puerta responde «¿cómo vamos, y con quién?». Cuando el
 * panorama levanta bandera, se baja a una planta tocándola.
 *
 * Sobre la guardia, lo mismo que en las otras dos: `exigirSesion` es lo que se
 * puede comprobar mientras la casa no lee un dato.
 */
export default async function CasaCorporativo() {
  await exigirSesion();

  const casa = CASAS.corporativo;
  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA}>
      <CasaVacia casa={casa} />
    </Marco>
  );
}
