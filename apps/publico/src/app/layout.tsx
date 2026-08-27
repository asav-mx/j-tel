import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarServicio } from "@/components/registrar-servicio";

/**
 * El cascarón de la app del pasajero.
 *
 * El nombre sale de una variable de entorno y no del código: esta app sirve a
 * cualquier concesionario invitado, y hornear «Juárez Bus» aquí convertiría el
 * alta del siguiente en un despliegue.
 */
const NOMBRE = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";

export const metadata: Metadata = {
  title: NOMBRE,
  description: "Dónde viene tu camión, en vivo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: NOMBRE, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin `maximumScale`: bloquear el zoom en una app que se usa en la calle deja
  // fuera a quien no ve de cerca. La accesibilidad gana al pixel perfect.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1418" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <RegistrarServicio />
      </body>
    </html>
  );
}
