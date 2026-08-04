import { EscenaCiudad } from "./escena-ciudad";
import estilos from "./landing.module.css";

/**
 * Landing público de j-telemetry.com.
 *
 * Excepción declarada del lenguaje de producto: aquí no se muestra un solo
 * dato real ni un resultado sellado, así que no hay confidencialidad que
 * cuidar ni veredicto que respetar. Lo que sí se conserva es la identidad, y
 * una promesa que el producto tiene que poder cumplir: tres resultados y nunca
 * un cuarto.
 *
 * Estático a propósito — no toca base de datos ni cuenta.
 */
export default function LandingPage() {
  return (
    // landing-raiz es el gancho de landing-global.css, no un estilo en sí.
    <div className={`landing-raiz ${estilos.pagina}`}>
      <nav className={estilos.nav}>
        <div className={estilos.navIn}>
          <span className={estilos.logo}>
            J<span>·</span>Telemetry
          </span>
          <span className={estilos.navLinks}>
            <a href="#como">Cómo funciona</a>
            <a href="#partes">Para quién</a>
            <a href="#limites">Lo que no hace</a>
            <a className={`${estilos.btn} ${estilos.btnPrim}`} href="#contacto">
              Solicitar demo
            </a>
          </span>
        </div>
      </nav>

      <section className={estilos.hero}>
        <div className={estilos.heroRejilla} />
        <div className={estilos.c}>
          <p className={estilos.kicker}>Arbitraje automático de cumplimiento</p>
          <h1>Toda la operación, verificada. Sin un equipo mirándola.</h1>
          <p className={estilos.lead}>
            J-Telemetry determina si el servicio de transporte contratado se cumplió, cruzando
            la telemetría contra el contrato que ambas partes firmaron.{" "}
            <b>El resultado se sella y deja de discutirse:</b> la planta y el transportista ven
            exactamente el mismo hecho.
          </p>
          <div className={estilos.ctaFila}>
            <a className={`${estilos.btn} ${estilos.btnPrim}`} href="#contacto">
              Solicitar demo
            </a>
            <a className={estilos.btn} href="#como">
              Ver cómo llega a un resultado
            </a>
          </div>
          <div className={estilos.heroLinea}>
            <span className={estilos.hl}>
              <b>3</b>estados posibles, nunca un cuarto
            </span>
            <span className={estilos.hl}>
              <b>0</b>monitoristas mirando pantallas
            </span>
            <span className={estilos.hl}>
              <b>1</b>solo hecho, sellado, para las dos partes
            </span>
          </div>
        </div>
      </section>

      <section className={estilos.dolor}>
        <div className={estilos.c}>
          <h2>Hoy la certeza cuesta sueldos — y aun así no alcanza.</h2>
          <p className={estilos.sm}>
            Verificar un contrato de transporte de personal se hace, casi siempre, con gente
            mirando pantallas todo el turno para producir un reporte que nadie firma. Y cuando
            algo falla, la evidencia es una llamada y la palabra de alguien.
          </p>

          <div className={estilos.dos}>
            <div className={estilos.lado}>
              <p className={estilos.quien}>Del lado de la planta</p>
              <p>
                Pagas por servicios que <b>no puedes verificar</b>. Sabes que hubo retrasos, pero
                no cuántos, ni de qué rutas, ni si se repiten. Cuando llega la factura, tu única
                opción es creerle a alguien.
              </p>
            </div>
            <div className={estilos.lado}>
              <p className={estilos.quien}>Del lado del transportista</p>
              <p>
                Te descuentan por incumplimientos que <b>no puedes rebatir</b>. Tu operación real
                —la unidad que sí salió, el desvío que no era tuyo, la obra que te frenó— no
                aparece en ningún lado con evidencia.
              </p>
            </div>
          </div>

          <p className={estilos.remate}>
            Las dos partes desconfían del mismo dato porque ninguna lo controla. Un árbitro sirve
            exactamente para eso.
          </p>
        </div>
      </section>

      <section id="parvada">
        <div className={estilos.c}>
          <p className={estilos.kicker}>Un turno completo, verificado solo</p>
          <h2>Cincuenta servicios. Tres te necesitan.</h2>
          <p className={estilos.sm}>
            Cada mañana la operación entera se verifica sin que nadie la mire. Lo que cumplió{" "}
            <b>se apaga</b>. Lo que no, <b>se queda encendido</b> hasta que alguien lo atienda.
          </p>

          <div className={estilos.escena}>
            <EscenaCiudad />
            <div className={estilos.vineta} />
            <div className={estilos.marcador}>
              <span className={estilos.mItem}>
                <b className={estilos.mv}>47</b>cumplidos
              </span>
              <span className={estilos.mItem}>
                <b className={estilos.mr}>1</b>no cumplido
              </span>
              <span className={estilos.mItem}>
                <b className={estilos.ma}>2</b>pendientes
              </span>
            </div>
            <div className={estilos.selloP}>
              <div className={estilos.v}>Verificado</div>
              <div className={estilos.s}>Sellado 06:50:00</div>
            </div>
          </div>
          <p className={estilos.pieEscena}>Ninguna ciudad en particular · todas las ciudades</p>
        </div>
      </section>

      <section id="como" className={estilos.borde}>
        <div className={estilos.c}>
          <p className={estilos.kicker}>Cómo llega a un resultado</p>
          <h2>Mide, compara contra el contrato, y sella.</h2>
          <p className={estilos.sm}>
            Sin intervención humana en ninguno de los tres pasos. Lo que un equipo tardaba un
            turno entero en armar, queda listo cuando cierra la ventana.
          </p>

          <div className={estilos.pasos}>
            <div className={estilos.paso}>
              <p className={estilos.n}>01 · MIDE</p>
              <h3>La telemetría, todo el día</h3>
              <p>
                Cada unidad reporta su posición de forma continua —{" "}
                <b>no depende de que alguien avise que salió</b>, ni de una app que el operador
                tenga que acordarse de abrir.
              </p>
            </div>
            <div className={estilos.paso}>
              <p className={estilos.n}>02 · COMPARA</p>
              <h3>Contra lo que se firmó</h3>
              <p>
                El trazado contratado, la ventana del turno, las tolerancias y los motivos
                excusables. <b>Nada de eso vive en el código: vive en el contrato</b>, y cada
                regla puede citar su cláusula.
              </p>
            </div>
            <div className={estilos.paso}>
              <p className={estilos.n}>03 · SELLA</p>
              <h3>Y ya no se mueve</h3>
              <p>
                El resultado se congela junto con la política vigente ese día.{" "}
                <b>Renegociar el contrato mañana no reescribe el pasado</b>, y si algo llega a
                re-verificarse, queda la historia completa.
              </p>
            </div>
          </div>

          <div className={estilos.estados}>
            <span className={`${estilos.est} ${estilos.eVerde}`}>Cumplido</span>
            <span className={`${estilos.est} ${estilos.eRojo}`}>No cumplido</span>
            <span className={`${estilos.est} ${estilos.eAmbar}`}>Pendiente por evidencia</span>
          </div>
          <p className={estilos.sm} style={{ marginTop: 16, fontSize: "14.5px" }}>
            Tres estados, nunca un cuarto. <b>&ldquo;Tarde&rdquo; no es un estado</b> — es un
            motivo bajo cumplido, con su medida exacta al lado.
          </p>
        </div>
      </section>

      <section id="partes" className={estilos.degradado}>
        <div className={estilos.c}>
          <p className={estilos.kicker}>Para quién</p>
          <h2>Un árbitro sirve a las dos partes, o no es árbitro.</h2>
          <p className={estilos.sm}>
            La planta y el transportista entran a la misma plataforma y ven el mismo resultado.
            Lo que cambia es la altura: cada quien ve su propia operación, nunca la del otro.
          </p>

          <div className={estilos.dos}>
            <div className={estilos.lado}>
              <p className={estilos.quien}>La planta obtiene</p>
              <p>
                El cierre de cada turno sin pedirlo · el mes completo en una retícula donde el
                patrón se ve solo · el expediente de cualquier servicio con su evidencia · y
                aviso de lo que se está formando <b>antes</b> de que se vuelva un problema.
              </p>
            </div>
            <div className={estilos.lado}>
              <p className={estilos.quien}>El transportista obtiene</p>
              <p>
                Evidencia propia para defenderse con números y no con llamadas · visibilidad de
                su flota completa, el día entero · el kilómetro que no factura · y un árbitro que{" "}
                <b>no falla a favor de nadie</b>, lo cual también lo protege a él.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="limites" className={estilos.borde}>
        <div className={estilos.c}>
          <p className={estilos.kicker}>Lo que no hace</p>
          <h2>Un árbitro se define tanto por lo que se niega a decir.</h2>
          <p className={estilos.sm}>
            Estas fronteras no son limitaciones pendientes de resolver: son la razón por la que
            el resultado se sostiene frente a las dos partes.
          </p>

          <div className={estilos.noHace}>
            <div className={estilos.nh}>
              <h4>No afirma lo que no midió</h4>
              <p>
                Sin evidencia suficiente no declara una falta. Declara{" "}
                <b>pendiente por evidencia</b>, y lo dice con todas sus letras.
              </p>
            </div>
            <div className={estilos.nh}>
              <h4>No decide si pagas</h4>
              <p>
                Entrega el hecho verificado. La consecuencia la define tu contrato, y aparece
                citando la cláusula que la respalda.
              </p>
            </div>
            <div className={estilos.nh}>
              <h4>No vigila personas</h4>
              <p>
                Identifica unidades, no gente. Y la operación interna del transportista jamás es
                visible para el cliente.
              </p>
            </div>
            <div className={estilos.nh}>
              <h4>No es contabilidad ni nómina</h4>
              <p>
                No factura ni calcula sueldos. Entrega el hecho medido; lo que sigue lo hacen los
                sistemas que ya tienes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={estilos.cierre} id="contacto">
        <div className={estilos.c}>
          <h2>La certeza deja de costar sueldos.</h2>
          <p className={estilos.lead}>
            Cuéntanos cómo opera tu contrato de transporte de personal y te enseñamos cómo se
            vería verificado — con tus rutas, tus turnos y tus tolerancias.
          </p>
          <div className={estilos.ctaFila}>
            <a className={`${estilos.btn} ${estilos.btnPrim}`} href="mailto:hola@j-telemetry.com">
              Solicitar demo
            </a>
            <a className={estilos.btn} href="mailto:hola@j-telemetry.com">
              Hablar con el equipo
            </a>
          </div>
        </div>
      </section>

      <footer className={estilos.pie}>
        <div className={estilos.c}>
          <span>
            J·Telemetry · j-telemetry.com
            <br />
            Arbitraje automático de cumplimiento de transporte de personal
          </span>
          <span>
            Verificado y sellado.
            <br />
            El mismo hecho, para las dos partes.
          </span>
        </div>
      </footer>
    </div>
  );
}
