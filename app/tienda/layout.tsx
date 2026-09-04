import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KHORA Tienda | Objetos para habitar despacio",
  description: "Aromas y objetos elegidos para acompañar tu casa y tus rituales cotidianos.",
};

export default function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
