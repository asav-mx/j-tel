import type { Repositories } from "@jtel/db";
import {
  JTTEL_TZ,
  PALABRAS_DEL_ERROR,
  inicioDeFecha,
  intervalosDePausa,
  pausaVigente,
  revisarPausa,
  revisarReanudacion,
  type ErrorDeEvento,
  type IntervaloDePausa,
} from "@jtel/domain";

/**
 * Pausar y reanudar la verificación de un contrato, desde J-Staff (0041).
 *
 * Las reglas son de `@jtel/domain` (`pausa.ts`) y la base las vuelve a exigir;
 * aquí se revisan antes para decirlas en palabras, y se arma la vista previa:
 * **nada se escribe sin que alguien haya visto qué va a pasar** (la regla de lo
 * que re-sella, ahora para lo que borra).
 *
 * Quién puede: sólo el admin de plataforma, provisional hasta la 6.29
 * (decisión 8 de Asav). Lo revisa la ruta; aquí no hay sesión.
 */

export type ReposDePausa = Pick<Repositories, "pausas">;
export type ActorDePausa = { kind: string; id: string | null };

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: ErrorDeEvento; mensaje: string };
const falla = (error: ErrorDeEvento) => ({ ok: false as const, error, mensaje: PALABRAS_DEL_ERROR[error] });

/** El contrato con su estado de verificación, para la ficha y la lista de J-Staff. */
export async function estadoDeVerificacion(repos: ReposDePausa, contractId: string, ahora: Date) {
  const intervalos = intervalosDePausa(await repos.pausas.eventosDe(contractId));
  return { intervalos, vigente: pausaVigente(intervalos, ahora) as IntervaloDePausa | null };
}

/**
 * Qué haría pausar desde `fechaIso` (fecha civil en la zona del contrato), sin
 * hacerlo. Si la pausa no pasaría, lo dice sin contar nada.
 */
export async function vistaPreviaDePausa(
  repos: ReposDePausa,
  entrada: { contractId: string; fechaIso: string; motivo: string; zona: string | null; ahora: Date },
): Promise<Resultado<{ valeDesde: Date; motivo: string; efecto: Awaited<ReturnType<ReposDePausa["pausas"]["vistaPrevia"]>> }>> {
  const valeDesde = /^\d{4}-\d{2}-\d{2}$/.test(entrada.fechaIso)
    ? inicioDeFecha(entrada.fechaIso, entrada.zona ?? JTTEL_TZ)
    : null;
  const revisada = revisarPausa({
    eventos: await repos.pausas.eventosDe(entrada.contractId),
    valeDesde,
    motivo: entrada.motivo,
    ahora: entrada.ahora,
  });
  if (!revisada.ok) return falla(revisada.error);
  const efecto = await repos.pausas.vistaPrevia(entrada.contractId, valeDesde!);
  return { ok: true, valeDesde: valeDesde!, motivo: revisada.motivo, efecto };
}

/**
 * Pausar: se revisa otra vez con la misma función que armó la vista previa —lo
 * que se escribe es lo que se revisó, o nada— y el evento y el borrado van en
 * una sola transacción.
 */
export async function pausarVerificacion(
  repos: ReposDePausa,
  entrada: { contractId: string; fechaIso: string; motivo: string; zona: string | null; ahora: Date; actor: ActorDePausa },
): Promise<Resultado<{ borradas: number }>> {
  const previa = await vistaPreviaDePausa(repos, entrada);
  if (!previa.ok) return previa;
  const { borradas } = await repos.pausas.pausar(entrada.contractId, {
    valeDesde: previa.valeDesde,
    motivo: previa.motivo,
    actor: entrada.actor,
  });
  return { ok: true, borradas };
}

/** Reanudar vale desde ahora. Sin motivo obligatorio: lo que se explica es la excepción. */
export async function reanudarVerificacion(
  repos: ReposDePausa,
  entrada: { contractId: string; ahora: Date; actor: ActorDePausa },
): Promise<Resultado<Record<never, never>>> {
  const revisada = revisarReanudacion({ eventos: await repos.pausas.eventosDe(entrada.contractId) });
  if (!revisada.ok) return falla(revisada.error);
  await repos.pausas.reanudar(entrada.contractId, entrada.actor, entrada.ahora);
  return { ok: true };
}
