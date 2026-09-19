import { notFound } from "next/navigation";
import { cargarServiciosEspeciales, zonaDeLaCuenta } from "@jtel/services";
import { localDateIso } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { SinCuenta, Titular } from "@/components/casa/expediente";
import { ListaDeServiciosEspeciales } from "@/components/casa/servicios-especiales";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { periodoDeLaDireccion, type Periodo } from "@/lib/casa/periodo";

export const dynamic = "force-dynamic";

/** Lo más ancho que se pide de una vez: un mes entero y un día de holgura, como el recorrido de C3. */
const VENTANA_MAXIMA_MS = 32 * 24 * 60 * 60_000;
/** Sin ventana en la dirección, «Ayer» — el atajo que el prototipo abre marcado. */
const ATAJO_POR_OMISION = 1;

/**
 * Servicios especiales — el primer cuarto de Vernier en la casa nueva
 * (`docs/Ficha-Construccion-Vernier-V1.md`; prototipo v1,
 * https://claude.ai/artifact/XDTRABFFkk2nVjqzC5SQDC).
 *
 * **Existe sólo si la cuenta tiene contrato.** Sin contrato no aparece ni la
 * pestaña, y entrar por la dirección da 404: el cuarto no se muestra bloqueado,
 * no existe (mapa, regla 4).
 *
 * La página resuelve la cuenta, la zona y la ventana, y lee las ocurrencias
 * con hecho. Contrato, turno, búsqueda y veredicto se eligen en el navegador:
 * son lentes sobre la misma lista, y los conteos cuentan lo que la lista
 * muestra.
 *
 * Sólo lee lo sellado. Abrir este cuarto no juzga ni escribe nada.
 */
export default async function ServiciosEspeciales({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("servicios-especiales");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  if (!cuenta.alcance.conContrato) notFound();

  const { carrier, cuentaEnRuta } = cuenta;
  const direccion = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const repos = getRepos();
  const ahora = Date.now();

  const zona = await zonaDeLaCuenta(repos, carrier.id);
  let periodo: Periodo = periodoDeLaDireccion(texto(direccion.desde), texto(direccion.hasta), ahora, {
    zona,
    porOmision: ATAJO_POR_OMISION,
  });
  // Una dirección con una ventana de años no se sirve entera: se cae al atajo.
  // La barra dice cuál periodo se leyó de verdad, así que no se esconde nada.
  if (periodo.hasta - periodo.desde > VENTANA_MAXIMA_MS) {
    periodo = periodoDeLaDireccion(undefined, undefined, ahora, { zona, porOmision: ATAJO_POR_OMISION });
  }

  const cuarto = await cargarServiciosEspeciales(repos, {
    carrierAccountId: carrier.id,
    desde: new Date(periodo.desde),
    hasta: new Date(periodo.hasta),
  });
  reloj.marca("datos");
  reloj.fin();

  const dia = localDateIso(new Date(periodo.desde), zona);
  const diaDeLaVentana = dia === localDateIso(new Date(periodo.hasta), zona) ? dia : null;
  const contratos = cuarto.contratos.length === 1 ? "un contrato" : `${cuarto.contratos.length} contratos`;

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <Titular
          nombre="Servicios especiales"
          bajo={`${carrier.name} · ${contratos} · los circuitos de transporte público viven en su propio cuarto`}
        />
        <ListaDeServiciosEspeciales
          ocurrencias={cuarto.ocurrencias}
          contratos={cuarto.contratos}
          zona={cuarto.zona}
          periodo={periodo}
          leida={ahora}
          slug={carrier.slug}
          cuentaEnRuta={cuentaEnRuta}
          diaDeLaVentana={diaDeLaVentana}
        />
      </div>
    </Marco>
  );
}
