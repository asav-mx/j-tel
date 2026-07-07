import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JTEL — Verificación de Transporte",
  description: "Plataforma de cumplimiento de transporte de personal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
