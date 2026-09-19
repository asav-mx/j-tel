import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { SinCuenta, Titular } from "@/components/casa/expediente";
import { ListaDelCajon } from "@/components/casa/archivero";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { leerArchivero } from "@/lib/casa/archivero-de-la-pagina";
import { tarjetaDeCajon } from "@/lib/casa/archivero";
import { rutas } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Expedientes · Choferes — un cajón del archivero (ficha V2 §3 y enmienda 5).
 *
 * **Sin botón de alta:** el alta de choferes no existe todavía (PR E de
 * `docs/Ficha-Expedientes.md`), y una puerta que no lleva a ningún lado no se
 * dibuja (regla 4 del mapa). Tampoco hay Ver ‹chofer›: las filas no son
 * tocables. El cajón vacío lo dice.
 */
export default async function CajonDeChoferes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const { cuenta, lleno } = await leerArchivero(searchParams, "expedientes-choferes");
  if (!lleno) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { cuentaEnRuta, alcance, archivero } = lleno;
  const t = tarjetaDeCajon("choferes", archivero.choferes);

  return (
    <Marco casa={casa} alcance={alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: "Choferes" }]} />
        <Titular nombre="Choferes" bajo={`${t.cifra} ${t.cifra === 1 ? "chofer activo" : "choferes activos"}`} />
        <ListaDelCajon cajon="choferes" piezas={archivero.choferes} mercado={null} />
      </div>
    </Marco>
  );
}
