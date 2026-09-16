import Link from "next/link";
import { notFound } from "next/navigation";
import { JTTEL_TZ, ORDEN_DE_ESTADOS } from "@jtel/domain";
import { cargarExpedienteDeUnidad } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { Encabezado, Familia, Parte, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import {
  datoDePapel,
  diaDe,
  edad,
  fechaCorta,
  glifoDePapel,
  glifoDeUnidad,
  papelApagado,
  rutas,
} from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

const VEREDICTO: Record<string, string> = {
  cumplido: "Cumplido",
  no_cumplido: "No cumplido",
  pendiente: "Pendiente",
};

/**
 * Ver ‹unidad› — el expediente de una unidad (Marco 6.30–6.33).
 *
 * Nace con sus cuatro familias enteras, en el orden del 6.31: identidad,
 * actividad, relaciones, documentos. Cada parte dice si está con datos, vacía o
 * aún no disponible; ninguna se esconde. Los servicios con veredicto sólo
 * aparecen si la cuenta tiene contrato: sin Vernier, no aplican.
 *
 * Los servicios no llevan liga a propósito (ASAV, 16 sep 2026): Ver ‹servicio›
 * no existe en el cascarón, y ligar a la pantalla vieja mezclaría las pieles.
 */
export default async function VerUnidad({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const cuenta = await cuentaDelCuarto(searchParams);
  if (!cuenta) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
        <SinCuenta />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta } = cuenta;
  const { unitId } = await params;
  const ahora = new Date();

  // La unidad de otra cuenta no existe desde aquí: `null`, y 404.
  const e = await cargarExpedienteDeUnidad(getRepos(), { carrierAccountId: carrier.id, unitId, ahora });
  if (!e) notFound();

  const nombre = e.identidad.numeroEconomico.estado === "con_datos" ? e.identidad.numeroEconomico.valor : "Unidad";
  const placa = e.identidad.placa.estado === "con_datos" ? e.identidad.placa.valor : null;

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: `Ver ${nombre}` }]} />
        <Titular
          nombre={nombre}
          bajo={[placa ?? "sin placa", carrier.name, e.unidad.activa ? null : "inactiva"].filter(Boolean).join(" · ")}
        />

        <Familia nombre="Identidad">
          <Parte pregunta="Número económico" parte={e.identidad.numeroEconomico} vacia="Sin número económico" conDatos={(v) => <Renglon pregunta="Número económico" medida>{v}</Renglon>} />
          <Parte pregunta="Placa" parte={e.identidad.placa} vacia="Sin placa capturada" conDatos={(v) => <Renglon pregunta="Placa" medida>{v}</Renglon>} />
        </Familia>

        <Familia nombre="Actividad">
          <Parte
            pregunta="Última señal"
            parte={e.actividad.ultimaSenal}
            vacia={e.relaciones.dispositivos.estado === "con_datos" ? "Su dispositivo nunca ha reportado" : "Sin dispositivo: no hay señal que leer"}
            conDatos={(s) => {
              const g = glifoDeUnidad(s.estado);
              const velocidad = s.estado.tipo === "en_linea" && s.estado.velocidadKmh !== null ? `${s.estado.velocidadKmh.toFixed(1)} km/h` : null;
              return (
                <Pieza
                  estado={g.glifo}
                  rumbo={g.rumbo}
                  nombre={g.palabra}
                  apoyo={velocidad ?? "sin velocidad"}
                  dato={edad(s.at, ahora)}
                  etiqueta="última señal"
                  edad={null}
                />
              );
            }}
          />
          {/* Mapa y playback se encienden con Flota en vivo; este renglón será su puerta. */}
          <Parte pregunta="Recorridos y playback" parte={e.actividad.recorridos} vacia="" conDatos={() => null} />
          {e.actividad.servicios && (
            <Parte
              pregunta="Servicios con veredicto"
              parte={e.actividad.servicios}
              vacia="Sin servicios con veredicto"
              conDatos={(servicios) => (
                <div className="flex flex-col gap-2">
                  <Encabezado izquierda={`Servicios con veredicto · últimos ${servicios.length}`} />
                  {servicios.map((s) => (
                    <Renglon key={s.ocurrenciaId} pregunta={`${s.ruta} · ${s.turno}`}>
                      {VEREDICTO[s.status] ?? s.status}
                      {s.timing ? ` · ${s.timing.replace("_", " ")}` : ""} · {fechaCorta(s.fecha)}
                    </Renglon>
                  ))}
                </div>
              )}
            />
          )}
        </Familia>

        <Familia nombre="Relaciones">
          <Parte
            pregunta="Dispositivos"
            parte={e.relaciones.dispositivos}
            vacia="Sin dispositivo asignado, nunca"
            conDatos={(lista) => (
              <div className="flex flex-col gap-2">
                {[...lista].reverse().map((d) => (
                  <Pieza
                    key={`${d.deviceId}-${d.desde.toISOString()}`}
                    nombre={d.etiqueta ?? d.imei}
                    apoyo={d.vigente ? `desde ${diaDe(d.desde, JTTEL_TZ)}` : `hasta ${d.hasta ? diaDe(d.hasta, JTTEL_TZ) : "—"}`}
                    dato={d.vigente ? "vigente" : "antes"}
                    etiqueta="dispositivo"
                    edad={null}
                    apagada={!d.vigente}
                    ficha={rutas.dispositivo(d.deviceId, cuentaEnRuta)}
                  />
                ))}
              </div>
            )}
          />
          <Parte pregunta="Choferes" parte={e.relaciones.choferes} vacia="Sin choferes asignados" conDatos={() => null} />
        </Familia>

        <Familia nombre="Documentos">
          <Parte
            pregunta="Papeles"
            parte={e.documentos}
            vacia="El catálogo de su mercado no tiene papeles de unidad"
            conDatos={(docs) => {
              // Primero lo que pide algo, como en el cuarto.
              const conPieza = docs.papeles
                .filter((p) => p.estado.estado !== "no_capturado")
                .sort((a, b) => ORDEN_DE_ESTADOS.indexOf(a.estado.estado) - ORDEN_DE_ESTADOS.indexOf(b.estado.estado));
              const opcionales = docs.papeles.filter((p) => p.estado.estado === "no_capturado");
              const { pidenAlgo, faltaLaRegla } = docs.resumen;
              return (
                <div className="flex flex-col gap-2">
                  <Encabezado
                    izquierda={`Catálogo de ${docs.mercado.nombre}`}
                    derecha={[`${pidenAlgo} piden algo`, faltaLaRegla ? `${faltaLaRegla} sin regla` : null].filter(Boolean).join(" · ")}
                  />
                  {conPieza.map((p) => {
                    const { dato, etiqueta } = datoDePapel(p.estado);
                    const version = p.vigente?.versiones[0];
                    const apoyo = version
                      ? [version.folio ?? "sin folio", "sin archivo"].join(" · ")
                      : p.estado.estado === "falta" ? "obligatorio" : "sin capturar";
                    return (
                      <Pieza
                        key={p.tipo.id}
                        estado={glifoDePapel(p.estado.estado)!}
                        nombre={p.tipo.nombre}
                        apoyo={apoyo}
                        dato={dato}
                        etiqueta={etiqueta}
                        edad={null}
                        apagada={papelApagado(p.estado.estado)}
                        ficha={rutas.papel(e.unidad.id, p.tipo.id, cuentaEnRuta)}
                      />
                    );
                  })}
                  {opcionales.length > 0 && (
                    <p className="px-1 text-[13px] text-[var(--tenue)]">
                      Opcionales sin capturar:{" "}
                      {opcionales.map((p, i) => (
                        <span key={p.tipo.id}>
                          {i > 0 && ", "}
                          <Link
                            href={rutas.papel(e.unidad.id, p.tipo.id, cuentaEnRuta)}
                            className="cursor-pointer underline decoration-[var(--linea)] underline-offset-4 hover:text-[var(--tinta)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
                          >
                            {p.tipo.nombre}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              );
            }}
          />
        </Familia>
      </div>
    </Marco>
  );
}
