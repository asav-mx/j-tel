/** Utilidades compartidas para filtros de rango de fechas (`desde` / `hasta`). */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(`${fromIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
 */
export function resolveDateRange(
  sp: Record<string, string | string[] | undefined> | undefined,
  opts: { defaultDaysBack?: number } = {},
): DateRange {
  const defaultDaysBack = opts.defaultDaysBack ?? 6;
  const today = todayIso();
  let fromIso = parseSearchParam(sp, "desde");
  let toIso = parseSearchParam(sp, "hasta");

  if (!isIsoDate(fromIso)) fromIso = addDaysIso(today, -defaultDaysBack);
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

/** Filtra por Date/`createdAt` usando el día calendario ISO. */
export function inCreatedAtRange(
  createdAt: Date | string,
  fromIso: string,
  toIso: string,
): boolean {
  const d =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.toISOString().slice(0, 10);
  return day >= fromIso && day <= toIso;
}
