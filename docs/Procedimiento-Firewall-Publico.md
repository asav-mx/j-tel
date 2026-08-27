# El límite de tasa del endpoint público

**Escrito el 27 de agosto de 2026, al construir el endpoint del Tramo JB.**

> **Este límite NO vive en el repo.** Es una regla del firewall de Vercel, y esa
> es exactamente la razón por la que este archivo existe: lo que no está en el
> código no aparece en un PR, no se prueba en local y no se le cae encima a
> nadie cuando falta. Si borras este archivo, en tres semanas nadie sabe que el
> endpoint depende de una regla puesta a mano.

---

## La decisión, y lo que costó

El `PLAN.md` §Tramo JB dice que el endpoint público lleva **caché y límite de
tasa, obligatorios**. Había tres caminos y se escogió el primero, el 26 de
agosto de 2026:

| Camino | Por qué no se escogió |
|---|---|
| **Firewall de Vercel** | **Escogido.** Cero código, cero dependencias, cero secretos, y frena el abuso antes de tocar una función. |
| Upstash Redis por Marketplace | Contador distribuido de verdad, en el repo y probable en local. Se descartó por costo y por una dependencia más para quince días de sprint. |
| Solo caché | Contradice el PLAN. |

**El costo aceptado:** el límite no se revisa en un PR ni se ejercita en local.
Se compensa con este procedimiento y con la comprobación de abajo.

---

## Qué proteger, y por qué el caché ya hace casi todo

La respuesta se sirve con:

```
cache-control: public, s-maxage=15, stale-while-revalidate=30
```

Así que **una parada llena de gente pega al CDN, no a la base**: con 15 s de TTL,
cincuenta teléfonos preguntando cada 10 s producen ~4 llamadas por minuto a la
función, no 300. El límite de tasa no está para el uso normal — está para el
raspado: alguien recorriendo slugs, o pidiendo el mismo circuito mil veces por
minuto con el encabezado que sea para saltarse el caché.

---

## La regla

En el proyecto de Vercel **de la app pública** (no el de la cara interna) →
**Firewall** → **Rate Limiting**:

| Campo | Valor | Por qué |
|---|---|---|
| Ruta | `/api/circuitos/*` | Todo el endpoint, cualquier circuito. |
| Ventana | **60 s** | Larga para que un pico normal no la toque. |
| Límite | **60 peticiones por IP** | Una por segundo sostenida. Un pasajero con la app abierta hace 4–6 por minuto contando el caché; sesenta es diez veces el uso real y sigue siendo cien veces menos que un raspado. |
| Acción | **Challenge**, no Deny | Un `deny` deja fuera a una colonia entera detrás de un NAT móvil — que en Juárez es el caso normal, no la excepción. El desafío deja pasar al humano y frena al guion. |

**Encender también «Attack Challenge Mode» no.** Ese es para cuando ya estás bajo
ataque; encendido de base le pone un obstáculo a cada pasajero.

---

## Cómo se comprueba que está mordiendo

Una valla que nadie vio fallar es una suposición con nombre de garantía. Después
de ponerla:

1. En **Firewall → Logs** del proyecto público, filtrar por la regla. Con tráfico
   normal debe salir **cero**: si dispara sin ataque, el límite está muy abajo y
   está estorbando a pasajeros reales.
2. Provocarla a propósito desde una IP propia — sesenta y pico de peticiones
   seguidas al mismo circuito— y **ver el desafío en el log**. Si no aparece, la
   regla está mal apuntada: casi siempre es la ruta, que en este proyecto **no**
   lleva el prefijo del dominio.
3. Comprobar que el caché sigue haciendo su parte: dos peticiones seguidas al
   mismo circuito deben traer `age:` creciente y el mismo `generado_en`. Si
   `generado_en` cambia en cada llamada, el CDN no está guardando nada y el
   límite se va a disparar con uso normal.

---

## Qué NO resuelve esto

- **No sustituye al filtro del servidor.** Publicación, horario y asignación se
  resuelven en el endpoint. El firewall limita cuántas veces preguntas, no qué
  te contestan.
- **No protege contra un raspado lento y distribuido.** Si eso llega a pasar, la
  respuesta es la del camino descartado —un contador de verdad— y esta decisión
  se reabre con datos.

---

## Cuándo se reabre

Cuando exista tráfico real medido, o cuando el firewall dispare contra pasajeros
en vez de contra guiones. Lo que ahí se compara ya no es «qué es más barato» sino
«qué está pasando», que es la única forma honesta de elegir entre estas dos.
