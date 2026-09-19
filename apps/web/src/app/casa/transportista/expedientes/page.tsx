import { redirect } from "next/navigation";
import { Marco } from "@/components/casa/marco";
import { AvisoDeError, SinCuenta, Titular } from "@/components/casa/expediente";
import { TableroDelArchivero } from "@/components/casa/archivero";
import { textoDeRuta } from "@/lib/casa/dispositivos";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { leerArchivero } from "@/lib/casa/archivero-de-la-pagina";
import { rutaDelCajon, tarjetaDeCajon } from "@/lib/casa/archivero";
import { fechaCorta } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Expedientes — el archivero, nivel 1: el tablero
 * (`docs/Ficha-Construccion-Expedientes-V2-Archivero.md` §2, con sus enmiendas
 * del 19-sep). Extiende `docs/Ficha-Expedientes.md`: el expediente no cambia,
 * cambia la puerta.
 *
 * Una sola pantalla, sin listas largas: el buscador que atraviesa los cajones,
 * «Piden atención» y las tarjetas de Unidades · Dispositivos · Choferes. Es una
 * **vista**: las altas viven en sus cajones y todo lo demás, en el expediente
 * de su cosa (Ley de Acción).
 */
export default async function TableroDeExpedientes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const { cuenta, lleno } = await leerArchivero(searchParams, "expedientes");
  if (!lleno) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta, alcance, cuarto, archivero, sp } = lleno;

  // El alta de unidades vivía aquí (C4-e) y se mudó a su cajón. Una liga vieja
  // con `?accion=alta-unidad` llega al panel, no a un tablero que ya no lo tiene.
  if (sp.accion === "alta-unidad") redirect(`${rutaDelCajon("unidades", cuentaEnRuta)}${cuentaEnRuta ? "&" : "?"}accion=alta-unidad`);

  const cifra = (c: "unidades" | "dispositivos" | "choferes", uno: string, varios: string) => {
    const n = tarjetaDeCajon(c, archivero[c]).cifra;
    return `${n} ${n === 1 ? uno : varios}`;
  };

  return (
    <Marco casa={casa} alcance={alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Titular
          nombre="Expedientes"
          bajo={[
            carrier.name,
            cuarto.mercado ? `${cuarto.mercado.nombre} · juzgado el ${fechaCorta(cuarto.mercado.hoy)}` : "sin mercado",
            [cifra("unidades", "unidad", "unidades"), cifra("dispositivos", "dispositivo", "dispositivos"), cifra("choferes", "chofer", "choferes")].join(" · "),
          ].join(" · ")}
        />

        {/* Un error que no es de un panel —la guardia negó el paso, la cuenta no
            existe— regresa aquí sin `accion`: si nadie lo dibujara, no se vería. */}
        {textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

        <TableroDelArchivero archivero={archivero} cuentaEnRuta={cuentaEnRuta} />
      </div>
    </Marco>
  );
}
