# Cómo se crea el proyecto de la app pública

**Escrito el 27 de agosto de 2026**, al salir el endpoint del pasajero (PR #351).

`apps/publico` es la app del pasajero de Juárez Bus: **la única superficie de
J-Telemetry sin autenticación**. Va en un **proyecto de Vercel aparte** para
aislar el tráfico abierto, **dentro de este mismo monorepo** — el repo despliega
varias apps a proyectos distintos, y aquí eso deja de ser teoría.

> **Hermano de [`Procedimiento-Firewall-Publico.md`](Procedimiento-Firewall-Publico.md).**
> Aquél pone el límite de tasa; éste pone el proyecto debajo. Los dos existen por
> la misma razón: **son configuración que no vive en el repo**, y lo que no está
> en el código no aparece en un PR ni se le cae encima a nadie cuando falta.

---

## Lo que la app necesita, y nada más

Comprobado sobre el código, no supuesto:

| Variable | Dónde se lee | Para qué |
|---|---|---|
| `DATABASE_URL` | `apps/publico/src/lib/db.ts` | La consulta del endpoint |
| `JTEL_SECRET_KEY` | `apps/publico/src/app/api/circuitos/[slug]/unidades/route.ts` | El `id_publico` opaco |

**Eso es todo.** Ni Clerk, ni Umbrella, ni `CRON_SECRET`. Si alguien agrega una
variable a este proyecto, que sea porque la app la lee.

---

## 1 · Crear el proyecto

1. **vercel.com/new**.
2. Importar **`asav-mx/j-tel`** — el mismo repo que ya usa `j-tel-web`. Un repo
   alimenta varios proyectos; eso es lo que hace que esto no necesite repo nuevo.
3. **Project Name:** `j-tel-publico`.
4. **Root Directory → Edit → `apps/publico`.** El paso que decide todo: con la
   raíz del repo, Vercel no encuentra una app Next y el build no arranca.
5. **Framework Preset** se detecta solo como **Next.js**. Si dice otra cosa, la
   carpeta está mal escogida.
6. **No desplegar todavía** — primero las variables, o el primer build truena por
   una razón que no es la real y manda a buscar al lado equivocado.

## 2 · Las variables

En **Environment Variables**, las dos, en **Production, Preview y Development**:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | **la cadena de `DATABASE_URL_READONLY`** |
| `JTEL_SECRET_KEY` | la misma que `j-tel-web` |

### En `DATABASE_URL` va el usuario de SOLO LECTURA, y no es un descuido

Ninguna ruta de esta app escribe. Darle el usuario dueño es regalarle permisos
que no usa, en la única superficie del producto expuesta a internet sin sesión.
Con `jtel_readonly` queda de solo lectura **por permiso y no por costumbre**: si
alguien mete un `INSERT` por error, lo rechaza Postgres y no la buena intención
de quien lo escribió.

⚠ **`DATABASE_URL_READONLY` solo vive en los `.env` locales, no en Vercel.**
Sácala de ahí. Y no corras `vercel env pull` encima de ese archivo después: la
borra, y el procedimiento de migraciones deja de tener con qué verificar.

### La llave tiene que ser la MISMA que la de `j-tel-web`

No por comodidad. El `id_publico` es un HMAC con esa llave: si algún día un
pasajero reporta algo citando el identificador que vio en la app, con llaves
distintas no hay forma de cruzarlo con la unidad real desde la cara interna.

Con eso puesto, **Deploy**.

## 3 · Si el build falla

El caso probable es `Cannot find module '@jtel/db'`: los paquetes del monorepo se
publican compilados a `dist/` y hay que construirlos antes que la app. Vercel
suele resolverlo solo porque detecta Turborepo. Si no:

**Settings → Build & Deployment → Build Command → Override:**

```
cd ../.. && pnpm turbo run build --filter=@jtel/publico
```

Si el primer build pasa, no tocar nada.

## 4 · Dos ajustes que sí importan

**Deployment Protection — producción tiene que quedar PÚBLICA.** Es una app para
quien espera un camión en una esquina; si Vercel le pide autenticarse, no sirve
para nada y además contradice el diseño entero, que arranca por la ubicación del
pasajero y sin cuenta. La protección de *previews* sí se queda encendida.

**Nada de crons.** `apps/publico` no tiene `vercel.json` y así debe seguir. Los
diez crons viven en `apps/web/vercel.json` y son de aquel proyecto. Duplicarlos
aquí haría correr el recolector dos veces y escribir posiciones por partida
doble — un daño silencioso, del que se ve normal.

## 5 · El dominio y el DNS

**En Vercel:** Settings → Domains → `juarezbus.digital` → **Add**. Vercel muestra
los registros exactos que pide. **Usar los que muestre la pantalla**, que son la
fuente buena. Lo que la documentación dice hoy, y lo que hay que esperar ver:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns-0.com` |

⚠ **Fíjate en el `-0` del CNAME.** Ese valor cambió; el viejo
`cname.vercel-dns.com` ya no es el documentado, y copiarlo de un tutorial de hace
un año deja el dominio en «Invalid Configuration» sin decir por qué.

**En Unstoppable Domains:** los nameservers del dominio apuntan ahí, así que **los
registros se editan en su panel, no en Vercel**. Estado al 27 de agosto de 2026:

```
NS  → ns1/ns2.unstoppabledomains.com
A   → (nada)
www → (nada)
```

Mover los nameservers a Vercel también funcionaría, pero es más movimiento del
necesario y deja el dominio administrado en dos lados.

**Comprobar, no suponer:**

```bash
dig +short A juarezbus.digital     # debe contestar 76.76.21.21
```

Tarda de minutos a un par de horas. Mientras no conteste eso, Vercel muestra
*Invalid Configuration* y no es un error de configuración del proyecto: es DNS
sin propagar.

## 6 · La comprobación final

El endpoint no sirve hasta que el circuito tenga unidades asignadas **y** esté
publicado. Con las dos cosas:

```
https://juarezbus.digital/api/circuitos/<slug>/unidades
```

- **404** mientras el circuito esté sin publicar — y el mismo 404 que para un
  slug inventado, que es lo que hace que no se pueda averiguar cuáles existen.
- **200** en cuanto se prenda el interruptor desde `/jstaff/circuitos/<id>`.

Y ahí toca poner la regla del firewall:
[`Procedimiento-Firewall-Publico.md`](Procedimiento-Firewall-Publico.md).

---

## Qué NO está resuelto por este procedimiento

- **El proyecto no se crea desde el repo.** No hay `vercel.json` que lo
  describa ni infraestructura como código: si alguien lo borra, se rehace a mano
  con este archivo. Es el mismo costo aceptado que el del firewall.
- **`DATABASE_URL_READONLY` sigue sin estar en Vercel** para la cara interna. Este
  procedimiento la usa en el proyecto público, que es donde más falta hacía, pero
  no cierra el pendiente general.
