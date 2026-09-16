import { Pestanas } from "@/components/casa/pestanas";
import { InterruptorPiel } from "@/components/casa/interruptor-piel";
import { SelloDeLaSeccion } from "@/components/casa/sello-de-la-seccion";
import { menuDe, type Alcance, type Casa } from "@/lib/casa/casas";

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
 *   · el interruptor de piel, arriba a la derecha;
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
 * **No hay nombre de cuenta ni de usuario.** No porque estorben, sino porque el
 * marco todavía no lee un solo dato: escribir ahí un nombre de ejemplo sería
 * inventar. Entran cuando entre el primer cuarto que sepa de quién es la casa.
 */
export function Marco({
  casa,
  alcance,
  children,
}: {
  casa: Casa;
  alcance: Alcance;
  children: React.ReactNode;
}) {
  const grupos = menuDe(casa, alcance);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between gap-4 px-5 pb-2 pt-4 md:px-6">
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
        <InterruptorPiel />
      </header>

      {/* Sin lugares no se dibuja ni la barra: una barra vacía es un menú que
          promete y no tiene. `menuDe` ya quitó lo que no aplica y lo que aún no
          se construye, así que quedarse sin nada es un estado legítimo, no un
          error — hoy es el de las cuatro casas. */}
      {grupos.length > 0 && <Pestanas grupos={grupos} />}

      {/* El padding de abajo en celular deja libre la barra de pestañas fija. */}
      <main className="flex-1 px-5 pb-[68px] pt-5 md:px-6 md:pb-8">{children}</main>
    </div>
  );
}
