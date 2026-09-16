import { exigirSesion } from "@/lib/guardia-pagina";
import { Marco } from "@/components/casa/marco";
import { CasaVacia } from "@/components/casa/casa-vacia";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";

/**
 * La casa del transportista — cimiento: Compás.
 *
 * Compra Compás aunque nunca tenga contrato; Vernier se enciende encima cuando
 * lo consigue. Su puerta responde «¿dónde está mi flota?».
 *
 * **La guardia es `exigirSesion` y no la fina**, por la misma razón que la de
 * `/carrier`: es la pregunta que se contesta sin leer un dato de nadie. La
 * guardia por cuenta —`{ tipo: "carrier", slug }`— necesita saber de qué cuenta
 * se habla, y esta pantalla todavía no lo sabe porque no lee nada. El primer
 * cuarto que traiga cuenta trae también su guardia fina; hasta entonces, pedir
 * sesión es exactamente lo que se puede comprobar, y pedir menos sería dejar
 * abierto lo que ya se cerró en el resto del producto.
 */
export default async function CasaTransportista() {
  await exigirSesion();

  const casa = CASAS.transportista;
  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
      <CasaVacia casa={casa} />
    </Marco>
  );
}
