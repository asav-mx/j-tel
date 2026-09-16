import { Pestanas } from "@/components/casa/pestanas";
import { InterruptorPiel } from "@/components/casa/interruptor-piel";
import { SelloDeLaSeccion } from "@/components/casa/sello-de-la-seccion";
import { SelectorDeCuenta } from "@/components/casa/selector-de-cuenta";
import { menuDe, type Alcance, type Casa, type CuentaDeLaCasa } from "@/lib/casa/casas";

/**
 * El marco de una casa — el cascarón propiamente dicho.
 *
 * Una casa por cara, cada una con su puerta, sobre la misma data organizada. No
 * es la misma pantalla con permisos apagados: eso es lo que el mapa vino a
 * cambiar.
 *
 * Lo que el marco pone, y nada más:
 *
 *   · la marca, arriba a la izquierda;
 *   · la cuenta en la que se está, y el interruptor de piel, arriba a la derecha;
 *   · las pestañas de la casa, con su sello encima;
 *   · el área donde entra el cuarto.
 *
 * ## Lo que el marco NO tiene, a propósito
 *
 * **No hay asiento reservado para Lenore.** `Ficha-Navegacion-Completa.md` §F
 * pedía uno en el marco superior, «presente en todas las caras desde el primer
 * día… aunque todavía no haga nada». La regla 4 del mapa dice lo contrario y
 * gana: lo que no aplica no aparece, ni apagado, ni con candado, ni
 * «próximamente». Un asiento vacío es el cuarto vacío que hace mentir a la
 * casa. Lenore entra el día que tenga algo que decir, y ese día se le hace
 * lugar. Decidido por ASAV el 15 de septiembre de 2026.
 *
 * **No hay nombre de usuario.** No porque estorbe, sino porque ningún cuarto
 * lo necesita todavía: escribir ahí un nombre de ejemplo sería inventar.
 *
 * ## La cuenta
 *
 * Entró con los primeros cuartos que saben de quién es la casa (16 sep 2026),
 * porque sin ella el marco la perdía: las pestañas ligaban a la ruta pelona y
 * quien había entrado con `?account=` caía en «no hay cuenta» al cambiar de
 * lugar. El cuarto la resuelve con su guardia y la entrega en `cuenta`; el
 * marco no la vuelve a decidir. Con ella:
 *
 *   · las pestañas la arrastran;
 *   · arriba se dice en qué cuenta se está — el nombre si sólo hay una, el
 *     selector si hay varias;
 *   · sin cuenta resuelta, arriba no se dice nada: el cuarto dice «elige una
 *     cuenta» en su cuerpo, y dos selectores iguales en la pantalla estorban.
 *
 * Las casas que no trabajan sobre una cuenta elegible (hoy J-Staff, Planta y
 * Corporativo, que todavía no tienen cuartos con datos) no la pasan.
 */
export function Marco({
  casa,
  alcance,
  cuenta,
  children,
}: {
  casa: Casa;
  alcance: Alcance;
  cuenta?: CuentaDeLaCasa;
  children: React.ReactNode;
}) {
  const grupos = menuDe(casa, alcance);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* En celular la cuenta baja a su propio renglón: en la misma línea que la
          marca, el selector se comía el sello de la sección, que es lo único
          que deja ver «Compás» en el teléfono (#415). En computadora cabe todo
          en una línea, con la cuenta junto al interruptor. */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pb-2 pt-4 md:flex-nowrap md:px-6">
        <span className="flex min-w-0 items-center gap-2">
          <span
            style={{ fontFamily: "var(--letra-titular)", fontWeight: 800, letterSpacing: "-0.02em" }}
            className="flex-none text-[17px]"
          >
            J-Tel
          </span>
          {/* El sello de la sección, sólo en celular: ahí la barra de abajo no
              tiene dónde ponerlo y la marca se caería entera. En computadora
              cada sello ya vive encima de sus pestañas. */}
          <SelloDeLaSeccion grupos={grupos} />
        </span>
        {cuenta?.actual && (
          <span className="order-last flex w-full min-w-0 items-center md:order-none md:ml-auto md:w-auto">
            {cuenta.elegibles.length > 1 ? (
              <SelectorDeCuenta cara={casa.cara} elegibles={cuenta.elegibles} actual={cuenta.actual} id="cuenta-del-marco" />
            ) : (
              <span className="truncate text-[13px] text-[var(--tenue)]">{cuenta.actual.nombre}</span>
            )}
          </span>
        )}
        <InterruptorPiel />
      </header>

      {/* Sin lugares no se dibuja ni la barra: una barra vacía es un menú que
          promete y no tiene. `menuDe` ya quitó lo que no aplica y lo que aún no
          se construye, así que quedarse sin nada es un estado legítimo, no un
          error — hoy es el de las cuatro casas. */}
      {grupos.length > 0 && <Pestanas grupos={grupos} cuenta={cuenta?.enRuta ?? null} />}

      {/* El padding de abajo en celular deja libre la barra de pestañas fija. */}
      <main className="flex-1 px-5 pb-[68px] pt-5 md:px-6 md:pb-8">{children}</main>
    </div>
  );
}
