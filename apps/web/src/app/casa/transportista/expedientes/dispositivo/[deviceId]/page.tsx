import Link from "next/link";
import { notFound } from "next/navigation";
import { JTTEL_TZ } from "@jtel/domain";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { cargarCuartoDeDispositivos, cargarExpedienteDeDispositivo } from "@jtel/services";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Migas } from "@/components/casa/migas";
import { Pieza } from "@/components/casa/pieza";
import { AvisoDeError, Familia, Parte, Renglon, SinCuenta, Titular } from "@/components/casa/expediente";
import { PanelAsignar, PanelMotivo } from "@/components/casa/paneles-de-dispositivo";
import { clases } from "@/components/casa/formulario";
import { ALCANCE_SIN_CUARTOS, CASAS } from "@/lib/casa/casas";
import { correosDeAutores } from "@/lib/casa/autores";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import { diaDe, edad, glifoDeDispositivo, rutas } from "@/lib/casa/expedientes";
import {
  RAIZ_DISPOSITIVOS,
  SUGERENCIAS,
  accionDeFicha,
  hechoDeFicha,
  horaDe,
  puertaDe,
  quienYPorQue,
  rutasDeDispositivos,
  senalViva,
  textoDeRuta,
} from "@/lib/casa/dispositivos";

export const dynamic = "force-dynamic";

/**
 * Ver ‹dispositivo› — el expediente de un dispositivo (Marco 6.30–6.33), y
 * desde C4-c el lugar donde se actúa sobre él: asignar, soltar y dar de baja
 * (6.18, 6.25). Prototipo aprobado el 17 sep 2026.
 *
 * Identidad, actividad y relaciones. **Sin familia de documentos**: un
 * dispositivo no lleva papeles, así que no aplica y no se dibuja (decidido el
 * 16 sep 2026). La baja aparece sólo si la tiene.
 *
 * ## Las acciones
 *
 * Sólo las que proceden y sólo para quien actúa (`puedeManejarFlota`): uno de
 * baja no tiene ninguna, uno en bodega no se suelta, y a despacho no se le
 * dibuja un solo botón (regla 4 del mapa). Cada botón abre su panel en la misma
 * página con `?accion=`; la ruta vuelve a preguntar todo.
 *
 * **Quitar la baja no tiene botón** (decisión 8 de la ficha de C4): es un
 * pendiente con nombre por el 6.18, y mientras no exista el panel de baja avisa
 * que no se deshace desde aquí. Un botón que no hace nada sería peor (6.19).
 *
 * ## Dos puertas
 *
 * Se llega desde Expedientes y desde Dispositivos; las migas regresan a la que
 * se usó (`?desde=`).
 */
export default async function VerDispositivo({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("ver-dispositivo");
  const cuenta = await cuentaDelCuarto(searchParams);
  reloj.marca("guardia");
  if (!cuenta.carrier) {
    return (
      <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa}>
        <SinCuenta elegibles={cuenta.casa.elegibles} />
      </Marco>
    );
  }
  const { carrier, cuentaEnRuta, identidad } = cuenta;
  const { deviceId } = await params;
  const sp = await searchParams;
  const ahora = new Date();
  const repos = getRepos();

  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const puerta = puertaDe(sp.desde);
  const hecho = hechoDeFicha(sp.hecho);
  const desplazadoId = typeof sp.desplazado === "string" ? sp.desplazado : null;
  let accion = actua ? accionDeFicha(sp.accion) : null;

  const e = await cargarExpedienteDeDispositivo(repos, { carrierAccountId: carrier.id, deviceId, ahora });
  if (!e) {
    reloj.fin();
    notFound();
  }
  const grupo = e.dispositivo.estado?.grupo ?? null;
  // Una acción que ya no procede no abre su panel: de baja no hay nada que
  // hacer, y en bodega no hay qué soltar.
  if (grupo === "de_baja" || (accion === "soltar" && grupo === "en_bodega")) accion = null;

  // El inventario sólo hace falta para ofrecer unidades o nombrar al desplazado.
  const cuarto =
    accion === "asignar" || (hecho === "asignado" && desplazadoId)
      ? await cargarCuartoDeDispositivos(repos, { carrierAccountId: carrier.id, ahora })
      : null;
  const unidades = e.relaciones.unidades.estado === "con_datos" ? e.relaciones.unidades.valor : [];
  const autores = await correosDeAutores([
    ...unidades.flatMap((u) => [u.asignadaPor, u.cerradaPor]),
    e.identidad.baja?.estado === "con_datos" ? e.identidad.baja.valor.por : null,
  ]);
  reloj.marca("datos");
  reloj.fin();

  const correo = (id: string) => autores.get(id) ?? id;
  const imei = e.identidad.imei.estado === "con_datos" ? e.identidad.imei.valor : "";
  const nombre = e.identidad.nombre.estado === "con_datos" ? e.identidad.nombre.valor : imei;
  const vigente = unidades.find((u) => u.vigente) ?? null;
  const estado = grupo ? glifoDeDispositivo({ grupo }).palabra : null;

  const esta = (params: Parameters<typeof rutasDeDispositivos.ver>[2] = {}) =>
    rutasDeDispositivos.ver(deviceId, cuentaEnRuta, { desde: puerta, ...params });
  const regreso =
    puerta === "dispositivos"
      ? { nombre: "Dispositivos", ruta: rutasDeDispositivos.cuarto(cuentaEnRuta) }
      : { nombre: "Expedientes", ruta: rutas.cuarto(cuentaEnRuta) };

  const fraseDelHecho = armarHecho({ hecho, grupo, vigente, unidades, desplazadoId, cuarto });
  const error = textoDeRuta(sp.error);
  const comunes = { cuenta: carrier.slug, deviceId, desde: puerta, nombre, cancelar: esta(), error };

  return (
    <Marco casa={casa} alcance={ALCANCE_SIN_CUARTOS} cuenta={cuenta.casa} lugar={puerta === "dispositivos" ? RAIZ_DISPOSITIVOS : undefined}>
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <Migas pasos={[regreso, { nombre: `Ver ${nombre}` }]} />
        <Titular
          nombre={nombre}
          bajo={[
            grupo === "en_unidad" && vigente ? `En ${vigente.etiqueta}` : estado && vigente && grupo === "desconectado" ? `${estado} en ${vigente.etiqueta}` : estado,
            carrier.name,
          ]
            .filter(Boolean)
            .join(" · ")}
        />

        {fraseDelHecho && (
          <p role="status" className="flex items-center gap-2.5 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-3.5 py-2.5 text-[14px]">
            <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-[var(--vivo)]" />
            <span>{fraseDelHecho}</span>
          </p>
        )}
        {/* Un error sin panel abierto (la guardia, o una acción que ya no procede) se dibuja aquí. */}
        {error && !accion && <AvisoDeError mensaje={error} />}

        {actua && grupo !== null && grupo !== "de_baja" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" aria-label="Acciones">
              <Link
                href={accion === "asignar" ? esta() : esta({ accion: "asignar" })}
                className={clases.abridor(accion === "asignar")}
                aria-expanded={accion === "asignar"}
              >
                {vigente ? "Mover a otra unidad" : "Asignar a una unidad"}
              </Link>
              {vigente && (
                <Link
                  href={accion === "soltar" ? esta() : esta({ accion: "soltar" })}
                  className={clases.abridor(accion === "soltar")}
                  aria-expanded={accion === "soltar"}
                >
                  Soltar de {vigente.etiqueta}
                </Link>
              )}
              <Link
                href={accion === "baja" ? esta() : esta({ accion: "baja" })}
                className={clases.abridor(accion === "baja")}
                aria-expanded={accion === "baja"}
              >
                Dar de baja
              </Link>
            </div>

            {accion === "asignar" && cuarto && (
              <PanelAsignar
                {...comunes}
                unidadActual={vigente?.etiqueta ?? null}
                unidades={cuarto.unidades.filter((u) => u.id !== vigente?.unitId)}
                horaInicial={horaDe(ahora, JTTEL_TZ)}
                timeZone={JTTEL_TZ}
              />
            )}
            {accion === "soltar" && vigente && (
              <PanelMotivo
                {...comunes}
                tipo="soltar"
                titulo={`Soltar ${nombre} de ${vigente.etiqueta}`}
                nota={`Queda en bodega desde ahora. ${vigente.etiqueta} se queda sin dispositivo.`}
                sugerencias={SUGERENCIAS.soltar}
                motivoInicial={textoDeRuta(sp.motivo, 600) ?? ""}
              />
            )}
            {accion === "baja" && (
              <PanelMotivo
                {...comunes}
                tipo="baja"
                titulo={`Dar de baja ${nombre}`}
                nota={`${vigente ? `También lo suelta de ${vigente.etiqueta}. ` : ""}Su historia se queda. La baja no se deshace desde la pantalla.`}
                sugerencias={SUGERENCIAS.baja}
                motivoInicial={textoDeRuta(sp.motivo, 600) ?? ""}
              />
            )}
          </div>
        )}

        <Familia nombre="Identidad">
          <Parte pregunta="Nombre" parte={e.identidad.nombre} vacia="Sin nombre" conDatos={(v) => <Renglon pregunta="Nombre" medida>{v}</Renglon>} />
          <Parte pregunta="IMEI" parte={e.identidad.imei} vacia="Sin IMEI" conDatos={(v) => <Renglon pregunta="IMEI" medida>{v}</Renglon>} />
          {e.identidad.baja && (
            <Parte
              pregunta="Baja"
              parte={e.identidad.baja}
              vacia=""
              conDatos={(b) => (
                <>
                  <Renglon pregunta="De baja" medida>
                    {diaDe(b.at, JTTEL_TZ)} · {b.motivo ?? "sin motivo"}
                  </Renglon>
                  <Renglon pregunta="La dio" tenue={!b.por}>
                    {b.por ? correo(b.por) : "sin registro de quién"}
                  </Renglon>
                </>
              )}
            />
          )}
        </Familia>

        <Familia nombre="Actividad">
          <Parte
            pregunta="Última señal"
            parte={e.actividad.ultimaSenal}
            vacia="Nunca ha reportado"
            conDatos={(s) => {
              const g = glifoDeDispositivo(s.estado);
              return (
                <Pieza
                  estado={g.glifo}
                  nombre={g.palabra}
                  // Decía «transmitiendo por su unidad» (#421). Falso dos veces, y
                  // la segunda sólo se vio asignando: uno desconectado no
                  // transmite, y uno recién montado cuenta como EN UNIDAD con una
                  // señal de hace 5 días, de cuando estaba en bodega. Dónde está
                  // montado es verdad siempre; la edad ya dice lo demás.
                  apoyo={vigente && s.estado.grupo !== "en_bodega" && s.estado.grupo !== "de_baja" ? `en ${vigente.etiqueta}` : "sin unidad"}
                  dato={edad(s.at, ahora)}
                  etiqueta="última señal"
                  edad={null}
                  datoVivo={senalViva(s.estado, ahora)}
                  apagada={s.estado.grupo === "desconectado" || s.estado.grupo === "de_baja"}
                />
              );
            }}
          />
          <Parte
            pregunta="Recorridos y playback"
            parte={e.actividad.ultimaSenal}
            vacia="Nunca ha reportado: no hay recorrido medido"
            conDatos={() => (
              <Pieza
                nombre="Recorridos y playback"
                apoyo="el mapa de un periodo, por unidad"
                dato="hoy"
                etiqueta="abre en"
                edad={null}
                ficha={rutasDeDispositivos.recorrido(deviceId, cuentaEnRuta, puerta)}
              />
            )}
          />
        </Familia>

        <Familia nombre="Relaciones">
          <Parte
            pregunta="Unidades"
            parte={e.relaciones.unidades}
            vacia="Nunca ha estado en una unidad de esta cuenta"
            conDatos={(lista) => (
              <div className="flex flex-col gap-2">
                {[...lista].reverse().map((u) => (
                  <div key={`${u.unitId}-${u.desde.toISOString()}`} className="flex flex-col gap-1">
                    <Pieza
                      nombre={u.etiqueta}
                      apoyo={
                        u.vigente
                          ? `desde ${diaDe(u.desde, JTTEL_TZ)} ${horaDe(u.desde, JTTEL_TZ)}`
                          : `${diaDe(u.desde, JTTEL_TZ)} – ${u.hasta ? `${diaDe(u.hasta, JTTEL_TZ)} ${horaDe(u.hasta, JTTEL_TZ)}` : "—"}`
                      }
                      dato={u.vigente ? "vigente" : "antes"}
                      etiqueta="unidad"
                      edad={null}
                      apagada={!u.vigente}
                      ficha={rutas.unidad(u.unitId, cuentaEnRuta)}
                    />
                    <p className={`px-4 text-[12.5px] text-[var(--tenue)]${u.vigente ? "" : " opacity-60"}`}>
                      {quienYPorQue(u, correo)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          />
        </Familia>
      </div>
    </Marco>
  );
}

/**
 * La frase de lo que acaba de pasar, **leída de la base**. La dirección sólo
 * dice qué acción fue; si la base no lo sostiene —otra pestaña ya lo movió, o
 * alguien editó la dirección— no se dice nada.
 */
function armarHecho({
  hecho,
  grupo,
  vigente,
  unidades,
  desplazadoId,
  cuarto,
}: {
  hecho: ReturnType<typeof hechoDeFicha>;
  grupo: string | null;
  vigente: { etiqueta: string; desde: Date } | null;
  unidades: { etiqueta: string; hasta: Date | null; vigente: boolean }[];
  desplazadoId: string | null;
  cuarto: Awaited<ReturnType<typeof cargarCuartoDeDispositivos>> | null;
}): string | null {
  const ultimaCerrada = [...unidades].reverse().find((u) => !u.vigente && u.hasta) ?? null;
  switch (hecho) {
    case "asignado": {
      if (!vigente || grupo === "de_baja") return null;
      const desplazado = desplazadoId ? cuarto?.grupos.en_bodega.find((d) => d.id === desplazadoId) : null;
      return `Asignado a ${vigente.etiqueta} a las ${horaDe(vigente.desde, JTTEL_TZ)}.${
        desplazado ? ` ${desplazado.nombre ?? desplazado.imei} quedó en bodega.` : ""
      }`;
    }
    case "soltado":
      return grupo === "en_bodega" && ultimaCerrada ? `Soltado de ${ultimaCerrada.etiqueta}. Queda en bodega.` : null;
    case "baja":
      return grupo === "de_baja" ? "Dado de baja." : null;
    default:
      return null;
  }
}
