import { khoraDb } from "@/db/postgres";

type Row = Record<string, unknown>;
type CartItemInput = { productId: number; quantity: number };

type StoreProduct = {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  type: string;
  priceCents: number;
  stock: number;
  availableStock: number;
  imagePath: string | null;
  published: boolean;
};

const db = () => khoraDb;
const asNumber = (value: unknown) => Number(value);
const asString = (value: unknown) => String(value ?? "").trim();
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const errorResponse = (message: string, status = 400, extra: Record<string, unknown> = {}) => json({ error: message, ...extra }, status);
const code = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

let schemaPromise: Promise<void> | null = null;
function ensureStoreSchema() {
  if (!schemaPromise) {
    schemaPromise = db().batch([
      db().prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS store_published BOOLEAN NOT NULL DEFAULT TRUE"),
      db().prepare("ALTER TABLE clients ADD COLUMN IF NOT EXISTS store_phone_normalized TEXT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_source TEXT NOT NULL DEFAULT 'ADMIN'"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_idempotency_key TEXT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_reservation_id BIGINT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_stock_committed_at TIMESTAMPTZ"),
      db().prepare("UPDATE products SET store_published=TRUE WHERE store_published IS NULL"),
      db().prepare("CREATE SEQUENCE IF NOT EXISTS store_order_number_seq START WITH 1"),
      db().prepare("CREATE TABLE IF NOT EXISTS store_reservations (id BIGSERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMMITTED','EXPIRED','RELEASED')), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db().prepare("CREATE TABLE IF NOT EXISTS store_reservation_items (id BIGSERIAL PRIMARY KEY, reservation_id BIGINT NOT NULL REFERENCES store_reservations(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), quantity NUMERIC NOT NULL CHECK(quantity>0), unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), UNIQUE(reservation_id,product_id))"),
      db().prepare("CREATE UNIQUE INDEX IF NOT EXISTS orders_store_idempotency_uq ON orders(store_idempotency_key) WHERE store_idempotency_key IS NOT NULL"),
      db().prepare("CREATE INDEX IF NOT EXISTS store_reservations_active_idx ON store_reservations(status,expires_at)"),
      db().prepare("CREATE INDEX IF NOT EXISTS store_reservation_items_product_idx ON store_reservation_items(product_id)"),
      db().prepare("CREATE INDEX IF NOT EXISTS clients_store_phone_idx ON clients(store_phone_normalized)"),
    ]).then(() => undefined).catch((cause) => { schemaPromise = null; throw cause; });
  }
  return schemaPromise;
}

const normalizePhone = (value: unknown) => {
  let digits = asString(value).replace(/\D/g, "");
  if (digits.startsWith("549")) digits = digits.slice(3);
  else if (digits.startsWith("54")) digits = digits.slice(2).replace(/^9/, "");
  return digits;
};

const parseImagePath = (value: unknown) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(asString(value));
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return asString(value) || null;
  }
};

const cleanCartItems = (value: unknown): CartItemInput[] => {
  if (!Array.isArray(value)) return [];
  const grouped = new Map<number, number>();
  for (const raw of value) {
    const row = raw as Record<string, unknown>;
    const productId = asNumber(row?.productId);
    const quantity = asNumber(row?.quantity);
    if (Number.isInteger(productId) && productId > 0 && Number.isFinite(quantity) && quantity > 0) grouped.set(productId, (grouped.get(productId) ?? 0) + quantity);
  }
  return [...grouped.entries()].map(([productId, quantity]) => ({ productId, quantity }));
};

async function expireReservations() {
  await db().prepare("UPDATE store_reservations SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE status='ACTIVE' AND expires_at<=CURRENT_TIMESTAMP").run();
}

async function listStoreProducts(token = ""): Promise<StoreProduct[]> {
  await expireReservations();
  const result = await db().prepare(`WITH reserved AS (
      SELECT sri.product_id, SUM(sri.quantity) quantity
      FROM store_reservation_items sri JOIN store_reservations sr ON sr.id=sri.reservation_id
      WHERE sr.status='ACTIVE' AND sr.expires_at>CURRENT_TIMESTAMP AND sr.token<>?
      GROUP BY sri.product_id
    ), committed AS (
      SELECT oi.product_id, SUM(oi.quantity) quantity
      FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE oi.product_id IS NOT NULL AND o.store_source='STORE' AND o.store_stock_committed_at IS NOT NULL
        AND o.status NOT IN ('CANCELLED','DELIVERED') AND (o.expected_at IS NULL OR o.expected_at>CURRENT_TIMESTAMP::text)
      GROUP BY oi.product_id
    )
    SELECT p.id,cb.code,cb.name,COALESCE(cb.description,'') description,COALESCE(c.name,'') category,p.type,p.sale_price_cents,p.current_stock,
      GREATEST(0,p.current_stock-COALESCE(reserved.quantity,0)-COALESCE(committed.quantity,0)) available_stock,p.store_published,
      (SELECT value_json FROM app_settings WHERE key='product_image_'||p.id) image_path
    FROM products p JOIN code_base cb ON cb.id=p.code_base_id LEFT JOIN categories c ON c.id=p.category_id
    LEFT JOIN reserved ON reserved.product_id=p.id LEFT JOIN committed ON committed.product_id=p.id
    WHERE p.active=1 AND p.store_published=TRUE ORDER BY cb.name`).bind(token).all<Row>();
  return result.results.map((row) => ({
    id: asNumber(row.id), code: asString(row.code), name: asString(row.name), description: asString(row.description), category: asString(row.category) || "Colección KHORA", type: asString(row.type), priceCents: asNumber(row.sale_price_cents), stock: asNumber(row.current_stock), availableStock: asNumber(row.available_stock), imagePath: parseImagePath(row.image_path), published: Boolean(row.store_published),
  }));
}

async function getSettings() {
  const rows = (await db().prepare("SELECT key,value_json FROM app_settings WHERE key IN ('business_profile','store_whatsapp')").all<Row>()).results;
  const values = new Map(rows.map((row) => [asString(row.key), asString(row.value_json)]));
  let profile: Record<string, unknown> = {};
  try { profile = JSON.parse(values.get("business_profile") ?? "{}"); } catch { profile = {}; }
  const configured = asString(values.get("store_whatsapp"));
  let whatsapp = configured;
  try { whatsapp = asString(JSON.parse(configured)); } catch { /* plain text setting */ }
  whatsapp ||= asString(profile.whatsapp ?? profile.phone ?? process.env.NEXT_PUBLIC_KHORA_WHATSAPP);
  return { whatsapp: whatsapp.replace(/\D/g, ""), businessName: asString(profile.name) || "KHORA" };
}

async function reservationByToken(token: string) {
  return db().prepare("SELECT id,token,status,expires_at FROM store_reservations WHERE token=?").bind(token).first<Row>();
}

async function reserveCart(tokenInput: unknown, itemsInput: unknown) {
  await ensureStoreSchema();
  const token = asString(tokenInput) || crypto.randomUUID();
  const items = cleanCartItems(itemsInput);
  if (!items.length) throw new Error("Agregá al menos un producto al carrito.");
  const products = await listStoreProducts(token);
  const byId = new Map(products.map((product) => [product.id, product]));
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) throw new Error("Uno de los productos ya no está disponible.");
    if (item.quantity > product.availableStock + 0.000001) throw new Error(`Solo quedan ${product.availableStock} unidades disponibles de ${product.name}.`);
  }
  let reservation = await reservationByToken(token);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  if (!reservation) reservation = await db().prepare("INSERT INTO store_reservations(token,status,expires_at) VALUES(?, 'ACTIVE', ?) RETURNING id,token,status,expires_at").bind(token, expiresAt).first<Row>();
  if (!reservation) throw new Error("No se pudo crear la reserva.");
  const reservationId = asNumber(reservation.id);
  await db().batch([
    db().prepare("UPDATE store_reservations SET status='ACTIVE',expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(expiresAt, reservationId),
    db().prepare("DELETE FROM store_reservation_items WHERE reservation_id=?").bind(reservationId),
    ...items.map((item) => db().prepare("INSERT INTO store_reservation_items(reservation_id,product_id,quantity,unit_price_cents) VALUES(?,?,?,?)").bind(reservationId, item.productId, item.quantity, byId.get(item.productId)!.priceCents)),
  ]);
  return { token, expiresAt, items: items.map((item) => { const product = byId.get(item.productId)!; return { ...item, name: product.name, code: product.code, priceCents: product.priceCents, availableStock: product.availableStock }; }) };
}

async function releaseCart(tokenInput: unknown) {
  await ensureStoreSchema();
  const token = asString(tokenInput);
  if (!token) return { released: false };
  await db().prepare("UPDATE store_reservations SET status='RELEASED',updated_at=CURRENT_TIMESTAMP WHERE token=? AND status='ACTIVE'").bind(token).run();
  return { released: true };
}

async function orderByNumber(number: string) {
  const order = await db().prepare(`SELECT o.id,o.number,o.created_at,o.expected_at,o.total_cents,o.status,o.payment_status,c.name client_name,c.phone client_phone,c.email client_email,c.address client_address
    FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.number=? AND o.store_source='STORE'`).bind(number).first<Row>();
  if (!order) return null;
  const items = (await db().prepare("SELECT product_id,description,quantity,unit_price_cents,line_total_cents FROM order_items WHERE order_id=? ORDER BY id").bind(asNumber(order.id)).all<Row>()).results;
  return { number: asString(order.number), createdAt: asString(order.created_at), expiresAt: asString(order.expected_at), totalCents: asNumber(order.total_cents), status: asString(order.status), paymentStatus: asString(order.payment_status), customer: { name: asString(order.client_name), phone: asString(order.client_phone), email: asString(order.client_email), location: asString(order.client_address) }, items: items.map((item) => ({ productId: asNumber(item.product_id), name: asString(item.description), quantity: asNumber(item.quantity), priceCents: asNumber(item.unit_price_cents), lineTotalCents: asNumber(item.line_total_cents) })) };
}

async function createStoreOrder(body: Record<string, unknown>) {
  await ensureStoreSchema();
  await expireReservations();
  const token = asString(body.token);
  const idempotencyKey = asString(body.idempotencyKey);
  const customer = (body.customer ?? {}) as Record<string, unknown>;
  const name = asString(customer.name);
  const phone = asString(customer.phone);
  const normalizedPhone = normalizePhone(phone);
  const email = asString(customer.email);
  const location = asString(customer.location);
  if (!idempotencyKey) throw new Error("No se pudo validar el pedido. Intentá nuevamente.");
  if (!name) throw new Error("Ingresá tu nombre y apellido.");
  if (!normalizedPhone || normalizedPhone.length < 8) throw new Error("Ingresá un teléfono válido.");
  const existing = await db().prepare("SELECT number FROM orders WHERE store_idempotency_key=? AND store_source='STORE'").bind(idempotencyKey).first<Row>();
  if (existing) return { order: await orderByNumber(asString(existing.number)), duplicate: true, settings: await getSettings() };
  const reservation = await reservationByToken(token);
  if (!reservation || asString(reservation.status) !== "ACTIVE" || new Date(asString(reservation.expires_at)).getTime() <= Date.now()) throw new Error("La reserva venció. Volvé al carrito para comprobar la disponibilidad.");
  const reservationItems = (await db().prepare(`SELECT sri.product_id,sri.quantity,sri.unit_price_cents,p.sale_price_cents,cb.name,p.current_stock
    FROM store_reservation_items sri JOIN products p ON p.id=sri.product_id JOIN code_base cb ON cb.id=p.code_base_id
    WHERE sri.reservation_id=? AND p.active=1 AND p.store_published=TRUE ORDER BY sri.id`).bind(asNumber(reservation.id)).all<Row>()).results;
  if (!reservationItems.length) throw new Error("El carrito está vacío.");
  const changed = reservationItems.filter((item) => asNumber(item.unit_price_cents) !== asNumber(item.sale_price_cents)).map((item) => ({ productId: asNumber(item.product_id), name: asString(item.name), oldPriceCents: asNumber(item.unit_price_cents), newPriceCents: asNumber(item.sale_price_cents) }));
  if (changed.length) return { priceChanged: true, changes: changed, products: await listStoreProducts(token) };
  const products = await listStoreProducts(token);
  const byId = new Map(products.map((product) => [product.id, product]));
  for (const item of reservationItems) {
    const product = byId.get(asNumber(item.product_id));
    if (!product || asNumber(item.quantity) > product.availableStock + 0.000001) throw new Error(`Solo quedan ${product?.availableStock ?? 0} unidades disponibles de ${asString(item.name)}.`);
  }
  const existingClients = (await db().prepare("SELECT id,name,phone,email,address,store_phone_normalized FROM clients WHERE active=1 ORDER BY id").all<Row>()).results;
  const phoneMatch = existingClients.find((client) => normalizePhone(client.store_phone_normalized ?? client.phone) === normalizedPhone);
  const emailMatch = !phoneMatch && email ? existingClients.find((client) => asString(client.email).toLowerCase() === email.toLowerCase()) : null;
  let clientId = asNumber(phoneMatch?.id || emailMatch?.id);
  if (clientId) await db().prepare("UPDATE clients SET name=?,phone=?,email=?,address=?,store_phone_normalized=? WHERE id=?").bind(name, phone, email || null, location || null, normalizedPhone, clientId).run();
  else {
    const created = await db().prepare("INSERT INTO clients(code,name,phone,email,address,store_phone_normalized) VALUES(?,?,?,?,?,?) RETURNING id").bind(code("CLI"), name, phone, email || null, location || null, normalizedPhone).first<Row>();
    clientId = asNumber(created?.id);
  }
  if (!clientId) throw new Error("No se pudo preparar el cliente.");
  const numberRow = await db().prepare("SELECT 'KH-' || LPAD(nextval('store_order_number_seq')::text,6,'0') number").first<Row>();
  const number = asString(numberRow?.number);
  if (!number) throw new Error("No se pudo generar el número de pedido.");
  const totalCents = reservationItems.reduce((sum, item) => sum + Math.round(asNumber(item.quantity) * asNumber(item.sale_price_cents)), 0);
  const q = [
    db().prepare("INSERT INTO orders(number,client_id,status,payment_status,subtotal_cents,total_cents,expected_at,delivery_address,notes,store_source,store_idempotency_key,store_reservation_id,store_stock_committed_at) VALUES(?,?, 'PENDING','PENDING',?,?,(CURRENT_TIMESTAMP + INTERVAL '24 hours')::text,?,?, 'STORE',?,?,CURRENT_TIMESTAMP)").bind(number, clientId, totalCents, totalCents, location || null, `Origen: KHORA Tienda · ${phone}`, idempotencyKey, asNumber(reservation.id)),
    db().prepare("UPDATE store_reservations SET status='COMMITTED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='ACTIVE'").bind(asNumber(reservation.id)),
    db().prepare("INSERT INTO audit_logs(action,entity_type,entity_id,actor_email,summary,after_json) VALUES('CREATE','ORDER',(SELECT id FROM orders WHERE number=?),'KHORA Tienda',?,?)").bind(number, `Pedido ${number} generado desde KHORA Tienda`, JSON.stringify({ source: "STORE", customerId: clientId, reservedUntil: asString(reservation.expires_at), committedUntilHours: 24 })),
  ];
  for (const item of reservationItems) q.splice(1, 0, db().prepare("INSERT INTO order_items(order_id,product_id,description,quantity,unit_price_cents,line_total_cents,requires_manufacturing) VALUES((SELECT id FROM orders WHERE number=?),?,?,?,?,?,FALSE)").bind(number, asNumber(item.product_id), asString(item.name), asNumber(item.quantity), asNumber(item.sale_price_cents), Math.round(asNumber(item.quantity) * asNumber(item.sale_price_cents))));
  try {
    await db().batch(q);
  } catch (cause) {
    // A repeated click can race the idempotency lookup; return the committed order.
    if ((cause as { code?: string })?.code === "23505") {
      const duplicate = await db().prepare("SELECT number FROM orders WHERE store_idempotency_key=? AND store_source='STORE'").bind(idempotencyKey).first<Row>();
      if (duplicate) return { order: await orderByNumber(asString(duplicate.number)), duplicate: true, settings: await getSettings() };
    }
    throw cause;
  }
  return { order: await orderByNumber(number), duplicate: false, settings: await getSettings(), possibleExistingClient: Boolean(emailMatch) };
}

export async function GET(request: Request) {
  try {
    await ensureStoreSchema();
    const url = new URL(request.url);
    const entity = asString(url.searchParams.get("entity")) || "products";
    if (entity === "settings") return json(await getSettings());
    if (entity === "products") return json({ products: await listStoreProducts(asString(url.searchParams.get("token"))) });
    if (entity === "product") {
      const id = asNumber(url.searchParams.get("id"));
      const product = (await listStoreProducts(asString(url.searchParams.get("token")))).find((item) => item.id === id);
      return product ? json({ product }) : errorResponse("Producto no disponible.", 404);
    }
    if (entity === "order") {
      const order = await orderByNumber(asString(url.searchParams.get("number")));
      return order ? json({ order, settings: await getSettings() }) : errorResponse("Pedido inexistente.", 404);
    }
    return errorResponse("Entidad desconocida.", 404);
  } catch (cause) {
    return errorResponse(cause instanceof Error ? cause.message : "No se pudo cargar la tienda.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = asString(body.action);
    if (action === "reserve") return json(await reserveCart(body.token, body.items));
    if (action === "release") return json(await releaseCart(body.token));
    if (action === "create_order") {
      const result = await createStoreOrder(body);
      if (result.priceChanged) return json(result, 409);
      return json(result);
    }
    return errorResponse("Acción desconocida.", 404);
  } catch (cause) {
    return errorResponse(cause instanceof Error ? cause.message : "No se pudo completar la operación.", 400);
  }
}


