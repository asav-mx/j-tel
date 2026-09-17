import { notFound } from "next/navigation";
import { cargarExpedienteDeUnidad } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { SinCuenta } from "@/components/casa/expediente";
import { RecorridoPlayback, type EstadoActual } from "@/components/casa/recorrido-playback";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { glifoDeUnidad, rutas } from "@/lib/casa/expedientes";
import { periodoDeLaDireccion } from "@/lib/casa/recorrido";

export const dynamic = "force-dynamic";

/**
 * Ver ‹unidad› → Recorridos y playback (ficha C3, prototipo v5).
 *
 * La página resuelve la cuenta y la unidad, y le entrega al navegador lo que no
 * es del periodo: el estado de la unidad ahora (el único cobre de la pantalla),
 * sus dispositivos con su último punto (para decir, en una ventana vacía, qué
 * se pudo medir) y los polígonos de los lugares. El periodo lo pide el
 * navegador a `/api/casa/recorrido`, que es donde vive la caché de lo cerrado.
 *
 * El periodo llega por la dirección (`?desde=…&hasta=…`), para que un veredicto
 * pueda abrir esta pantalla con la ventana de su servicio ya puesta.
 */
export default async function RecorridoDeUnidad({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("recorrido-unidad");
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
  const { unitId } = await params;
  const direccion = await searchParams;
  const ahora = new Date();
  const repos = getRepos();

  const e = await cargarExpedienteDeUnidad(repos, { carrierAccountId: carrier.id, unitId, ahora });
  if (!e) {
    reloj.fin();
    notFound();
  }

  const dispositivos = e.relaciones.dispositivos.estado === "con_datos" ? e.relaciones.dispositivos.valor : [];
  const [ultimos, filasDeLugares] = await Promise.all([
    repos.telemetry.ultimoPuntoPorImei([...new Set(dispositivos.map((d) => d.imei))]),
    repos.geofences.lugaresDeCarrier(carrier.id),
  ]);
  reloj.marca("datos");
  reloj.fin();

  const nombre = e.identidad.numeroEconomico.estado === "con_datos" ? e.identidad.numeroEconomico.valor : "unidad";
  let estadoActual: EstadoActual | null = null;
  if (e.actividad.ultimaSenal.estado === "con_datos") {
    const s = e.actividad.ultimaSenal.valor;
    const g = glifoDeUnidad(s.estado);
    estadoActual = {
      glifo: g.glifo,
      rumbo: g.rumbo ?? 0,
      palabra: g.palabra,
      atIso: s.at.toISOString(),
      vivo: s.grupo === "en_linea" || s.grupo === "en_destino",
    };
  }
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
        <Migas
          pasos={[
            { nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) },
            { nombre: `Ver ${nombre}`, ruta: rutas.unidad(unitId, cuentaEnRuta) },
            { nombre: "Recorridos y playback" },
          ]}
        />
        <RecorridoPlayback
          slug={carrier.slug}
          cuentaEnRuta={cuentaEnRuta}
          unidad={{ id: unitId, nombre }}
          periodoInicial={periodoDeLaDireccion(texto(direccion.desde), texto(direccion.hasta), ahora.getTime())}
          leidaIso={ahora.toISOString()}
          estadoActual={estadoActual}
          asignaciones={dispositivos.map((d) => ({
            deviceId: d.deviceId,
            etiqueta: d.etiqueta ?? d.imei,
            desde: d.desde.getTime(),
            hasta: d.hasta ? d.hasta.getTime() : null,
            ultimoPunto: ultimos.get(d.imei)?.getTime() ?? null,
          }))}
          lugares={filasDeLugares.map((g) => ({ id: g.id, nombre: g.name, rol: g.role, poligono: g.polygon }))}
        />
      </div>
    </Marco>
  );
}
