import Link from "next/link";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, SinCuenta, Titular } from "@/components/casa/expediente";
import { PanelDeIdentidadDeUnidad } from "@/components/casa/paneles-de-unidad";
import { ListaDelCajon } from "@/components/casa/archivero";
import { clases } from "@/components/casa/formulario";
import { textoDeRuta } from "@/lib/casa/dispositivos";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { leerArchivero } from "@/lib/casa/archivero-de-la-pagina";
import { rutaDelCajon, tarjetaDeCajon } from "@/lib/casa/archivero";
import { rutas } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Expedientes · Unidades — un cajón del archivero (ficha V2 §3 y enmienda 1).
 *
 * Tres secciones: Piden algo · Sin juzgar · Al día. «Al día» sólo se dice de
 * lo que se juzgó; lo que no se pudo juzgar dice por qué en una línea. Las
 * inactivas, plegadas al final.
 *
 * Aquí vive el alta de unidades (C4-e), mudada del cuarto sin reescribirse: lo
 * que todavía no existe no tiene expediente donde hacerse. El botón lo ven
 * coordinador y admin (`puedeManejarFlota`); la ruta vuelve a preguntar, porque
 * esconder un botón no es una guardia.
 */
export default async function CajonDeUnidades({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const { cuenta, lleno } = await leerArchivero(searchParams, "expedientes-unidades");
  if (!lleno) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta, identidad, alcance, cuarto, archivero, sp } = lleno;

  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const altaAbierta = actua && sp.accion === "alta-unidad";
  const cajon = rutaDelCajon("unidades", cuentaEnRuta);
  const conAlta = (abierta: boolean) => (abierta ? `${cajon}${cajon.includes("?") ? "&" : "?"}accion=alta-unidad` : cajon);

  const t = tarjetaDeCajon("unidades", archivero.unidades);
  const inactivas = archivero.unidades.filter((p) => p.plegada).length;

  return (
    <Marco casa={casa} alcance={alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: "Unidades" }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titular
            nombre="Unidades"
            bajo={[
              `${t.cifra} ${t.cifra === 1 ? "unidad" : "unidades"}`,
              t.piden,
              inactivas > 0 ? `${inactivas} ${inactivas === 1 ? "inactiva" : "inactivas"}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {actua && (
            <Link href={conAlta(!altaAbierta)} className={altaAbierta ? clases.abridor(true) : clases.primario} aria-expanded={altaAbierta}>
              ＋ Dar de alta una unidad
            </Link>
          )}
        </div>

        {/* Un error que no es del panel regresa sin `accion`: si sólo lo pintara el panel, no se vería. */}
        {!altaAbierta && textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

        {altaAbierta && (
          <PanelDeIdentidadDeUnidad
            modo="alta"
            cuenta={carrier.slug}
            valores={{
              nombre: textoDeRuta(sp.nombre, 60) ?? "",
              placa: textoDeRuta(sp.placa, 30) ?? "",
              vin: textoDeRuta(sp.vin, 40) ?? "",
            }}
            error={textoDeRuta(sp.error)}
            cancelar={cajon}
          />
        )}

        <ListaDelCajon cajon="unidades" piezas={archivero.unidades} mercado={cuarto.mercado?.nombre ?? null} />
      </div>
    </Marco>
  );
}
