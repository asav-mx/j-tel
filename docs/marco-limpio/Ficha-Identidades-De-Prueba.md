# Ficha — Tres identidades de prueba, una por cara

**Fecha:** 5 de agosto de 2026 · **Estado:** diseño, **esperando trámite de Asav**
· **Nada ejecutado**

**Qué resuelve:** hoy Asav solo puede ver su propia cara. Para probar el producto
de verdad hacen falta **tres sesiones simultáneas en navegadores distintos** —
corporativo de Tecma, usuario de Planta 47, admin de Juárez Bus.

**Qué NO es:** cuentas nuevas. Las tres membresías **ya existen** en la base desde
el seed; lo único que falta es **ligarles una identidad de Clerk**.

---

## 1. Lo que ya existe, y por eso esto es chico

🟢 Comprobado contra la base: las tres identidades del seed están puestas, con su
alcance, y **no hace falta crear ninguna membresía nueva**.

| Cara | Cadena del seed | Rol | Alcance |
|---|---|---|---|
| Cliente — corporativo | `tecma_admin` | `admin_corporativo` | cuenta Tecma |
| Cliente — planta | `tecma_planta47` | `usuario_planta` | planta 47 |
| Carrier | `jb_admin` | `admin` | cuenta Juárez Bus |

El mecanismo de ligado también existe: `MAPEO` en
`packages/db/src/mapeo-identidades.ts`, ejecutado por `vincular-identidades.ts`,
**en seco por omisión**. Es el mismo que ligó la identidad de Asav en el #209.

> ⚠ **Una de las tres no va a poder entrar a su cara, y hay que saberlo antes.**
> 🟢 `tecma_planta47` tiene alcance `plant`, y `canAccessClientAccount` exige
> alcance `account`. Hoy `/cliente` le contesta **«No hay cuentas cliente»**. Eso
> es la pieza **1.h**, que sigue abierta. **Ligarle la identidad no lo arregla:**
> va a poder entrar al producto y no va a ver su planta. Si el objetivo es ver
> las tres caras a la vez, **1.h es requisito para la tercera.**

---

## 2. Lo que necesito de tu lado, en Clerk

**Tres cosas, y ninguna toca el repo.**

### 2.1 Crear tres usuarios en la instancia de **prueba**

Hoy en Vercel están las **llaves de test** (T1 del plan), así que cualquier
usuario que crees ahí **ya es de prueba por construcción** — no existe en la
instancia de producción y no puede entrar a nada real el día que se conecten las
llaves de producción.

**Con la convención de correo de prueba de Clerk**, que es la parte que los deja
marcados sin inventar buzones:

```
prueba.tecma.corp+clerk_test@j-telemetry.com
prueba.tecma.p47+clerk_test@j-telemetry.com
prueba.jb.admin+clerk_test@j-telemetry.com
```

El sufijo `+clerk_test` hace que Clerk **no mande correo** y acepte un código
fijo de verificación. Ventajas, y son justo tus dos condiciones:

- **No hace falta que el buzón exista** — y `hola@j-telemetry.com` todavía no
  existe (T2).
- **Se leen como prueba a simple vista**, en Clerk y en cualquier registro.

### 2.2 Ponerles nombre y apellido en Clerk

**Es lo que resuelve tu primera condición.** Ver §3.

### 2.3 Pasarme los tres `user_...`

Solo el identificador. **Ni correos ni nombres** — ver §4.

---

## 3. El nombre en pantalla, sin meter datos personales al repo

**El problema:** la esquina dice `user_3HQuURm3OmMaJXub9RMpRMYHVkN`. Ilegible.

**Por qué pasa:** `getIdentidad()` toma de Clerk **solo el `userId`**
(`const { userId } = await auth()`), y la base guarda ese id y nada más. **El
nombre vive en Clerk y en ningún otro lado** — que es exactamente como debe ser.

**Cómo lo resolvería, y es la parte importante: no guardándolo.**

> **El nombre se lee de Clerk en cada render y no se persiste nunca.** Ni en la
> base, ni en el `MAPEO`, ni en un caché nuestro.

Dos formas, en este orden:

1. **De los claims de la sesión.** Clerk puede incluir `first_name` y
   `last_name` en el token de sesión, configurable desde su panel. Sale **sin una
   sola llamada extra** — ya viaja en la petición que el middleware valida.
2. **De la API de Clerk como respaldo** (`currentUser()`), si el claim no está.
   Cuesta una llamada por render, y por eso es el plan B y no el A.

**Y si Clerk no contesta, se enseña el identificador**, que es lo que hay hoy.
Un nombre es comodidad; **la identidad es el id**, y una pantalla que se cae
porque el adorno no cargó es la lección del distintivo de sesión otra vez.

**Lo que esto respeta:** el `MAPEO` versionado sigue llevando **solo `user_...` y
una nota de rol** — su regla desde el #209, y por eso ahí nunca hubo un correo.

---

## 4. Lo que esto deja en la base, dicho antes — la lección del #206

**Sí mete filas, y sí hay que limpiarlas algún día.** Aquí va el conteo exacto
antes de ejecutar nada, que es lo que faltó con las cuentas demo.

🟢 `vincular(desde, hacia)` **agrega, no reemplaza**: por cada membresía del seed
inserta **una fila espejo** con el `user_...` de Clerk, y **deja la del seed
intacta** — porque las del seed son lo que sostiene el bypass.

| | Filas nuevas en `user_memberships` |
|---|---|
| `tecma_admin` → Clerk | 1 |
| `tecma_planta47` → Clerk | 1 |
| `jb_admin` → Clerk | 1 |
| **Total** | **3** |

**Tres filas. Nada más.** Ni cuentas, ni contratos, ni servicios, ni hechos. **No
se sella nada y no se genera un solo veredicto.**

### Cómo se limpian, y por qué se puede

**Se sabe cuáles son sin adivinar:** las tres tienen un `clerk_user_id` que
empieza con `user_` y está listado en el `MAPEO` versionado. **El archivo es la
lista de limpieza.**

**Propuesta, para que no dependa de acordarse:** que cada entrada del `MAPEO`
lleve un campo `prueba: true`, y que el ejecutor sepa **deshacer** lo que ese
campo marca. Cuesta una línea por identidad y convierte «hay que limpiar esto
algún día» en un comando.

> **La diferencia con el #206 es ésta:** las 84 filas de la cuenta demo eran
> **hechos sellados** —veredictos vinculantes sobre servicios que nadie
> declaró—, y por eso limpiarlas exige firma y motivo. Éstas son **tres filas de
> pertenencia sin consecuencia**: no acusan a nadie, no entran a ningún conteo,
> y borrarlas no cambia un solo veredicto. **No es el mismo riesgo, y decirlo
> igual es el punto.**

---

## 5. El orden, y dónde está la parada

1. 👤 **Asav** crea los tres usuarios en Clerk con la convención `+clerk_test`,
   les pone nombre y apellido, y pasa los tres `user_...`.
2. 👤 **Asav** activa `first_name` / `last_name` en los claims de sesión de Clerk
   (o confirma que prefiere el plan B de §3).
3. **Devin** agrega las tres entradas al `MAPEO` con su `nota` de rol — **sin
   correos ni nombres** — y el campo `prueba: true`.
4. **Devin** corre el ejecutor **en seco**, enseña las tres filas que insertaría,
   y **para ahí**.
5. 👤 **Asav** aprueba, y recién entonces se ejecuta contra producción.
6. **Devin** hace que la esquina lea el nombre de Clerk, con respaldo al id.

**Lo que NO se puede hacer todavía:** ver la cara de planta. **1.h primero.**
