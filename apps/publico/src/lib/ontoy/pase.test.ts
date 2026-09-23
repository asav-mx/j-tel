import { describe, it, expect } from "vitest";
import type { BoletoSellado } from "@jtel/domain/boleto";
import {
  PASE_VACIO,
  TARIFA_MXN,
  PAQUETES,
  precioDe,
  viajesDisponibles,
  viajesPorConfirmar,
  boletoParaMostrar,
  marcarMostrado,
  agregarCompra,
  codigoParaDictar,
  type BoletoDelTelefono,
  type Pase,
} from "./pase";

const AHORA = Date.UTC(2026, 8, 23, 12, 0, 0);

function boleto(folio: string, estado: BoletoDelTelefono["estado"] = "sin_usar"): BoletoDelTelefono {
  const sellado = {
    cuerpo: {
      folio,
      ruta: "circuito-juarez-1",
      emitido: AHORA - 1000,
      vence: AHORA + 1000,
      unSoloUso: true as const,
      portador: "00".repeat(32),
    },
    firmaDeJTel: "00".repeat(64),
  } satisfies BoletoSellado;
  return { sellado, portadorPrivada: "00".repeat(32), estado };
}

const conBoletos = (...bs: BoletoDelTelefono[]): Pase => ({ ...PASE_VACIO, boletos: bs });

describe("la tarifa y los paquetes", () => {
  /* Sin descuento a propósito: la tarifa la fija el estado y no es nuestra para
     rebajarla. El paquete ahorra sacar el teléfono, no dinero. */
  it("ningún paquete sale más barato por viaje", () => {
    for (const p of PAQUETES) expect(precioDe(p.viajes)).toBe(p.viajes * TARIFA_MXN);
  });
});

describe("qué puede afirmar el pase", () => {
  it("cuenta los sin usar, y los enseñados los dice aparte", () => {
    const pase = conBoletos(boleto("1"), boleto("2", "en_uso"), boleto("3", "confirmado"));
    expect(viajesDisponibles(pase)).toBe(1);
    expect(viajesPorConfirmar(pase)).toBe(1);
  });

  /* La mentira hacia arriba que la opción B habría dejado: un boleto enseñado
     sigue contando como disponible y el pasajero cree tener uno más. */
  it("un boleto enseñado deja de contar como disponible", () => {
    const antes = conBoletos(boleto("1"));
    expect(viajesDisponibles(antes)).toBe(1);
    expect(viajesDisponibles(marcarMostrado(antes, "1", AHORA))).toBe(0);
  });
});

describe("enseñar el pase", () => {
  /* La regla que parece un detalle y no lo es: si el lector no te dejó subir y
     vuelves a enseñar, vuelve el MISMO boleto. Gastar el siguiente te cobraría
     dos viajes por un camión. */
  it("enseñar dos veces no gasta dos viajes", () => {
    let pase = conBoletos(boleto("1"), boleto("2"));
    const primero = boletoParaMostrar(pase)!;
    pase = marcarMostrado(pase, primero.sellado.cuerpo.folio, AHORA);

    const segundo = boletoParaMostrar(pase)!;
    expect(segundo.sellado.cuerpo.folio).toBe(primero.sellado.cuerpo.folio);
    expect(viajesDisponibles(pase)).toBe(1);
  });

  it("sin boletos no hay nada que enseñar", () => {
    expect(boletoParaMostrar(PASE_VACIO)).toBeNull();
    expect(boletoParaMostrar(conBoletos(boleto("1", "confirmado")))).toBeNull();
  });

  /* El teléfono no tiene canal con el validador: no sabe en qué camión te
     subiste. Escribir la ruta aquí sería inventarla. */
  it("el renglón nace por confirmar y NO nombra ruta ni unidad", () => {
    const pase = marcarMostrado(conBoletos(boleto("1")), "1", AHORA);
    expect(pase.movimientos[0]).toEqual({
      cuando: AHORA,
      que: "Viaje",
      cambio: -1,
      porConfirmar: true,
    });
  });

  it("marcar dos veces el mismo folio no duplica el renglón", () => {
    const una = marcarMostrado(conBoletos(boleto("1")), "1", AHORA);
    const otra = marcarMostrado(una, "1", AHORA + 5000);
    expect(otra.movimientos).toHaveLength(1);
    expect(otra).toBe(una);
  });

  it("un folio que no existe no mueve nada", () => {
    const pase = conBoletos(boleto("1"));
    expect(marcarMostrado(pase, "999", AHORA)).toBe(pase);
  });
});

describe("la compra simulada", () => {
  it("suma los viajes y deja su renglón, con la palabra «simulada»", () => {
    const pase = agregarCompra(PASE_VACIO, [boleto("1"), boleto("2")], AHORA);
    expect(viajesDisponibles(pase)).toBe(2);
    expect(pase.movimientos[0]?.que).toBe("Compra · 2 viajes (simulada)");
    expect(pase.movimientos[0]?.cambio).toBe(2);
  });

  it("un viaje va en singular", () => {
    const pase = agregarCompra(PASE_VACIO, [boleto("1")], AHORA);
    expect(pase.movimientos[0]?.que).toBe("Compra · 1 viaje (simulada)");
  });

  it("lo más reciente queda arriba", () => {
    let pase = agregarCompra(PASE_VACIO, [boleto("1")], AHORA);
    pase = marcarMostrado(pase, "1", AHORA + 60_000);
    expect(pase.movimientos.map((m) => m.cambio)).toEqual([-1, 1]);
  });
});

describe("el código que se dicta", () => {
  /* El teclado de un validador no tiene letras: lo que se dicta va en dígitos. */
  it("son ocho dígitos en dos bloques", () => {
    expect(codigoParaDictar("ONT-000123")).toBe("0000 0123");
    expect(codigoParaDictar("ONT-12345678")).toBe("1234 5678");
  });

  it("un folio sin dígitos no truena: sale en ceros", () => {
    expect(codigoParaDictar("SIN-NUMERO")).toBe("0000 0000");
  });

  it("de un folio largo se queda con los últimos ocho", () => {
    expect(codigoParaDictar("ONT-9999912345678")).toBe("1234 5678");
  });
});
