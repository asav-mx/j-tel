import { timingSafeEqual } from "node:crypto";

/**
 * Valida el header `Authorization: Bearer <CRON_SECRET>` de los endpoints cron.
 *
 * Seguridad:
 * - En producción `CRON_SECRET` es obligatoria; si falta, se rechaza todo.
 *   Nunca usamos un secreto por defecto en producción.
 * - Solo fuera de producción se acepta el fallback `dev-cron-secret` para
 *   facilitar el desarrollo local.
 * - La comparación es de tiempo constante para evitar timing attacks.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  const expected =
    configured && configured.length > 0
      ? configured
      : process.env.NODE_ENV !== "production"
        ? "dev-cron-secret"
        : null;

  if (!expected) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return false;

  const provided = authHeader.slice(prefix.length);
  return safeEqual(provided, expected);
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
