"use client";

import { useState } from "react";
import {
  COLORES_DE_RUTA,
  colorReservado,
  estaEnLaLista,
  porQueNoSirveParaUnaRuta,
} from "@jtel/domain";
import { clases } from "@/components/casa/formulario";

/**
 * El color de una ruta: se escoge de una lista.
 *
 * **Enmienda (a) de ASAV, 23-sep-2026.** Antes era un `<input type="color">`
 * libre: cualquier hex, el naranja de Ontoy incluido. Ahora la lista no ofrece
 * un tono que pelee con el naranja —que es de Ontoy y de nadie más— y detrás de
 * «otro color» queda el selector libre, con la misma regla aplicada.
 *
 * ## Las tres cosas que dice, y por qué son tres y no una
 *
 * **Bloquea el naranja de Ontoy.** Es la regla, y va con el color deshabilitado
 * para guardar: si se pudiera guardar, no sería una regla.
 *
 * **Avisa si el color ya significa algo en la plataforma** —el cobre de lo vivo,
 * el verde del latido, los del sello— y deja guardar. El color de una ruta es el
 * que los camiones traen pintados en la calle; si un transportista pintó su
 * flota de un verde parecido al del latido, la app no puede decirle que se
 * equivocó de verde. Se declara y decide quien captura.
 *
 * **Avisa si otra ruta ya lo tiene**, y también deja guardar, por lo mismo.
 *
 * Los dos avisos van **en tinta, sin cobre**: un aviso no es un dato vivo.
 *
 * ## Lo que NO hace
 *
 * **No le corrige el color a nadie.** Ni corrimiento de tono, ni luz, ni
 * saturación — eso era la regla vieja y se fue con la enmienda. Lo que se
 * captura es lo que se pinta, en la lámina del poste, en la app y en el camión.
 *
 * El contraste sobre el mapa no se arregla aquí tampoco: lo mide
 * `contraste-de-ruta.ts` de Ontoy y lo resuelve con un halo del color del
 * lienzo, que separa la traza del fondo **sin tocarle el color a la ruta**
 * (Marco 8.8c).
 */
export function SelectorDeColorDeRuta({
  tono,
  setTono,
  otrosCircuitos = [],
}: {
  /**
   * **Controlado desde el formulario** y no con estado propio: el padre tiene el
   * botón de guardar, y tiene que poder apagarlo cuando el color no se puede
   * guardar. Una regla que avisa y deja apretar el botón no es una regla — es un
   * viaje al servidor para que lo diga él.
   */
  tono: string;
  setTono: (hex: string) => void;
  /** Los otros circuitos y su color, para poder decir quién ya lo tiene. */
  otrosCircuitos?: { name: string; colorHex: string }[];
}) {
  /* «Otro color» se queda abierto si el color guardado no está en la lista —
     que es el caso de todo circuito capturado antes de esta pantalla, y el del
     color con que nace un circuito. */
  const [otro, setOtro] = useState(!estaEnLaLista(tono));

  const noSirve = porQueNoSirveParaUnaRuta(tono);
  const reservado = colorReservado(tono);
  const yaLoTiene = otrosCircuitos.filter((c) => c.colorHex.toUpperCase() === tono.toUpperCase());

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13px] font-semibold">Color de la ruta</legend>

      {/* El name va en un hidden y no en las pastillas: así el valor que se
          manda es uno solo, venga de la lista o de «otro color». */}
      <input type="hidden" name="colorHex" value={tono} />

      <div className="flex flex-wrap items-center gap-2">
        {COLORES_DE_RUTA.map((c) => {
          const puesto = !otro && c.hex.toUpperCase() === tono.toUpperCase();
          return (
            <button
              key={c.hex}
              type="button"
              aria-pressed={puesto}
              onClick={() => {
                setOtro(false);
                setTono(c.hex);
              }}
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[13px] ${
                puesto
                  ? "border-[var(--texto)] font-semibold"
                  : "border-[var(--linea)] text-[var(--tenue)]"
              }`}
            >
              {/* El círculo del color, y el nombre al lado: el color nunca va
                  solo, ni aquí (8.8c). Y así se distingue sin depender del color. */}
              <span
                aria-hidden
                className="h-5 w-5 rounded-full border border-[var(--linea)]"
                style={{ background: c.hex }}
              />
              {c.nombre}
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={otro}
          onClick={() => setOtro(true)}
          className={`rounded-full border px-3 py-1.5 text-[13px] ${
            otro ? "border-[var(--texto)] font-semibold" : "border-[var(--linea)] text-[var(--tenue)]"
          }`}
        >
          otro color…
        </button>
      </div>

      {otro && (
        <span className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Escoger el color"
            value={/^#[0-9A-Fa-f]{6}$/.test(tono) ? tono : "#000000"}
            onChange={(e) => setTono(e.target.value.toUpperCase())}
            className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--linea)] bg-[var(--papel)]"
          />
          <input
            aria-label="El color en #RRGGBB"
            value={tono}
            onChange={(e) => setTono(e.target.value.toUpperCase())}
            pattern="#[0-9a-fA-F]{6}"
            className={`${clases.campo.replace("w-full ", "")} w-[130px] font-[family-name:var(--letra-medida)]`}
          />
        </span>
      )}

      {noSirve ? (
        <p role="alert" className={clases.aviso}>
          <span className="font-semibold">Ese color no se puede guardar.</span> {noSirve}
        </p>
      ) : (
        <>
          {reservado && (
            <p role="status" className={clases.aviso}>
              <span className="font-semibold">Ese color ya significa algo en la plataforma:</span>{" "}
              es {reservado}. Se puede guardar —el color de una ruta es el que los camiones traen
              pintados—, pero conviene saberlo.
            </p>
          )}
          {yaLoTiene.length > 0 && (
            <p role="status" className={clases.aviso}>
              <span className="font-semibold">
                Este color ya lo {yaLoTiene.length === 1 ? "tiene" : "tienen"}{" "}
                {yaLoTiene.map((c) => c.name).join(", ")}.
              </span>{" "}
              En el mapa las dos rutas se distinguirían sólo por su nombre. Se puede guardar.
            </p>
          )}
        </>
      )}

      <span className={clases.ayuda}>
        Identidad de la ruta, nunca estado: así se conoce en la calle (8.8c). Se guarda uno solo,
        y es el mismo en la lámina del poste, en la app y pintado en el camión.
      </span>
    </fieldset>
  );
}
