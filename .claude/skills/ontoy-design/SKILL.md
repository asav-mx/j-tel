---
name: ontoy-design
description: Use this skill to generate well-branded interfaces and assets for ¿Ontoy? (passenger transit app), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, characters and rules. Úsalo SIEMPRE que el trabajo toque la cara del pasajero de ¿Ontoy? — `apps/publico`, la landing de ontoy.app, el letrero impreso del QR de una parada, los íconos de la app, o cualquier pantalla, componente o pieza que un pasajero vaya a ver. Vale aunque la petición no hable de diseño. NO aplica a J-Staff, planta ni carrier (el árbitro): esa cara es del skill `jtel-diseno` y no lleva caritas.
user-invocable: true
---

**Lee `ENMIENDAS.md` primero: manda sobre este archivo, sobre `CLAUDE.md` y sobre `readme.md`.** Trae lo que Asav cambió después de exportar el skill (el color de ruta, lo que la landing promete, las direcciones de ontoy.app, el nombre de la parada: Páris) y las reglas que este repo ya tiene y que el skill no sabe.

Read the readme.md file within this skill, and CLAUDE.md for the approved rules, then explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.
Always use colors from tokens/colors.css — never invent hex values. Orange is only for Ontoy. Route colors come from data.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
