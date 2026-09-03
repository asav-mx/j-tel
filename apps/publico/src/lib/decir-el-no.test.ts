import { describe, expect, it } from "vitest";
import type { MotivoDeNoServir, ResultadoDeBusqueda } from "@jtel/domain";
import {
  aPie,
  distancia,
  porQueNo,
  TITULARES,
  tituloDelNo,
  tocaDecirQueCrecemos,
} from "./decir-el-no";

const no = (
  motivo: MotivoDeNoServir,
  cerca: number | null = 100,
  lejos: number | null = 100,
): ResultadoDeBusqueda => ({
  sirve: false,
  motivo,
  caminataDeDondeEstasMetros: cerca,
  caminataDeDondeVasMetros: lejos,
});

describe("distancia y aPie", () => {
  it("metros a la decena, kilómetros con un decimal", () => {
    expect(distancia(0)).toBe("0 m");
    expect(distancia(137)).toBe("140 m");
    expect(distancia(1000)).toBe("1000 m");
    expect(distancia(14900)).toBe("14.9 km");
  });

  it("POR DEBAJO DEL GRANO DE REDONDEO no se dice un número", () => {
    /*
     * «a 0 m de donde estás» era literalmente cierto y se leía como un defecto.
     * Y decir «a 3 m» sería peor: el GPS de un teléfono no distingue cinco
     * metros, así que ese número sería precisión inventada.
     */
    expect(aPie(0, "de donde estás")).toBe("justo de donde estás");
    expect(aPie(4, "de Terminal Norte")).toBe("justo de Terminal Norte");
    expect(aPie(0, "de donde estás")).not.toContain("0 m");
  });

  it("por encima del grano sí se dice, con su número", () => {
    expect(aPie(240, "de donde estás")).toBe("a 240 m de donde estás");
  });
});

describe("el titular del «no»", () => {
  it("cuando todo falló por distancia, habla de distancia", () => {
    const t = tituloDelNo(["los_dos_lejos", "lejos_de_donde_vas"]);
    expect(t).toBe("no_pasa_cerca");
    expect(TITULARES[t]).toContain("pasa cerca");
  });

  it("EL TITULAR NO PUEDE NEGAR LO QUE LA RAZÓN AFIRMA", () => {
    /*
     * El defecto que salió mirando la pantalla: el titular decía «ninguna pasa
     * cerca de ahí» y tres renglones abajo el motivo decía «pasa por los dos,
     * pero en el otro sentido». La pantalla se contradecía a sí misma.
     */
    const t = tituloDelNo(["en_ese_orden_no"]);
    expect(TITULARES[t]).not.toContain("pasa cerca");
    expect(TITULARES[t]).toContain("sentido");

    // Y el motivo de abajo sigue diciendo que sí pasa por los dos.
    expect(porQueNo(no("en_ese_orden_no"))).toContain("pasa por los dos");
  });

  it("mezclado con una falla de distancia, manda el sentido: afirma menos y es cierto", () => {
    expect(tituloDelNo(["los_dos_lejos", "en_ese_orden_no"])).toBe("solo_el_sentido");
  });

  it("un viaje de una cuadra tiene su propio titular: no es una falla de cobertura", () => {
    const t = tituloDelNo(["mejor_camina"]);
    expect(t).toBe("a_un_paso");
    expect(TITULARES[t]).toContain("caminar");
  });

  it("«mejor camina» gana a todo: es una respuesta, no una carencia", () => {
    expect(tituloDelNo(["en_ese_orden_no", "mejor_camina", "los_dos_lejos"])).toBe("a_un_paso");
  });

  it("«estamos creciendo» sólo cuando lo que falló ES la cobertura", () => {
    expect(tocaDecirQueCrecemos("no_pasa_cerca")).toBe(true);
    expect(tocaDecirQueCrecemos("solo_el_sentido")).toBe(false);
    expect(tocaDecirQueCrecemos("a_un_paso")).toBe(false);
  });
});

describe("el motivo por ruta", () => {
  it("dice cuál de los dos extremos falló, y por cuánto", () => {
    expect(porQueNo(no("lejos_de_donde_vas", 20, 2400))).toBe("pasa a 2.4 km de a dónde vas");
    expect(porQueNo(no("lejos_de_donde_estas", 2400, 20))).toBe("pasa a 2.4 km de donde estás");
    expect(porQueNo(no("los_dos_lejos", 1500, 2400))).toBe(
      "pasa a 1.5 km de donde estás y a 2.4 km de a dónde vas",
    );
  });

  it("SIN NADA MEDIDO no se inventa un número", () => {
    expect(porQueNo(no("los_dos_lejos", null, null))).toBe("no pasa cerca de ninguno de los dos");
    expect(porQueNo(no("lejos_de_donde_vas", null, null))).not.toMatch(/\d/);
  });

  it("una ruta que sirve no tiene motivo que dar", () => {
    const sirve: ResultadoDeBusqueda = {
      sirve: true,
      sentido: "ida",
      subir: { lat: 31.7, lon: -106.45, caminataMetros: 12, avanceMetros: 0 },
      bajar: { lat: 31.74, lon: -106.45, caminataMetros: 8, avanceMetros: 4440 },
      recorridoMetros: 4440,
    };
    expect(porQueNo(sirve)).toBe("");
  });
});
