import { exigirEnPagina } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { CasaVacia } from "@/components/casa/casa-vacia";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";

/**
 * La casa de J-Staff — el operador de la plataforma.
 *
 * Ve todo, con el razonamiento completo, y es **la única cara que cruza entre
 * cuentas**, siempre por la compuerta. Su puerta responde «¿está sana la
 * plataforma?».
 *
 * Aquí la guardia sí es la fina desde el primer día, al revés que en las otras
 * tres: `{ tipo: "jstaff" }` no necesita saber de qué cuenta se habla, así que
 * no hay nada que esperar. Es la misma que cubre `/jstaff`, y por la misma
 * razón: un árbitro cuya cocina es visible para el auditado deja de ser
 * árbitro.
 */
export default async function CasaJStaff() {
  await exigirEnPagina({ tipo: "jstaff" });

  const casa = CASAS.jstaff;
  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
      <CasaVacia casa={casa} />
    </Marco>
  );
}
