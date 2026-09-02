import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KHORA | Gestión del emprendimiento",
  description: "Ventas, pedidos, clientes, fabricación, stock y finanzas en un solo lugar.",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", sizes: "32x32", type: "image/svg+xml" },
      { url: "/brand/favicon-16.svg", sizes: "16x16", type: "image/svg+xml" },
    ],
    shortcut: "/brand/favicon.svg",
    apple: [{ url: "/brand/app-icon.svg", sizes: "512x512", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "KHORA | Gestión simple para tu negocio",
    description: "Una forma clara y cálida de manejar todo el emprendimiento.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
