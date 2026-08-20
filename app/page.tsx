"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { navigation, primaryNavigation, SectionId, type PrimaryNavigationItem } from "./khora-data";
import { getOperationalOverview, groupSearchResults, searchKhora, type GlobalSearchResult, type NavigationIntent } from "./khora-operations";
import { SectionContent } from "./khora-sections";
import { KhoraIcon, moduleIcons, type KhoraIconName } from "./khora-icons";

const descriptions: Record<SectionId, string> = {
  inicio: "Así está el negocio hoy.", ventas: "Registrá cobros y seguí cada venta sin perder el stock.", pedidos: "Organizá el trabajo pendiente desde que entra hasta que se entrega.", clientes: "Conocé a tus clientes y detectá a quién volver a contactar.", productos: "Precios, costos, recetas y combos en un solo lugar.", fabricacion: "Planificá lotes y consumí materias primas automáticamente.", stock: "Controlá productos terminados y materias primas en tiempo real.", compras: "Registrá abastecimiento, comprobantes y pagos a proveedores.", proveedores: "Contactos, insumos y evolución de precios de cada proveedor.", finanzas: "Entendé cuánto vende y cuánto gana realmente el negocio.", calendario: "Organizá pedidos, entregas, fabricación, compras y cobros del negocio.",
};

const quickActions: Array<{ label: string; section: SectionId; kind: string; icon: KhoraIconName }> = [
  { label: "Nueva venta", section: "ventas", kind: "venta", icon: moduleIcons.ventas }, { label: "Nuevo pedido", section: "pedidos", kind: "pedido", icon: moduleIcons.pedidos }, { label: "Fabricar producto", section: "fabricacion", kind: "fabricación", icon: moduleIcons.fabricacion }, { label: "Nueva compra", section: "compras", kind: "compra", icon: moduleIcons.compras }, { label: "Nuevo gasto", section: "finanzas", kind: "gasto", icon: moduleIcons.finanzas }, { label: "Nuevo cliente", section: "clientes", kind: "cliente", icon: moduleIcons.clientes }, { label: "Nuevo proveedor", section: "proveedores", kind: "proveedor", icon: moduleIcons.proveedores },
];

export default function Home() {
  const [section, setSection] = useState<SectionId>("inicio");
  const [mobileNav, setMobileNav] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState<"contactos" | "produccion" | null>(null);
  const [createKind, setCreateKind] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const primaryNavRef = useRef<HTMLElement>(null);
  const current = useMemo(() => navigation.find((item) => item.id === section) ?? navigation[0], [section]);
  const searchResults = useMemo(() => searchKhora(globalQuery), [globalQuery]);
  const operationalAlerts = useMemo(() => getOperationalOverview().alerts, []);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); searchInput.current?.focus(); }
      if (event.key === "Escape") { setSearchOpen(false); setQuickOpen(false); setAlertsOpen(false); setOpenNavGroup(null); }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    function closeNavGroup(event: PointerEvent) {
      if (primaryNavRef.current && !primaryNavRef.current.contains(event.target as Node)) setOpenNavGroup(null);
    }
    document.addEventListener("pointerdown", closeNavGroup);
    return () => document.removeEventListener("pointerdown", closeNavGroup);
  }, []);

  useEffect(() => {
    const syncSectionWithPath = () => setSection(window.location.pathname === "/calendario" ? "calendario" : "inicio");
    syncSectionWithPath();
    window.addEventListener("popstate", syncSectionWithPath);
    return () => window.removeEventListener("popstate", syncSectionWithPath);
  }, []);

  function goTo(next: SectionId, query = "") { const targetPath = next === "calendario" ? "/calendario" : "/"; if (window.location.pathname !== targetPath) window.history.pushState({}, "", targetPath); setSection(next); setActiveSearch(query); setGlobalQuery(""); setSearchOpen(false); setMobileNav(false); setQuickOpen(false); setAlertsOpen(false); setOpenNavGroup(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function isPrimaryActive(item: PrimaryNavigationItem) { return item.type === "link" ? section === item.id : item.children.some((child) => child.id === section); }
  function openSearchResult(result: GlobalSearchResult) { goTo(result.destination.section, result.destination.query); }
  function openCreate(kind: string, target = section) { setSection(target); setCreateKind(kind); setQuickOpen(false); }
  function saveDemo(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setCreateKind(null); setNotice("Listo. El registro se guardó en la demostración."); window.setTimeout(() => setNotice(""), 3200); }

  return <div className="app-shell">
    <header className="desktop-navbar">
      <button className="navbar-brand" onClick={() => goTo("inicio")} aria-label="Ir al inicio de KHORA"><span className="brand-mark">K</span><span><strong>KHORA</strong><small>Gestión simple</small></span></button>
      <nav ref={primaryNavRef} className="horizontal-nav" aria-label="Navegación principal">{primaryNavigation.map((item) => { const active = isPrimaryActive(item); if (item.type === "link") return <button key={item.id} className={active ? "active" : ""} onClick={() => goTo(item.id)} title={item.label}><i aria-hidden="true"><KhoraIcon name={item.icon} /></i><span>{item.label}</span>{item.id === "pedidos" && <b className="nav-count">4</b>}</button>; const expanded = openNavGroup === item.id; return <div className={`top-nav-group ${active ? "has-active" : ""}`} key={item.id}><button className={active ? "active" : ""} onClick={() => setOpenNavGroup((current) => current === item.id ? null : item.id)} aria-haspopup="menu" aria-expanded={expanded} title={item.label}><i aria-hidden="true"><KhoraIcon name={item.icon} /></i><span>{item.label}</span><i className="nav-chevron" aria-hidden="true"><KhoraIcon name="chevron-down" /></i>{item.id === "produccion" && <b className="nav-alert">!</b>}</button>{expanded && <div className="top-nav-menu" role="menu" aria-label={item.label}>{item.children.map((child) => <button key={child.id} role="menuitem" className={section === child.id ? "selected" : ""} onClick={() => goTo(child.id)}><KhoraIcon name={child.icon} /><span>{child.label}</span>{child.id === "stock" && <b className="nav-alert">!</b>}</button>)}</div>}</div>; })}</nav>
      <div className="navbar-user"><div className="profile-wrap"><button className="navbar-profile" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}><span className="avatar">PZ</span><span><strong>Paula</strong><small>Administradora</small></span><i><KhoraIcon name="chevron-down" /></i></button>{profileOpen && <div className="profile-menu"><button><KhoraIcon name={moduleIcons.configuracion} /> Configuración</button><button>◌ Mi perfil</button><button disabled>Cerrar sesión</button></div>}</div></div>
    </header>
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`} aria-label="Navegación principal">
      <div className="brand-block"><div className="brand-mark" aria-hidden="true">K</div><div><strong>KHORA</strong><span>Gestión simple</span></div><button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú">×</button></div>
      <nav className="side-nav"><span className="nav-caption">GESTIÓN</span>{navigation.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => goTo(item.id)}><i aria-hidden="true"><KhoraIcon name={item.icon} /></i><span>{item.label}</span>{item.id === "pedidos" && <b className="nav-count">4</b>}{item.id === "stock" && <b className="nav-alert">!</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">PZ</div><div><strong>Paula</strong><span>Administradora</span></div><button aria-label="Opciones del perfil">•••</button></div></div>
    </aside>
    {mobileNav && <button className="sidebar-scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menú">☰</button><label className="global-search"><span aria-hidden="true"><KhoraIcon name="search" /></span><input ref={searchInput} role="combobox" aria-autocomplete="list" value={globalQuery} onFocus={() => setSearchOpen(globalQuery.trim().length >= 2)} onChange={(event) => { setGlobalQuery(event.target.value); setSearchOpen(true); setSelectedSearchIndex(0); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setSelectedSearchIndex((value) => Math.min(value + 1, searchResults.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setSelectedSearchIndex((value) => Math.max(value - 1, 0)); } if (event.key === "Enter" && searchResults[selectedSearchIndex]) { event.preventDefault(); openSearchResult(searchResults[selectedSearchIndex]); } }} placeholder="Buscar cliente, pedido, producto o lote…" aria-label="Búsqueda global" aria-expanded={searchOpen && globalQuery.trim().length >= 2} aria-controls="global-search-results" autoComplete="off" /><kbd>⌘ K</kbd></label><div className="topbar-actions"><button className="mobile-alert-button" aria-label="Notificaciones" onClick={() => setAlertsOpen((value) => !value)}><KhoraIcon name={moduleIcons.notificaciones} /><b>{operationalAlerts.length}</b></button><div className="quick-wrap"><button className="new-button" onClick={() => setQuickOpen((value) => !value)} aria-expanded={quickOpen} aria-haspopup="menu"><span>＋</span> Nuevo <i><KhoraIcon name="chevron-down" /></i></button>{quickOpen && <div className="quick-menu" role="menu" aria-label="Crear nuevo registro"><p>CREAR NUEVO</p>{quickActions.map((action) => <button role="menuitem" key={action.kind} onClick={() => openCreate(action.kind, action.section)}><i><KhoraIcon name={action.icon} /></i><span>{action.label}</span></button>)}</div>}</div></div></header>
      {searchOpen && globalQuery.trim().length >= 2 && <GlobalSearchPalette query={globalQuery} results={searchResults} selectedIndex={selectedSearchIndex} onSelect={openSearchResult} onClose={() => setSearchOpen(false)} />}
      {alertsOpen && <NotificationCenter alerts={operationalAlerts} onNavigate={(destination) => goTo(destination.section, destination.query)} onClose={() => setAlertsOpen(false)} />}
      <main className="content"><div className="page-heading"><div><p className="breadcrumb">KHORA <span>/</span> {current.label}</p><h1>{section === "inicio" ? "Buen día, Paula" : current.label}</h1><p>{descriptions[section]}</p></div>{!(["inicio", "ventas", "stock", "compras", "productos", "fabricacion", "finanzas", "calendario"] as SectionId[]).includes(section) && <button className="context-create" onClick={() => openCreate(section.slice(0, -1) || section)}><span>＋</span> {createLabel(section)}</button>}</div>
        {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
        {activeSearch && <div className="search-notice"><span><KhoraIcon name="search" /></span><div><strong>Mostrando resultados para “{activeSearch}”</strong><p>Filtro aplicado desde la búsqueda global o una acción del centro operativo.</p></div><button onClick={() => setActiveSearch("")}>Limpiar</button></div>}
        <SectionContent section={section} search={activeSearch} onNavigate={goTo} onCreate={openCreate} />
      </main>
    </div>
    {createKind && <div className="drawer-layer" role="presentation"><button className="drawer-backdrop" onClick={() => setCreateKind(null)} aria-label="Cerrar formulario" /><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className="drawer-header"><div><p>NUEVO REGISTRO</p><h2 id="drawer-title">{drawerTitle(createKind)}</h2></div><button onClick={() => setCreateKind(null)} aria-label="Cerrar">×</button></div><CreateForm kind={createKind} onSubmit={saveDemo} onCancel={() => setCreateKind(null)} /></aside></div>}
  </div>;
}

function GlobalSearchPalette({ query, results, selectedIndex, onSelect, onClose }: { query: string; results: GlobalSearchResult[]; selectedIndex: number; onSelect: (result: GlobalSearchResult) => void; onClose: () => void }) {
  const groups = groupSearchResults(results);
  return <div className="search-palette-layer"><button className="search-palette-backdrop" onClick={onClose} aria-label="Cerrar búsqueda" /><section className="search-palette" id="global-search-results" role="dialog" aria-modal="true" aria-label="Resultados de búsqueda global"><header><span><KhoraIcon name="search" /></span><div><strong>Resultados para “{query}”</strong><small>{results.length ? `${results.length} coincidencias en KHORA` : "Sin coincidencias"}</small></div><kbd>ESC</kbd></header><div className="search-results" role="listbox">{results.length ? Object.entries(groups).map(([category, items]) => <section key={category}><h2>{category}</h2>{items?.map((result) => { const resultIndex = results.indexOf(result); return <button key={result.id} className={resultIndex === selectedIndex ? "selected" : ""} role="option" aria-selected={resultIndex === selectedIndex} onMouseEnter={() => undefined} onClick={() => onSelect(result)}><i><KhoraIcon name={result.icon} /></i><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><b>↗</b></button>; })}</section>) : <div className="search-empty"><span><KhoraIcon name="search" /></span><strong>No encontramos resultados</strong><p>Probá con un número de pedido, cliente, producto, materia prima, lote o proveedor.</p></div>}</div><footer><span>↑↓ Navegar</span><span>↵ Abrir</span><span>Esc Cerrar</span></footer></section></div>;
}

function NotificationCenter({ alerts, onNavigate, onClose }: { alerts: ReturnType<typeof getOperationalOverview>["alerts"]; onNavigate: (destination: NavigationIntent) => void; onClose: () => void }) {
  const groups = [
    { id: "critical", label: "Crítico", items: alerts.filter((alert) => alert.priority === "critical") },
    { id: "attention", label: "Atención", items: alerts.filter((alert) => alert.priority === "attention") },
    { id: "information", label: "Información", items: alerts.filter((alert) => alert.priority === "information") },
  ];
  return <div className="notification-layer"><button className="notification-backdrop" onClick={onClose} aria-label="Cerrar alertas" /><aside className="notification-center" role="dialog" aria-modal="true" aria-labelledby="notification-title"><header><div><p>CENTRO DE ALERTAS</p><h2 id="notification-title">Requiere tu atención</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div>{groups.map((group) => group.items.length > 0 && <section key={group.id}><h3><i className={`priority-dot ${group.id}`} />{group.label}<span>{group.items.length}</span></h3>{group.items.map((alert) => <button className="notification-row" key={alert.id} onClick={() => onNavigate(alert.destination)}><i className={`dot ${alert.tone}`} /><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><b>→</b></button>)}</section>)}</div><footer>Las alertas se calculan con los datos actuales y no se duplican.</footer></aside></div>;
}

function createLabel(section: SectionId) { const labels: Partial<Record<SectionId, string>> = { ventas: "Nueva venta", pedidos: "Nuevo pedido", clientes: "Nuevo cliente", productos: "Nuevo producto", fabricacion: "Nueva fabricación", stock: "Ajustar stock", compras: "Nueva compra", proveedores: "Nuevo proveedor", finanzas: "Nuevo gasto" }; return labels[section] ?? "Nuevo"; }
function drawerTitle(kind: string) { const value = kind.toLowerCase(); if (value.includes("fabric")) return "Fabricar producto"; if (value.includes("stock")) return "Ajustar stock"; return `Nueva ${value}`.replace("Nueva cliente", "Nuevo cliente").replace("Nueva pedido", "Nuevo pedido").replace("Nueva producto", "Nuevo producto").replace("Nueva proveedor", "Nuevo proveedor"); }

function CreateForm({ kind, onSubmit, onCancel }: { kind: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const k = kind.toLowerCase(), isContact = k.includes("cliente") || k.includes("proveedor"), isMoney = k.includes("venta") || k.includes("compra") || k.includes("gasto") || k.includes("pedido"), isStock = k.includes("fabric") || k.includes("stock") || k.includes("producto");
  return <form className="drawer-form" onSubmit={onSubmit}><div className="drawer-body"><div className="form-intro"><span>i</span><p>Completá lo esencial. Podés agregar más detalles después desde la ficha.</p></div>
    {isContact && <><Field label="Nombre o razón social" placeholder="Ej. María López" /><div className="field-row"><Field label="Teléfono / WhatsApp" placeholder="+54 9…" /><Field label="Email" type="email" placeholder="nombre@email.com" /></div><Field label="Dirección" placeholder="Calle, número, localidad" required={false} /></>}
    {isMoney && <>{k.includes("gasto") ? <Field label="Fecha" type="date" defaultValue="2026-08-13" /> : <div className="field-row"><Field label={k.includes("compra") ? "Proveedor" : "Cliente"} as="select" options={["Seleccionar…", "Mariana López", "Estudio Nativa", "Casa Calma"]} /><Field label="Fecha" type="date" defaultValue="2026-08-13" /></div>}<Field label={k.includes("gasto") ? "Descripción" : "Producto o concepto"} placeholder="Empezá a escribir para buscar…" /><div className="field-row"><Field label="Cantidad" type="number" defaultValue="1" /><Field label="Importe (ARS)" type="number" placeholder="$ 0" /></div><Field label="Estado de pago" as="select" options={["Pagado", "Pendiente", "Parcial"]} /></>}
    {isStock && <><Field label="Producto o materia prima" as="select" options={["Seleccionar…", "Difusor Lavanda 250 ml", "Home Spray Jazmín", "Alcohol de cereal", "Esencia Lavanda"]} /><div className="field-row"><Field label="Cantidad" type="number" defaultValue="1" /><Field label="Fecha" type="date" defaultValue="2026-08-13" /></div><Field label="Motivo u observación" placeholder="Escribí una referencia clara…" required={false} /></>}
    {!isContact && !isMoney && !isStock && <Field label="Nombre" placeholder="Nombre del registro" />}<label className="field"><span>Notas internas <small>OPCIONAL</small></span><textarea rows={4} placeholder="Información útil para recordar…" /></label></div><div className="drawer-footer"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button">Guardar</button></div></form>;
}

function Field({ label, as = "input", options = [], required = true, ...props }: { label: string; as?: "input" | "select"; options?: string[]; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="field"><span>{label}{!required && <small>OPCIONAL</small>}</span>{as === "select" ? <select required={required}>{options.map((option) => <option key={option}>{option}</option>)}</select> : <input required={required} {...props} />}</label>; }
