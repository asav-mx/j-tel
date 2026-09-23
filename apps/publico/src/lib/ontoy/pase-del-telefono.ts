"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LLAVE_DE_LABORATORIO,
  crearPortador,
  emitirBoleto,
  presentarBoleto,
  type Presentacion,
} from "@jtel/domain/boleto";
import { empacarPresentacion } from "@jtel/domain/boleto-empaque";
import {
  PASE_VACIO,
  agregarCompra,
  boletoParaMostrar,
  marcarMostrado,
  type BoletoDelTelefono,
  type Pase,
} from "./pase";

/**
 * El pase vive **en el teléfono**, como las paradas guardadas (8.7, 8.8b).
 *
 * Mismo trato que `paradas-guardadas.ts`, y por las mismas razones: cada lectura
 * y cada escritura en `try/catch` porque `localStorage` **lanza** en una ventana
 * privada de Safari; el estado arranca vacío y se llena al montar, porque el
 * servidor no tiene `localStorage` y leerlo en el primer dibujo daría un HTML
 * distinto del que el navegador arma después.
 *
 * ## Lo que aquí es de mentira, dicho sin rodeos
 *
 * **El teléfono se emite sus propios boletos, con la llave de laboratorio.** En
 * la vida real quien los firma es J-Tel, de su lado, y la llave privada nunca
 * baja a un celular. Aquí baja porque toda la ficha es un laboratorio con datos
 * falsos y porque no hay servidor que los emita todavía.
 *
 * Que eso sea visible es parte del punto: un teléfono que puede firmar sus
 * propios boletos puede fabricarse viajes gratis, y por eso **este código no
 * puede acercarse a dinero real** — que es exactamente lo que dice la raya de
 * la ficha, y lo que la valla anti-cobro vigila.
 *
 * ## Una pregunta que este PR no contesta
 *
 * El dominio pide una `ruta` dentro del boleto. **A qué se ata un viaje —a un
 * circuito, a una concesión o a todo el sistema— no lo dice la ficha**, y no es
 * del P2 decidirlo: un pasajero que compra diez viajes no escoge diez rutas.
 * Mientras tanto se emiten con `cualquier-circuito`, que es lo único que no
 * afirma de más. Lo decide el P4, cuando el reparto a transportistas diga qué
 * necesita saber cada boleto.
 */

const LLAVE = "ontoy:pase";
const RUTA_DEL_LABORATORIO = "cualquier-circuito";
const DIAS_DE_VIGENCIA = 90;

interface PaseGuardado {
  boletos: BoletoDelTelefono[];
  movimientos: Pase["movimientos"];
  cuenta: string | null;
}

function leer(): Pase {
  try {
    const crudo = window.localStorage.getItem(LLAVE);
    if (!crudo) return PASE_VACIO;
    const valor = JSON.parse(crudo) as PaseGuardado;
    if (!Array.isArray(valor?.boletos) || !Array.isArray(valor?.movimientos)) return PASE_VACIO;
    return {
      boletos: valor.boletos,
      movimientos: valor.movimientos,
      cuenta: typeof valor.cuenta === "string" ? valor.cuenta : null,
    };
  } catch {
    return PASE_VACIO;
  }
}

function escribir(pase: Pase): void {
  try {
    window.localStorage.setItem(LLAVE, JSON.stringify(pase));
  } catch {
    /* Sin dónde guardar, la app sigue: se pierde el pase, no la pantalla. */
  }
}

/** Un folio legible y dictable: ocho dígitos, con su prefijo para la pantalla. */
function folioNuevo(): string {
  const n = Math.floor(Math.random() * 100_000_000);
  return `ONT-${String(n).padStart(8, "0")}`;
}

function emitirEnElTelefono(ahora: number): BoletoDelTelefono {
  const portador = crearPortador();
  const sellado = emitirBoleto(
    {
      folio: folioNuevo(),
      ruta: RUTA_DEL_LABORATORIO,
      emitido: ahora,
      vence: ahora + DIAS_DE_VIGENCIA * 24 * 60 * 60 * 1000,
      portador: portador.publica,
    },
    LLAVE_DE_LABORATORIO,
  );
  return {
    sellado,
    portadorPrivada: [...portador.privada].map((b) => b.toString(16).padStart(2, "0")).join(""),
    estado: "sin_usar",
  };
}

const deHex = (hex: string): Uint8Array =>
  Uint8Array.from(hex.match(/.{2}/g)?.map((p) => parseInt(p, 16)) ?? []);

/** Lo que va dentro del QR ahora mismo, ya empacado. */
export function textoDelQr(boleto: BoletoDelTelefono, ahora: number): string {
  const presentacion: Presentacion = presentarBoleto(
    boleto.sellado,
    { privada: deHex(boleto.portadorPrivada), publica: deHex(boleto.sellado.cuerpo.portador) },
    ahora,
  );
  return empacarPresentacion(presentacion);
}

export function useElPase() {
  const [pase, setPase] = useState<Pase>(PASE_VACIO);
  /** `false` no es «no tienes viajes»: es «aquí no se puede guardar». */
  const [disponible, setDisponible] = useState(true);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.getItem(LLAVE);
      setPase(leer());
    } catch {
      setDisponible(false);
    }
    setListo(true);
  }, []);

  const guardar = useCallback((siguiente: Pase) => {
    escribir(siguiente);
    setPase(siguiente);
    return siguiente;
  }, []);

  const comprar = useCallback(
    (viajes: number) => {
      const ahora = Date.now();
      const nuevos = Array.from({ length: viajes }, () => emitirEnElTelefono(ahora));
      guardar(agregarCompra(pase, nuevos, ahora));
    },
    [pase, guardar],
  );

  /** Toma el boleto que toca y lo deja enseñado, por confirmar. */
  const mostrar = useCallback((): BoletoDelTelefono | null => {
    const boleto = boletoParaMostrar(pase);
    if (!boleto) return null;
    if (boleto.estado === "sin_usar") {
      guardar(marcarMostrado(pase, boleto.sellado.cuerpo.folio, Date.now()));
    }
    return boleto;
  }, [pase, guardar]);

  const alternarCuenta = useCallback(() => {
    guardar({ ...pase, cuenta: pase.cuenta ? null : "m···@gmail.com" });
  }, [pase, guardar]);

  return { pase, disponible, listo, comprar, mostrar, alternarCuenta };
}
