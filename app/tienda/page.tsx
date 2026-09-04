"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./store.module.css";
import { buildStoreOrderWhatsAppMessage, buildWhatsAppLink } from "../khora-whatsapp";

type View = "home" | "product" | "cart" | "details" | "confirmation";
type Product = { id: number; code: string; name: string; description: string; category: string; type: string; priceCents: number; stock: number; availableStock: number; imagePath: string | null; published: boolean };
type CartLine = Product & { quantity: number };
type StoreOrder = { number: string; expiresAt: string; totalCents: number; status: string; paymentStatus: string; customer: { name: string; phone: string; email: string; location: string }; items: Array<{ productId: number; name: string; quantity: number; priceCents: number; lineTotalCents: number }> };

const money = (cents: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(cents / 100);
const formatQuantity = (value: number) => Number.isInteger(value) ? String(value) : value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const productImage = (product: Product) => product.imagePath && /^(https?:|\/)/.test(product.imagePath) ? product.imagePath : null;
const fallbackProductImage = (product: Product) => {
  const key = `${product.code} ${product.name}`.toLowerCase();
  if (key.includes("pro-003") || key.includes("aromatizador")) return "/khora-product-aromatizador.png";
  if (key.includes("pro-001") || key.includes("difusor")) return "/khora-product-difusor.png";
  if (key.includes("com-001") || key.includes("combo")) return "/khora-product-combo.png";
  return null;
};
const friendlyError = (cause: unknown, fallback: string) => {
  const message = cause instanceof Error ? cause.message : "";
  return /^(Solo quedan |Uno de los productos ya no está disponible\.|La reserva venció\.|El precio de uno o más productos se actualizó\.|Ingresá |Revisá las cantidades|No pudimos )/.test(message) ? message : fallback;
};
const readToken = () => { try { return localStorage.getItem("khora-store-token") ?? ""; } catch { return ""; } }; const readExpiresAt = () => { try { return localStorage.getItem("khora-store-expires") ?? ""; } catch { return ""; } }; const readCheckoutKey = () => { try { return localStorage.getItem("khora-store-checkout-key") ?? ""; } catch { return ""; } };
const readCart = (): CartLine[] => { try { const value = JSON.parse(localStorage.getItem("khora-store-cart") ?? "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const viewFromLocation = (): { view: View; productId?: number; orderNumber?: string; orderAccess?: string } => {
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("pedido") ?? undefined;
  const productId = Number(params.get("producto"));
  if (orderNumber) return { view: "confirmation", orderNumber, orderAccess: params.get("acceso") ?? undefined };
  if (params.get("vista") === "carrito") return { view: "cart" };
  if (params.get("vista") === "datos") return { view: "details" };
  if (productId) return { view: "product", productId };
  return { view: "home" };
};

export default function StorePage() {
  const [view, setView] = useState<View>("home");
  const [selectedProductId, setSelectedProductId] = useState<number>();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reservationExpired, setReservationExpired] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{ whatsapp: string; businessName: string }>({ whatsapp: "", businessName: "KHORA" });
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [initialOrderNumber, setInitialOrderNumber] = useState("");
  const [initialOrderAccess, setInitialOrderAccess] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState("");
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", location: "" });
  const [now, setNow] = useState(() => Date.now());

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))], [products]);
  const filteredProducts = useMemo(() => products.filter((product) => (category === "Todas" || product.category === category) && `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query.toLowerCase().trim())), [products, category, query]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? cart.find((product) => product.id === selectedProductId);

  useEffect(() => {
    const initial = viewFromLocation();
    // Hydrate the client-only URL and localStorage state after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(initial.view); setSelectedProductId(initial.productId); setInitialOrderNumber(initial.orderNumber || ""); setInitialOrderAccess(initial.orderAccess || ""); setToken(readToken()); setExpiresAt(readExpiresAt()); setCart(readCart()); setCheckoutKey(readCheckoutKey());
    const onPopState = () => { const next = viewFromLocation(); setView(next.view); setSelectedProductId(next.productId); setInitialOrderNumber(next.orderNumber || ""); setInitialOrderAccess(next.orderAccess || ""); setOrder(null); setWhatsappError(""); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    // Show the loading state whenever the reservation token changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/tienda?entity=products${token ? `&token=${encodeURIComponent(token)}` : ""}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No pudimos cargar la colección. Revisá tu conexión e intentá nuevamente."); return data as { products: Product[]; reservationExpiresAt?: string }; }).then((data) => { if (active) { setProducts(data.products); if (data.reservationExpiresAt) { setExpiresAt(data.reservationExpiresAt); try { localStorage.setItem("khora-store-expires", data.reservationExpiresAt); } catch { /* optional persistence */ } } setError(""); } }).catch((cause) => { if (active) setError(friendlyError(cause, "No pudimos cargar la colección. Revisá tu conexión e intentá nuevamente.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, catalogRefresh]);

  useEffect(() => { fetch("/api/tienda?entity=settings").then((response) => response.json()).then((data) => setSettings({ whatsapp: String(data.whatsapp ?? ""), businessName: String(data.businessName ?? "KHORA") })).catch(() => undefined); }, []);

  useEffect(() => {
    if (view !== "confirmation" || !initialOrderNumber || !initialOrderAccess || order) return;
    let active = true;
    fetch(`/api/tienda?entity=order&number=${encodeURIComponent(initialOrderNumber)}&access=${encodeURIComponent(initialOrderAccess)}`)
      .then(async (response) => { const data = await response.json() as { order?: StoreOrder; settings?: { whatsapp?: string; businessName?: string }; error?: string }; if (!response.ok || !data.order) throw new Error(data.error || "No pudimos encontrar este pedido."); return data; })
      .then((data) => { if (!active) return; setOrder(data.order || null); if (data.settings) setSettings({ whatsapp: String(data.settings.whatsapp || ""), businessName: String(data.settings.businessName || "KHORA") }); setError(""); })
      .catch((cause) => { if (active) { setOrder(null); setError(friendlyError(cause, "No pudimos abrir este pedido. Revisá el enlace de confirmación o volvé a la tienda.")); } });
    return () => { active = false; };
  }, [initialOrderAccess, initialOrderNumber, order, view]);

  useEffect(() => {
    if (!expiresAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReservationExpired(false); return;
    }
    const tick = () => setReservationExpired(new Date(expiresAt).getTime() <= Date.now());
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (view !== "confirmation" || !order?.expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [order?.expiresAt, view]);

  function navigate(nextView: View, productId?: number, orderNumber?: string, orderAccess?: string) {
    const params = new URLSearchParams();
    if (nextView === "product" && productId) params.set("producto", String(productId));
    if (nextView === "cart") params.set("vista", "carrito");
    if (nextView === "details") params.set("vista", "datos");
    if (nextView === "confirmation" && orderNumber) { params.set("pedido", orderNumber); if (orderAccess) params.set("acceso", orderAccess); }
    const suffix = params.toString() ? `?${params}` : "";
    window.history.pushState({}, "", `/tienda${suffix}`);
    setView(nextView); setSelectedProductId(productId); if (nextView === "confirmation") { setInitialOrderNumber(orderNumber || ""); setInitialOrderAccess(orderAccess || ""); } setWhatsappError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveCart(next: CartLine[]) { setCart(next); try { localStorage.setItem("khora-store-cart", JSON.stringify(next)); } catch { /* optional persistence */ } }

  async function syncReservation(nextCart: CartLine[]) {
    if (!nextCart.length) { if (token) await fetch("/api/tienda", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "release", token }) }).catch(() => undefined); saveCart([]); setExpiresAt(""); setReservationExpired(false); try { localStorage.removeItem("khora-store-expires"); localStorage.removeItem("khora-store-token"); } catch { /* optional persistence */ } return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/tienda", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reserve", token, items: nextCart.map((item) => ({ productId: item.id, quantity: item.quantity })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No pudimos reservar estos productos.");
      const nextToken = String(data.token); setToken(nextToken); try { localStorage.setItem("khora-store-token", nextToken); } catch { /* optional persistence */ }
      setExpiresAt(String(data.expiresAt)); try { localStorage.setItem("khora-store-expires", String(data.expiresAt)); } catch { /* optional persistence */ } setReservationExpired(false);
      const updates = new Map<number, { productId: number; priceCents: number; availableStock: number }>((data.items ?? []).map((item: { productId: number; priceCents: number; availableStock: number }) => [Number(item.productId), item] as const));
      saveCart(nextCart.map((item) => ({ ...item, priceCents: Number(updates.get(item.id)?.priceCents ?? item.priceCents), availableStock: Number(updates.get(item.id)?.availableStock ?? item.availableStock) })));
    } catch (cause) { setError(friendlyError(cause, "No pudimos reservar estos productos. Revisá tu conexión e intentá nuevamente.")); throw cause; } finally { setSaving(false); }
  }

  async function addToCart(product: Product, quantity = 1) {
    if (product.availableStock <= 0) return;
    const current = cart.find((item) => item.id === product.id)?.quantity ?? 0;
    const nextQuantity = Math.min(product.availableStock, current + quantity);
    const next = cart.some((item) => item.id === product.id) ? cart.map((item) => item.id === product.id ? { ...item, quantity: nextQuantity } : item) : [...cart, { ...product, quantity: nextQuantity }];
    try { await syncReservation(next); setNotice(`${product.name} quedó reservado en tu carrito.`); } catch { /* message already visible */ }
  }

  async function changeQuantity(item: CartLine, delta: number) {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity <= 0) { await syncReservation(cart.filter((line) => line.id !== item.id)); return; }
    if (nextQuantity > item.availableStock) { setError(`Solo quedan ${formatQuantity(item.availableStock)} unidades disponibles de ${item.name}.`); return; }
    await syncReservation(cart.map((line) => line.id === item.id ? { ...line, quantity: nextQuantity } : line));
  }

  async function continueToDetails() {
    try { await syncReservation(cart); navigate("details"); } catch { /* message already visible */ }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!cart.length) { navigate("cart"); return; }
    setSaving(true); setError("");
    const key = checkoutKey || readCheckoutKey() || crypto.randomUUID(); setCheckoutKey(key); try { localStorage.setItem("khora-store-checkout-key", key); } catch { /* optional persistence */ }
    try {
      const response = await fetch("/api/tienda", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create_order", token, idempotencyKey: key, customer }) });
      const data = await response.json();
      if (response.status === 409 && data.priceChanged) {
        const updates = new Map<number, number>((data.changes ?? []).map((item: { productId: number; newPriceCents: number }) => [Number(item.productId), Number(item.newPriceCents)] as const));
        const updatedCart = cart.map((item) => updates.has(item.id) ? { ...item, priceCents: updates.get(item.id)! } : item); saveCart(updatedCart); try { await syncReservation(updatedCart); } catch { /* keep the latest reservation error visible */ }
        setError("El precio de uno o más productos se actualizó. Revisá el nuevo total antes de generar el pedido."); return;
      }
      if (!response.ok || !data.order || !data.accessToken) throw new Error(data.error ?? "No pudimos generar el pedido. Tu bolsa sigue disponible.");
      setOrder(data.order); if (data.settings) setSettings(data.settings); saveCart([]); setExpiresAt(""); try { localStorage.removeItem("khora-store-expires"); localStorage.removeItem("khora-store-token"); localStorage.removeItem("khora-store-checkout-key"); } catch { /* optional persistence */ } setCheckoutKey(""); setNotice(""); navigate("confirmation", undefined, data.order.number, String(data.accessToken));
    } catch (cause) { setError(friendlyError(cause, "No pudimos generar el pedido. Tu bolsa sigue disponible.")); } finally { setSaving(false); }
  }

  function whatsappUrl() { return order && settings.whatsapp ? buildWhatsAppLink(settings.whatsapp, buildStoreOrderWhatsAppMessage(order)) : ""; }
  function orderIsClosed() { if (!order) return true; const state = order.status.toUpperCase(); return state === "CANCELLED" || state === "EXPIRED" || (state === "PENDING_PAYMENT" && Boolean(order.expiresAt) && new Date(order.expiresAt).getTime() <= Date.now()); }
  function openWhatsApp() {
    setWhatsappError("");
    if (!order) { setWhatsappError("No pudimos encontrar este pedido."); return; }
    if (orderIsClosed()) { setWhatsappError(order.status.toUpperCase() === "CANCELLED" ? "Este pedido ya fue cancelado y no está activo." : "Este pedido venció. Volvé a generar uno para verificar stock y precios actuales."); return; }
    const url = whatsappUrl();
    if (!url) { setWhatsappError("WhatsApp todavía no está configurado para este negocio."); return; }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) setWhatsappError("No pudimos abrir WhatsApp. Revisá el bloqueo de ventanas y volvé a intentarlo.");
  }
  async function copyOrderNumber() { if (!order) return; try { await navigator.clipboard.writeText(order.number); setCopiedOrder(true); window.setTimeout(() => setCopiedOrder(false), 1800); } catch { setWhatsappError("No pudimos copiar el número de pedido."); } }
  return <div className={styles.storeShell}>
    <StoreHeader view={view} cartCount={cartCount} query={query} onHome={() => navigate("home")} onCatalog={() => { navigate("home"); setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }), 20); }} onStory={() => { navigate("home"); setTimeout(() => document.getElementById("historia")?.scrollIntoView({ behavior: "smooth" }), 20); }} onCart={() => navigate("cart")} onQueryChange={(value) => { setQuery(value); if (view !== "home") navigate("home"); }} />
    {notice && <div className={styles.notice} role="status">{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")} aria-label="Cerrar error">×</button></div>}
    {view === "home" && <>
      <main><section className={styles.hero} aria-labelledby="store-hero-title"><div className={styles.heroCopy}><div className={styles.eyebrowRow}><p className={styles.eyebrow}>OBJETOS PARA HABITAR DESPACIO</p><span aria-hidden="true" /></div><h1 id="store-hero-title">Lo cotidiano,<br /><em>con intención.</em></h1><p>Pequeños objetos hechos para acompañar tu casa y tus momentos de todos los días.</p><button className={styles.primary} onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Descubrir KHORA <span>→</span></button><div className={styles.heroMeta}><span>01 <i aria-hidden="true" /> 03</span><span>SCROLLÉA <b aria-hidden="true">↓</b></span></div></div><div className={styles.heroImage}><img src="/khora-store-hero.png" alt="Difusor de aroma sobre piedra y cerámica, rodeado de hojas" /><span className={styles.heroImageNote}>AROMAS · OBJETOS · HOGAR</span></div></section><section className={styles.catalog} id="catalogo"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>LA COLECCIÓN</p><h2>Elegidos para tu espacio</h2></div><p>Diseño simple, materiales nobles y una pausa para lo esencial.</p></div><div className={styles.filters}><div className={styles.categoryList}>{categories.map((item) => <button key={item} className={category === item ? styles.selectedFilter : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><label className={styles.catalogSearch}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre…" aria-label="Buscar en el catálogo" /></label></div>{loading ? <p className={styles.empty}>Cargando la colección…</p> : error && !products.length ? <div className={styles.emptyPanel} role="alert"><h2>No pudimos cargar la colección</h2><p>Revisá tu conexión e intentá nuevamente.</p><button className={styles.primary} onClick={() => { setError(""); setCatalogRefresh((value) => value + 1); }}>Reintentar <span>→</span></button></div> : <div className={styles.grid}>{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onOpen={() => navigate("product", product.id)} onAdd={() => addToCart(product)} />)}</div>}{!loading && !error && !filteredProducts.length && <p className={styles.empty}>No encontramos productos con esa búsqueda.</p>}</section><section className={styles.story} id="historia"><div><p className={styles.eyebrow}>LA MIRADA KHORA</p><h2>Hecho para quedarse.</h2></div><p>Creamos objetos honestos, calmos y duraderos. Cada pieza encuentra su lugar cuando suma belleza sin pedir atención.</p><button className={styles.linkButton} onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Ver la colección <span>→</span></button></section><section className={styles.editorialBanner} aria-label="Manifiesto KHORA"><div><p className={styles.eyebrow}>UNA PAUSA EN CASA</p><h2>Una casa también<br />se recuerda<br /><em>por su aroma.</em></h2></div><p>Objetos sencillos para rituales que se vuelven parte de vos.</p></section><section className={styles.newsletter} aria-label="Novedades de KHORA"><div><p className={styles.eyebrow}>DE VEZ EN CUANDO</p><h2>Un poco de KHORA.</h2></div><div><p>Novedades, objetos y pequeñas historias para habitar despacio.</p><div className={styles.newsletterField}><input type="email" placeholder="Tu correo electrónico" aria-label="Tu correo electrónico" disabled /><button type="button" disabled aria-label="Suscribirse próximamente">→</button></div><small>Próximamente.</small></div></section></main><Footer /></>}
    {view === "product" && selectedProduct && <ProductDetail product={selectedProduct} onBack={() => navigate("home")} onAdd={(quantity) => addToCart(selectedProduct, quantity)} />}
    {view === "product" && !selectedProduct && !loading && <main className={styles.narrowPage}><div className={styles.emptyPanel}><h2>Este producto ya no está disponible</h2><p>Puede haber cambiado su disponibilidad o dejado de publicarse.</p><button className={styles.primary} onClick={() => navigate("home")}>Volver a la tienda <span>→</span></button></div></main>}
    {view === "cart" && <CartView cart={cart} total={cartTotal} expiresAt={expiresAt} expired={reservationExpired} saving={saving} onBack={() => navigate("home")} onChange={changeQuantity} onRemove={(item) => syncReservation(cart.filter((line) => line.id !== item.id))} onContinue={continueToDetails} />}
    {view === "details" && <CustomerForm customer={customer} setCustomer={setCustomer} cart={cart} total={cartTotal} saving={saving} onBack={() => navigate("cart")} onSubmit={createOrder} />}
     {view === "confirmation" && order && <Confirmation order={order} now={now} configured={Boolean(settings.whatsapp)} whatsappError={whatsappError} copiedOrder={copiedOrder} onCopyOrder={copyOrderNumber} onWhatsApp={openWhatsApp} onBack={() => navigate("home")} />}
    {view === "confirmation" && !order && !loading && <main className={styles.confirmation}><div className={styles.confirmMark}>!</div><p className={styles.eyebrow}>KHORA TIENDA</p><h1>No pudimos abrir este pedido</h1><p className={styles.confirmLead}>Revisá el enlace de confirmación. Si el pedido venció o fue cancelado, volvé a la tienda para generar uno nuevo.</p><button className={styles.primary} onClick={() => navigate("home")}>Volver a la tienda <span>→</span></button></main>}
  </div>;
}

type StoreHeaderProps = {
  view: View;
  cartCount: number;
  query: string;
  onHome: () => void;
  onCatalog: () => void;
  onStory: () => void;
  onCart: () => void;
  onQueryChange: (value: string) => void;
};

function StoreHeader({ view, cartCount, query, onHome, onCatalog, onStory, onCart, onQueryChange }: StoreHeaderProps) {
  return <header className={`${styles.header} ${styles.publicHeader}`}>
    <a className={styles.logo} href="/tienda" onClick={(event) => { event.preventDefault(); onHome(); }} aria-label="KHORA, volver al inicio"><span className={styles.wordmark}>KHORA</span></a>
    <nav aria-label="Store navigation">
      <button className={`${styles.navItem} ${view === "home" ? styles.navActive : ""}`} onClick={onHome} aria-current={view === "home" ? "page" : undefined}>Inicio</button>
      <button className={styles.navItem} onClick={onCatalog}>Colecciones</button>
      <button className={styles.navItem} onClick={onStory}>Nosotros</button>
    </nav>
    <div className={styles.headerActions}>
      <label className={styles.search}><span aria-hidden="true">&#8981;</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar" aria-label="Buscar productos" /></label>
      <button className={`${styles.textAction} ${styles.bagAction}`} onClick={onCart} aria-label="Abrir bolsa"><svg className={styles.bagIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l1 11h-15l1-11Z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M9 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg><span>Bolsa {cartCount ? `(${cartCount})` : ""}</span></button>
    </div>
  </header>;
}

function ProductImage({ product, alt, compact = false }: { product: Product; alt: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = productImage(product) ?? fallbackProductImage(product);
  if (image && !failed) return <img src={image} alt={alt} onError={() => setFailed(true)} />;
  if (compact) return <span>KH</span>;
  return <div className={styles.placeholder}><span>KH</span><small>Hecho para tu espacio</small></div>;
}

function ProductCard({ product, onOpen, onAdd }: { product: Product; onOpen: () => void; onAdd: () => void }) {
  const unavailable = product.availableStock <= 0;
  return <article className={styles.card}><button className={styles.cardVisual} onClick={onOpen} aria-label={`Ver ${product.name}`}><ProductImage product={product} alt="" />{unavailable && <span className={styles.outOfStock}>Sin stock</span>}<span className={styles.cardReveal}>Ver producto <span aria-hidden="true">→</span></span></button><div className={styles.cardBody}><p className={styles.cardCategory}>{product.category}</p><h3>{product.name}</h3><div className={styles.cardMeta}><strong>{money(product.priceCents)}</strong><span className={unavailable ? styles.stockOut : styles.stock}>{unavailable ? "Sin stock" : product.availableStock <= 3 ? `Últimas ${formatQuantity(product.availableStock)}` : "Disponible"}</span></div><button className={styles.cardLink} onClick={unavailable ? onOpen : onAdd} disabled={unavailable}>{unavailable ? "Ver producto" : "Agregar al carrito"} <span>→</span></button></div></article>;
}

function ProductDetail({ product, onBack, onAdd }: { product: Product; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState(1); const unavailable = product.availableStock <= 0;
  return <main className={styles.detailPage}><button className={styles.backLink} onClick={onBack}>← Volver a la colección</button><div className={styles.detailGrid}><div className={styles.detailVisual}><ProductImage product={product} alt={product.name} /></div><div className={styles.detailInfo}><p className={styles.eyebrow}>{product.category}</p><h1>{product.name}</h1><p className={styles.detailPrice}>{money(product.priceCents)}</p><p className={styles.detailDescription}>{product.description || "Una pieza pensada para acompañar tus espacios con calma y belleza."}</p><div className={styles.availability}>{unavailable ? "Sin stock" : product.availableStock <= 3 ? `Últimas ${formatQuantity(product.availableStock)} unidades` : "Disponible"}</div>{!unavailable && <div className={styles.quantityRow}><div className={styles.quantity}><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Disminuir cantidad">−</button><span>{quantity}</span><button onClick={() => setQuantity((value) => Math.min(product.availableStock, value + 1))} aria-label="Aumentar cantidad">+</button></div><button className={styles.primary} onClick={() => onAdd(quantity)}>Agregar al carrito <span>→</span></button></div>}<div className={styles.accordion}><p>Materiales y cuidado</p><span>La información disponible de cada producto se actualiza desde KHORA Administración.</span></div></div></div></main>;
}

function ReservationNote({ expiresAt, expired }: { expiresAt: string; expired: boolean }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => { const tick = () => setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [expiresAt]);
  if (!expiresAt) return null;
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return <div className={expired ? styles.reservationExpired : styles.reservation}><span>{expired ? "i" : "◷"}</span><p>{expired ? "La reserva venció. Vamos a comprobar nuevamente la disponibilidad antes de continuar." : <>Tus productos están reservados durante 5 minutos. <strong>{clock}</strong></>}</p></div>;
}

function CartView({ cart, total, expiresAt, expired, saving, onBack, onChange, onRemove, onContinue }: { cart: CartLine[]; total: number; expiresAt: string; expired: boolean; saving: boolean; onBack: () => void; onChange: (item: CartLine, delta: number) => void; onRemove: (item: CartLine) => void; onContinue: () => void }) {
  return <main className={styles.narrowPage}><button className={styles.backLink} onClick={onBack}>← Seguir mirando</button><div className={styles.pageTitle}><p className={styles.eyebrow}>TU BOLSA</p><h1>Lo que elegiste</h1></div><ReservationNote expiresAt={expiresAt} expired={expired} />{!cart.length ? <div className={styles.emptyPanel}><h2>Tu bolsa está vacía</h2><p>Elegí algo que haga especial tu espacio.</p><button className={styles.primary} onClick={onBack}>Ver colección <span>→</span></button></div> : <><div className={styles.cartLines}>{cart.map((item) => <article className={styles.cartLine} key={item.id}><div className={styles.cartThumb}><ProductImage product={item} alt="" compact /></div><div className={styles.cartLineInfo}><h3>{item.name}</h3><p>{money(item.priceCents)} · {item.availableStock <= 3 ? `Últimas ${formatQuantity(item.availableStock)}` : "Disponible"}</p></div><div className={styles.quantity}><button onClick={() => onChange(item, -1)} aria-label={`Disminuir ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={() => onChange(item, 1)} aria-label={`Aumentar ${item.name}`}>+</button></div><strong>{money(item.priceCents * item.quantity)}</strong><button className={styles.remove} onClick={() => onRemove(item)} aria-label={`Eliminar ${item.name}`}>×</button></article>)}</div><div className={styles.totalRow}><span>Total del pedido</span><strong>{money(total)}</strong></div><button className={`${styles.primary} ${styles.fullButton}`} onClick={onContinue} disabled={saving}>{saving ? "Comprobando disponibilidad…" : "Continuar pedido"}</button></>}</main>;
}

function CustomerForm({ customer, setCustomer, cart, total, saving, onBack, onSubmit }: { customer: { name: string; phone: string; email: string; location: string }; setCustomer: (value: { name: string; phone: string; email: string; location: string }) => void; cart: CartLine[]; total: number; saving: boolean; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <main className={styles.narrowPage}><button className={styles.backLink} onClick={onBack}>← Volver a la bolsa</button><div className={styles.pageTitle}><p className={styles.eyebrow}>ÚLTIMO PASO</p><h1>Tus datos</h1><p>Solo necesitamos lo esencial para preparar tu pedido.</p></div><form className={styles.customerLayout} onSubmit={onSubmit}><div className={styles.formCard}><label>Nombre y apellido *<input required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" /></label><label>Teléfono / WhatsApp *<input required type="tel" inputMode="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} autoComplete="tel" /></label><label>Correo electrónico <input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" /></label><label>Localidad / zona <input value={customer.location} onChange={(event) => setCustomer({ ...customer, location: event.target.value })} autoComplete="address-level2" /></label><p className={styles.formHint}>Al generar el pedido, tus productos quedan reservados por 24 horas mientras coordinamos el pago y la entrega.</p><button className={`${styles.primary} ${styles.fullButton}`} disabled={saving}>{saving ? "Generando pedido…" : "Generar pedido"} <span>→</span></button></div><aside className={styles.summaryCard}><h2>Resumen</h2>{cart.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><strong>{money(item.quantity * item.priceCents)}</strong></div>)}<div className={styles.summaryTotal}><span>Total</span><strong>{money(total)}</strong></div></aside></form></main>;
}

function Confirmation({ order, now, configured, whatsappError, copiedOrder, onCopyOrder, onWhatsApp, onBack }: { order: StoreOrder; now: number; configured: boolean; whatsappError: string; copiedOrder: boolean; onCopyOrder: () => void; onWhatsApp: () => void; onBack: () => void }) {
  const state = order.status.toUpperCase();
  const cancelled = state === "CANCELLED";
  const expired = state === "EXPIRED" || (state === "PENDING_PAYMENT" && Boolean(order.expiresAt) && new Date(order.expiresAt).getTime() <= now);
  const closed = cancelled || expired;
  const reservationLabel = state === "PAID" || state === "PENDING_DELIVERY" || state === "DELIVERED" ? "Pago confirmado" : closed ? "Reserva cerrada" : "24 horas";
  return <main className={styles.confirmation}><div className={styles.confirmMark}>{closed ? "!" : "✓"}</div><p className={styles.eyebrow}>KHORA TIENDA</p><h1>{closed ? (cancelled ? "Pedido cancelado" : "Pedido vencido") : "Pedido generado"}</h1><p className={styles.confirmLead}>{closed ? (cancelled ? <>El pedido <strong>{order.number}</strong> ya no está activo.</> : <>El pedido <strong>{order.number}</strong> venció y ya no conserva la reserva.</>) : <>Tu pedido <strong>{order.number}</strong> fue generado correctamente.</>}</p><div className={styles.confirmCard}><div><span>Pedido</span><strong>{order.number}</strong><button className={styles.copyOrder} onClick={onCopyOrder}>{copiedOrder ? "Copiado" : `Copiar ${order.number}`}</button></div><div><span>Total</span><strong>{money(order.totalCents)}</strong></div><div><span>{state === "PAID" ? "Estado" : "Reserva"}</span><strong>{reservationLabel}</strong></div></div>{closed ? <p className={styles.confirmCopy}>{cancelled ? "No vuelvas a abrir WhatsApp con este pedido. Si necesitás comprar, generá un pedido nuevo." : "Volvé a generar uno para verificar stock y precios actuales."}</p> : <p className={styles.confirmCopy}>Tus productos quedaron reservados mientras coordinamos el pago y la entrega.</p>}{!closed && <button className={`${styles.primary} ${styles.whatsappButton}`} onClick={onWhatsApp}>Continuar por WhatsApp <span>→</span></button>}{whatsappError && <p className={styles.whatsappError} role="alert">{whatsappError}</p>}{!configured && !closed && <p className={styles.configHint}>El pedido ya existe. WhatsApp todavía no está configurado; podés coordinarlo desde KHORA Administración.</p>}<button className={styles.linkButton} onClick={onBack}>Volver a la tienda</button></main>;
}

function Footer() { return <footer className={styles.footer}><div><span className={styles.footerWordmark}>KHORA</span><p>Objetos para habitar despacio.</p></div><div><span>KHORA Tienda</span><a href="#catalogo">Colecciones</a><a href="#historia">Nosotros</a><a href="mailto:hola@khora.com">Contacto</a></div><small>© {new Date().getFullYear()} KHORA</small></footer>; }





