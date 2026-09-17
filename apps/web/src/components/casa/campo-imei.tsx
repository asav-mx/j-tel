"use client";

import { useState } from "react";
import { validarImei } from "@jtel/domain";
import { clases } from "@/components/casa/formulario";

/**
 * El IMEI del alta, revisado mientras se teclea — con el mismo verificador que
 * la ruta vuelve a correr al guardar (`validarImei`, #395).
 *
 * No regaña antes de tiempo: con menos de 15 dígitos todavía se está
 * escribiendo. Desde el 15 dice qué está mal, en palabras de quien lee una
 * etiqueta. El error que vino de la ruta (IMEI de otra cuenta, ya dado de alta)
 * se muestra hasta que se cambia el texto: después ya no habla de lo que hay
 * escrito.
 *
 * Sin JavaScript el campo sigue siendo un `<input>` de formulario y la ruta
 * hace la misma revisión.
 */
export function CampoImei({ inicial, errorDeRuta }: { inicial: string; errorDeRuta: string | null }) {
  const [valor, setValor] = useState(inicial);
  const [tocado, setTocado] = useState(false);

  const digitos = valor.replace(/[\s-]/g, "");
  const revisado = digitos.length >= 15 ? validarImei(valor) : null;
  const error = !tocado && errorDeRuta ? errorDeRuta : revisado && !revisado.ok ? revisado.motivo : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="alta-imei" className="text-[13px] text-[var(--tenue)]">
        IMEI
      </label>
      <input
        id="alta-imei"
        name="imei"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value);
          setTocado(true);
        }}
        inputMode="numeric"
        autoComplete="off"
        required
        placeholder="15 dígitos, de la etiqueta"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "alta-imei-error" : "alta-imei-ayuda"}
        data-medida
        className={`${clases.campo} tracking-[0.04em]`}
        autoFocus
      />
      {error ? (
        <p id="alta-imei-error" role="alert" className={clases.aviso}>
          {error}
        </p>
      ) : (
        <p id="alta-imei-ayuda" className={clases.ayuda}>
          El mismo que se capturó en Compás. Puedes pegarlo con espacios.
        </p>
      )}
    </div>
  );
}
