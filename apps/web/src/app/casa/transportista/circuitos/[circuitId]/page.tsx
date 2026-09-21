import Link from "next/link";
import { notFound } from "next/navigation";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { armarTorreDelCircuito } from "@jtel/services";
import type { Sentido } from "@jtel/domain";
import { Marco } from "@/components/casa/marco";
import { AvisoDeError, Encabezado, Familia, SinCuenta, Titular, Vacio } from "@/components/casa/expediente";
import { clases } from "@/components/casa/formulario";
import { PanelAsignarUnidad, PanelSoltarUnidad } from "@/components/casa/paneles-de-circuito";
import { Pieza } from "@/components/casa/pieza";
import { Torre, type VistaDeLaTorre } from "@/components/casa/torre/torre";
import { correosDeAutores } from "@/lib/casa/autores";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { SUGERENCIAS_SOLTAR, accionDeCircuito, hechoDeCircuito, rutasDeCircuito } from "@/lib/casa/circuitos";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { horaDe, quienYPorQue, textoDeRuta } from "@/lib/casa/dispositivos";
import { diaDe, rutas } from "@/lib/casa/expedientes";
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
 *
 * ## Relaciones: sus unidades en el circuito, y asignarlas
 *
 * Bajo la torre va la familia Relaciones del expediente del circuito (9.8):
 * **sólo las unidades de esta cuenta** —vigentes y su historia—, leídas con
 * muro (`listAsignacionesDeCuenta`). En un circuito compartido las del otro
 * carrier no existen aquí (9.14).
 *
 * Quien maneja la flota (`puedeManejarFlota`) asigna y suelta desde aquí
 * (ficha de huecos de «asignar unidad», PR 2). Despacho ve la lista y ningún
 * botón (mapa, regla 4). La ruta vuelve a preguntar todo.
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
  const sp = await searchParams;
  const repos = getRepos();
  const { carrier, identidad, cuentaEnRuta } = cuenta;
  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const torre = await armarTorreDelCircuito(repos, {
    cuentaId: cuenta.carrier.id,
    circuitId,
    ahora: new Date(),
  });
  if (torre.alcance === "ninguno") notFound();

  let accion = actua ? accionDeCircuito(sp.accion) : null;
  const [circuito, paradasCrudas, trazadosCrudos, asignaciones, asignables] = await Promise.all([
    repos.circuits.getCircuitVisibleParaCuenta(cuenta.carrier.id, circuitId),
    repos.circuits.listStopsVigentes(circuitId),
    repos.circuits.getPaths(circuitId),
    repos.circuits.listAsignacionesDeCuenta(carrier.id, circuitId),
    // El universo sólo hace falta para ofrecer; si no actúa, ni se pide.
    actua ? repos.circuits.listUnidadesAsignablesDelCarrier(carrier.id, circuitId) : Promise.resolve([]),
  ]);
  if (!circuito) notFound();

  const vigentes = asignaciones.filter((a) => a.validTo === null);
  const historia = asignaciones.filter((a) => a.validTo !== null);
  const aSoltar =
    accion === "soltar" ? (vigentes.find((a) => a.id === textoDeRuta(sp.asignacion, 64)) ?? null) : null;
  // Una acción que ya no procede no abre su panel: lo soltado ya no se suelta.
  if (accion === "soltar" && !aSoltar) accion = null;
  const autores = await correosDeAutores(asignaciones.flatMap((a) => [a.asignadaPor, a.cerradaPor]));
  const correo = (id: string) => autores.get(id) ?? id;
  const error = textoDeRuta(sp.error);
  const esta = (p: Parameters<typeof rutasDeCircuito.ver>[2] = {}) => rutasDeCircuito.ver(circuitId, cuentaEnRuta, p);
  const fraseDelHecho = armarHecho({
    hecho: hechoDeCircuito(sp.hecho),
    unidad: textoDeRuta(sp.unidad, 64),
    asignaciones,
    zona: circuito.timeZone,
  });
  const comunes = {
    cuenta: carrier.slug,
    circuitId,
    nombreDelCircuito: circuito.name,
    cancelar: esta(),
    error,
  };

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

      <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-4">
        <Familia nombre="Relaciones">
          <Encabezado
            izquierda="Tus unidades en este circuito"
            derecha={vigentes.length ? `${vigentes.length} ${vigentes.length === 1 ? "asignada" : "asignadas"}` : null}
          />

          {fraseDelHecho && (
            <p
              role="status"
              className="flex items-center gap-2.5 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px]"
            >
              <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-[var(--vivo)]" />
              <span>{fraseDelHecho}</span>
            </p>
          )}
          {/* Un error sin panel abierto (la guardia, o una acción que ya no procede) se dibuja aquí. */}
          {error && !accion && <AvisoDeError mensaje={error} />}

          {vigentes.length === 0 ? (
            <Vacio>Ninguna unidad de esta cuenta está asignada a este circuito.</Vacio>
          ) : (
            <div className="flex flex-col gap-2">
              {vigentes.map((a) => (
                <div key={a.id} className="flex flex-col gap-1">
                  <Pieza
                    nombre={a.unitLabel}
                    apoyo={`desde ${diaDe(a.validFrom, circuito.timeZone)} ${horaDe(a.validFrom, circuito.timeZone)}`}
                    /*
                     * «asignada», no «corriendo»: esto es lo ESPERADO. Si de verdad
                     * corre lo dice la torre, que lo mide (Pieza 1.C: esperado y
                     * observado nunca se mezclan).
                     */
                    dato="asignada"
                    etiqueta="unidad"
                    edad={null}
                    ficha={rutas.unidad(a.unitId, cuentaEnRuta)}
                  />
                  <div className="flex items-center justify-between gap-3 px-4">
                    <p className="text-[12.5px] text-[var(--tenue)]">
                      {quienYPorQue({ vigente: true, asignadaPor: a.asignadaPor, cerradaPor: null, motivoCierre: null }, correo)}
                    </p>
                    {actua && (
                      <Link
                        href={aSoltar?.id === a.id ? esta() : esta({ accion: "soltar", asignacion: a.id })}
                        className="text-[12.5px] text-[var(--tinta)] underline underline-offset-2"
                        aria-expanded={aSoltar?.id === a.id}
                      >
                        Soltar
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {actua && (
            <div className="flex flex-wrap gap-2" aria-label="Acciones">
              <Link
                href={accion === "asignar" ? esta() : esta({ accion: "asignar" })}
                className={clases.abridor(accion === "asignar")}
                aria-expanded={accion === "asignar"}
              >
                Asignar una unidad
              </Link>
            </div>
          )}

          {accion === "asignar" && (
            <PanelAsignarUnidad
              {...comunes}
              unidades={asignables
                .filter((u) => u.ocupadaEnCircuitoId !== circuitId)
                .map((u) => ({
                  unitId: u.unitId,
                  numeroEconomico: u.label,
                  corre: u.ocupadaEnCircuitoId ? { circuitId: u.ocupadaEnCircuitoId, nombre: u.ocupadaEnCircuito } : null,
                }))}
            />
          )}
          {accion === "soltar" && aSoltar && (
            <PanelSoltarUnidad
              {...comunes}
              asignacionId={aSoltar.id}
              numeroEconomico={aSoltar.unitLabel}
              sugerencias={SUGERENCIAS_SOLTAR}
              motivoInicial={textoDeRuta(sp.motivo, 600) ?? ""}
            />
          )}

          {historia.length > 0 && (
            <>
              <Encabezado izquierda="Asignaciones terminadas" />
              <div className="flex flex-col gap-2">
                {historia.map((a) => (
                  <div key={a.id} className="flex flex-col gap-1">
                    <Pieza
                      nombre={a.unitLabel}
                      apoyo={`${diaDe(a.validFrom, circuito.timeZone)} → ${diaDe(a.validTo!, circuito.timeZone)}`}
                      dato="soltada"
                      etiqueta="unidad"
                      edad={null}
                      apagada
                      ficha={rutas.unidad(a.unitId, cuentaEnRuta)}
                    />
                    <p className="px-4 text-[12.5px] text-[var(--tenue)]">
                      {quienYPorQue(
                        { vigente: false, asignadaPor: a.asignadaPor, cerradaPor: a.cerradaPor, motivoCierre: a.motivo },
                        correo,
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Familia>
      </div>
    </Marco>
  );
}

/**
 * La frase de lo que acaba de pasar, **leída de la base**. La dirección sólo
 * dice qué acción fue y de qué unidad; si la base no lo sostiene —otra pestaña
 * ya la movió, o alguien editó la dirección— no se dice nada.
 */
function armarHecho({
  hecho,
  unidad,
  asignaciones,
  zona,
}: {
  hecho: ReturnType<typeof hechoDeCircuito>;
  unidad: string | null;
  asignaciones: { unitId: string; unitLabel: string; validFrom: Date; validTo: Date | null }[];
  zona: string;
}): string | null {
  if (!hecho || !unidad) return null;
  const suya = asignaciones.filter((a) => a.unitId === unidad);
  if (hecho === "asignada") {
    const vigente = suya.find((a) => a.validTo === null);
    return vigente ? `${vigente.unitLabel} quedó asignada a este circuito a las ${horaDe(vigente.validFrom, zona)}.` : null;
  }
  const ultima = suya.find((a) => a.validTo !== null);
  if (!ultima || suya.some((a) => a.validTo === null)) return null;
  return `${ultima.unitLabel} se soltó de este circuito a las ${horaDe(ultima.validTo!, zona)}.`;
}
