import { notFound } from "next/navigation";
import { cargarExpedienteDeDispositivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { SinCuenta } from "@/components/casa/expediente";
import { RecorridoDispositivoPlayback } from "@/components/casa/recorrido-dispositivo-playback";
import type { EstadoActual } from "@/components/casa/recorrido-playback";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { glifoDeDispositivo, rutas } from "@/lib/casa/expedientes";
import { RAIZ_DISPOSITIVOS, puertaDe, rutasDeDispositivos, senalViva } from "@/lib/casa/dispositivos";
import { periodoDeLaDireccion } from "@/lib/casa/recorrido";

export const dynamic = "force-dynamic";

/**
 * Ver ‹dispositivo› → Recorridos y playback (prototipo aprobado por ASAV, 17 sep 2026).
 *
 * La página resuelve la cuenta y el dispositivo, y le entrega al navegador lo
 * que no es del periodo: el estado del dispositivo ahora (lo único que puede ir
 * en cobre) y los polígonos de los lugares. El periodo lo pide el navegador a
 * `/api/casa/recorrido/dispositivo`, partido en etapas por unidad.
 *
 * Dos puertas, como la ficha: la puerta va en `?puerta=` porque `desde` y
 * `hasta` son de la ventana.
 */
export default async function RecorridoDeDispositivo({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("recorrido-dispositivo");
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
  const { deviceId } = await params;
  const direccion = await searchParams;
  const puerta = puertaDe(direccion.puerta);
  const ahora = new Date();
  const repos = getRepos();

  const [e, filasDeLugares] = await Promise.all([
    cargarExpedienteDeDispositivo(repos, { carrierAccountId: carrier.id, deviceId, ahora }),
    repos.geofences.lugaresDeCarrier(carrier.id),
  ]);
  reloj.marca("datos");
  reloj.fin();
  if (!e) notFound();

  const imei = e.identidad.imei.estado === "con_datos" ? e.identidad.imei.valor : "";
  const nombre = e.identidad.nombre.estado === "con_datos" ? e.identidad.nombre.valor : imei;
  const unidades = e.relaciones.unidades.estado === "con_datos" ? e.relaciones.unidades.valor : [];
  const vigente = unidades.find((u) => u.vigente) ?? null;

  let estadoActual: EstadoActual | null = null;
  if (e.actividad.ultimaSenal.estado === "con_datos") {
    const s = e.actividad.ultimaSenal.valor;
    const g = glifoDeDispositivo(s.estado);
    const enUnidad = vigente && s.estado.grupo !== "en_bodega" && s.estado.grupo !== "de_baja";
    estadoActual = {
      glifo: g.glifo,
      rumbo: 0,
      palabra: enUnidad ? `${s.estado.grupo === "desconectado" ? "desconectado en" : "en"} ${vigente.etiqueta}` : g.palabra.toLowerCase(),
      atIso: s.at.toISOString(),
      vivo: senalViva(s.estado, ahora),
    };
  }
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const regreso =
    puerta === "dispositivos"
      ? { nombre: "Dispositivos", ruta: rutasDeDispositivos.cuarto(cuentaEnRuta) }
      : { nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) };

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa} lugar={puerta === "dispositivos" ? RAIZ_DISPOSITIVOS : undefined}>
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
        <Migas
          pasos={[
            regreso,
            { nombre: `Ver ${nombre}`, ruta: rutasDeDispositivos.ver(deviceId, cuentaEnRuta, { desde: puerta }) },
            { nombre: "Recorridos y playback" },
          ]}
        />
        <RecorridoDispositivoPlayback
          slug={carrier.slug}
          cuentaEnRuta={cuentaEnRuta}
          puerta={puerta}
          dispositivo={{ id: deviceId, nombre }}
          periodoInicial={periodoDeLaDireccion(texto(direccion.desde), texto(direccion.hasta), ahora.getTime())}
          leidaIso={ahora.toISOString()}
          estadoActual={estadoActual}
          lugares={filasDeLugares.map((g) => ({ id: g.id, nombre: g.name, rol: g.role, poligono: g.polygon }))}
        />
      </div>
    </Marco>
  );
}
