import { notFound } from "next/navigation";
import { armarTorreDelCircuito } from "@jtel/services";
import type { Sentido } from "@jtel/domain";
import { Marco } from "@/components/casa/marco";
import { SinCuenta, Titular } from "@/components/casa/expediente";
import { Torre, type VistaDeLaTorre } from "@/components/casa/torre/torre";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

const SENTIDOS: Sentido[] = ["ida", "vuelta"];

/**
 * **Ver ‹circuito›** — y su parte de actividad viva es la torre (Marco 9.2b,
 * 9.9). El cuarto lista los circuitos; tocar uno abre esto.
 *
 * ## Aquí no se mide nada
 *
 * Todo el cálculo vive en `armarTorreDelCircuito` (Paso 1). Esta página resuelve
 * la cuenta, pide la torre y le pasa a la pantalla lo que hace falta para
 * dibujarla: las paradas, los trazados y los rótulos de cada sentido. Una cifra
 * calculada aquí sería una segunda definición de algo que ya está medido.
 *
 * ## El muro, y el 404
 *
 * `armarTorreDelCircuito` abre con `getCircuitVisibleParaCuenta`: un circuito
 * que no es de esta cuenta responde `alcance: "ninguno"`, y eso se dibuja como
 * `notFound()` — **indistinguible de un id inventado**, que es justo el punto.
 *
 * ## Una pantalla, dos alcances
 *
 * La torre dibuja lo que la capa devuelve, sea `carrier` —sus unidades, sin
 * columna de transportista— o `concesion` —todas, con transportista—. Hoy sólo
 * llega aquí un carrier: la cara de la concesión es la de J-Staff y se cablea
 * en su propio frente. El componente ya sabe dibujarla; lo que falta es la
 * puerta, y un cuarto al que nadie llega no se dibuja (mapa, regla 4).
 */
export default async function VerCircuito({
  params,
  searchParams,
}: {
  params: Promise<{ circuitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const cuenta = await cuentaDelCuarto(searchParams);
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }

  const { circuitId } = await params;
  const repos = getRepos();
  const torre = await armarTorreDelCircuito(repos, {
    cuentaId: cuenta.carrier.id,
    circuitId,
    ahora: new Date(),
  });
  if (torre.alcance === "ninguno") notFound();

  const [circuito, paradasCrudas, trazadosCrudos] = await Promise.all([
    repos.circuits.getCircuitVisibleParaCuenta(cuenta.carrier.id, circuitId),
    repos.circuits.listStopsVigentes(circuitId),
    repos.circuits.getPaths(circuitId),
  ]);
  if (!circuito) notFound();

  const paradas = paradasCrudas.map((p) => ({
    stopId: p.stopId,
    nombre: p.name,
    lat: p.latitude,
    lon: p.longitude,
    sentido: (p.sentido ?? null) as Sentido | null,
    orden: p.orden,
  }));

  /*
   * El rótulo de cada carril sale de sus propias paradas —la primera y la
   * última del sentido— y nunca de un texto horneado: el día que el circuito
   * cambie de extremos, el rótulo cambia solo. Sin paradas no hay rótulo que
   * inventar, y se dice el sentido a secas.
   */
  const rotulos = Object.fromEntries(
    SENTIDOS.map((s) => {
      /*
       * **La vuelta recorre las mismas paradas al revés**, así que su rótulo se
       * ordena al revés. Sin esto los dos carriles decían «OASIS → CENTRO» y el
       * de abajo mentía sobre su propia dirección — lo enseñó la primera captura.
       */
      const suyas = paradas
        .filter((p) => p.sentido === null || p.sentido === s)
        .sort((a, b) => (s === "vuelta" ? b.orden - a.orden : a.orden - b.orden));
      const primera = suyas[0];
      const ultima = suyas[suyas.length - 1];
      return [
        s,
        primera && ultima && primera !== ultima
          ? `${s.toUpperCase()} · ${primera.nombre} → ${ultima.nombre}`
          : s.toUpperCase(),
      ];
    }),
  ) as Record<Sentido, string>;

  const vista: VistaDeLaTorre = {
    nombreDelCircuito: circuito.name,
    zona: circuito.timeZone,
    paradas,
    trazados: trazadosCrudos.map((t) => ({
      sentido: t.sentido as Sentido,
      coordinates: t.coordinates as Array<[number, number]>,
    })),
    rotulos,
  };

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa} lugar="/casa/transportista/circuitos">
      <Titular
        nombre={`Ver ${circuito.name}`}
        bajo={
          torre.yaArranco
            ? torre.enHorario
              ? `en servicio · ${circuito.serviceStartLocal.slice(0, 5)}–${circuito.serviceEndLocal.slice(0, 5)}`
              : `fuera de horario · ${circuito.serviceStartLocal.slice(0, 5)}–${circuito.serviceEndLocal.slice(0, 5)}`
            : "el servicio todavía no arranca"
        }
      />
      <Torre torre={torre} vista={vista} />
    </Marco>
  );
}
