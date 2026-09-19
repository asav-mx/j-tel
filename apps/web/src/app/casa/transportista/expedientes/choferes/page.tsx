import Link from "next/link";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { papelDeLicenciaDeCuenta } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { AvisoDeError, SinCuenta, Titular } from "@/components/casa/expediente";
import { ListaDelCajon } from "@/components/casa/archivero";
import { PanelDeIdentidadDeChofer } from "@/components/casa/paneles-de-chofer";
import { clases } from "@/components/casa/formulario";
import { textoDeRuta } from "@/lib/casa/dispositivos";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { leerArchivero } from "@/lib/casa/archivero-de-la-pagina";
import { rutaDelCajon, tarjetaDeCajon } from "@/lib/casa/archivero";
import { rutas } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Expedientes · Choferes — un cajón del archivero (ficha V2 §3) con gente
 * (Choferes V1).
 *
 * **Vuelve el botón de alta** que el #450 quitó con razón: ahora lleva a algún
 * lado. Lo ven coordinador y admin (`puedeManejarFlota`), como el de unidades;
 * la ruta vuelve a preguntar. Tocar un chofer abre Ver ‹chofer›.
 *
 * Las mismas secciones que Unidades —Piden algo · Sin juzgar · Al día—, y los
 * de baja plegados al final.
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
  const { carrier, cuentaEnRuta, identidad, alcance, cuarto, archivero, sp } = lleno;

  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const altaAbierta = actua && sp.accion === "alta-chofer";
  const cajon = rutaDelCajon("choferes", cuentaEnRuta);
  const conAlta = (abierta: boolean) => (abierta ? `${cajon}${cajon.includes("?") ? "&" : "?"}accion=alta-chofer` : cajon);
  // El vencimiento sólo se pide si hay dónde guardarlo: el papel «Licencia» del catálogo.
  const pideVencimiento = altaAbierta ? (await papelDeLicenciaDeCuenta(getRepos(), carrier.id)) !== null : false;

  const t = tarjetaDeCajon("choferes", archivero.choferes);
  const deBaja = archivero.choferes.filter((p) => p.plegada).length;

  return (
    <Marco casa={casa} alcance={alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: "Choferes" }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titular
            nombre="Choferes"
            bajo={[
              `${t.cifra} ${t.cifra === 1 ? "chofer activo" : "choferes activos"}`,
              t.piden,
              deBaja > 0 ? `${deBaja} de baja` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {actua && (
            <Link href={conAlta(!altaAbierta)} className={altaAbierta ? clases.abridor(true) : clases.primario} aria-expanded={altaAbierta}>
              ＋ Dar de alta un chofer
            </Link>
          )}
        </div>

        {/* Un error que no es del panel regresa sin `accion`: si sólo lo pintara el panel, no se vería. */}
        {!altaAbierta && textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

        {altaAbierta && (
          <PanelDeIdentidadDeChofer
            modo="alta"
            cuenta={carrier.slug}
            valores={{
              nombre: textoDeRuta(sp.nombre, 140) ?? "",
              licencia: textoDeRuta(sp.licencia, 40) ?? "",
              venceEl: textoDeRuta(sp.venceEl, 10) ?? "",
            }}
            pideVencimiento={pideVencimiento}
            error={textoDeRuta(sp.error)}
            cancelar={cajon}
          />
        )}

        <ListaDelCajon cajon="choferes" piezas={archivero.choferes} mercado={cuarto.mercado?.nombre ?? null} />
      </div>
    </Marco>
  );
}
