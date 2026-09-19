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
 * antes de dibujar: Servicios especiales sólo con contrato, Circuitos sólo si la
 * cuenta opera transporte público.
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
 * «Servicios especiales», «Circuitos»— y el nombre de producto va como **sello
 * chico** encima de su sección. Un coordinador sabe buscar lo que hace, no
 * «Vernier». El lugar de Vernier se llamó «Cumplimiento» hasta el 18 sep 2026:
 * Asav lo renombró al construirlo, porque sigue siendo nombre de cosa y el
 * adjetivo evita que un carrier con concesión busque ahí sus circuitos.
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
          // C2 del cuarto de Compás (16 sep 2026).
          { nombre: "Flota en vivo", ruta: "/casa/transportista/flota", condicion: "siempre" },
          // C4-b: el inventario (6.6) y el alta (17 sep 2026).
          { nombre: "Dispositivos", ruta: "/casa/transportista/dispositivos", condicion: "siempre" },
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
            // Vernier V1 (18 sep 2026): los servicios de modalidad especial con su
            // veredicto, y el acta de cada ocurrencia. Los circuitos de transporte
            // público no entran aquí: viven en Circuitos.
            nombre: "Servicios especiales",
            ruta: "/casa/transportista/servicios-especiales",
            condicion: "con-contrato",
            // Declarado y sin cuarto: no se dibuja (regla de la cabecera).
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
          {
            // Su único lugar construido es el catálogo (D2, 16 sep 2026). Las altas
            // y los demos siguen en el árbol viejo; entran a este menú cuando se
            // muden, no antes.
            nombre: "Cuentas y demos",
            ruta: "/casa/jstaff/cuentas-y-demos",
            condicion: "siempre",
            hijos: [
              { nombre: "Catálogo de documentos", ruta: "/casa/jstaff/cuentas-y-demos/catalogo", condicion: "siempre" },
            ],
          },
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
 * Sale de la cuenta, no de una constante: `alcanceDeLaCuenta` en
 * `cuenta-del-cuarto.ts` lee si hay contrato de Vernier encendido. El primer
 * cuarto de Vernier (Servicios especiales, 18 sep 2026) desarmó la trampa que
 * aquí se anotaba: con la constante, el cuarto no habría aparecido nunca.
 */
export type Alcance = {
  conContrato: boolean;
  operaPublico: boolean;
};

/**
 * El alcance cuando no hay una cuenta que leer: la sesión no alcanza ninguna,
 * o ve varias y todavía no eligió. Sin cuenta no hay datos, así que no hay
 * contrato ni transporte público que afirmar; lo único que se dibuja es el
 * selector.
 *
 * También lo usan las casas que no tienen un solo lugar condicionado —Planta,
 * Corporativo, J-Staff—: ahí no cambia nada, porque nada de su menú pregunta.
 *
 * ⚠ **No es el alcance de una cuenta resuelta.** Un cuarto del transportista
 * con cuenta usa `cuenta.alcance`. Pasarle esto en su lugar esconde Servicios
 * especiales a una cuenta que sí tiene contrato — la trampa que este nombre
 * reemplazó (`ALCANCE_SIN_CUARTOS`, hasta el 18 sep 2026).
 */
export const ALCANCE_SIN_CUENTA: Alcance = { conContrato: false, operaPublico: false };

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

/**
 * En qué cuenta está la casa — lo que el marco necesita para no perderla.
 *
 * La resuelve el cuarto con su guardia y se la entrega al marco ya decidida: el
 * marco no vuelve a leer la dirección ni a comprobar alcance. Si lo hiciera,
 * habría dos respuestas a «¿en qué cuenta estoy?» y tarde o temprano dirían
 * cosas distintas.
 *
 * - `actual`: la cuenta resuelta, o `null` si no la hay (varias sin elegir, una
 *   que no te alcanza, ninguna).
 * - `enRuta`: el slug que las ligas arrastran. Sólo si vino en la dirección;
 *   quien tiene una sola cuenta no lo necesita y sus ligas quedan limpias.
 * - `elegibles`: las cuentas que tu alcance cubre. Con más de una hay selector.
 */
export type CuentaDeLaCasa = {
  actual: { slug: string; nombre: string } | null;
  enRuta: string | null;
  elegibles: { slug: string; nombre: string }[];
};

/**
 * Una ruta con la cuenta puesta, si hay cuenta que poner.
 *
 * Es la única forma de arrastrarla: la usan las pestañas, las ligas de los
 * cuartos y el selector. Si cada quien pegara el `?account=` a su manera, uno
 * se olvidaría del `&` y la cuenta se perdería justo en esa liga — que es la
 * clase de defecto que obligó a escribir esto (16 sep 2026).
 */
export function conCuenta(ruta: string, cuenta?: string | null): string {
  if (!cuenta) return ruta;
  return `${ruta}${ruta.includes("?") ? "&" : "?"}account=${encodeURIComponent(cuenta)}`;
}

/**
 * A qué cuarto se vuelve al cambiar de cuenta estando en esta ruta.
 *
 * Al cuarto, **no a la ficha**: la unidad 1042 de Juárez Bus no existe en la
 * cuenta de ASAV, así que quedarse en su ficha con otra cuenta sería pedir algo
 * que no hay. Se busca el lugar más hondo que contiene la ruta —un hijo gana a
 * su padre— entre todos los construidos, sin filtrar por alcance: el alcance es
 * de la cuenta nueva, y lo decide el cuarto al que se llega. Si la ruta no cae
 * en ningún lugar, la puerta de la casa.
 */
export function cuartoDeLaRuta(casa: Casa, ruta: string): string {
  const construidos = casa.grupos
    .flatMap((grupo) => grupo.lugares.flatMap((lugar) => [lugar, ...(lugar.hijos ?? [])]))
    .map((lugar) => lugar.ruta)
    .filter((r): r is string => r !== null && estaEnLugar(ruta, r));
  return construidos.sort((a, b) => b.length - a.length)[0] ?? casa.base;
}
