import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alma & Casa | Gestión",
  description: "Stock, ventas y compras del emprendimiento de aromatizadores.",
  openGraph: {
    title: "Alma & Casa | Gestión",
    description: "Stock, ventas y compras en un solo lugar",
    images: [{ url: "/og.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alma & Casa | Gestión",
    description: "Stock, ventas y compras en un solo lugar",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
