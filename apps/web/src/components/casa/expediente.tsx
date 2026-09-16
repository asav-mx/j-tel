import type { Parte as ParteDelDominio } from "@jtel/domain";
import { SelectorDeCuenta } from "@/components/casa/selector-de-cuenta";
import type { CuentaDeLaCasa } from "@/lib/casa/casas";
import { aunNoDisponibleEnPalabras } from "@/lib/casa/expedientes";

/**
 * Las piezas con que se arma un expediente (Marco, Pieza 6 §H).
 *
 * Un expediente tiene familias —identidad, actividad, relaciones, documentos— y
 * cada familia tiene partes. Cada parte está en uno de tres estados (ficha §3):
 * con datos, vacía o aún no disponible. **Ninguno se esconde**, y ninguno usa
 * esqueleto: un esqueleto finge contenido que no va a llegar.
 */

const titular = { fontFamily: "var(--letra-titular)", fontWeight: 700, letterSpacing: "-0.02em" } as const;

export function Titular({ nombre, bajo }: { nombre: string; bajo?: string }) {
  return (
    <div>
      <h1 className="text-[28px] leading-tight" style={titular}>
        {nombre}
      </h1>
      {bajo && (
        <p data-medida className="mt-1.5 text-[12px] tracking-[0.02em] text-[var(--tenue)]">
          {bajo}
        </p>
      )}
    </div>
  );
}

/** Una familia del expediente, con su nombre. El orden lo pone quien la usa: el del 6.31. */
export function Familia({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2" aria-label={nombre}>
      <h2 className="text-[15px]" style={{ ...titular, letterSpacing: "-0.01em" }}>
        {nombre}
      </h2>
      {children}
    </section>
  );
}

/** Una etiqueta de sección, con un número a la derecha si lo hay. */
export function Encabezado({ izquierda, derecha }: { izquierda: string; derecha?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span data-medida className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--tenue)]">
        {izquierda}
      </span>
      {derecha && (
        <span data-medida className="text-[10.5px] uppercase tracking-[0.16em] text-[var(--tenue)]">
          {derecha}
        </span>
      )}
    </div>
  );
}

/** Un renglón pregunta · respuesta. `medida` pone la respuesta en monoespaciado. */
export function Renglon({
  pregunta,
  children,
  medida = false,
  tenue = false,
}: {
  pregunta: string;
  children: React.ReactNode;
  medida?: boolean;
  tenue?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[var(--linea)] bg-[var(--pieza)] px-4 py-2.5">
      <span className="text-[13px] text-[var(--tenue)]">{pregunta}</span>
      <span
        data-medida={medida || undefined}
        className={`text-right ${tenue ? "text-[13px] text-[var(--tenue)]" : medida ? "text-[13.5px]" : "text-[14px]"}`}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Una parte del expediente en sus tres estados.
 *
 * - con datos: lo dibuja `conDatos`.
 * - vacía: una frase corta en tenue que dice qué falta (`vacia`).
 * - aún no disponible: la frase dice de dónde va a llegar.
 */
export function Parte<T>({
  pregunta,
  parte,
  vacia,
  conDatos,
}: {
  pregunta: string;
  parte: ParteDelDominio<T>;
  vacia: string;
  conDatos: (valor: T) => React.ReactNode;
}) {
  if (parte.estado === "con_datos") return <>{conDatos(parte.valor)}</>;
  return (
    <Renglon pregunta={pregunta} tenue>
      {parte.estado === "vacia" ? vacia : aunNoDisponibleEnPalabras(parte.fuente)}
    </Renglon>
  );
}

/** Lo que se dice cuando no hay nada, sin fingir que hay algo. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--linea)] px-4 py-3 text-[13px] text-[var(--tenue)]">
      {children}
    </div>
  );
}

/** Un aviso de error de un formulario, en palabras de quien captura. */
export function AvisoDeError({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="rounded-lg border border-[var(--tinta)] px-4 py-3 text-[14px]">
      {mensaje}
    </p>
  );
}

/**
 * Cuando la cuenta no se puede resolver: sin membresía de carrier, con varias y
 * sin decir cuál, o con una en la dirección que no está a tu alcance. No se
 * dibuja ningún dato de nadie.
 *
 * Con cuentas para elegir, se ofrece el selector aquí mismo. Antes esto pedía
 * escribir `?account=` a mano, y un coordinador no edita la dirección (Asav, 16
 * sep 2026). Sin ninguna, no hay qué elegir y se dice así.
 */
export function SinCuenta({ elegibles }: { elegibles: CuentaDeLaCasa["elegibles"] }) {
  if (elegibles.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <h1 className="text-[26px] leading-tight" style={titular}>
          No hay una cuenta de transportista que mostrar
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--tenue)]">
          Tu sesión no pertenece a ningún transportista.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-[26px] leading-tight" style={titular}>
        Elige una cuenta
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--tenue)]">
        Tu sesión alcanza {elegibles.length === 1 ? "una cuenta" : `${elegibles.length} cuentas`} de transportista.
        Elige en cuál trabajar.
      </p>
      <div className="mt-6">
        <SelectorDeCuenta cara="transportista" elegibles={elegibles} actual={null} id="cuenta-del-cuarto" />
      </div>
    </div>
  );
}
