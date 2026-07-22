/**
 * Utilidades compartidas para filtros de rango de fechas (`desde` / `hasta`).
 *
 * Todas las funciones que resuelven "qué día civil es" delegan a
 * `localDateIso` de `@jtel/domain` — una sola implementación, una sola zona.
 *
 * `timeZone` es opcional con default `JTTEL_TZ` (zona del despliegue).
 *
 * ── Call sites que DEBEN pasar `contract.policy.timeZone` ───────────────
 * Cuando existan contratos en zonas distintas a Juárez, estos call sites
 * DEBEN pasar la zona del contrato en foco. Hoy todos usan el default
 * porque todos los contratos comparten zona. Marcarlos aquí para que
 * un grep futuro los encuentre:
 *
 *   TIENE CONTRATO EN CONTEXTO (pasar timeZone cuando haya multi-zona):
 *     - views/servicios-unit.tsx          → rolling window de perfiles
 *     - views/unit-compliance.tsx         → rango de cumplimiento
 *     - app/carrier/cumplimiento/page.tsx → cumplimiento carrier
 *     - app/cliente/reportes/page.tsx     → reporte mensual
 *     - app/jstaff/soporte/page.tsx       → soporte J-Staff
 *
 *   CORRECTO CON DEFAULT (multi-contrato o sin contrato):
 *     - components/date-range-filter.tsx  → filtro genérico, sin contrato
 *     - components/reverify-range-form.tsx→ multi-contrato, usa JTTEL_TZ
 *     - app/carrier/mantenimiento         → alertas carrier, sin contrato
 *     - app/cliente/notificaciones        → notificaciones, sin contrato
 *     - views/contratos-unit.tsx          → formulario de contratos
 * ─────────────────────────────────────────────────────────────────────────
 */

import { localDateIso, JTTEL_TZ } from "@jtel/domain";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Día civil actual en la zona indicada (default: zona del despliegue).
 *
 * ⚠ Si tienes un contrato en contexto, pasa `contract.policy.timeZone`.
 */
export function todayIso(timeZone: string = JTTEL_TZ): string {
  return localDateIso(new Date(), timeZone);
}

/**
 * Suma/resta días a una fecha ISO. Resultado en la misma zona civil.
 *
 * Internamente crea el Date en UTC (mediodía para evitar problemas DST),
 * suma los días, y proyecta el resultado a la zona indicada.
 */
export function addDaysIso(fromIso: string, days: number, timeZone: string = JTTEL_TZ): string {
  const d = new Date(`${fromIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return localDateIso(d, timeZone);
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00`));
}

export function parseSearchParam(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const v = sp?.[key];
  if (typeof v === "string" && v.length > 0) {
    if (key !== "account" && v.includes("&")) {
      return v.split("&")[0] || null;
    }
    return v;
  }
  if (key !== "account" && typeof sp?.account === "string") {
    const match = sp.account.match(new RegExp(`(?:^|&)${key}=([^&]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export type DateRange = {
  fromIso: string;
  toIso: string;
  from: Date;
  to: Date;
  label: string;
};

/**
 * Lee `desde` / `hasta` de searchParams.
 * Si faltan, usa los últimos `defaultDaysBack` días inclusive (0 = solo hoy).
 * Si `desde` > `hasta`, los intercambia.
 *
 * ⚠ Si tienes un contrato en contexto, pasa `timeZone` en opts.
 */
export function resolveDateRange(
  sp: Record<string, string | string[] | undefined> | undefined,
  opts: { defaultDaysBack?: number; timeZone?: string } = {},
): DateRange {
  const defaultDaysBack = opts.defaultDaysBack ?? 6;
  const tz = opts.timeZone ?? JTTEL_TZ;
  const today = todayIso(tz);
  let fromIso = parseSearchParam(sp, "desde");
  let toIso = parseSearchParam(sp, "hasta");

  if (!isIsoDate(fromIso)) fromIso = addDaysIso(today, -defaultDaysBack, tz);
  if (!isIsoDate(toIso)) toIso = today;

  if (fromIso > toIso) {
    const tmp = fromIso;
    fromIso = toIso;
    toIso = tmp;
  }

  return {
    fromIso,
    toIso,
    from: new Date(`${fromIso}T00:00:00`),
    to: new Date(`${toIso}T00:00:00`),
    label:
      fromIso === toIso
        ? fromIso
        : `${fromIso} → ${toIso}`,
  };
}

/** Filtra filas con `serviceDate` (YYYY-MM-DD) dentro del rango inclusive. */
export function inServiceDateRange(
  serviceDate: string,
  fromIso: string,
  toIso: string,
): boolean {
  const day = serviceDate.slice(0, 10);
  return day >= fromIso && day <= toIso;
}

/**
 * Filtra por Date/`createdAt` usando el día civil en la zona indicada.
 *
 * ⚠ Si tienes un contrato en contexto, pasa `timeZone`.
 */
export function inCreatedAtRange(
  createdAt: Date | string,
  fromIso: string,
  toIso: string,
  timeZone: string = JTTEL_TZ,
): boolean {
  const d =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  const day = localDateIso(d, timeZone);
  return day >= fromIso && day <= toIso;
}
