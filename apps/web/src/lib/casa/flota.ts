/**
 * Flota en vivo, puesta en palabras y formas — C2 del cuarto de Compás.
 *
 * Los estados vienen de `@jtel/domain` y `@jtel/services`; aquí se decide cómo
 * se ven. Vive aparte de la página por dos razones: se prueba sin navegador, y
 * lo mismo que dibuja la página al cargar es lo que devuelve la ruta que la
 * actualiza cada 30 s. Dos traducciones del mismo estado terminarían diciendo
 * cosas distintas.
 *
 * Todo lo que sale de aquí es serializable: viaja como JSON al navegador.
 *
 * **La edad no se hornea como texto.** Se manda el instante (`desdeIso`) y el
 * navegador la escribe cada segundo: una edad escrita en el servidor sería
 * correcta al cargar y mentira diez segundos después (Pieza 1 §D).
 */

import type { FlotaEnVivo } from "@jtel/services";
import { JTTEL_TZ, type GrupoDeUnidad } from "@jtel/domain";
import type { EstadoGlifo } from "@/components/casa/glifo";
import { glifoDeUnidad, rutas } from "@/lib/casa/expedientes";

export const RUTA_FLOTA = "/casa/transportista/flota";

/** Cada cuánto se pide una lectura nueva: la cadencia real del recolector de Compás. */
export const LECTURA_CADA_MS = 30_000;

export const NOMBRE_DE_GRUPO: Record<GrupoDeUnidad, string> = {
  en_linea: "En línea",
  en_destino: "En destino",
  sin_senal: "Sin señal",
  desconectado: "Desconectado",
  sin_dispositivo: "Sin dispositivo",
};

/** El único dato de la pieza. Una edad corre en el navegador; una hora no. */
export type DatoDePieza =
  | { tipo: "edad"; desdeIso: string; etiqueta: string; vivo: boolean }
  | { tipo: "hora"; texto: string; etiqueta: string }
  | { tipo: "ninguno"; etiqueta: string };

export interface UnidadEnVivo {
  id: string;
  nombre: string;
  grupo: GrupoDeUnidad;
  glifo: EstadoGlifo;
  rumbo: number | null;
  apoyo: string;
  dato: DatoDePieza;
  apagada: boolean;
  posicion: { lat: number; lng: number } | null;
  ficha: string;
}

export interface LugarEnVivo {
  id: string;
  nombre: string;
  rol: "destino" | "base" | "caseta" | "otro";
  poligono: Array<{ lat: number; lng: number }>;
}

export interface FlotaEnVivoParaPantalla {
  /** El instante en que el servidor leyó. La edad de «actualizado» corre desde aquí. */
  leidaIso: string;
  cuenta: string;
  cuentaEnRuta: string | null;
  unidades: UnidadEnVivo[];
  unidadesInactivas: number;
  lugares: LugarEnVivo[];
}

/** `06:08`, en la zona de la operación. */
export function horaCorta(instante: Date, timeZone = JTTEL_TZ): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instante);
}

export function flotaParaPantalla(
  flota: FlotaEnVivo,
  entrada: { leida: Date; cuenta: string; cuentaEnRuta: string | null },
): FlotaEnVivoParaPantalla {
  const unidades: UnidadEnVivo[] = flota.unidades.map(({ unidad, estado, grupo }) => {
    const g = glifoDeUnidad(estado);
    const comun = {
      id: unidad.id,
      nombre: unidad.label,
      grupo,
      glifo: g.glifo,
      rumbo: g.rumbo ?? null,
      posicion: flota.posicionPorUnidad.get(unidad.id) ?? null,
      ficha: rutas.unidad(unidad.id, entrada.cuentaEnRuta),
    };
    switch (estado.tipo) {
      case "en_linea":
        return {
          ...comun,
          apoyo:
            estado.postura === "en_movimiento" && estado.velocidadKmh !== null
              ? `${estado.velocidadKmh.toFixed(1)} km/h`
              : estado.postura === "detenida"
                ? "detenida"
                : "en línea",
          dato: { tipo: "edad", desdeIso: estado.ultimaSenalAt.toISOString(), etiqueta: "última señal", vivo: true },
          apagada: false,
        };
      case "en_destino":
        // La hora de llegada, nunca la edad: callarse adentro es la ley funcionando.
        return {
          ...comun,
          apoyo: estado.destino.lugarNombre,
          dato: {
            tipo: "hora",
            texto: horaCorta(estado.destino.llegadaAt),
            etiqueta: estado.destino.entradaObservada ? "llegó" : "adentro desde",
          },
          apagada: false,
        };
      case "sin_senal":
        return {
          ...comun,
          apoyo: estado.ultimaSenalAt ? "sin señal" : "montada, sin reportar",
          dato: estado.ultimaSenalAt
            ? { tipo: "edad", desdeIso: estado.ultimaSenalAt.toISOString(), etiqueta: "última señal", vivo: false }
            : { tipo: "ninguno", etiqueta: "nunca reportó" },
          apagada: false,
        };
      case "desconectado":
        return {
          ...comun,
          apoyo: "más de 24 h",
          dato: estado.ultimaSenalAt
            ? { tipo: "edad", desdeIso: estado.ultimaSenalAt.toISOString(), etiqueta: "última señal", vivo: false }
            : { tipo: "ninguno", etiqueta: "nunca reportó" },
          apagada: true,
        };
      case "sin_dispositivo":
        return { ...comun, apoyo: "sin dispositivo", dato: { tipo: "ninguno", etiqueta: "sin señal" }, apagada: true };
    }
  });

  return {
    leidaIso: entrada.leida.toISOString(),
    cuenta: entrada.cuenta,
    cuentaEnRuta: entrada.cuentaEnRuta,
    unidades,
    unidadesInactivas: flota.unidadesInactivas,
    lugares: flota.lugares.map((l) => ({ id: l.id, nombre: l.nombre, rol: l.rol, poligono: l.poligono })),
  };
}
