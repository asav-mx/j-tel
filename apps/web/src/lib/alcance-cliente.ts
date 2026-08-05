import { canAccessClientAccount, type UserMembership } from "@jtel/auth-rbac";
import type { OperationalUnit } from "@jtel/domain";

/**
 * Qué sitios de una cuenta cliente se le **enseñan** a quien está preguntando.
 *
 * Es la pieza 1.d del plan: el filtro de unidades por membresía que quedó sin
 * mergear en el #138. Vuelve con las dos advertencias de aquel PR intactas,
 * porque las dos siguen siendo ciertas — y con una tercera, medida al
 * escribirlo.
 *
 * ## Advertencia 1 — esto es presentación, no seguridad
 *
 * Este filtro decide qué se **enseña**, no qué está **permitido abrir**. La
 * guardia real vive en `guardia-pagina.ts` y en `@jtel/auth-rbac`. **Si el
 * inicio no enseña un sitio, la ruta directa a ese sitio queda exactamente tan
 * abierta como antes de este archivo.** Esconder no es cerrar, y confundir las
 * dos cosas es la forma más cara de creerse protegido.
 *
 * ## Advertencia 2 — la pregunta fina todavía no existe
 *
 * `canAccessPlant` está escrita en `@jtel/auth-rbac` y **no la llama nadie**
 * —comprobado el 4 de agosto de 2026 sobre `main`, cero llamadores fuera de sus
 * propias pruebas— y además **no tiene rama para `plant_group`**. Mientras siga
 * así, la guardia solo sabe preguntar «¿es tu cuenta?». La pregunta «¿tu
 * alcance cubre esta planta?» es la pieza 1.h, y no está diseñada.
 *
 * ## Advertencia 3 — hoy este filtro no le cambia la pantalla a nadie
 *
 * Medido, no inferido: `/cliente` resuelve su cuenta con
 * `resolveAccountByType`, que pregunta `canAccessClientAccount`, y esa función
 * exige alcance `account`, rol `admin_corporativo` o alcance global. **Un
 * usuario de planta no pasa de ahí**: no ve su planta sola, no ve nada — la
 * pantalla le dice «No hay cuentas cliente».
 *
 * O sea que hoy los únicos que llegan hasta aquí son los que lo ven todo, y
 * para ellos este filtro es la identidad. **Lo que se construye es la
 * estructura, no un cambio visible.** El día que 1.h abra la puerta por
 * alcance, la vista ya sabe recortarse y no habrá que acordarse de nada. Esa
 * es toda la ganancia, y decirla completa es parte de entregarla.
 */

/**
 * Los sitios que esta identidad puede ver de esta cuenta.
 *
 * **Falla cerrado, y esa es la mitad que importa.** Una identidad sin
 * membresías en la cuenta devuelve **lista vacía**, nunca la lista completa. El
 * #222 cerró exactamente ese patrón en `resolveAccountByType` —la ausencia de
 * un dato leída como permiso— y no vamos a reintroducirlo por la puerta de la
 * presentación.
 *
 * Alcances que **no** resuelven un sitio: `contract` y `fleet`. El primero
 * apunta a un contrato, no a una unidad operativa, y traducirlo exige leer la
 * base; el segundo no tiene caso de uso (ficha §5). Los dos devuelven vacío en
 * vez de adivinar.
 */
export function unidadesVisibles(
  unidades: OperationalUnit[],
  memberships: UserMembership[],
  clientAccountId: string,
): OperationalUnit[] {
  /*
   * La pregunta de cuenta, reutilizada y no copiada. Cubre de una sola vez el
   * alcance global, el alcance `account` y el rol `admin_corporativo`. Si
   * llevara su propia copia, el día que alguien corrigiera una de las dos, la
   * que se quedaría vieja sería justo la que decide qué se enseña.
   */
  if (canAccessClientAccount(memberships, clientAccountId)) return unidades;

  const deLaCuenta = memberships.filter((m) => m.accountId === clientAccountId);

  const plantas = new Set(
    deLaCuenta.filter((m) => m.scopeType === "plant" && m.scopeId).map((m) => m.scopeId!),
  );
  const campus = new Set(
    deLaCuenta.filter((m) => m.scopeType === "plant_group" && m.scopeId).map((m) => m.scopeId!),
  );

  return unidades.filter((u) => {
    if (u.kind === "plant") return plantas.has(u.id);

    /*
     * La regla del campus, de `Ficha-Diseno-Permisos.md` §2.2 y §2.3 —
     * confirmada por Asav el 31 de julio de 2026.
     *
     * Quien tiene alcance sobre una planta que vive dentro de un campus ve el
     * campus entero, porque **el transporte compartido es del campus, no de la
     * planta**: no existe «el viaje de la Planta 20», existe el viaje del
     * campus que recoge gente de las tres. No es un permiso de más — es que su
     * operación de transporte es el campus.
     *
     * Y es lo que hace que el filtro tenga que mirar `memberPlants`:
     * `getOperationalUnits` no lista como sitio propio a una planta agrupada,
     * así que buscar solo por id de unidad le dejaría la pantalla vacía a quien
     * sí tiene dónde mirar.
     *
     * Esto NO viola «una planta jamás ve otra planta»: esa ley protege entre
     * operaciones distintas, y un campus es una operación, no una excepción.
     */
    return campus.has(u.id) || u.memberPlants.some((p) => plantas.has(p.id));
  });
}

/**
 * ¿La vista alcanza la cuenta entera?
 *
 * No es cosmético: decide de qué alcance pueden salir las cifras del encabezado
 * y del aviso. Con la cuenta entera a la vista, el total de pendientes y la
 * antigüedad del más viejo pueden leerse de la cuenta —que es como se leen hoy,
 * y con esto siguen dando exactamente el mismo número—. Con la vista recortada
 * **no pueden**: un titular que cuenta pendientes de sitios que no salen en la
 * lista es §D del Marco con otro disfraz, un dato correcto que alarma sin
 * informar porque su alcance no es el de la pantalla que lo enseña.
 */
export function vistaCubreLaCuenta(
  memberships: UserMembership[],
  clientAccountId: string,
): boolean {
  return canAccessClientAccount(memberships, clientAccountId);
}
