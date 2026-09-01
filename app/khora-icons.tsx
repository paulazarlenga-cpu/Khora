import type { SVGProps } from "react";

export type KhoraIconName =
  | "home"
  | "cash"
  | "package"
  | "users"
  | "box"
  | "settings-automation"
  | "building-warehouse"
  | "shopping-cart"
  | "truck-delivery"
  | "chart-line"
  | "calendar"
  | "settings"
  | "bell"
  | "chevron-down"
  | "delivery"
  | "search"
  | "plus"
  | "check"
  | "pencil"
  | "trash"
  | "download"
  | "printer"
  | "arrow-left"
  | "x"
  | "eye"
  | "more-horizontal"
  | "filter"
  | "save"
  | "wallet"
  | "package-check";

export const moduleIcons = {
  inicio: "home",
  ventas: "cash",
  pedidos: "package",
  clientes: "users",
  productos: "box",
  fabricacion: "settings-automation",
  stock: "building-warehouse",
  compras: "shopping-cart",
  proveedores: "truck-delivery",
  finanzas: "chart-line",
  calendario: "calendar",
  configuracion: "settings",
  notificaciones: "bell",
  entregas: "delivery",
} as const satisfies Record<string, KhoraIconName>;

const iconPaths: Record<KhoraIconName, React.ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-6h5v6" /></>,
  cash: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h.01M17 15h.01" /><circle cx="12" cy="12" r="2.5" /></>,
  package: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
  users: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20" /><circle cx="10" cy="7" r="4" /><path d="M18 8a3 3 0 0 1 0 5.8M20 20v-1.5a4.5 4.5 0 0 0-3-4.25" /></>,
  box: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v5" /></>,
  "settings-automation": <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.08A1.7 1.7 0 0 0 8.55 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2.5v-4h.08A1.7 1.7 0 0 0 4.2 8.55a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.55 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2.5h4v.08A1.7 1.7 0 0 0 15 4.2a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.55a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4h.08v4H21a1.7 1.7 0 0 0-1.6 1.05Z" /></>,
  "building-warehouse": <><path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8M7 16h10M9 13v8M15 13v8" /></>,
  "shopping-cart": <><path d="M3 4h2l2.3 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L20.5 8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  "truck-delivery": <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  "chart-line": <><path d="M4 20V5M4 20h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1V21h-4v-.08A1.7 1.7 0 0 0 8.55 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2.5v-4h.08A1.7 1.7 0 0 0 4.2 8.55a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.55 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2.5h4v.08A1.7 1.7 0 0 0 15 4.2a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8.55a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4h.08v4H21a1.7 1.7 0 0 0-1.6 1.05Z" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  delivery: <><path d="M4 7h10v10H4z" /><path d="M14 10h3l3 3v4h-6z" /><circle cx="8" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M6 4h6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  pencil: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m14.5 7.5 2 2" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="m6 7 1 13h10l1-13M9 7V4h6v3" /></>,
  download: <><path d="M12 4v11M8 11l4 4 4-4" /><path d="M5 20h14" /></>,
  printer: <><path d="M6 9V4h12v5M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v6H6z" /></>,
  "arrow-left": <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  "more-horizontal": <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  save: <><path d="M5 4h12l2 2v14H5z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
  wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path d="M16 13h5" /><circle cx="16" cy="13" r=".5" /></>,
  "package-check": <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /><path d="m8.5 15 2 2 4-4" /></>,
};

type KhoraIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: KhoraIconName;
  size?: number | string;
};

export function KhoraIcon({ name, size = "1em", className = "", ...props }: KhoraIconProps) {
  return <svg
    aria-hidden={props["aria-label"] ? undefined : true}
    className={`khora-icon ${className}`.trim()}
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    {...props}
  >{iconPaths[name]}</svg>;
}
