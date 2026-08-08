import { asc, eq } from "drizzle-orm";
import { createDb } from "./index.js";
import {
  accounts,
  serviceContracts,
  serviceOccurrences,
  serviceProfiles,
  units,
  userMemberships,
} from "./schema/index.js";

/**
 * El escenario feo: **dos transportistas sirviendo a la misma planta.**
 *
 * Existe porque con un solo carrier ninguna prueba puede distinguir una
 * guardia que funciona de una que no existe: todo lo que se pide es tuyo, y
 * cualquier comprobación de pertenencia pasa por vacía. Hasta el 4 de agosto
 * de 2026 la rama desechable tenía exactamente eso — un solo carrier,
 * `juarez-bus`.
 *
 * ## Por qué B comparte cliente y planta con A
 *
 * Si a B se le diera otro cliente, pedir lo de A chocaría primero contra la
 * pared entre CUENTAS DE CLIENTE, y la prueba pasaría sin haber tocado nunca
 * la pared entre carriers. Compartiendo cliente y planta, lo único que separa
 * a B de los recursos de A es la pertenencia del carrier. Que es lo que se
 * quiere medir.
 *
 * ## El candado
 *
 * Se niega a sembrar si la URL no es la de `DATABASE_URL_TEST`. Esta función
 * escribe seis filas; ninguna tiene nada que hacer en una base con un cliente
 * vivo, y el `#206` ya enseñó lo que cuesta una cuenta de mentiras en
 * producción — 84 hechos sellados encima, 52 de ellos acusaciones formales por
 * servicios que nadie prestó.
 *
 * Es **idempotente**: se puede correr muchas veces. Re-sembrar no duplica.
 */

/** Ids fijos: eso es lo que hace la siembra repetible en vez de acumulativa. */
export const ESCENARIO_B = {
  cuentaId: "b0000000-0000-4000-8000-000000000001",
  unidadId: "b0000000-0000-4000-8000-000000000002",
  contratoId: "b0000000-0000-4000-8000-000000000003",
  perfilId: "b0000000-0000-4000-8000-000000000004",
  ocurrenciaId: "b0000000-0000-4000-8000-000000000005",
  membresiaId: "b0000000-0000-4000-8000-000000000006",
  membresiaFlotaId: "b0000000-0000-4000-8000-000000000007",
  slug: "transportes-frontera",
  usuario: "frontera_admin",
  /**
   * El usuario que hace REAL la prueba de audiencia.
   *
   * `canAccessClientAccount` y `canAccessCarrierAccount` coinciden en
   * `scopeType: "account"` y se separan justo afuera: la de cliente acepta
   * además el rol `admin_corporativo`, la de carrier acepta además
   * `scopeType: "fleet"`.
   *
   * Con solo el `frontera_admin` —que es de cuenta— cambiar la audiencia de la
   * guardia **no cambiaría nada**, y la mutación que confunde las dos paredes
   * sobreviviría en verde. Éste, que alcanza por flota, es invisible para la
   * función de cliente: es el único testigo que nota la diferencia.
   */
  usuarioFlota: "frontera_flota",
} as const;

export type EscenarioDosCarriers = {
  carrierA: { id: string; name: string; slug: string; type: string };
  carrierB: { id: string; name: string; slug: string; type: string };
  /** Lo de A — lo que B va a intentar abrir. */
  deA: { unidadId: string; contratoId: string; ocurrenciaId: string };
  /** Lo de B — el control: si esto tampoco abre, la prueba pasa por vacía. */
  deB: { unidadId: string; contratoId: string; ocurrenciaId: string };
};

export async function sembrarEscenarioDosCarriers(
  connectionString: string,
  opciones: { carrierASlug?: string } = {},
): Promise<EscenarioDosCarriers> {
  const test = process.env.DATABASE_URL_TEST;
  if (!test) {
    throw new Error("[escenario] DATABASE_URL_TEST no está definida. No se siembra a ciegas.");
  }
  if (connectionString !== test) {
    throw new Error(
      "[escenario] La URL recibida no es DATABASE_URL_TEST. Este escenario solo se siembra " +
        "en la rama desechable — ver el #206.",
    );
  }

  const db = createDb(connectionString);
  const slugA = opciones.carrierASlug ?? "juarez-bus";

  const [a] = await db.select().from(accounts).where(eq(accounts.slug, slugA));
  if (!a) throw new Error(`[escenario] No existe el carrier A (${slugA}) en la base de pruebas`);

  /*
   * `ORDER BY` explícito, y no es cosmético.
   *
   * Esto era `LIMIT 1` a secas. Postgres no garantiza qué fila devuelve sin
   * orden, así que el contrato de A podía cambiar entre corridas — y como el
   * contrato de B se escribía con `onConflictDoNothing`, B se quedaba clavado
   * al cliente de la PRIMERA corrida. Los dos carriers dejaban de compartir
   * cliente y **la pared que se medía pasaba a ser la del cliente, no la del
   * carrier**, sin que nada lo dijera.
   *
   * Es el mismo patrón que el `[0]` de `resolveAccountByType` que cerró el
   * #222, y la hermana de la regla 2 de «las ganadas por las malas»: ordenar
   * sin techo devuelve el futuro; **no ordenar devuelve cualquiera.**
   */
  const [contratoDeA] = await db
    .select()
    .from(serviceContracts)
    .where(eq(serviceContracts.carrierAccountId, a.id))
    .orderBy(asc(serviceContracts.createdAt), asc(serviceContracts.id))
    .limit(1);
  if (!contratoDeA) throw new Error("[escenario] El carrier A no tiene contratos");

  const [perfilDeA] = await db
    .select()
    .from(serviceProfiles)
    .where(eq(serviceProfiles.contractId, contratoDeA.id))
    .limit(1);
  if (!perfilDeA) throw new Error("[escenario] El contrato de A no tiene perfil de servicio");

  const [ocurrenciaDeA] = await db
    .select()
    .from(serviceOccurrences)
    .where(eq(serviceOccurrences.contractId, contratoDeA.id))
    .limit(1);
  if (!ocurrenciaDeA) throw new Error("[escenario] El contrato de A no tiene ocurrencias");

  const [unidadDeA] = await db
    .select()
    .from(units)
    .where(eq(units.carrierAccountId, a.id))
    .limit(1);
  if (!unidadDeA) throw new Error("[escenario] El carrier A no tiene unidades");

  await db
    .insert(accounts)
    .values({
      id: ESCENARIO_B.cuentaId,
      slug: ESCENARIO_B.slug,
      name: "Transportes Frontera",
      type: "carrier",
      isDemo: false,
    })
    .onConflictDoNothing();

  await db
    .insert(units)
    .values({
      id: ESCENARIO_B.unidadId,
      carrierAccountId: ESCENARIO_B.cuentaId,
      label: "Unidad 201",
      plateNumber: "FRO-201",
      active: true,
    })
    .onConflictDoNothing();

  await db
    .insert(userMemberships)
    .values({
      id: ESCENARIO_B.membresiaId,
      accountId: ESCENARIO_B.cuentaId,
      clerkUserId: ESCENARIO_B.usuario,
      role: "admin",
      scopeType: "account",
    })
    .onConflictDoNothing();

  await db
    .insert(userMemberships)
    .values({
      id: ESCENARIO_B.membresiaFlotaId,
      accountId: ESCENARIO_B.cuentaId,
      clerkUserId: ESCENARIO_B.usuarioFlota,
      role: "admin",
      scopeType: "fleet",
    })
    .onConflictDoNothing();

  await db
    .insert(serviceContracts)
    .values({
      id: ESCENARIO_B.contratoId,
      clientAccountId: contratoDeA.clientAccountId,
      carrierAccountId: ESCENARIO_B.cuentaId,
      plantId: contratoDeA.plantId,
      plantGroupId: contratoDeA.plantGroupId,
      name: `${contratoDeA.name} (Frontera)`,
      status: "active",
      policy: contratoDeA.policy,
      validFrom: contratoDeA.validFrom,
      validTo: contratoDeA.validTo,
    })
    /*
     * CONVERGE, no omite. Con `onConflictDoNothing` una fila vieja sobrevivía
     * intacta y el escenario dejaba de ser el escenario: B seguía colgado del
     * cliente de una corrida anterior. Sembrar tiene que dejar la base en el
     * estado pedido, no «en el estado pedido si estaba vacía».
     */
    .onConflictDoUpdate({
      target: serviceContracts.id,
      set: {
        clientAccountId: contratoDeA.clientAccountId,
        carrierAccountId: ESCENARIO_B.cuentaId,
        plantId: contratoDeA.plantId,
        plantGroupId: contratoDeA.plantGroupId,
        policy: contratoDeA.policy,
        validFrom: contratoDeA.validFrom,
        validTo: contratoDeA.validTo,
      },
    });

  await db
    .insert(serviceProfiles)
    .values({
      id: ESCENARIO_B.perfilId,
      contractId: ESCENARIO_B.contratoId,
      routeShiftId: perfilDeA.routeShiftId,
      geofenceId: perfilDeA.geofenceId,
      name: `${perfilDeA.name} (Frontera)`,
      code: "FRO-NORTE-7",
      referenceUnitId: ESCENARIO_B.unidadId,
      activeDays: [1, 2, 3, 4, 5],
      active: true,
    })
    // Mismo motivo: el perfil hereda ruta y geocerca de A, así que si A cambia
    // el perfil viejo queda apuntando a otra parte.
    .onConflictDoUpdate({
      target: serviceProfiles.id,
      set: {
        routeShiftId: perfilDeA.routeShiftId,
        geofenceId: perfilDeA.geofenceId,
        referenceUnitId: ESCENARIO_B.unidadId,
        active: true,
      },
    });

  await db
    .insert(serviceOccurrences)
    .values({
      id: ESCENARIO_B.ocurrenciaId,
      serviceProfileId: ESCENARIO_B.perfilId,
      contractId: ESCENARIO_B.contratoId,
      routeShiftId: perfilDeA.routeShiftId,
      serviceDate: ocurrenciaDeA.serviceDate,
      expectedDeadline: ocurrenciaDeA.expectedDeadline,
      expectedGeofenceId: ocurrenciaDeA.expectedGeofenceId,
      referenceUnitId: ESCENARIO_B.unidadId,
    })
    .onConflictDoNothing();

  const [b] = await db.select().from(accounts).where(eq(accounts.id, ESCENARIO_B.cuentaId));

  return {
    carrierA: { id: a.id, name: a.name, slug: a.slug, type: a.type },
    carrierB: { id: b!.id, name: b!.name, slug: b!.slug, type: b!.type },
    deA: {
      unidadId: unidadDeA.id,
      contratoId: contratoDeA.id,
      ocurrenciaId: ocurrenciaDeA.id,
    },
    deB: {
      unidadId: ESCENARIO_B.unidadId,
      contratoId: ESCENARIO_B.contratoId,
      ocurrenciaId: ESCENARIO_B.ocurrenciaId,
    },
  };
}
