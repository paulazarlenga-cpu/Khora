import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KHORA | Gestión del emprendimiento",
  description: "Ventas, pedidos, clientes, fabricación, stock y finanzas en un solo lugar.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "KHORA | Gestión simple para tu negocio",
    description: "Una forma clara y cálida de manejar todo el emprendimiento.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
