/**
 * Las casas, declaradas como dato — `docs/Mapa-De-La-Casa.md`, ratificado el 15
 * de septiembre de 2026.
 *
 * Este archivo **es** el menú. No hay una segunda lista en ningún componente: si
 * un lugar no está aquí, no existe para la navegación, y si está aquí con su
 * cuarto construido, aparece solo.
 *
 * ## Las dos reglas del mapa que este archivo hace cumplir
 *
 * **Regla 4 — lo que no aplica, no aparece.** Ni apagado, ni con candado, ni
 * «próximamente». Por eso cada lugar declara su `condicion` y el marco filtra
 * antes de dibujar: Cumplimiento sólo con contrato, Circuitos sólo si la cuenta
 * opera transporte público.
 *
 * **Y su hermana, decidida el mismo día: un cuarto vacío miente igual.** Por eso
 * `ruta` puede ser `null`, y `null` significa *el cuarto todavía no se
 * construye*. El lugar se queda declarado —para que no se pierda, y para que
 * construirlo sea cambiar una línea— pero **no se dibuja**. Hoy todos son
 * `null`: el cascarón entra sin un solo cuarto, y cada uno se enciende el día
 * que aterriza su pantalla.
 *
 * ## Los nombres
 *
 * Opción B, ratificada: el menú usa **nombres de cosa** —«Flota en vivo»,
 * «Cumplimiento», «Circuitos»— y el nombre de producto va como **sello chico**
 * encima de su sección. Un coordinador sabe buscar «cumplimiento», no «Vernier».
 *
 * ## Dos niveles, y ni uno más
 *
 * `hijos` es el segundo nivel y es el último: el tipo no permite un tercero a
 * propósito. Si algún día hiciera falta, el mapa dice que la casa está mal
 * partida, no que falte un nivel.
 */

/** Las cuatro casas que se construyen. Pasajero son dos apps aparte — ver abajo. */
export type Cara = "transportista" | "planta" | "corporativo" | "jstaff";

/**
 * Cuándo aplica un lugar. El marco no dibuja lo que no aplica: no lo apaga, no
 * le pone candado, no lo anuncia. Simplemente no está.
 */
export type Condicion =
  /** Siempre, para cualquier cuenta de esta cara. */
  | "siempre"
  /** Sólo si la cuenta tiene contrato de Vernier encendido. */
  | "con-contrato"
  /** Sólo si la cuenta opera transporte público. */
  | "opera-publico";

/** Un lugar del menú: una entrada, con su cuarto o sin él todavía. */
export type Lugar = {
  /** El nombre de cosa que ve el usuario. Nunca el nombre del producto. */
  nombre: string;
  /**
   * La ruta de su cuarto, o `null` si todavía no se construye.
   * `null` = no se dibuja. Ver la cabecera de este archivo.
   */
  ruta: string | null;
  condicion: Condicion;
  /** El segundo nivel, que cuelga de la pestaña activa. No hay un tercero. */
  hijos?: { nombre: string; ruta: string | null; condicion: Condicion }[];
};

/**
 * Un grupo de lugares bajo un sello de producto.
 *
 * `sello: null` es un grupo sin sello — el mapa no le pone nombre de producto a
 * Expedientes, y ponérselo por simetría sería inventar marca donde no la hay.
 */
export type Grupo = {
  sello: string | null;
  lugares: Lugar[];
};

export type Casa = {
  cara: Cara;
  /** Cómo se llama la casa para quien la construye. No se dibuja en pantalla. */
  nombre: string;
  /** La única pregunta que su puerta responde. */
  pregunta: string;
  /** La raíz de sus rutas. Cuando cada cara gane su subdominio, este prefijo se cae. */
  base: string;
  grupos: Grupo[];
};

export const CASAS: Record<Cara, Casa> = {
  /**
   * 1 · Transportista — cimiento: Compás.
   * Compra Compás aunque nunca tenga contrato; Vernier se enciende encima
   * cuando lo consigue.
   */
  transportista: {
    cara: "transportista",
    nombre: "Transportista",
    pregunta: "¿Dónde está mi flota?",
    base: "/casa/transportista",
    grupos: [
      {
        sello: "Compás",
        lugares: [
          // La puerta de la casa: el primer lugar del primer grupo.
          { nombre: "Flota en vivo", ruta: null, condicion: "siempre" },
          { nombre: "Dispositivos", ruta: null, condicion: "siempre" },
          { nombre: "Lugares", ruta: null, condicion: "siempre" },
        ],
      },
      {
        sello: null,
        lugares: [
          // El segundo afluente: pólizas, permisos, exámenes, capacitaciones,
          // mantenimiento firmado, inspecciones. Aquí viven los choferes
          // mientras toda su sustancia sean sus papeles.
          // El primer cuarto construido (PR D, 16 sep 2026).
          { nombre: "Expedientes", ruta: "/casa/transportista/expedientes", condicion: "siempre" },
        ],
      },
      {
        sello: "Vernier",
        lugares: [
          {
            nombre: "Cumplimiento",
            ruta: null,
            condicion: "con-contrato",
            hijos: [{ nombre: "Contratos y perfiles", ruta: null, condicion: "con-contrato" }],
          },
        ],
      },
      {
        sello: "Transporte público",
        lugares: [{ nombre: "Circuitos", ruta: null, condicion: "opera-publico" }],
      },
    ],
  },

  /**
   * 2 · Planta — cimiento: Vernier.
   * Vive la operación diaria. Ve sólo lo suyo; jamás el Compás de su proveedor.
   */
  planta: {
    cara: "planta",
    nombre: "Planta",
    pregunta: "¿Qué pasó hoy?",
    base: "/casa/planta",
    grupos: [
      {
        sello: null,
        lugares: [
          { nombre: "El día", ruta: null, condicion: "siempre" },
          { nombre: "Historial", ruta: null, condicion: "siempre" },
          { nombre: "Inspecciones", ruta: null, condicion: "siempre" },
          { nombre: "Estado de cuenta", ruta: null, condicion: "siempre" },
        ],
      },
    ],
  },

  /**
   * 3 · Corporativo — cimiento: Vernier.
   * Comparar, no operar. Agrupa sus plantas; puede tener varios transportistas.
   */
  corporativo: {
    cara: "corporativo",
    nombre: "Corporativo",
    pregunta: "¿Cómo vamos, y con quién?",
    base: "/casa/corporativo",
    grupos: [
      {
        sello: null,
        lugares: [
          { nombre: "Panorama", ruta: null, condicion: "siempre" },
          { nombre: "Estado de cuenta", ruta: null, condicion: "siempre" },
          { nombre: "Contratos", ruta: null, condicion: "siempre" },
        ],
      },
    ],
  },

  /**
   * 4 · J-Staff — el operador de la plataforma.
   * Ve todo, con el razonamiento completo. La única cara que cruza entre
   * cuentas, siempre por la compuerta.
   */
  jstaff: {
    cara: "jstaff",
    nombre: "J-Staff",
    pregunta: "¿Está sana la plataforma?",
    base: "/casa/jstaff",
    grupos: [
      {
        sello: null,
        lugares: [
          { nombre: "Compás · operación", ruta: null, condicion: "siempre" },
          { nombre: "Compuerta de atención", ruta: null, condicion: "siempre" },
          { nombre: "Cuentas y demos", ruta: null, condicion: "siempre" },
        ],
      },
    ],
  },
};

/*
 * La quinta cara del mapa —Pasajero— no está aquí, y no es un olvido.
 *
 * Son dos apps con dos cocinas (la de la ciudad y la del empleado), no dos
 * menús de lugares, y el mapa es explícito: «cada app merece su propia pieza
 * del Marco antes de construirse» (6.28). Levantarles un cascarón hoy sería
 * justo el cuarto imaginario que el mapa prohíbe.
 */

/**
 * Lo que la cuenta tiene encendido. Es lo único que el marco necesita saber
 * para aplicar la regla 4.
 *
 * Hoy lo arma quien dibuja el marco, porque ningún cuarto lee datos todavía.
 * Cuando el primer cuarto llegue, esto sale de la cuenta —contrato de Vernier
 * encendido, modalidad de transporte público— y no de una constante.
 */
export type Alcance = {
  conContrato: boolean;
  operaPublico: boolean;
};

/**
 * El alcance que usa el cascarón mientras no hay un solo cuarto construido.
 *
 * ⚠ **No es una afirmación sobre ninguna cuenta.** Con cero cuartos el menú sale
 * vacío pongas lo que pongas aquí, porque `menuDe` tira primero todo lo que
 * tiene `ruta: null`. Existe para que el marco no tenga que inventarse un
 * objeto en cada casa.
 *
 * **Y es una trampa con fecha.** El día que aterrice el primer cuarto de
 * Cumplimiento o de Circuitos, si esto sigue en su lugar esos lugares no
 * aparecerán nunca y se va a ver igual que un defecto de ruteo. Quien construya
 * ese cuarto reemplaza esta constante por la lectura de verdad: contrato de
 * Vernier encendido, modalidad de transporte público.
 */
export const ALCANCE_SIN_CUARTOS: Alcance = { conContrato: false, operaPublico: false };

function aplica(condicion: Condicion, alcance: Alcance): boolean {
  if (condicion === "con-contrato") return alcance.conContrato;
  if (condicion === "opera-publico") return alcance.operaPublico;
  return true;
}

/**
 * El menú de una casa: sus grupos, ya filtrados.
 *
 * Quita de un tirón las dos cosas que el mapa prohíbe enseñar: lo que no aplica
 * a esta cuenta, y lo que todavía no tiene cuarto construido. Un grupo que se
 * queda sin lugares desaparece con su sello — un sello suelto anunciaría una
 * sección que no está.
 */
export function menuDe(casa: Casa, alcance: Alcance): Grupo[] {
  return casa.grupos
    .map((grupo) => ({
      sello: grupo.sello,
      lugares: grupo.lugares
        .filter((lugar) => lugar.ruta !== null && aplica(lugar.condicion, alcance))
        .map((lugar) => ({
          ...lugar,
          hijos: lugar.hijos?.filter((hijo) => hijo.ruta !== null && aplica(hijo.condicion, alcance)),
        })),
    }))
    .filter((grupo) => grupo.lugares.length > 0);
}

/** ¿Esta ruta es la del lugar, o cuelga de él? */
export function estaEnLugar(ruta: string, lugar: string | null): boolean {
  if (lugar === null) return false;
  return ruta === lugar || ruta.startsWith(`${lugar}/`);
}

/**
 * El sello del lugar donde se está parado, o `null` si no hay ninguno.
 *
 * Lo pide el celular. En computadora los sellos van encima de sus pestañas y se
 * ven los tres a la vez; en la barra de abajo no cabe ninguno, y sin esto la
 * marca **desaparece por completo en el teléfono** — que es media razón de la
 * opción B: el menú lista nombres de cosa y la marca se graba por repetición del
 * sello. Un sello que no se repite no graba nada.
 *
 * Devuelve `null` cuando toca: en la puerta de la casa, donde todavía no se
 * entró a ninguna sección, y en los grupos que el mapa dejó sin producto
 * —Expedientes no es de nadie—. Inventarle un sello por simetría sería poner
 * marca donde no la hay.
 */
export function selloActivo(grupos: Grupo[], ruta: string): string | null {
  const grupo = grupos.find((g) =>
    g.lugares.some(
      (lugar) =>
        estaEnLugar(ruta, lugar.ruta) || (lugar.hijos ?? []).some((hijo) => estaEnLugar(ruta, hijo.ruta)),
    ),
  );
  return grupo?.sello ?? null;
}

/**
 * Cuántas entradas de primer nivel tiene una casa para una cuenta.
 *
 * Existe para la prueba, no para la pantalla: el mapa dice que más de seis
 * entradas significa que la casa está mal partida, y esa regla sólo sirve si
 * algo la comprueba.
 */
export function cuentaEntradas(casa: Casa, alcance: Alcance): number {
  return casa.grupos.reduce(
    (total, grupo) =>
      total + grupo.lugares.filter((lugar) => aplica(lugar.condicion, alcance)).length,
    0,
  );
}
