# Ficha de Diagnóstico — El árbitro sella sobre datos que nadie declaró

**Gobierna:** el `Marco-Limpio-J-Telemetry-MAESTRO.md` y la compuerta de salida de Ola 2 del `PLAN-v1.md`.
**Estado:** hallazgo verificado contra el código y la base. **No se corrigió ni se borró nada.**
**Reemplaza** a la versión anterior de esta ficha, que estaba mal fundada — ver §1.

---

## 1. Corrección: qué decía antes esta ficha, y por qué estaba mal

La versión anterior se llamaba *"La geocerca ciega"* y afirmaba haber medido un modo de falla: una geocerca dibujada demasiado chica que convertía cumplidos en `no_cumplido`. Presentaba como evidencia que las unidades pasaban a 123 m del centro sin entrar nunca.

**Esa lectura era falsa, y la falsedad estaba en el fundamento, no en la aritmética.**

La cuenta que se midió no tiene ni tuvo nunca operación real. Nadie subió un KML, nadie registró perfiles, nadie dibujó esa geocerca. Los 55 servicios, los 135,256 puntos GPS y el polígono de 111 × 189 m **los sembró un script**. Las "unidades que pasaban a 123 m" no son autobuses que llegaron: son coordenadas generadas por una función que nunca tuvo la intención de modelar una llegada.

Entonces la ficha describía la forma de sus propios datos de prueba y la presentaba como un hallazgo sobre el producto. **Una ficha de diagnóstico mal fundada es peor que ninguna: manda a buscar en el lugar equivocado.** Se retira esa lectura y se deja escrita, porque el registro de un error de razonamiento vale más que su borrado.

Lo que sí quedó del episodio es el hallazgo real, y es más grave.

---

## 2. El hallazgo, en una frase

> **El árbitro no distingue una cuenta de demostración de una real.** La marca existe, está puesta, y ninguna línea del motor la lee. Una cuenta sembrada por un script produce veredictos con exactamente la misma forma —y la misma autoridad de sello— que los vinculantes.

---

## 3. De dónde salieron los datos

De `pnpm db:seed` (`packages/db/src/seed.ts`), corrido contra la base de producción.

El script crea la cuenta, la planta, el contrato, las rutas y la geocerca. **El polígono es una constante escrita a mano en el archivo** — cuatro vértices fijos. Ningún humano lo dibujó, y por eso no se le puede atribuir la intención de encerrar un andén.

**Existe un candado que lo impide, y es posterior a los datos.** `seed-guard.ts` exige `SEED_DATABASE_URL` explícita y distinta de `DATABASE_URL`, y se niega a correr contra producción. Se agregó el **2026-07-27**. La cuenta sembrada es del **2026-07-07**: veinte días antes. El candado cierra la puerta hacia adelante; **no retira lo que ya entró.**

---

## 4. Las dos marcas que existen, y por qué ninguna sirvió

| Marca | Dónde vive | Valor en la cuenta sembrada | ¿La lee el motor? |
|---|---|---|---|
| `accounts.isDemo` | booleano en la cuenta | **`true`** — está bien puesta | **No** |
| `serviceContracts.status` | enum `draft · demo · active · suspended` | **`active`** | **No** |

**La primera está puesta y nadie la mira.** `isDemo` se lee en exactamente dos lugares del repositorio, los dos para *listar* cuentas en selectores de interfaz. Ni `packages/services`, ni `packages/verification`, ni `apps/worker` la consultan.

**La segunda podría haber servido, y el propio script la desactivó.** El enum tiene `demo` justo para esto, y la columna nace en `draft` por defecto — pero el seed escribe `status: "active"` en los tres contratos que crea. La fixture se marcó a sí misma como producción.

**Resultado medido: 73 hechos sellados sobre cuentas marcadas como demo**, indistinguibles en forma de los 829 sellados sobre cuentas reales.

---

## 5. Por qué esto es más grave que una geocerca mal dibujada

Una geocerca mal dibujada es un error de configuración: tiene dueño, se corrige, y quien la dibujó puede explicarla.

Esto es otra cosa. **Un veredicto es vinculante porque alguien declaró la operación sobre la que se juzga** — el contrato, la ruta, el trazado, la geocerca, el horario. Cuando el motor sella sobre datos que nadie declaró, produce la forma de un veredicto sin la cadena de declaraciones que lo sostiene: el sello, la política congelada, la razón escrita, el expediente completo. Todo presente, y hueco por dentro.

Y el auditado no tiene cómo distinguirlos. Es §D del Marco llevado al extremo: no es un dato correcto mal presentado — es la maquinaria entera de credibilidad funcionando sobre nada.

---

## 6. Lo que hay que decidir

1. **¿El motor debe negarse a sellar sobre cuentas demo, o sellar marcando el hecho?** Negarse es más limpio; marcar conserva la demo como demostración funcional. Y la demo tiene que poder enseñar veredictos — si no, no demuestra el producto.
2. **Si se marca: ¿dónde vive la marca?** Un hecho sellado hoy no lleva de qué cuenta viene sin recorrer sus relaciones. Y la marca tiene que viajar **dentro del hecho** para sobrevivir a que la cuenta cambie de marca después — el mismo argumento que congela la política, y el que obliga a congelar el nombre del chofer.
3. **¿Qué se hace con los 73 hechos ya sellados?** No se borran sin decidirlo: son el registro de que esto pasó.
4. **¿Quién puede poner una cuenta en `active`?** Hoy lo hizo un script. El enum ya distingue `draft` de `active`; lo que falta es que pasar de uno a otro sea una acción con dueño.

---

## 7. Lo que esta ficha NO afirma

- **No afirma que exista un modo de falla por geocerca chica.** Es plausible en aritmética y **no está evidenciado**: su única evidencia eran datos sembrados. Para sostenerlo habría que medirlo sobre una operación declarada por un humano. Queda como hipótesis, no como hallazgo.
- **No propone borrar los datos sembrados.** Primero hay que decidir §6.3.
- **No acusa al candado del seed de haber fallado.** No existía cuando esto pasó.
