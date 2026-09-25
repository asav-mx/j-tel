import * as THREE from "three";

/**
 * **Ontoy en 3D** — la pieza del hero, traducida del `Ontoy hero 3D.html` del
 * sistema de diseño.
 *
 * Ontoy se construye **con geometría, no con un modelo**: el cuerpo es una
 * esfera deformada a mano —achatada, cuadrada de más y con sus bultos
 * asimétricos—, y encima van los ojos, la boca, las manos flotantes y su
 * celular. No se descarga ningún `.glb`: lo único que pesa aquí es `three`.
 *
 * ## Tres cosas cambian respecto al prototipo, y las tres por la misma razón
 *
 * El prototipo vive dentro de un `<iframe>` y habla con la página por
 * `postMessage`. Aquí **no hay iframe**:
 *
 *  1. El canvas se monta en el contenedor que se le pase, y se mide contra él
 *     —no contra `innerWidth`, que en un iframe era lo mismo y aquí sería la
 *     ventana entera.
 *  2. Los mensajes son llamadas del controlador que esto devuelve.
 *  3. Los escuchas de puntero se enganchan al contenedor, no a la ventana: un
 *     `pointerdown` global haría que Ontoy brincara cada vez que alguien toca
 *     un botón del pie.
 *
 * ## `three` viene de npm y se carga diferido
 *
 * El prototipo lo trae de `unpkg.com` con un `importmap`. En producción eso
 * pondría la portada a depender de un CDN ajeno —la misma falla que este repo
 * ya pagó tres veces con las fuentes de Google, sólo que tumbando la página en
 * vez de la compilación— y le contaría a un tercero que alguien abrió Ontoy.
 *
 * Aquí es una dependencia del paquete, y **este módulo se importa con
 * `import()`**, así que Next lo deja en un fragmento aparte que **sólo se
 * descarga en el nivel alto**, después de que la página ya es usable.
 */

/** Lo que el hero puede pedirle a Ontoy una vez montado. */
export interface Ontoy3D {
  /** Hacia dónde mira, en coordenadas de −1 a 1 sobre el contenedor. `e` es qué tan cerca está el cursor. */
  mirarA(x: number, y: number, e: number): void;
  /** Su ánimo: 1 contento, 0 neutro, −1 triste. Se suaviza solo. */
  animo(v: number): void;
  /** Deja de dibujar cuando no se ve: un canvas fuera de pantalla no tiene por qué gastar batería. */
  visible(v: boolean): void;
  /**
   * Que baile. Es lo que hace al pasar el ratón por encima del botón de abrir
   * la app: Ontoy celebra que vas a entrar.
   */
  baila(v: boolean): void;
  /** Suelta el canvas, la geometría y las texturas. */
  destruir(): void;
}

/** Las acrobacias, con lo que dura cada una. Salen a los seis clicks seguidos. */
const TRUCOS: Array<[string, number]> = [
  ["backflip", 0.95],
  ["mortal lateral", 0.95],
  ["giro", 0.8],
  ["doble backflip", 1.35],
  ["tornillo", 1.15],
  ["rebote de pared", 1.2],
];

const suave = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
const entre = (a: number, b: number, k: number) => a + (b - a) * k;
const entraYSale = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/**
 * Monta a Ontoy dentro de `contenedor` y devuelve con qué hablarle.
 *
 * @param sinSombras el nivel medio lo pide: mismo Ontoy, sin sombras y a 1x.
 * @param quieto     `prefers-reduced-motion`: se queda, pero no se mueve.
 */
export function montarOntoy3D(
  contenedor: HTMLElement,
  { sinSombras = false, quieto = false }: { sinSombras?: boolean; quieto?: boolean } = {},
): Ontoy3D {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(sinSombras ? 1 : Math.min(contenedor.clientWidth < 600 ? 1.5 : 2, devicePixelRatio));
  renderer.shadowMap.enabled = !sinSombras;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  contenedor.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 10);
  camera.position.set(0, 0.035, 0.66);
  camera.lookAt(0, -0.012, 0);

  scene.add(new THREE.HemisphereLight("#ffffff", "#d8cdbd", 1.25));
  const luzPrincipal = new THREE.DirectionalLight("#ffffff", 1.7);
  luzPrincipal.position.set(0.5, 0.9, 0.7);
  luzPrincipal.castShadow = !sinSombras;
  luzPrincipal.shadow.mapSize.set(1024, 1024);
  Object.assign(luzPrincipal.shadow.camera, {
    left: -0.3,
    right: 0.3,
    top: 0.3,
    bottom: -0.3,
    near: 0.1,
    far: 3,
  });
  scene.add(luzPrincipal);
  const relleno = new THREE.DirectionalLight("#fff1e0", 0.5);
  relleno.position.set(-0.7, 0.2, 0.4);
  scene.add(relleno);

  /* El suelo es sólo la sombra: no se dibuja piso, se recibe sombra sobre nada. */
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShadowMaterial({ opacity: 0.16 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -0.116;
  suelo.receiveShadow = true;
  scene.add(suelo);

  /* El naranja es de Ontoy y de nadie más. Los demás son neutros de la paleta. */
  const M = {
    naranja: new THREE.MeshStandardMaterial({ color: "#F6A15B", roughness: 0.55, metalness: 0 }),
    blanco: new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.25, metalness: 0 }),
    carbon: new THREE.MeshStandardMaterial({ color: "#2A2E37", roughness: 0.35, metalness: 0 }),
    /* La boca 3D: contorno carbón delgado, interior rojizo y lengua rosa. */
    boca: new THREE.MeshStandardMaterial({ color: "#7A2E2A", roughness: 0.6, metalness: 0 }),
    lengua: new THREE.MeshStandardMaterial({ color: "#D9666B", roughness: 0.55, metalness: 0 }),
    pantalla: new THREE.MeshStandardMaterial({
      color: "#F6A15B",
      emissive: "#F6A15B",
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0,
    }),
    crema: new THREE.MeshStandardMaterial({
      color: "#EDE9E1",
      emissive: "#EDE9E1",
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0,
    }),
  };

  /*
   * El cuerpo: una esfera deformada a piedra. `sq` la acuadra un poco, `bulto`
   * le pone la asimetría que impide que parezca una cápsula, y el achatado de
   * abajo es lo que la asienta en el suelo.
   */
  const RX = 0.09;
  const RY = 0.102;
  const RZ = 0.074;
  const acuadrar = (a: number) => Math.sign(a) * Math.abs(a) ** 0.82;
  const bulto = (x: number, y: number, z: number) =>
    1 + 0.03 * Math.sin(x * 2.3 + 1.2) * Math.cos(y * 1.9) + 0.02 * Math.sin(z * 2.1 + y * 1.7);
  /** La Z de la superficie del cuerpo en un punto: los ojos y la boca se pegan ahí. */
  const superficieZ = (x: number, y: number) => {
    const k =
      1 - Math.abs(x / RX) ** ((1 / 0.82) * 2) - Math.abs(y / RY) ** ((1 / 0.82) * 2);
    return RZ * Math.max(k, 0) ** 0.41;
  };

  const ontoy = new THREE.Group();
  const cuerpoGrupo = new THREE.Group();
  ontoy.add(cuerpoGrupo);

  const geo = new THREE.SphereGeometry(1, 96, 72);
  const pos = geo.attributes.position;
  const punto = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    punto.fromBufferAttribute(pos, k);
    const l = bulto(punto.x, punto.y, punto.z);
    let x = acuadrar(punto.x) * RX * l;
    let y = acuadrar(punto.y) * RY * l;
    const z = acuadrar(punto.z) * RZ * l;
    if (y < -0.082) y = -0.082 + (y + 0.082) * 0.4;
    x *= 1 - 0.07 * (y / RY);
    pos.setXYZ(k, x, y, z);
  }
  geo.computeVertexNormals();
  const cuerpo = new THREE.Mesh(geo, M.naranja);
  cuerpo.castShadow = !sinSombras;
  cuerpoGrupo.add(cuerpo);

  /* Los pies, flotantes: no tocan el cuerpo, como todos los del universo. */
  for (const x of [-0.038, 0.042]) {
    const pie = new THREE.Mesh(new THREE.SphereGeometry(0.025, 48, 32), M.naranja);
    pie.scale.set(1.2, 0.55, 1.35);
    pie.position.set(x, -0.102, 0.018);
    pie.castShadow = !sinSombras;
    ontoy.add(pie);
  }

  const manoIzq = new THREE.Mesh(new THREE.SphereGeometry(0.02, 40, 28), M.naranja);
  manoIzq.scale.set(0.85, 1, 0.9);
  manoIzq.position.set(0.118, -0.02, 0.02);
  manoIzq.castShadow = !sinSombras;
  ontoy.add(manoIzq);

  /* El celular, con la cara de Ontoy en la pantalla: la app dentro de la app. */
  const cel = new THREE.Group();
  const celCuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.066, 0.006), M.carbon);
  const celPantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.031, 0.058), M.pantalla);
  celPantalla.position.z = 0.0031;
  const celApp = new THREE.Mesh(new THREE.CircleGeometry(0.009, 32), M.crema);
  celApp.position.set(0, 0.004, 0.0033);
  celApp.scale.set(1, 1.1, 1);
  cel.add(celCuerpo, celPantalla, celApp);
  for (const x of [-0.0035, 0.0035]) {
    const ojito = new THREE.Mesh(new THREE.CircleGeometry(0.002, 20), M.carbon);
    ojito.position.set(x, 0.006, 0.0035);
    cel.add(ojito);
  }
  const manoDer = new THREE.Mesh(new THREE.SphereGeometry(0.02, 40, 28), M.naranja);
  manoDer.scale.set(1, 0.85, 0.9);
  manoDer.position.set(0.004, -0.026, -0.008);
  manoDer.castShadow = !sinSombras;
  cel.add(manoDer);
  cel.position.set(-0.07, -0.02, 0.105);
  cel.lookAt(0, 0.045, 0.02);
  cel.rotateZ(0.12);
  ontoy.add(cel);

  /*
   * La cara va en piezas sueltas —cada ojo su grupo, cada boca la suya— para
   * que las reacciones que falten reusen el mismo cuerpo en vez de dibujar
   * otro Ontoy.
   */
  const ojos: Array<{ grupo: THREE.Group; pupila: THREE.Mesh; brillo: THREE.Mesh; r: number }> = [];
  for (const [x, y, r] of [
    [-0.029, 0.035, 0.029],
    [0.031, 0.039, 0.029],
  ]) {
    const grupo = new THREE.Group();
    grupo.position.set(x, y, superficieZ(x, y) - 0.008);
    const blanco = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), M.blanco);
    blanco.scale.set(1, 1, 0.62);
    const pupila = new THREE.Mesh(new THREE.SphereGeometry(r * 0.52, 40, 28), M.carbon);
    pupila.scale.set(1, 1, 0.5);
    const brillo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 20, 14), M.blanco);
    grupo.add(blanco, pupila, brillo);
    cuerpoGrupo.add(grupo);
    ojos.push({ grupo, pupila, brillo, r });
  }

  const BX = 0.004;
  const BY = -0.016;
  const bocaAbierta = new THREE.Group();
  bocaAbierta.position.set(BX, BY, superficieZ(BX, BY) + 0.001);
  const contorno = new THREE.Mesh(new THREE.SphereGeometry(0.016, 40, 28), M.carbon);
  contorno.scale.set(1, 1.25, 0.2);
  const interior = new THREE.Mesh(new THREE.SphereGeometry(0.0142, 40, 28), M.boca);
  interior.scale.set(1, 1.22, 0.22);
  interior.position.z = 0.0012;
  const lengua = new THREE.Mesh(new THREE.SphereGeometry(0.0088, 32, 24), M.lengua);
  lengua.scale.set(1.1, 0.55, 0.3);
  lengua.position.set(0, -0.0095, 0.0032);
  bocaAbierta.add(contorno, interior, lengua);
  cuerpoGrupo.add(bocaAbierta);

  const sonrisa = new THREE.Mesh(
    new THREE.TorusGeometry(0.01, 0.0028, 14, 40, Math.PI),
    M.carbon,
  );
  sonrisa.rotation.z = Math.PI;
  sonrisa.position.set(BX, BY + 0.006, superficieZ(BX, BY) + 0.001);
  cuerpoGrupo.add(sonrisa);
  const sonrisaY = sonrisa.position.y;

  const linea = new THREE.Mesh(new THREE.CapsuleGeometry(0.0028, 0.012, 8, 16), M.carbon);
  linea.rotation.z = Math.PI / 2;
  linea.position.set(BX, BY, superficieZ(BX, BY) + 0.001);
  cuerpoGrupo.add(linea);

  const pivote = new THREE.Group();
  const acrobacias = new THREE.Group();
  acrobacias.add(ontoy);
  pivote.add(acrobacias);
  scene.add(pivote);
  cuerpoGrupo.rotation.z = -0.04;

  /* Se mide contra el CONTENEDOR. En el prototipo era la ventana porque el prototipo era un iframe. */
  const medir = () => {
    const w = contenedor.clientWidth || 1;
    const h = contenedor.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(medir);
  observador.observe(contenedor);
  medir();

  let objetivo = { x: 0.3, y: -0.1, e: 0 };
  const actual = { x: 0.3, y: -0.1, e: 0 };
  const arranque = performance.now();
  let anterior = arranque;
  let fase = 0;
  let ultimoMovimiento = 0;
  let seVe = true;
  let animoPedido = 0;
  let animoSuave = 0;
  let energia = 0;
  let combo = { n: 0, cuando: -9 };
  let ultimoClick = -9;
  const cola: Array<[string, number]> = [];
  let truco: [string, number] | null = null;
  let trucoT = 0;
  let brincoteo = 0;
  let mezclaTruco = 0;
  let camZ = 0.66;
  let camY = 0.035;
  let bailando = 0;
  let bailandoQuiere = 0;

  const alMover = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse") return;
    const r = contenedor.getBoundingClientRect();
    /*
     * **`e` es qué tan cerca está el cursor, de 0 a 1** — y es lo que hace que
     * Ontoy se vaya emocionando conforme te acercas: la boca se le abre más y
     * más, se mueve más rápido y levanta la mano.
     *
     * Estaba puesto a 1 en cuanto el ratón se movía en cualquier parte de la
     * página, así que Ontoy pasaba de dormido a emocionadísimo de golpe y se
     * quedaba ahí. El acercamiento —que es la mitad de su gracia— no existía.
     *
     * Se mide del centro de su caja: pegado vale 1, y se apaga a unos 420 px.
     */
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.45;
    const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
    const cercania = Math.max(0, Math.min(1, 1 - (d - r.width * 0.4) / 420));

    objetivo = {
      x: ((ev.clientX - r.left) / r.width - 0.5) * 2,
      y: ((ev.clientY - r.top) / r.height - 0.45) * 2,
      e: cercania,
    };
    /*
     * Y el ocio sólo se reinicia si el cursor está cerca. Con cualquier
     * movimiento de la página, Ontoy no llegaba a aburrirse nunca — y
     * aburrirse es lo que lo pone a jugar con su celular.
     */
    if (cercania > 0.02) ultimoMovimiento = (performance.now() - arranque) / 1000;
  };

  const alTocar = () => {
    const t = (performance.now() - arranque) / 1000;
    /* Los clicks cuentan como racha si pasan menos de 1.6 s entre uno y otro. */
    combo = { n: t - combo.cuando < 1.6 ? Math.min(combo.n + 1, 60) : 1, cuando: t };
    ultimoClick = t;
    ultimoMovimiento = t;
    energia = Math.min(1, energia + 0.22);
    /* A los seis seguidos empieza a hacer trucos, y no encola más de tres. */
    if (!quieto && combo.n >= 6 && cola.length < 3) {
      cola.push(TRUCOS[(combo.n - 6) % TRUCOS.length]);
    }
  };

  contenedor.addEventListener("pointerdown", alTocar);
  window.addEventListener("pointermove", alMover, { passive: true });

  const partesDelCel = cel.children
    .filter((c) => c !== manoDer)
    .map((m) => [m, m.position.y, m.rotation.x] as const);

  let raf = 0;
  const cuadro = (ahora: number) => {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    const t = (ahora - arranque) / 1000;
    const k = 1 - Math.exp(-dt * 6);
    const ke = 1 - Math.exp(-dt * 3.5);

    /* Sin cursor un rato, se aburre; más rato todavía, se pone a jugar con su cel. */
    const ocio = quieto ? 0 : t - ultimoMovimiento;
    const aburrido = suave((ocio - 5) / 1.5);
    const jugando = suave((ocio - 13) / 1.5);
    const tp = ((((ocio - 13) % 1.7) + 1.7) % 1.7) / 1.7;
    const volada = 4 * tp * (1 - tp) * jugando;

    const gx = entre(entre(objetivo.x, Math.sin(t * 0.7) * 0.8, aburrido), -0.75, jugando);
    const gy = entre(entre(objetivo.y, 1.1, aburrido), 0.25 - volada * 2.6, jugando);

    animoSuave += ((quieto ? 0 : animoPedido) - animoSuave) * (1 - Math.exp(-dt * 1.8));
    const triste = Math.max(0, -animoSuave) * (1 - objetivo.e);
    const feliz = Math.max(0, animoSuave);
    const cerca = Math.max(entre(objetivo.e, 0, aburrido), feliz * 0.45);

    actual.x += (gx - actual.x) * k;
    actual.y += (gy + triste * 0.9 - actual.y) * k;
    actual.e += (cerca - actual.e) * ke;
    const e = actual.e;
    fase += dt * (4 + e * 7);

    /* La energía sube con cada click y baja despacito: nunca se corta de golpe. */
    if (t - ultimoClick > 0.6 && !truco) {
      energia = Math.max(0, energia - dt * (0.22 + energia * 0.2));
    }
    const risa = quieto ? 0 : suave(energia * 1.35);
    const histericoQuiere = !quieto && combo.n >= 5 && t - ultimoClick < 2.2 ? 1 : 0;
    brincoteo += (histericoQuiere - brincoteo) * (1 - Math.exp(-dt * (histericoQuiere ? 5 : 1.6)));

    /* El baile del botón: entra y sale suave, nunca de golpe. */
    bailando += ((quieto ? 0 : bailandoQuiere) - bailando) * (1 - Math.exp(-dt * 4));

    if (!truco && cola.length) {
      truco = cola.shift()!;
      trucoT = 0;
    }

    let jx = 0;
    let jy = 0;
    let rx = 0;
    let ry = 0;
    let rz = 0;
    let aplaste = 1;
    if (truco) {
      trucoT += dt / truco[1];
      const p = Math.min(1, trucoT);
      const E = entraYSale(p);
      const arco = 4 * p * (1 - p);
      const VUELTA = Math.PI * 2;
      switch (truco[0]) {
        case "backflip":
          jy = arco * 0.075;
          rx = -VUELTA * E;
          break;
        case "mortal lateral":
          jy = arco * 0.07;
          rz = VUELTA * E;
          break;
        case "giro":
          jy = arco * 0.055;
          ry = VUELTA * E;
          break;
        case "doble backflip":
          jy = arco * 0.11;
          rx = -2 * VUELTA * E;
          break;
        case "tornillo":
          jy = arco * 0.09;
          rx = -VUELTA * E;
          ry = VUELTA * E;
          break;
        case "rebote de pared": {
          const a = Math.sin(Math.PI * p);
          jx = a * 0.1;
          jy = arco * 0.07;
          rz = -a * 0.7 + (p > 0.5 ? VUELTA * entraYSale((p - 0.5) * 2) : 0);
          break;
        }
      }
      /* Se aplasta al despegar y al caer: sin eso, el salto no pesa. */
      const filo = Math.min(p, 1 - p);
      aplaste = 1 - 0.2 * Math.max(0, 1 - filo / 0.1);
      if (p >= 1) truco = null;
    }
    mezclaTruco += ((truco ? 1 : 0) - mezclaTruco) * (1 - Math.exp(-dt * (truco ? 6 : 2.2)));

    const altoBrinco = Math.abs(Math.sin(t * 17)) * 0.032 * brincoteo * (1 - mezclaTruco);
    /*
     * El baile: un vaivén de lado con su balanceo, más lento que el brinco
     * histérico. Se suma al resto en vez de reemplazarlo, así que bailar
     * mientras se le hace clic no corta nada.
     */
    const vaivenX = Math.sin(t * 5.5) * 0.035 * bailando * (1 - mezclaTruco);
    const vaivenY = Math.abs(Math.sin(t * 11)) * 0.018 * bailando * (1 - mezclaTruco);
    acrobacias.position.set(jx + vaivenX, jy + altoBrinco + vaivenY, 0);
    acrobacias.rotation.set(rx, ry, rz + Math.sin(t * 5.5) * 0.14 * bailando * (1 - mezclaTruco));
    const aplasteBrinco =
      1 - Math.max(0, 0.12 - Math.abs(Math.sin(t * 17)) * 0.12) * brincoteo * (1 - mezclaTruco);
    const S = Math.min(aplaste, aplasteBrinco);
    acrobacias.scale.set(1 + (1 - S) * 0.6, S, 1 + (1 - S) * 0.6);

    /* La cámara se echa para atrás cuando hay truco, para que quepa el salto. */
    camZ = entre(camZ, 0.66 + mezclaTruco * 0.3 + brincoteo * 0.12, 1 - Math.exp(-dt * 3));
    camY = entre(camY, 0.035 + mezclaTruco * 0.035 + brincoteo * 0.02, 1 - Math.exp(-dt * 3));
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, -0.012 + mezclaTruco * 0.03, 0);

    /* Mientras da la vuelta deja de seguir al cursor: no puede mirarte de cabeza. */
    const sigue = 1 - mezclaTruco;
    pivote.rotation.y = Math.max(-0.6, Math.min(0.6, actual.x * 0.55)) * sigue;
    pivote.rotation.x = Math.max(-0.25, Math.min(0.25, actual.y * 0.18)) * sigue;

    const mx = Math.max(-0.45, Math.min(0.45, actual.x * 0.45)) * sigue;
    const my = entre(Math.max(-0.42, Math.min(0.42, -actual.y * 0.42)), 0.35, mezclaTruco);
    for (const { pupila, brillo, r } of ojos) {
      pupila.position.set(mx * r, my * r, r * 0.48);
      brillo.position.set(mx * r + r * 0.18, my * r + r * 0.16, r * 0.66);
    }

    const b = t % 3.6;
    const parpadeo = quieto ? 1 : b > 3.35 ? Math.abs(Math.cos(((b - 3.35) / 0.25) * Math.PI)) : 1;
    const entrecerrado =
      Math.max(risa, brincoteo, aburrido * (1 - jugando) * 0.45, triste * 0.4) *
      (1 - mezclaTruco);
    const abierto = Math.max(0.08, parpadeo * (1 + e * 0.12)) * (1 + mezclaTruco * 0.2);
    for (const o of ojos) {
      o.grupo.scale.y = Math.max(0.1, entre(abierto, 0.14, entrecerrado));
    }

    /*
     * Las bocas, y aquí está la regla del universo: **la versión original va
     * sin boca**; la boca sólo sale en las reacciones. Por eso las tres se
     * esconden a la vez cuando no pasa nada.
     */
    /*
     * **La boca se abre con la cercanía.** `e` va de 0 a 1 según se acerque el
     * cursor, y a partir de 0.35 la boca empieza a abrirse: es el gesto de
     * emocionarse conforme llegas, y era lo que faltaba cuando `e` valía 1
     * siempre.
     */
    const abre = Math.max(risa, brincoteo, mezclaTruco, bailando * 0.7, e > 0.35 ? (e - 0.35) / 0.65 : 0);
    bocaAbierta.visible = abre > 0.04;
    sonrisa.visible = !bocaAbierta.visible && (e > 0.1 || jugando > 0.5 || triste > 0.35);
    sonrisa.rotation.z = triste > 0.35 ? 0 : Math.PI;
    sonrisa.position.y = triste > 0.35 ? sonrisaY - 0.012 : sonrisaY;
    linea.visible = !bocaAbierta.visible && !sonrisa.visible && aburrido > 0.5;
    bocaAbierta.scale.set(
      1 + risa * 0.5 + brincoteo * 0.3,
      (0.35 + abre * 0.95) *
        (1 + (quieto ? 0 : Math.sin(t * 16) * 0.22 * Math.max(risa, brincoteo))),
      1,
    );

    const tembleque = quieto ? 0 : Math.sin(t * 44) * 0.004 * risa * (1 + brincoteo) * (1 - mezclaTruco);
    const respira = quieto
      ? 0
      : (Math.abs(Math.sin(fase)) * 0.004 * e + Math.abs(Math.sin(t * 2.2)) * 0.002) * (1 - risa);
    cuerpoGrupo.position.set(tembleque, respira, 0);
    cuerpoGrupo.rotation.z =
      -0.04 + (quieto ? 0 : Math.sin(t * 14) * 0.06 * brincoteo * (1 - mezclaTruco));

    manoIzq.position.set(
      0.118,
      -0.02 +
        (quieto
          ? 0
          : Math.sin(t * 28) * 0.02 * Math.max(risa, brincoteo) +
            Math.sin(fase) * 0.02 * e * (1 - risa) +
            Math.sin(t * 1.8) * 0.003) +
        e * 0.02 +
        mezclaTruco * 0.05,
      0.02,
    );
    cel.position.y = -0.02 + respira * 0.6 + mezclaTruco * 0.03;
    for (const [m, y0, r0] of partesDelCel) {
      m.position.y = y0 + volada * 0.075;
      m.rotation.x = r0 + (jugando > 0.01 ? tp * Math.PI * 2 * jugando : 0);
    }

    if (seVe) renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(cuadro);

  return {
    mirarA(x, y, e) {
      objetivo = { x, y, e };
      ultimoMovimiento = (performance.now() - arranque) / 1000;
    },
    animo(v) {
      animoPedido = v;
    },
    baila(v) {
      bailandoQuiere = v ? 1 : 0;
      if (v) ultimoMovimiento = (performance.now() - arranque) / 1000;
    },
    visible(v) {
      seVe = v;
    },
    destruir() {
      cancelAnimationFrame(raf);
      observador.disconnect();
      contenedor.removeEventListener("pointerdown", alTocar);
      window.removeEventListener("pointermove", alMover);
      /*
       * La geometría y los materiales viven en la tarjeta de video y NO los
       * recoge el recolector de basura: sin esto, cada montaje dejaría una
       * copia de Ontoy en memoria de GPU.
       */
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
