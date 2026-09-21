import { Marco } from "@/components/casa/marco";
import { SinCuenta, Titular } from "@/components/casa/expediente";
import { Pieza } from "@/components/casa/pieza";
import { ALCANCE_SIN_CUENTA, CASAS } from "@/lib/casa/casas";
import { cuentaDelCuarto } from "@/lib/casa/cuenta-del-cuarto";
import { getRepos } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Circuitos — el cuarto de transporte público (mapa, sello «Transporte
 * público»; Marco 9.9).
 *
 * Lista los circuitos de la cuenta y nada más: **a la torre se llega tocando
 * una pieza** (mapa, regla 2), y lo que se abre es el circuito, cuya parte de
 * actividad viva es el radar.
 *
 * **La lectura lleva muro** (`listarCircuitosVisiblesParaCuenta`, del #473 a
 * nivel cuenta): la concesión dueña ve los suyos, un carrier ve aquellos donde
 * tiene unidades propias que él asignó, y nadie más ve nada. `listAllCircuits`
 * —la de J-Staff— no se usa aquí, y una valla estática lo vigila.
 *
 * El cuarto **existe sólo si la cuenta opera transporte público**, y eso es
 * exactamente «tiene al menos un circuito visible»: la misma lectura que llena
 * esta pantalla decide si la pestaña se dibuja (mapa, regla 4).
 */
export default async function Circuitos({
  searchParams,
}: {
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

  const { carrier, cuentaEnRuta } = cuenta;
  const circuitos = await getRepos().circuits.listarCircuitosVisiblesParaCuenta(carrier.id);
  const cola = cuentaEnRuta ? `?account=${cuentaEnRuta}` : "";

  return (
    <Marco casa={casa} alcance={cuenta.alcance} cuenta={cuenta.casa} lugar="/casa/transportista/circuitos">
      <Titular nombre="Circuitos" bajo={`${circuitos.length} en esta cuenta`} />

      {circuitos.length === 0 ? (
        <p className="mt-8 text-[15px] leading-relaxed text-[var(--tenue)]">
          Sin circuitos en esta cuenta. Un circuito aparece aquí cuando esta cuenta es su concesión, o cuando alguna
          de sus unidades queda asignada a él.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {circuitos.map((c) => (
            <Pieza
              key={c.id}
              nombre={c.name}
              apoyo={c.esDeLaConcesion ? "tu concesión" : "corres unidades aquí"}
              dato={`${c.serviceStartLocal.slice(0, 5)}–${c.serviceEndLocal.slice(0, 5)}`}
              etiqueta="SERVICIO"
              /*
               * Un circuito de la lista no es un dato vivo: su horario es lo
               * declarado, no una lectura. La edad va `null` a propósito, que es
               * decisión escrita y no olvido — lo vivo empieza al abrirlo.
               */
              edad={null}
              apagada={!c.active}
              ficha={`/casa/transportista/circuitos/${c.id}${cola}`}
            />
          ))}
        </div>
      )}
    </Marco>
  );
}
