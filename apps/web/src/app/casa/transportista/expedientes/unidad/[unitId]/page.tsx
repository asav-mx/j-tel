import Link from "next/link";
import { notFound } from "next/navigation";
import { JTTEL_TZ, ORDEN_DE_ESTADOS } from "@jtel/domain";
import { cargarExpedienteDeUnidad } from "@jtel/services";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { AvisoDeError, Encabezado, Familia, Parte, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { PanelDeIdentidadDeUnidad } from "@/components/casa/paneles-de-unidad";
import { clases } from "@/components/casa/formulario";
import { textoDeRuta } from "@/lib/casa/dispositivos";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
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
  const reloj = await relojDePagina("ver-unidad");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUENTA} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta, identidad } = cuenta;
  const { unitId } = await params;
  const sp = await searchParams;
  const ahora = new Date();

  // La unidad de otra cuenta no existe desde aquí: `null`, y 404.
  const e = await cargarExpedienteDeUnidad(getRepos(), { carrierAccountId: carrier.id, unitId, ahora });
  reloj.marca("datos");
  reloj.fin();
  if (!e) notFound();

  const nombre = e.identidad.numeroEconomico.estado === "con_datos" ? e.identidad.numeroEconomico.valor : "Unidad";
  const placa = e.identidad.placa.estado === "con_datos" ? e.identidad.placa.valor : null;
  const vin = e.identidad.vin.estado === "con_datos" ? e.identidad.vin.valor : null;

  // C4-e: corregir la identidad. Coordinador y admin (`puedeManejarFlota`); a
  // despacho no se le dibuja el botón, y la ruta vuelve a preguntar.
  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const corrigiendo = actua && sp.accion === "corregir";
  const ficha = rutas.unidad(e.unidad.id, cuentaEnRuta);
  const conCorregir = `${ficha}${ficha.includes("?") ? "&" : "?"}accion=corregir`;
  // El «hecho» sólo nombra qué pasó; lo que se ve es lo que dice la base.
  const hecho = sp.hecho === "alta" ? "Dada de alta." : sp.hecho === "corregida" ? "Identidad corregida." : null;

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[{ nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) }, { nombre: `Ver ${nombre}` }]} />
        <Titular
          nombre={nombre}
          bajo={[placa ?? "sin placa", carrier.name, e.unidad.activa ? null : "inactiva"].filter(Boolean).join(" · ")}
        />

        {hecho && !corrigiendo && (
          <p role="status" className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px]">
            {hecho}
          </p>
        )}

        <Familia nombre="Identidad">
          {corrigiendo ? (
            <PanelDeIdentidadDeUnidad
              modo="corregir"
              cuenta={carrier.slug}
              unitId={e.unidad.id}
              valores={{
                // Si vuelve de un error, lo tecleado; si no, lo que dice la base.
                nombre: textoDeRuta(sp.nombre, 60) ?? (e.identidad.numeroEconomico.estado === "con_datos" ? nombre : ""),
                placa: sp.error ? (textoDeRuta(sp.placa, 30) ?? "") : (placa ?? ""),
                vin: sp.error ? (textoDeRuta(sp.vin, 40) ?? "") : (vin ?? ""),
              }}
              error={textoDeRuta(sp.error)}
              cancelar={ficha}
            />
          ) : (
            <>
              <Parte pregunta="Número económico" parte={e.identidad.numeroEconomico} vacia="Sin número económico" conDatos={(v) => <Renglon pregunta="Número económico" medida>{v}</Renglon>} />
              <Parte pregunta="Placa" parte={e.identidad.placa} vacia="Sin placa capturada" conDatos={(v) => <Renglon pregunta="Placa" medida>{v}</Renglon>} />
              <Parte pregunta="VIN" parte={e.identidad.vin} vacia="Sin VIN capturado" conDatos={(v) => <Renglon pregunta="VIN" medida>{v}</Renglon>} />
              {actua && (
                <div>
                  <Link href={conCorregir} className={clases.secundario}>
                    Corregir
                  </Link>
                </div>
              )}
            </>
          )}
        </Familia>

        {/* Un error que no es del panel regresa sin `accion`: si sólo lo pintara el panel, no se vería. */}
        {!corrigiendo && textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

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
          <Parte
            pregunta="Recorridos y playback"
            parte={e.actividad.recorridos}
            vacia="Sin dispositivo, nunca: no hay recorrido medido"
            conDatos={() => (
              <Pieza
                nombre="Recorridos y playback"
                apoyo="el mapa de un periodo"
                dato="hoy"
                etiqueta="abre en"
                edad={null}
                ficha={rutas.recorrido(e.unidad.id, cuentaEnRuta)}
              />
            )}
          />
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
