/**
 * ¿Este despliegue tiene Clerk configurado?
 *
 * Todo el arranque de auth-rbac cuelga de esta pregunta, y por eso vive en un
 * solo archivo. La regla del Paso 1 es **cero puertas cerradas**: si las llaves
 * no están puestas —en local, en un preview recién creado, en CI— la app tiene
 * que seguir funcionando exactamente igual que antes. Un `ClerkProvider` sin
 * llave publicable no se degrada: truena, y se lleva todas las pantallas de
 * corbata. Eso sería cerrarnos la puerta a nosotros mismos, justo lo que este
 * paso existe para evitar.
 *
 * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` se lee literal y no por una variable
 * intermedia: Next sustituye el texto `process.env.NEXT_PUBLIC_*` en tiempo de
 * compilación, y solo lo hace cuando lo encuentra escrito así.
 */

/**
 * Basta para montar el proveedor y los componentes de interfaz. Es seguro
 * leerlo desde cliente o servidor: la llave publicable es pública por diseño.
 */
export const CLERK_CONFIGURADO = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Lo que exige el lado servidor. `auth()` necesita además la llave secreta, y
 * si falta lanza en medio del render — así que se comprueban las dos antes de
 * tocarla. En cliente esto siempre da `false` (la secreta no se inlinea, y así
 * debe ser); por eso solo se usa en código de servidor.
 */
export function clerkListoEnServidor(): boolean {
  return CLERK_CONFIGURADO && Boolean(process.env.CLERK_SECRET_KEY);
}
