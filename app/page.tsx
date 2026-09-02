"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { navigation, primaryNavigation, SectionId, type PrimaryNavigationItem } from "./khora-data";
import { emptyOperationalData, getOperationalOverview, groupSearchResults, searchKhora, type GlobalSearchResult, type NavigationIntent, type OperationalData } from "./khora-operations";
import { SectionContent } from "./khora-sections";
import { KhoraIcon, moduleIcons, type KhoraIconName } from "./khora-icons";
import { KhoraLogo } from "./khora-logo";
import { Button } from "./khora-button";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const descriptions: Partial<Record<SectionId, string>> = {
  inicio: "Así está el negocio hoy.", pedidos: "Gestioná pedidos de KHORA Tienda, pagos, entregas y vencimientos.", ventas: "Registrá cobros y seguí cada venta sin perder el stock.", clientes: "Conocé a tus clientes y detectá a quién volver a contactar.", productos: "Precios, costos, recetas y combos en un solo lugar.", fabricacion: "Planificá lotes y consumí materias primas automáticamente.", stock: "Controlá productos terminados y materias primas en tiempo real.", compras: "Registrá abastecimiento, comprobantes y pagos a proveedores.", proveedores: "Contactos, insumos y evolución de precios de cada proveedor.", finanzas: "Entendé cuánto vende y cuánto gana realmente el negocio.", calendario: "Organizá fabricación, compras y cobros del negocio.",
};

const quickActions: Array<{ label: string; section: SectionId; kind: string; icon: KhoraIconName }> = [
  { label: "Nueva venta", section: "ventas", kind: "venta", icon: moduleIcons.ventas }, { label: "Fabricar producto", section: "fabricacion", kind: "fabricación", icon: moduleIcons.fabricacion }, { label: "Nueva compra", section: "compras", kind: "compra", icon: moduleIcons.compras }, { label: "Nuevo gasto", section: "finanzas", kind: "gasto", icon: moduleIcons.finanzas }, { label: "Nuevo cliente", section: "clientes", kind: "cliente", icon: moduleIcons.clientes }, { label: "Nuevo proveedor", section: "proveedores", kind: "proveedor", icon: moduleIcons.proveedores },
];

export default function Home() {
  const [section, setSection] = useState<SectionId>("inicio");
  const [mobileNav, setMobileNav] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePanel, setProfilePanel] = useState<"settings" | "profile" | null>(null);
  const [userEmail, setUserEmail] = useState("paulazarlenga@gmail.com");
  const [globalQuery, setGlobalQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState<"contactos" | "produccion" | null>(null);
  const [createKind, setCreateKind] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [recordRevision, setRecordRevision] = useState(0);
  const [operationalData, setOperationalData] = useState<OperationalData>(emptyOperationalData);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [orderAttention, setOrderAttention] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const primaryNavRef = useRef<HTMLElement>(null);
  const current = useMemo(() => navigation.find((item) => item.id === section) ?? navigation[0], [section]);
  const searchResults = useMemo(() => searchKhora(globalQuery, operationalData), [globalQuery, operationalData]);
  const operationalOverview = useMemo(() => getOperationalOverview(operationalData), [operationalData]);
  const operationalAlerts = operationalOverview.alerts.filter((alert) => alert.dismissible === false || !dismissedAlertIds.includes(alert.id));
  const stockAlertSummary = operationalOverview.stockAlerts.summary;
  const stockSeverity = stockAlertSummary.severity;
  const stockAlertLocations = ([
    ["Productos terminados", operationalOverview.stockAlerts.products],
    ["Materias primas", operationalOverview.stockAlerts.materials],
    ["Mezclas", operationalOverview.stockAlerts.mixtures],
  ] as const).filter(([, summary]) => summary.problemCount > 0);
  const stockAlertDescription = stockAlertLocations.length ? stockAlertLocations.map(([label, summary]) => `${label}: ${summary.problemCount}`).join(" · ") : "Sin alertas de stock";
  const productionAttention = stockSeverity !== "normal" || operationalOverview.agenda.some((item) => item.id === "manufacture" && item.count > 0);
  useEffect(() => {
    let active = true;
    fetch("/api/khora?entity=orders").then((response) => response.ok ? response.json() as Promise<{ rows?: Array<Record<string, unknown>> }> : Promise.reject(new Error())).then((data) => { if (active) setOrderAttention((data.rows ?? []).filter((row) => ["PENDING_PAYMENT", "PAID", "PENDING_DELIVERY"].includes(String(row.store_status ?? "").toUpperCase()) || (!row.store_status && !["CANCELLED", "DELIVERED"].includes(String(row.status ?? "").toUpperCase()))).length); }).catch(() => { if (active) setOrderAttention(0); });
    return () => { active = false; };
  }, [recordRevision]);

  useEffect(() => {
    let active = true;
    const entities = ["clients", "products", "materials", "manufacturing", "suppliers", "purchases", "mixtures"] as const;
    Promise.all(entities.map(async (entity) => {
      const response = await fetch(`/api/khora?entity=${entity}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as { rows?: Array<Record<string, unknown>> };
      return data.rows ?? [];
    })).then(([clients, products, materials, batches, suppliers, purchases, mixtures]) => {
      if (active) setOperationalData({ clients, products, materials, batches, suppliers, purchases, mixtures });
    }).catch(() => { if (active) setOperationalData(emptyOperationalData); });
    return () => { active = false; };
  }, [recordRevision]);

  useEffect(() => {
    const refreshOperationalData = () => setRecordRevision((value) => value + 1);
    window.addEventListener("khora:data-changed", refreshOperationalData);
    return () => window.removeEventListener("khora:data-changed", refreshOperationalData);
  }, []);

  useEffect(() => { let active = true; fetch("/api/khora?entity=dismissed_alerts").then((response) => response.json()).then((data: { ids?: string[] }) => { if (active) setDismissedAlertIds(Array.isArray(data.ids) ? data.ids : []); }).catch(() => undefined); return () => { active = false; }; }, []);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); searchInput.current?.focus(); }
      if (event.key === "Escape") { setSearchOpen(false); setQuickOpen(false); setAlertsOpen(false); setOpenNavGroup(null); }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => { let active = true; createSupabaseClient().auth.getUser().then(({ data }) => { if (active && data.user?.email) setUserEmail(data.user.email); }).catch(() => undefined); return () => { active = false; }; }, []);

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
  async function dismissAlert(id: string) { const next = Array.from(new Set([...dismissedAlertIds, id])); setDismissedAlertIds(next); try { const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_setting", key: "dismissed_operational_alerts", value: next }) }); if (!response.ok) throw new Error(); } catch { setDismissedAlertIds(dismissedAlertIds); setNotice("No pudimos ocultar la alerta. Intentá nuevamente."); } }
  async function saveCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), normalized = (createKind ?? "").toLowerCase();
    if (normalized.includes("cliente") || normalized.includes("proveedor")) {
      try {
        const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_contact", kind: normalized.includes("proveedor") ? "supplier" : "client", name: form.get("name"), phone: form.get("phone"), email: form.get("email"), address: form.get("address"), priceListId: normalized.includes("cliente") && form.get("priceListId") ? Number(form.get("priceListId")) : undefined }) });
        const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "No se pudo guardar el contacto");
        setCreateKind(null); setRecordRevision((value) => value + 1); setNotice(normalized.includes("proveedor") ? "Proveedor guardado correctamente." : "Cliente guardado correctamente.");
      } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se pudo guardar el contacto"); }
    } else if (normalized.includes("gasto")) {
      try {
        const response = await fetch("/api/khora", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_expense", concept: form.get("concept"), supplierId: form.get("supplierId") ? Number(form.get("supplierId")) : undefined, date: form.get("date"), quantity: Number(form.get("quantity")), amountCents: Math.round(Number(form.get("amountPesos")) * 100), paymentStatus: form.get("paymentStatus"), invoiceNumber: form.get("invoiceNumber"), notes: form.get("notes") }) });
        const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "No se pudo guardar el gasto");
        setCreateKind(null); setRecordRevision((value) => value + 1); setNotice("Gasto guardado correctamente.");
      } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se pudo guardar el gasto"); }
    } else {
      setNotice("Este formulario se completará en su módulo operativo correspondiente.");
    }
    window.setTimeout(() => setNotice(""), 4200);
  }
  async function signOut() { await createSupabaseClient().auth.signOut(); window.location.assign("/login"); }

  return <div className="app-shell">
    <header className="desktop-navbar">
      <button className="navbar-brand" onClick={() => goTo("inicio")} aria-label="Ir al inicio de KHORA"><KhoraLogo variant="horizontal" size="lg" theme="white" decorative /></button>
      <nav ref={primaryNavRef} className="horizontal-nav" aria-label="Navegación principal">{primaryNavigation.map((item) => { const active = isPrimaryActive(item); if (item.type === "link") return <button key={item.id} className={active ? "active" : ""} onClick={() => goTo(item.id)} title={item.label}><i aria-hidden="true"><KhoraIcon name={item.icon} /></i><span>{item.label}</span>{item.id === "pedidos" && orderAttention > 0 && <b className="nav-alert warning" title={`${orderAttention} pedidos activos`} aria-label={`${orderAttention} pedidos activos`}>{orderAttention}</b>}</button>; const expanded = openNavGroup === item.id; return <div className={`top-nav-group ${active ? "has-active" : ""}`} key={item.id}><button className={active ? "active" : ""} onClick={() => setOpenNavGroup((current) => current === item.id ? null : item.id)} aria-haspopup="menu" aria-expanded={expanded} title={item.label}><i aria-hidden="true"><KhoraIcon name={item.icon} /></i><span>{item.label}</span><i className="nav-chevron" aria-hidden="true"><KhoraIcon name="chevron-down" /></i>{item.id === "produccion" && productionAttention && <b className={`nav-alert ${stockSeverity}`} title={stockAlertDescription} aria-label={`Stock ${stockSeverity === "out" ? "sin stock" : "con poco stock"}: ${stockAlertDescription}`}>!</b>}</button>{expanded && <div className="top-nav-menu" role="menu" aria-label={item.label}>{item.children.map((child) => <button key={child.id} role="menuitem" className={section === child.id ? "selected" : ""} onClick={() => goTo(child.id)}><KhoraIcon name={child.icon} /><span>{child.label}</span>{child.id === "stock" && stockSeverity !== "normal" && <b className={`nav-alert ${stockSeverity}`} title={stockAlertDescription} aria-label={`Stock ${stockSeverity === "out" ? "sin stock" : "con poco stock"}: ${stockAlertDescription}`}>!</b>}</button>)}</div>}</div>; })}</nav>
      <div className="navbar-user"><div className="profile-wrap"><button className="navbar-profile" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}><span className="avatar">PZ</span><span><strong>Paula</strong><small>Administradora</small></span><i><KhoraIcon name="chevron-down" /></i></button>{profileOpen && <div className="profile-menu"><button onClick={() => { setProfileOpen(false); setProfilePanel("settings"); }}><KhoraIcon name={moduleIcons.configuracion} /> Configuración</button><button onClick={() => { setProfileOpen(false); setProfilePanel("profile"); }}><KhoraIcon name="users" /> Mi perfil</button><button onClick={signOut}>Cerrar sesión</button></div>}</div></div>
    </header>
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`} aria-label="Navegación principal">
      <div className="brand-block"><KhoraLogo variant="horizontal" size="md" theme="white" decorative className="sidebar-logo sidebar-logo--tablet" /><KhoraLogo variant="icon" size="md" theme="white" decorative className="sidebar-logo sidebar-logo--mobile" /><button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú">×</button></div>
      <nav className="side-nav"><span className="nav-caption">GESTIÓN</span>{navigation.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => { setMobileNav(false); goTo(item.id); }}><i aria-hidden="true"><KhoraIcon name={item.icon} /></i><span>{item.label}</span>{item.id === "pedidos" && orderAttention > 0 && <b className="nav-alert warning" title={`${orderAttention} pedidos activos`} aria-label={`${orderAttention} pedidos activos`}>{orderAttention}</b>}{item.id === "stock" && stockSeverity !== "normal" && <b className={`nav-alert ${stockSeverity}`} title={stockAlertDescription} aria-label={`Stock ${stockSeverity === "out" ? "sin stock" : "con poco stock"}: ${stockAlertDescription}`}>!</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">PZ</div><div><strong>Paula</strong><span>Administradora</span></div><button aria-label="Opciones del perfil" onClick={() => { setMobileNav(false); setProfilePanel("profile"); }}>•••</button></div></div>
    </aside>
    {mobileNav && <button className="sidebar-scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menú">☰</button><KhoraLogo variant="horizontal" size="sm" theme="green" decorative className="mobile-topbar-logo mobile-topbar-logo--tablet" /><KhoraLogo variant="icon" size="md" theme="green" decorative className="mobile-topbar-logo mobile-topbar-logo--mobile" /><label className="global-search"><span aria-hidden="true"><KhoraIcon name="search" /></span><input ref={searchInput} role="combobox" aria-autocomplete="list" value={globalQuery} onFocus={() => setSearchOpen(globalQuery.trim().length >= 2)} onChange={(event) => { setGlobalQuery(event.target.value); setSearchOpen(true); setSelectedSearchIndex(0); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setSelectedSearchIndex((value) => Math.min(value + 1, searchResults.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setSelectedSearchIndex((value) => Math.max(value - 1, 0)); } if (event.key === "Enter" && searchResults[selectedSearchIndex]) { event.preventDefault(); openSearchResult(searchResults[selectedSearchIndex]); } }} placeholder="Buscar cliente, producto o lote…" aria-label="Búsqueda global" aria-expanded={searchOpen && globalQuery.trim().length >= 2} aria-controls="global-search-results" autoComplete="off" /><kbd>⌘ K</kbd></label><div className="topbar-actions"><button className="mobile-alert-button" aria-label="Notificaciones" onClick={() => setAlertsOpen((value) => !value)}><KhoraIcon name={moduleIcons.notificaciones} /><b>{operationalAlerts.length}</b></button><div className="quick-wrap"><button className="new-button" onClick={() => setQuickOpen((value) => !value)} aria-expanded={quickOpen} aria-haspopup="menu"><span>＋</span> Nuevo <i><KhoraIcon name="chevron-down" /></i></button>{quickOpen && <div className="quick-menu" role="menu" aria-label="Crear nuevo registro"><p>CREAR NUEVO</p>{quickActions.map((action) => <button role="menuitem" key={action.kind} onClick={() => openCreate(action.kind, action.section)}><i><KhoraIcon name={action.icon} /></i><span>{action.label}</span></button>)}</div>}</div></div></header>
      {searchOpen && globalQuery.trim().length >= 2 && <GlobalSearchPalette query={globalQuery} results={searchResults} selectedIndex={selectedSearchIndex} onSelect={openSearchResult} onClose={() => setSearchOpen(false)} />}
      {alertsOpen && <NotificationCenter alerts={operationalAlerts} onNavigate={(destination) => goTo(destination.section, destination.query)} onDismiss={dismissAlert} onClose={() => setAlertsOpen(false)} />}
      <main className="content"><div className="page-heading"><div><p className="breadcrumb">KHORA <span>/</span> {current.label}</p><h1>{section === "inicio" ? "Buen día, Paula" : current.label}</h1><p>{descriptions[section] ?? descriptions.ventas}</p></div>{!(["inicio", "ventas", "pedidos", "stock", "compras", "productos", "fabricacion", "finanzas", "calendario"] as SectionId[]).includes(section) && <Button className="context-create" variant="primary" size="md" icon={<span>＋</span>} onClick={() => openCreate(section.slice(0, -1) || section)}>{createLabel(section)}</Button>}</div>
        {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
        {activeSearch && <div className="search-notice"><span><KhoraIcon name="search" /></span><div><strong>Mostrando resultados para “{activeSearch}”</strong><p>Filtro aplicado desde la búsqueda global o una acción del centro operativo.</p></div><button onClick={() => setActiveSearch("")}>Limpiar</button></div>}
        <SectionContent key={`${section}-${recordRevision}`} section={section} search={activeSearch} onNavigate={goTo} onCreate={openCreate} />
      </main>
    </div>
    {createKind && <div className="drawer-layer" role="presentation"><button className="drawer-backdrop" onClick={() => setCreateKind(null)} aria-label="Cerrar formulario" /><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className="drawer-header"><div><p>NUEVO REGISTRO</p><h2 id="drawer-title">{drawerTitle(createKind)}</h2></div><button onClick={() => setCreateKind(null)} aria-label="Cerrar">×</button></div><CreateForm kind={createKind} onSubmit={saveCreate} onCancel={() => setCreateKind(null)} /></aside></div>}
    {profilePanel === "settings" && <ProfilePanel kind="settings" email={userEmail} onClose={() => setProfilePanel(null)} />}
    {profilePanel === "profile" && <ProfilePanel kind="profile" email={userEmail} onClose={() => setProfilePanel(null)} />}
  </div>;
}

function ProfilePanel({ kind, email, onClose }: { kind: "settings" | "profile"; email: string; onClose: () => void }) {
  const settings = kind === "settings";
  return <div className="drawer-layer profile-panel-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="Cerrar panel" /><aside className="drawer profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-panel-title"><div className="drawer-header"><div><p>{settings ? "KHORA · CONFIGURACIÓN" : "KHORA · CUENTA"}</p><h2 id="profile-panel-title">{settings ? "Configuración" : "Mi perfil"}</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></div><div className="profile-panel-body">{settings ? <><section><strong>Cuenta conectada</strong><p>{email}</p><small>Tu sesión está protegida por Supabase Auth.</small></section><section><strong>Preferencias operativas</strong><p>Las alertas, movimientos y documentos se calculan con los datos reales del negocio.</p><small>Podés administrar el detalle desde cada módulo sin modificar el historial.</small></section><section><strong>Seguridad</strong><p>RLS y permisos activos</p><small>KHORA mantiene la base protegida para usuarios autorizados.</small></section></> : <><div className="profile-panel-avatar">PZ</div><section><strong>Paula</strong><p>{email}</p><small>Administradora del negocio</small></section><section><strong>Acceso</strong><p>Cuenta activa</p><small>Podés cerrar sesión desde el menú superior.</small></section></>}</div><footer><Button variant="primary" size="md" onClick={onClose}>Listo</Button></footer></aside></div>;
}

function GlobalSearchPalette({ query, results, selectedIndex, onSelect, onClose }: { query: string; results: GlobalSearchResult[]; selectedIndex: number; onSelect: (result: GlobalSearchResult) => void; onClose: () => void }) {
  const groups = groupSearchResults(results);
  return <div className="search-palette-layer"><button className="search-palette-backdrop" onClick={onClose} aria-label="Cerrar búsqueda" /><section className="search-palette" id="global-search-results" role="dialog" aria-modal="true" aria-label="Resultados de búsqueda global"><header><span><KhoraIcon name="search" /></span><div><strong>Resultados para “{query}”</strong><small>{results.length ? `${results.length} coincidencias en KHORA` : "Sin coincidencias"}</small></div><kbd>ESC</kbd></header><div className="search-results" role="listbox">{results.length ? Object.entries(groups).map(([category, items]) => <section key={category}><h2>{category}</h2>{items?.map((result) => { const resultIndex = results.indexOf(result); return <button key={result.id} className={resultIndex === selectedIndex ? "selected" : ""} role="option" aria-selected={resultIndex === selectedIndex} onMouseEnter={() => undefined} onClick={() => onSelect(result)}><i><KhoraIcon name={result.icon} /></i><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><b>↗</b></button>; })}</section>) : <div className="search-empty"><span><KhoraIcon name="search" /></span><strong>No encontramos resultados</strong><p>Probá con un cliente, producto, materia prima, lote, mezcla o proveedor.</p></div>}</div><footer><span>↑↓ Navegar</span><span>↵ Abrir</span><span>Esc Cerrar</span></footer></section></div>;
}

function NotificationCenter({ alerts, onNavigate, onDismiss, onClose }: { alerts: ReturnType<typeof getOperationalOverview>["alerts"]; onNavigate: (destination: NavigationIntent) => void; onDismiss: (id: string) => void; onClose: () => void }) {
  const groups = [
    { id: "critical", label: "Crítico", items: alerts.filter((alert) => alert.priority === "critical") },
    { id: "attention", label: "Atención", items: alerts.filter((alert) => alert.priority === "attention") },
    { id: "information", label: "Información", items: alerts.filter((alert) => alert.priority === "information") },
  ];
  return <div className="notification-layer"><button className="notification-backdrop" onClick={onClose} aria-label="Cerrar alertas" /><aside className="notification-center" role="dialog" aria-modal="true" aria-labelledby="notification-title"><header><div><p>CENTRO DE ALERTAS</p><h2 id="notification-title">Requiere tu atención</h2></div><button onClick={onClose} aria-label="Cerrar">×</button></header><div>{groups.map((group) => group.items.length > 0 && <section key={group.id}><h3><i className={`priority-dot ${group.id}`} />{group.label}<span>{group.items.length}</span></h3>{group.items.map((alert) => <article className="notification-row" key={alert.id}><button className="notification-open" onClick={() => onNavigate(alert.destination)}><i className={`dot ${alert.tone}`} /><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><b>→</b></button>{alert.dismissible !== false && <button className="notification-dismiss" title="Ocultar alerta" aria-label={`Ocultar ${alert.title}`} onClick={() => onDismiss(alert.id)}>×</button>}</article>)}</section>)}{!alerts.length && <div className="notification-empty"><span>✓</span><strong>No hay alertas activas</strong><small>Todo está al día.</small></div>}</div><footer>Las alertas de stock reflejan el estado actual y desaparecen al normalizarse. Las demás alertas se pueden ocultar.</footer></aside></div>;
}

function createLabel(section: SectionId) { const labels: Partial<Record<SectionId, string>> = { ventas: "Nueva venta", clientes: "Nuevo cliente", productos: "Nuevo producto", fabricacion: "Nueva fabricación", stock: "Ajustar stock", compras: "Nueva compra", proveedores: "Nuevo proveedor", finanzas: "Nuevo gasto" }; return labels[section] ?? "Nuevo"; }
function drawerTitle(kind: string) { const value = kind.toLowerCase(); if (value.includes("fabric")) return "Fabricar producto"; if (value.includes("stock")) return "Ajustar stock"; return `Nueva ${value}`.replace("Nueva cliente", "Nuevo cliente").replace("Nueva producto", "Nuevo producto").replace("Nueva proveedor", "Nuevo proveedor"); }

function CreateForm({ kind, onSubmit, onCancel }: { kind: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const k = kind.toLowerCase(), isContact = k.includes("cliente") || k.includes("proveedor"), isMoney = k.includes("venta") || k.includes("compra") || k.includes("gasto"), isStock = k.includes("fabric") || k.includes("stock") || k.includes("producto");
  return <form className="drawer-form" onSubmit={onSubmit}><div className="drawer-body"><div className="form-intro"><span>i</span><p>Completá lo esencial. Podés agregar más detalles después desde la ficha.</p></div>
    {isContact && <><Field name="name" label="Nombre o razón social" placeholder="Ej. María López" /><div className="field-row"><Field name="phone" label="Teléfono / WhatsApp" placeholder="+54 9…" required={false} /><Field name="email" label="Email" type="email" placeholder="nombre@email.com" required={false} /></div><Field name="address" label="Dirección" placeholder="Calle, número, localidad" required={false} />{k.includes("cliente") && <PriceListField />}</>}
    {isMoney && <>{k.includes("gasto") ? <ExpenseCreateFields /> : <><div className="field-row"><Field label={k.includes("compra") ? "Proveedor" : "Cliente"} as="select" options={["Seleccionar…"]} /><Field label="Fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><Field label="Producto o concepto" placeholder="Empezá a escribir para buscar…" /><div className="field-row"><Field label="Cantidad" type="number" defaultValue="1" /><Field label="Importe (ARS)" type="number" placeholder="$ 0" /></div><Field label="Estado de pago" as="select" options={["Pagado", "Pendiente", "Parcial"]} /></>}</>}
    {isStock && <><Field label="Producto o materia prima" as="select" options={["Seleccionar…"]} /><div className="field-row"><Field label="Cantidad" type="number" defaultValue="1" /><Field label="Fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><Field label="Motivo u observación" placeholder="Escribí una referencia clara…" required={false} /></>}
    {!isContact && !isMoney && !isStock && <Field label="Nombre" placeholder="Nombre del registro" />}{!k.includes("gasto") && <label className="field"><span>Notas internas <small>OPCIONAL</small></span><textarea name="notes" rows={4} placeholder="Información útil para recordar…" /></label>}</div><div className="drawer-footer"><Button type="button" variant="neutral" size="md" onClick={onCancel}>Cancelar</Button><Button type="submit" variant="primary" size="md">Guardar</Button></div></form>;
}

function ExpenseCreateFields() {
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);
  useEffect(() => { let active = true; fetch("/api/khora?entity=suppliers").then((response) => response.json() as Promise<{ rows?: Array<Record<string, unknown>> }>).then((data) => { if (active) setSuppliers((data.rows ?? []).filter((row) => Boolean(row.active)).map((row) => ({ id: Number(row.id), name: String(row.name) }))); }).catch(() => undefined); return () => { active = false; }; }, []);
  return <><div className="field-row"><Field name="concept" label="Concepto" placeholder="Ej. Publicidad en Instagram" /><Field name="date" label="Fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><label className="field"><span>Proveedor <small>OPCIONAL</small></span><select name="supplierId"><option value="">Sin proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><div className="field-row"><Field name="quantity" label="Cantidad" type="number" min="0.01" step="0.01" defaultValue="1" /><Field name="amountPesos" label="Importe total (ARS)" type="number" min="0" step="0.01" placeholder="$ 0" /></div><div className="field-row"><label className="field"><span>Estado de pago</span><select name="paymentStatus"><option value="PAID">Pagado</option><option value="UNPAID">Pendiente</option></select></label><Field name="invoiceNumber" label="Comprobante" placeholder="Ej. FC A 0001-1234" required={false} /></div><label className="field"><span>Notas internas <small>OPCIONAL</small></span><textarea name="notes" rows={4} placeholder="Información útil para recordar…" /></label></>;
}

function PriceListField() {
  const [lists, setLists] = useState<Array<{ id: number; code: string; name: string }>>([]);
  useEffect(() => { let active = true; fetch("/api/khora?entity=price_lists").then((response) => response.json() as Promise<{ rows?: Array<Record<string, unknown>> }>).then((data) => { if (active) setLists((data.rows ?? []).filter((row) => row.active).map((row) => ({ id: Number(row.id), code: String(row.code), name: String(row.name) }))); }).catch(() => undefined); return () => { active = false; }; }, []);
  return <label className="field"><span>Lista de precios <small>OPCIONAL</small></span><select name="priceListId"><option value="">Precio estándar (predeterminada)</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.code} · {list.name}</option>)}</select><small>Usá una lista mayorista para aplicar descuentos automáticamente.</small></label>;
}

function Field({ label, as = "input", options = [], required = true, ...props }: { label: string; as?: "input" | "select"; options?: string[]; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="field"><span>{label}{!required && <small>OPCIONAL</small>}</span>{as === "select" ? <select required={required} name={props.name}>{options.map((option) => <option key={option}>{option}</option>)}</select> : <input required={required} {...props} />}</label>; }
