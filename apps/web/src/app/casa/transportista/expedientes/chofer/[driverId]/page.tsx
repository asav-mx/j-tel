import Link from "next/link";
import { notFound } from "next/navigation";
import { JTTEL_TZ, ORDEN_DE_ESTADOS } from "@jtel/domain";
import { cargarExpedienteDeChofer } from "@jtel/services";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { AvisoDeError, Encabezado, Familia, Parte, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { PanelDeIdentidadDeChofer } from "@/components/casa/paneles-de-chofer";
import { clases } from "@/components/casa/formulario";
import { textoDeRuta } from "@/lib/casa/dispositivos";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { rutaDelCajon } from "@/lib/casa/archivero";
import { aunNoDisponibleEnPalabras, datoDePapel, diaDe, fechaCorta, glifoDePapel, papelApagado, rutas } from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * Ver ‹chofer› — el expediente de un chofer (Marco 6.30–6.33; Choferes V1).
 *
 * Nace con sus cuatro familias enteras, como la unidad: identidad, actividad,
 * relaciones, documentos. Cada parte dice si está con datos, vacía o aún no
 * disponible —y de dónde va a llegar—; ninguna se esconde.
 *
 * - **Actividad**: las unidades que operó **según el transportista** —el chofer
 *   declarado en cada servicio—. Declarado, no medido (Plan-Choferes §1).
 * - **Documentos**: los papeles de chofer del catálogo de su mercado. La
 *   «Licencia» nace en el alta, con el número de folio. Examen médico y
 *   antidoping esperan la palabra del abogado: se dicen, sin captura, y no
 *   cuentan (enmienda 4).
 *
 * Corregir la identidad: coordinador y admin (`puedeManejarFlota`), como la
 * unidad; la ruta vuelve a preguntar.
 */
export default async function VerChofer({
  params,
  searchParams,
}: {
  params: Promise<{ driverId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("ver-chofer");
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
  const { driverId } = await params;
  const sp = await searchParams;
  const ahora = new Date();

  // El chofer de otra cuenta no existe desde aquí: `null`, y 404.
  const e = await cargarExpedienteDeChofer(getRepos(), { carrierAccountId: carrier.id, driverId, ahora });
  reloj.marca("datos");
  reloj.fin();
  if (!e) notFound();

  const nombre = e.identidad.nombre.estado === "con_datos" ? e.identidad.nombre.valor : "Chofer";
  const licencia = e.identidad.licencia.estado === "con_datos" ? e.identidad.licencia.valor : null;
  const purgado = e.chofer.credencialesPurgadasAt;

  const actua = puedeManejarFlota(identidad.memberships, carrier.id) && e.chofer.activo && !purgado;
  const corrigiendo = actua && sp.accion === "corregir";
  const ficha = rutas.chofer(e.chofer.id, cuentaEnRuta);
  const conCorregir = `${ficha}${ficha.includes("?") ? "&" : "?"}accion=corregir`;
  // El «hecho» sólo nombra qué pasó; lo que se ve es lo que dice la base.
  const hecho = sp.hecho === "alta" ? "Dado de alta." : sp.hecho === "corregido" ? "Identidad corregida." : null;

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas
          pasos={[
            { nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) },
            { nombre: "Choferes", ruta: rutaDelCajon("choferes", cuentaEnRuta) },
            { nombre: `Ver ${nombre}` },
          ]}
        />
        <Titular nombre={nombre} bajo={[licencia ?? "sin licencia", carrier.name, e.chofer.activo ? null : "de baja"].filter(Boolean).join(" · ")} />

        {hecho && !corrigiendo && (
          <p role="status" className="rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px]">
            {hecho}
          </p>
        )}

        <Familia nombre="Identidad">
          {purgado ? (
            <Renglon pregunta="Credenciales" tenue>
              Purgadas el {diaDe(purgado, JTTEL_TZ)}: sus hechos se conservan
            </Renglon>
          ) : corrigiendo ? (
            <PanelDeIdentidadDeChofer
              modo="corregir"
              cuenta={carrier.slug}
              driverId={e.chofer.id}
              valores={{
                // Si vuelve de un error, lo tecleado; si no, lo que dice la base.
                nombre: textoDeRuta(sp.nombre, 140) ?? (e.identidad.nombre.estado === "con_datos" ? nombre : ""),
                licencia: textoDeRuta(sp.licencia, 40) ?? (licencia ?? ""),
                venceEl: "",
              }}
              pideVencimiento={false}
              error={textoDeRuta(sp.error)}
              cancelar={ficha}
            />
          ) : (
            <>
              <Parte pregunta="Nombre" parte={e.identidad.nombre} vacia="Sin nombre" conDatos={(v) => <Renglon pregunta="Nombre">{v}</Renglon>} />
              <Parte pregunta="Licencia" parte={e.identidad.licencia} vacia="Sin licencia" conDatos={(v) => <Renglon pregunta="Número de licencia" medida>{v}</Renglon>} />
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
            pregunta="Unidades que ha operado"
            parte={e.actividad.unidadesOperadas}
            vacia="Sin unidades operadas"
            conDatos={(lista) => (
              <div className="flex flex-col gap-2">
                <Encabezado izquierda="Unidades que ha operado · según el transportista" />
                {lista.map((u) => (
                  <Pieza
                    key={u.unitId}
                    nombre={u.etiqueta}
                    apoyo={`último ${diaDe(u.ultimo, JTTEL_TZ)}`}
                    dato={String(u.servicios)}
                    etiqueta={u.servicios === 1 ? "servicio" : "servicios"}
                    edad={null}
                    ficha={rutas.unidad(u.unitId, cuentaEnRuta)}
                  />
                ))}
              </div>
            )}
          />
        </Familia>

        <Familia nombre="Relaciones">
          <Parte
            pregunta="Rutas y turnos asignados"
            parte={e.relaciones.rutas}
            vacia="Sin rutas asignadas"
            conDatos={(rutasAsignadas) => (
              <div className="flex flex-col gap-2">
                {rutasAsignadas.map((r) => (
                  <Renglon key={`${r.routeShiftId}-${r.desde}`} pregunta={`${r.ruta} · ${r.turno}`}>
                    desde {fechaCorta(r.desde)}
                    {r.hasta ? ` hasta ${fechaCorta(r.hasta)}` : " · fija"}
                  </Renglon>
                ))}
              </div>
            )}
          />
        </Familia>

        <Familia nombre="Documentos">
          <Parte
            pregunta="Papeles"
            parte={e.documentos}
            vacia="El catálogo de su mercado no tiene papeles de chofer"
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
                        ficha={rutas.papelDeChofer(e.chofer.id, p.tipo.id, cuentaEnRuta)}
                      />
                    );
                  })}
                  {/* Examen médico y antidoping: se dicen, sin captura y sin contar (enmienda 4). */}
                  {docs.enEspera.map((t) => (
                    <Renglon key={t.id} pregunta={t.nombre} tenue>
                      {aunNoDisponibleEnPalabras("palabra_del_abogado")}
                    </Renglon>
                  ))}
                  {opcionales.length > 0 && (
                    <p className="px-1 text-[13px] text-[var(--tenue)]">
                      Opcionales sin capturar:{" "}
                      {opcionales.map((p, i) => (
                        <span key={p.tipo.id}>
                          {i > 0 && ", "}
                          <Link
                            href={rutas.papelDeChofer(e.chofer.id, p.tipo.id, cuentaEnRuta)}
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
