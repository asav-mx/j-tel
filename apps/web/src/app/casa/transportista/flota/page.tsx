import { cargarFlotaEnVivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { SinCuenta } from "@/components/casa/expediente";
import { FlotaEnVivo } from "@/components/casa/flota-en-vivo";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { flotaParaPantalla } from "@/lib/casa/flota";

export const dynamic = "force-dynamic";

/**
 * Flota en vivo — la puerta de la casa del transportista: «¿dónde está mi
 * flota?». C2 del cuarto de Compás; prototipo aprobado el 16 de septiembre de
 * 2026 (https://claude.ai/artifact/NFYEH3tTw85GmttGQm26sV).
 *
 * Cinco grupos, primero lo vivo: EN LÍNEA · EN DESTINO · SIN SEÑAL ·
 * DESCONECTADO · SIN DISPOSITIVO. EN DESTINO sólo existe en servicio especial
 * (Marco 7.7): en circuito, la misma geocerca es de paso.
 *
 * La página lee una vez en el servidor y el navegador vuelve a pedir cada 30 s
 * por `/api/casa/flota`, que traduce con la misma función.
 */
export default async function CuartoFlotaEnVivo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("flota");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }

  const { carrier, cuentaEnRuta } = cuenta;
  const leida = new Date();
  const flota = await cargarFlotaEnVivo(getRepos(), carrier.id, leida);
  reloj.marca("datos");
  reloj.fin();

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa}>
      <FlotaEnVivo
        inicial={flotaParaPantalla(flota, { leida, cuenta: carrier.name, cuentaEnRuta })}
        slug={carrier.slug}
      />
    </Marco>
  );
}
