"use client";

import { useCallback, useMemo, useState } from "react";
import { useTema } from "@/lib/tema";
import { useMiUbicacion } from "@/lib/ubicacion";
import { avanceSobreTrazado } from "@jtel/domain";
import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import type { RutaDeLaCiudad, Sentido } from "@/lib/ontoy/forma";
import {
  dondeCaeLaParada,
  llegadasHasta,
  promesaEnPalabras,
  rangoEnPalabras,
  useVelocidadDelCorredor,
} from "@/lib/ontoy/llegadas";
import { useContarApertura } from "@/lib/ontoy/apertura";
import { useParadasGuardadas } from "@/lib/ontoy/paradas-guardadas";
import { useRutaEnVivo } from "@/lib/ontoy/ruta-en-vivo";
import { HojaDeParada, type LlegadaEnLaHoja } from "@/components/ontoy/hoja-de-parada";
import { VistaMapa } from "@/components/ontoy/vista-mapa";
import { VistaRutas, type EstadoDeRuta } from "@/components/ontoy/vista-rutas";

/**
 * **Ontoy** — el cascarón de las dos vistas (8.8).
 *
 * Rutas y Mapa, con el conmutador arriba, **y ninguna tercera**: la Pieza 8 lo
 * evaluó y decidió que lo que el pasajero de todos los días necesita no es otra
 * pantalla, es llegar en un toque a su parada (8.8b). Ese toque es el atajo de
 * la vista de Rutas, no una vista más.
 *
 * ## Toda pantalla tiene su salida (8.10)
 *
 * El conmutador está siempre visible, en las dos vistas. La hoja de una parada
 * se cierra de tres maneras. Ninguna pantalla de esta app es un callejón.
 *
 * ## La app no sabe quién eres (8.7)
 *
 * No hay cuenta, no hay registro, no hay identificación. Lo único que se guarda
 * son las paradas guardadas, y viven en el teléfono. La ubicación entra al
 * cálculo aquí mismo y no sale del aparato (8.3b).
 */
export function Ontoy({
  nombre,
  rutas,
  estados,
  rutaInicial,
}: {
  /** De configuración, nunca del código: `NEXT_PUBLIC_APP_NOMBRE`. */
  nombre: string;
  rutas: RutaDeLaCiudad[];
  estados: EstadoDeRuta[];
  /**
   * La ruta que la dirección pidió (`/?ruta=…`, o una liga vieja `/c/‹slug›`).
   * Cuando viene, la app abre en el Mapa con esa ruta enfocada: quien llega por
   * una liga compartida quiere ver ESA ruta, no la lista de la ciudad.
   */
  rutaInicial: string | null;
}) {
  const { deNoche, alternar: alternarPiel } = useTema();
  const pedida = rutaInicial && rutas.some((r) => r.circuito_id === rutaInicial) ? rutaInicial : null;
  const [vista, setVista] = useState<"rutas" | "mapa">(pedida ? "mapa" : "rutas");
  const [enfocada, setEnfocada] = useState<string | null>(pedida ?? rutas[0]?.circuito_id ?? null);
  const [sentido, setSentido] = useState<Sentido>("ida");
  const [paradaAbierta, setParadaAbierta] = useState<string | null>(null);

  const guardadas = useParadasGuardadas();
  const { forma, vivo, error, reintentar } = useRutaEnVivo(vista === "mapa" ? enfocada : null);
  const { velocidad, trazadoPorSentido } = useVelocidadDelCorredor(forma, vivo);
  const yo = useMiUbicacion();
  // La única escritura de la app: una apertura por ruta abierta (8.7).
  useContarApertura(vista === "mapa" ? enfocada : null);

  const abrirRuta = useCallback((circuitoId: string, parada?: string) => {
    setEnfocada(circuitoId);
    setParadaAbierta(parada ?? null);
    setVista("mapa");
  }, []);

  const rutaEnfocada = rutas.find((r) => r.circuito_id === enfocada) ?? null;
  const parada = forma?.paradas.find((p) => p.id === paradaAbierta) ?? null;

  /* Lo que la hoja enseña: lo medido arriba, la promesa abajo, nunca fundidos. */
  const llegadasDeLaHoja = useMemo((): LlegadaEnLaHoja[] => {
    if (!forma || !parada) return [];
    if (error) {
      return [{ rotulo: "No pudimos preguntar", apoyo: "lo que ves es lo último que supimos", vieja: true }];
    }
    if (!vivo) return [{ rotulo: "Preguntando…", apoyo: "un momento", vieja: true }];
    if (vivo.estado === "por_arrancar") {
      return [
        {
          rotulo: vivo.arranca_el ? `Arranca el ${vivo.arranca_el}` : "Todavía no arranca",
          apoyo: "esta ruta aún no da servicio",
          vieja: true,
        },
      ];
    }
    if (vivo.estado === "fuera_de_horario") {
      return [{ rotulo: "Fuera de horario", apoyo: `abre ${vivo.abre_a}`, vieja: true }];
    }

    const abscisa = dondeCaeLaParada(parada, trazadoPorSentido.get(sentido), forma.corredor_m);
    if (abscisa === null) {
      return [{ rotulo: "Sin dato en este sentido", apoyo: "esta parada no cae en el trazado de ida y vuelta", vieja: true }];
    }
    const lista = llegadasHasta(
      { avanceMetros: abscisa, sentido },
      { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
    );
    if (lista.length === 0) {
      return [{ rotulo: "Sin unidad a la vista", apoyo: "ahorita no hay ninguna que se pueda medir", vieja: true }];
    }
    return lista.slice(0, 3).map((l, i) => ({
      rotulo: rangoEnPalabras(l.rango),
      apoyo: `viene la ${l.unidad} · ${haceNMinutos(l.antiguedadSeg)}`,
      enVivo: i === 0,
      vieja: i > 0,
    }));
  }, [forma, parada, vivo, error, sentido, trazadoPorSentido, velocidad.kmh]);

  /* 8.3b: hasta donde está el pasajero, calculado aquí y sin que salga nada. */
  const hastaMi = useMemo(() => {
    if (!forma || !vivo || !yo) return null;
    const trazado = trazadoPorSentido.get(sentido);
    const mi = trazado ? avanceSobreTrazado(yo, trazado, forma.corredor_m) : null;
    if (!mi) return null;
    const l = llegadasHasta(
      { avanceMetros: mi.avanceMetros, sentido },
      { forma, vivo, velocidadKmh: velocidad.kmh, trazadoPorSentido },
    )[0];
    return l ? rangoEnPalabras(l.rango) : null;
  }, [forma, vivo, yo, sentido, trazadoPorSentido, velocidad.kmh]);

  return (
    <div className="ontoy">
      <header className="ontoy-cabeza">
        <LogoOntoy />
        <h1 className="ontoy-marca">{nombre}</h1>
        <button type="button" className="ontoy-piel" onClick={alternarPiel} aria-label="Cambiar entre piel de día y de noche">
          {deNoche ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
      </header>

      <div className="ontoy-tabs" role="tablist" aria-label="Vistas">
        {(["rutas", "mapa"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            className="ontoy-tab"
            onClick={() => setVista(v)}
          >
            {v === "rutas" ? "Rutas" : "Mapa"}
          </button>
        ))}
      </div>

      {vista === "rutas" ? (
        <VistaRutas
          rutas={rutas}
          estados={estados}
          guardadas={guardadas.guardadas}
          puedeGuardar={guardadas.disponible}
          alAbrirRuta={abrirRuta}
          alQuitarGuardada={guardadas.alternar}
        />
      ) : (
        <VistaMapa
          rutas={rutas}
          enfocada={enfocada}
          forma={forma}
          vivo={vivo}
          error={error}
          deNoche={deNoche}
          sentido={sentido}
          paradaAbierta={paradaAbierta}
          alEnfocar={(id) => {
            setEnfocada(id);
            setParadaAbierta(null);
          }}
          alCambiarSentido={setSentido}
          alTocarParada={setParadaAbierta}
          alReintentar={reintentar}
        />
      )}

      {vista === "mapa" && parada && rutaEnfocada && (
        <HojaDeParada
          nombre={parada.nombre}
          direccion={`Ruta ${rutaEnfocada.nombre} · ${sentido === "ida" ? "ida" : "vuelta"}${
            hastaMi ? ` · hasta donde estás ${hastaMi}` : ""
          }`}
          llegadas={llegadasDeLaHoja}
          promesa={promesaEnPalabras(vivo?.promesa ?? null, sentido) ?? ""}
          guardada={guardadas.estaGuardada(parada.id)}
          sePuedeGuardar={guardadas.disponible}
          color={rutaEnfocada.color_hex}
          alGuardar={() => guardadas.alternar({ parada: parada.id, ruta: rutaEnfocada.circuito_id })}
          alCerrar={() => setParadaAbierta(null)}
        />
      )}
    </div>
  );
}

/** El logo de Ontoy. Su identidad es de Ontoy, no de la plataforma. */
function LogoOntoy() {
  return (
    <svg className="ontoy-logo" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 54 C22 54 26 40 32 30" fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M32 30 L26 40 L38 38 Z" fill="currentColor" />
      <circle cx="46" cy="17" r="9.5" fill="currentColor" />
      <circle cx="46" cy="17" r="3.6" className="ontoy-logo-ojo" />
    </svg>
  );
}
