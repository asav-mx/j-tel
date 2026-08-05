import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { getIdentidad } from "@/lib/auth";
import { sesionUtilizable } from "@/lib/guardia-pagina";
import { CLERK_CONFIGURADO } from "@/lib/clerk-estado";
import { destinoDeVuelta, PARAM_VOLVER } from "@/lib/destino-de-vuelta";

export const dynamic = "force-dynamic";

/**
 * `/entrar` — la puerta.
 *
 * Pieza 1.i del plan. Hasta ahora el botón de iniciar sesión vivía en
 * `/quien-soy`, que es **pantalla de diagnóstico**: enseña el origen de la
 * identidad, el conteo de membresías, si el encabezado de suplantación fue
 * rechazado. Pedirle a alguien que entre por ahí es hacerle leer el tablero del
 * taller para abrir la puerta.
 *
 * `/quien-soy` no desaparece ni cambia — sigue siendo el instrumento, y se llega
 * a él desde aquí por un enlace discreto. Lo que cambia es a dónde manda la
 * guardia cuando niega el paso.
 *
 * ## Esta pantalla no se guarda, y no puede guardarse
 *
 * Es el destino de la negativa. Ponerle guardia haría un bucle de
 * redirecciones. Es también la única pantalla, junto con `/quien-soy`, que tiene
 * sentido ver sin haber entrado.
 *
 * ## Lo que NO dice
 *
 * El motivo llega como código corto en la URL y se traduce a una frase que **no
 * nombra cuentas, plantas ni identidades**. Es una pantalla que ve cualquiera:
 * un motivo detallado aquí filtraría justo lo que la guardia protege. «Esto no
 * es tuyo» ya es todo lo que se puede decir sin confirmar que existe.
 */

/**
 * Las cuatro negativas de `guardia-pagina.ts`, en cristiano.
 *
 * Se traducen aquí y no en la guardia a propósito: la guardia manda un código
 * porque un código no filtra: viaja en una URL que cualquiera puede leer y
 * compartir. La frase se elige del lado que sabe a quién se la está enseñando.
 */
const MOTIVOS: Record<string, { titulo: string; lectura: string }> = {
  "sin-sesion": {
    titulo: "Necesitas entrar para ver eso.",
    lectura: "La pantalla que pediste pide sesión. Entra y te llevamos a lo tuyo.",
  },
  "sin-alcance": {
    titulo: "Eso no es tuyo.",
    lectura:
      "Entraste bien, pero esa pantalla pertenece a otra operación. Si crees que debería ser tuya, quien administra tu cuenta puede darte el acceso.",
  },
  "identidad-irresoluble": {
    titulo: "No pudimos resolver quién eres.",
    lectura:
      "No es que te hayamos negado el paso: no logramos leer la identidad de esta petición. Vuelve a entrar; si sigue igual, es cosa nuestra y no tuya.",
  },
  "membresia-irresoluble": {
    titulo: "No pudimos comprobar tu acceso.",
    lectura:
      "Sabemos quién eres, pero no pudimos leer a qué alcanzas. Ante la duda no se pasa. Vuelve a intentar en un momento.",
  },
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const crudo = typeof sp?.motivo === "string" ? sp.motivo : null;
  const motivo = crudo && crudo in MOTIVOS ? MOTIVOS[crudo]! : null;

  const identidad = await getIdentidad();
  const yaEntraste = sesionUtilizable(identidad);

  /*
   * Pieza 1.j. Se valida AQUÍ aunque la guardia ya lo haya validado al
   * escribirlo: este parámetro lo puede teclear cualquiera en la barra de
   * direcciones, así que el único lugar donde la comprobación cuenta es el
   * que lo consume. Ver `destino-de-vuelta.ts` — un `?volver=` sin comprobar
   * es un redirector abierto, y el momento en que dispararía es el peor
   * posible: justo después de que la persona tecleó su contraseña.
   *
   * Rechazado significa `null`, y `null` significa la portada. No se avisa de
   * que se rechazó: un mensaje explicando por qué le enseña a quien lo está
   * probando cuál es la siguiente forma que sí pasa.
   */
  const volver = destinoDeVuelta(sp?.[PARAM_VOLVER]);
  const seguir = volver ?? "/";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-5 py-16">
      <p className="mb-4 font-mono text-[10.5px] font-medium tracking-[0.17em] text-[var(--tenue)] uppercase">
        J-Telemetry
      </p>

      <h1 className="mb-3 max-w-[22ch] font-[family-name:var(--fuente-archivo)] text-[30px] leading-[1.08] font-bold tracking-[-0.02em] text-[var(--texto)]">
        {motivo ? motivo.titulo : yaEntraste ? "Ya entraste." : "Entra a J-Telemetry."}
      </h1>

      <p className="mb-8 max-w-[52ch] text-[14px] leading-relaxed text-[var(--tenue)]">
        {motivo
          ? motivo.lectura
          : yaEntraste
            ? volver
              ? "Tu sesión está viva. Sigue y te dejamos donde ibas."
              : "Tu sesión está viva. Sigue a la portada y verás lo que te corresponde."
            : "Una sola cuenta para tu operación. Entra y verás solo lo tuyo."}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/*
          Con sesión utilizable no se ofrece "iniciar sesión": ofrecer una
          puerta que ya está abierta manda a la gente a resolver el problema
          equivocado. Se ofrece seguir.
        */}
        {yaEntraste ? (
          <Link
            href={seguir}
            className="cursor-pointer rounded-sm border border-[var(--azul)] px-4 py-2.5 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--azul)] uppercase transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)]"
          >
            {volver ? "Continuar" : "Ir a la portada"}
          </Link>
        ) : CLERK_CONFIGURADO ? (
          /*
           * `forceRedirectUrl` y no `fallbackRedirectUrl`: el segundo cede ante
           * lo que Clerk tenga guardado de una vuelta anterior, y entonces el
           * destino que la guardia apuntó se pierde justo cuando sirve.
           */
          <SignInButton forceRedirectUrl={seguir}>
            <button className="cursor-pointer rounded-sm border border-[var(--azul)] px-4 py-2.5 font-mono text-[11px] font-medium tracking-[0.11em] text-[var(--azul)] uppercase transition-colors hover:bg-[var(--hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)]">
              Iniciar sesión
            </button>
          </SignInButton>
        ) : (
          /*
            Sin llaves de Clerk no se pinta un botón que no abre nada. Un botón
            muerto en la puerta de entrada es peor que decirlo: manda a la
            persona a intentar otra vez lo que no puede funcionar.
          */
          <p className="max-w-[52ch] border-l-2 border-[var(--acero)] py-1 pl-4 text-[13px] text-[var(--tenue)]">
            <b className="font-medium text-[var(--texto)]">
              Este despliegue no tiene el inicio de sesión configurado.
            </b>{" "}
            No hay por dónde entrar desde aquí todavía.
          </p>
        )}
      </div>

      {/*
        El diagnóstico sigue existiendo y se llega desde aquí — pero abajo,
        tenue y nombrado por lo que es. Esa es toda la diferencia entre una
        puerta y un tablero.
      */}
      <p className="mt-10 border-t border-[var(--linea)] pt-5 font-mono text-[11px] text-[var(--tenue)]">
        <Link
          href="/quien-soy"
          className="cursor-pointer text-[var(--azul)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--azul)]"
        >
          Diagnóstico de identidad
        </Link>
        {" — de dónde sale la identidad de esta sesión y qué alcanza."}
      </p>
    </main>
  );
}
