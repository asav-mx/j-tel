import Link from "next/link";
import { cargarCuartoDeExpedientes } from "@jtel/services";
import { puedeManejarFlota } from "@jtel/auth-rbac";
import { getRepos } from "@/lib/db";
import { Marco } from "@/components/casa/marco";
import { Pieza } from "@/components/casa/pieza";
import { AvisoDeError, Encabezado, Renglon, SinCuenta, Titular, Vacio } from "@/components/casa/expediente";
import { PanelDeIdentidadDeUnidad } from "@/components/casa/paneles-de-unidad";
import { clases } from "@/components/casa/formulario";
import { textoDeRuta } from "@/lib/casa/dispositivos";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { relojDePagina } from "@/lib/casa/cronometro";
import {
  aunNoDisponibleEnPalabras,
  datoDeResumen,
  edad,
  fechaCorta,
  glifoDeDispositivo,
  glifoDePapel,
  rutas,
} from "@/lib/casa/expedientes";

export const dynamic = "force-dynamic";

/**
 * El cuarto de Expedientes — la puerta a los expedientes de las cosas del
 * transportista (Marco 6.30–6.33; `docs/Ficha-Expedientes.md` §1).
 *
 * Es una **vista**: ve, agrupa y liga. Capturar, corregir y renovar un papel
 * se hace en el expediente de su unidad (Ley de Acción), y corregir la unidad
 * también. Lo único que se hace aquí es **dar de alta una unidad** (C4-e): lo
 * que todavía no existe no tiene expediente donde hacerse, igual que el alta de
 * un dispositivo vive en su cuarto.
 *
 * Tres grupos, en este orden: Unidades · Dispositivos · Choferes. La unidad
 * lleva el glifo de su peor papel y cuántos papeles le piden algo; el
 * dispositivo, su cuadro de inventario y la edad de su última señal. Primero lo
 * que pide hacer algo.
 *
 * El marco recibe el alcance de la cuenta (`cuenta.alcance`): Expedientes
 * aplica «siempre», pero el menú que lo rodea tiene que enseñar Servicios
 * especiales a una cuenta con contrato.
 */
export default async function CuartoDeExpedientes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const casa = CASAS.transportista;
  const reloj = await relojDePagina("expedientes");
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
  const sp = await searchParams;
  const ahora = new Date();
  const cuarto = await cargarCuartoDeExpedientes(getRepos(), { carrierAccountId: carrier.id, ahora });
  reloj.marca("datos");
  reloj.fin();

  // C4-e: dar de alta una unidad. El botón lo ven coordinador y admin
  // (`puedeManejarFlota`); a despacho no se le dibuja. La ruta vuelve a
  // preguntar, porque esconder un botón no es una guardia.
  const actua = puedeManejarFlota(identidad.memberships, carrier.id);
  const altaAbierta = actua && sp.accion === "alta-unidad";
  const conAlta = (abierta: boolean) => {
    const base = rutas.cuarto(cuentaEnRuta);
    return abierta ? `${base}${base.includes("?") ? "&" : "?"}accion=alta-unidad` : base;
  };

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titular
            nombre="Expedientes"
            bajo={
              cuarto.mercado
                ? `${carrier.name} · ${cuarto.mercado.nombre} · juzgado el ${fechaCorta(cuarto.mercado.hoy)}`
                : `${carrier.name} · sin mercado`
            }
          />
          {actua && (
            <Link
              href={conAlta(!altaAbierta)}
              className={altaAbierta ? clases.abridor(true) : clases.primario}
              aria-expanded={altaAbierta}
            >
              Dar de alta una unidad
            </Link>
          )}
        </div>

        {/* Un error que no es del panel —la guardia negó el paso, la cuenta no
            existe— regresa sin `accion`: si sólo lo pintara el panel, no se vería. */}
        {!altaAbierta && textoDeRuta(sp.error) && <AvisoDeError mensaje={textoDeRuta(sp.error)!} />}

        {altaAbierta && (
          <PanelDeIdentidadDeUnidad
            modo="alta"
            cuenta={carrier.slug}
            valores={{
              nombre: textoDeRuta(sp.nombre, 60) ?? "",
              placa: textoDeRuta(sp.placa, 30) ?? "",
              vin: textoDeRuta(sp.vin, 40) ?? "",
            }}
            error={textoDeRuta(sp.error)}
            cancelar={rutas.cuarto(cuentaEnRuta)}
          />
        )}

        <section className="flex flex-col gap-2.5" aria-label="Unidades">
          <Encabezado
            izquierda={`Unidades · ${cuarto.unidades.length}`}
            derecha={
              cuarto.papelesQuePidenAlgo === null
                ? null
                : cuarto.papelesQuePidenAlgo === 1
                  ? "1 papel pide algo"
                  : `${cuarto.papelesQuePidenAlgo} papeles piden algo`
            }
          />
          {cuarto.mercado === null && <Vacio>{aunNoDisponibleEnPalabras("mercado_de_la_cuenta")}</Vacio>}
          {cuarto.unidades.length === 0 && <Vacio>Sin unidades dadas de alta</Vacio>}
          {cuarto.unidades.map((u) => {
            const r = u.papeles.estado === "con_datos" ? u.papeles.valor : null;
            // Una inactiva no opera: sus papeles se juzgan igual (el glifo lo
            // dice), pero no pide nada ni cuenta en el total.
            const { dato, etiqueta } = !u.activa
              ? { dato: "—", etiqueta: "inactiva" }
              : r
                ? datoDeResumen(r)
                : { dato: "—", etiqueta: u.papeles.estado === "vacia" ? "sin papeles" : "sin mercado" };
            const glifo = (r?.peor && glifoDePapel(r.peor)) || "papel-falta-la-regla";
            return (
              <Pieza
                key={u.id}
                estado={glifo}
                nombre={u.numeroEconomico}
                apoyo={u.placa ?? "sin placa"}
                dato={dato}
                etiqueta={etiqueta}
                edad={null}
                apagada={!u.activa || Boolean(r?.estaAlDia)}
                ficha={rutas.unidad(u.id, cuentaEnRuta)}
              />
            );
          })}
        </section>

        <section className="flex flex-col gap-2.5" aria-label="Dispositivos">
          <Encabezado izquierda={`Dispositivos · ${cuarto.dispositivos.enServicio.length}`} />
          {cuarto.dispositivos.enServicio.length === 0 && <Vacio>Sin dispositivos en servicio</Vacio>}
          {cuarto.dispositivos.enServicio.map((d) => {
            const { glifo, palabra } = glifoDeDispositivo(d.estado);
            return (
              <Pieza
                key={d.id}
                estado={glifo}
                nombre={d.nombre ?? d.imei}
                apoyo={d.unidad ? `en ${d.unidad}` : palabra.toLowerCase()}
                dato={d.estado.ultimaSenalAt ? edad(d.estado.ultimaSenalAt, ahora) : "—"}
                etiqueta={d.estado.ultimaSenalAt ? "última señal" : "nunca reportó"}
                edad={null}
                apagada={d.estado.grupo === "desconectado"}
                ficha={rutas.dispositivo(d.id, cuentaEnRuta)}
              />
            );
          })}
          {cuarto.dispositivos.deBaja.length > 0 && (
            /* No se esconden: su historia queda y el motor la sigue leyendo.
               Van plegados al final para no ahogar a los que están en servicio. */
            <details className="group rounded-lg border border-[var(--linea)]">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] text-[var(--tenue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]">
                De baja · {cuarto.dispositivos.deBaja.length}
              </summary>
              <div className="flex flex-col gap-2 border-t border-[var(--linea)] p-2.5">
                {cuarto.dispositivos.deBaja.map((d) => (
                  <Pieza
                    key={d.id}
                    estado="dispositivo-de-baja"
                    nombre={d.nombre ?? d.imei}
                    apoyo={d.estado.grupo === "de_baja" ? `de baja · ${fechaCorta(d.estado.retiredAt.toISOString().slice(0, 10))}` : "de baja"}
                    dato={d.estado.ultimaSenalAt ? edad(d.estado.ultimaSenalAt, ahora) : "—"}
                    etiqueta="última señal"
                    edad={null}
                    apagada
                    ficha={rutas.dispositivo(d.id, cuentaEnRuta)}
                  />
                ))}
              </div>
            </details>
          )}
        </section>

        <section className="flex flex-col gap-2.5" aria-label="Choferes">
          <Encabezado izquierda="Choferes" />
          {cuarto.choferes.estado === "con_datos" ? (
            /* Sin glifo a propósito: este cuarto no juzga los papeles de los
               choferes todavía (llega con el PR E). Una forma aquí afirmaría
               un estado que nadie midió. */
            cuarto.choferes.valor.map((c) => (
              <Renglon key={c.id} pregunta={c.nombre ?? "Credenciales purgadas"} medida>
                {c.licencia ?? "sin licencia"}
                {c.activo ? "" : " · de baja"}
              </Renglon>
            ))
          ) : (
            <Vacio>Sin choferes dados de alta</Vacio>
          )}
        </section>
      </div>
    </Marco>
  );
}
