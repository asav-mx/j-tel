import Link from "next/link";
import { MODELOS_DE_DISPOSITIVO } from "@jtel/domain";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { CampoImei } from "@/components/casa/campo-imei";
import { clases, estiloTitularDePanel } from "@/components/casa/formulario";
import { AvisoDeError, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { ListaDelCajon } from "@/components/casa/archivero";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { leerArchivero } from "@/lib/casa/archivero-de-la-pagina";
import { tarjetaDeCajon } from "@/lib/casa/archivero";
import { rutas } from "@/lib/casa/expedientes";
import { rutasDeDispositivos, textoDeRuta } from "@/lib/casa/dispositivos";

export const dynamic = "force-dynamic";

/**
 * Expedientes · Dispositivos — un cajón del archivero (ficha V2 §3 y §4, y
 * enmiendas 2 y 3). Hasta el 19-sep fue el lugar Dispositivos del menú (C4-b);
 * su dirección vieja redirige aquí.
 *
 * Los cuatro grupos del inventario (Marco 6.6), que no se enciman: EN UNIDAD ·
 * EN BODEGA · DESCONECTADO, y los de baja plegados al final. Pide algo el
 * desconectado y el de bodega que nunca reportó.
 *
 * **Aquí sólo se da de alta.** Asignar, soltar y dar de baja se hacen en Ver
 * ‹dispositivo›, tocando el dispositivo: una acción se ejecuta en el expediente
 * de su sustantivo (Ley de Acción). El botón lo ven coordinador y admin
 * (`puedeManejarFlota`); la ruta vuelve a preguntar.
 */
export default async function CajonDeDispositivos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const { cuenta, lleno } = await leerArchivero(searchParams, "expedientes-dispositivos");
  if (!lleno) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta, identidad, alcance, cuarto, archivero, sp } = lleno;

  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const altaAbierta = actua && sp.accion === "alta";
  // El «hecho» se arma con lo que hay en la base, no con lo que diga la
  // dirección: si el dispositivo no es de esta cuenta, no se dice nada.
  const recienDado =
    sp.hecho === "alta" && typeof sp.dispositivo === "string"
      ? (cuarto.dispositivos.enServicio.find((d) => d.id === sp.dispositivo && d.estado.grupo === "en_bodega") ?? null)
      : null;

  const t = tarjetaDeCajon("dispositivos", archivero.dispositivos);
  const deBaja = cuarto.dispositivos.deBaja.length;

  return (
    <Marco casa={casa} alcance={alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: "Dispositivos" }]} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titular
            nombre="Dispositivos"
            bajo={[
              `${t.cifra} en servicio`,
              t.piden,
              deBaja > 0 ? `${deBaja} de baja` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {actua &&
            (altaAbierta ? (
              <Link href={rutasDeDispositivos.cuarto(cuentaEnRuta)} className={clases.abridor(true)} aria-expanded="true">
                ＋ Dar de alta un dispositivo
              </Link>
            ) : (
              <Link href={rutasDeDispositivos.cuarto(cuentaEnRuta, { accion: "alta" })} className={clases.primario} aria-expanded="false">
                ＋ Dar de alta un dispositivo
              </Link>
            ))}
        </div>

        {recienDado && (
          <p role="status" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px]">
            <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-[var(--vivo)]" />
            <span>
              Dado de alta: <b data-medida>{recienDado.nombre ?? recienDado.imei}</b>, en bodega.
            </span>
            <Link
              href={rutasDeDispositivos.ver(recienDado.id, cuentaEnRuta, { desde: "dispositivos", accion: "asignar" })}
              className="underline decoration-[var(--linea)] underline-offset-4"
            >
              Asignarlo a una unidad
            </Link>
          </p>
        )}

        {/* Un error que no es del panel —la guardia negó el paso, la cuenta no
            existe— regresa sin `accion`. Si sólo lo dibujara el panel, no se
            vería nunca. */}
        {!altaAbierta && textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

        {altaAbierta && (
          <PanelDeAlta
            cuenta={carrier.slug}
            cancelar={rutasDeDispositivos.cuarto(cuentaEnRuta)}
            imei={textoDeRuta(sp.imei, 40) ?? ""}
            error={textoDeRuta(sp.error)}
          />
        )}

        <ListaDelCajon cajon="dispositivos" piezas={archivero.dispositivos} mercado={null} />
      </div>
    </Marco>
  );
}

function PanelDeAlta({ cuenta, cancelar, imei, error }: { cuenta: string; cancelar: string; imei: string; error: string | null }) {
  const modelo = MODELOS_DE_DISPOSITIVO[0];
  return (
    <form action="/api/casa/dispositivos" method="post" className={clases.panel} aria-label="Dar de alta un dispositivo">
      <h3 className="text-[17px]" style={estiloTitularDePanel}>
        Dar de alta un dispositivo
      </h3>
      <input type="hidden" name="account" value={cuenta} />
      <input type="hidden" name="accion" value="alta" />
      <input type="hidden" name="prefijo" value={modelo.prefijo} />
      <Renglon pregunta="Modelo">
        {modelo.marca} {modelo.modelo}
      </Renglon>
      <CampoImei inicial={imei} errorDeRuta={error} />
      <p className={clases.nota}>
        El nombre lo pone el sistema al guardar: marca, modelo y el siguiente número de la plataforma. Queda en bodega.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={clases.primario}>
          Dar de alta
        </button>
        <Link href={cancelar} className={clases.secundario}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
