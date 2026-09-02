import { khoraDb, withKhoraTransaction } from "@/db/postgres";

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
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_status TEXT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_paid_at TIMESTAMPTZ"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_paid_by TEXT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_delivered_at TIMESTAMPTZ"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_delivered_by TEXT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_expired_at TIMESTAMPTZ"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_cancel_reason TEXT"),
      db().prepare("ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_customer_snapshot JSONB"),
      db().prepare("ALTER TABLE payments ADD COLUMN IF NOT EXISTS store_payment_key TEXT"),
      db().prepare("CREATE UNIQUE INDEX IF NOT EXISTS payments_store_payment_key_uq ON payments(store_payment_key) WHERE store_payment_key IS NOT NULL"),
      db().prepare("UPDATE products SET store_published=TRUE WHERE store_published IS NULL"),
      db().prepare("CREATE SEQUENCE IF NOT EXISTS store_order_number_seq START WITH 1"),
      db().prepare("CREATE TABLE IF NOT EXISTS store_reservations (id BIGSERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMMITTED','EXPIRED','RELEASED')), expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db().prepare("CREATE TABLE IF NOT EXISTS store_reservation_items (id BIGSERIAL PRIMARY KEY, reservation_id BIGINT NOT NULL REFERENCES store_reservations(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id), quantity NUMERIC NOT NULL CHECK(quantity>0), unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), UNIQUE(reservation_id,product_id))"),
      db().prepare("CREATE UNIQUE INDEX IF NOT EXISTS orders_store_idempotency_uq ON orders(store_idempotency_key) WHERE store_idempotency_key IS NOT NULL"),
      db().prepare("CREATE UNIQUE INDEX IF NOT EXISTS orders_store_reservation_uq ON orders(store_reservation_id) WHERE store_reservation_id IS NOT NULL"),
      db().prepare("CREATE INDEX IF NOT EXISTS order_items_product_store_idx ON order_items(product_id,order_id)"),
      db().prepare("CREATE INDEX IF NOT EXISTS store_orders_commitment_idx ON orders(store_source,store_status,expected_at) WHERE store_source='STORE' AND store_stock_committed_at IS NOT NULL"),
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
        AND (
          COALESCE(o.store_status,CASE WHEN o.status='DELIVERED' THEN 'DELIVERED' WHEN o.status='CANCELLED' THEN 'CANCELLED' WHEN o.payment_status='PAID' THEN 'PENDING_DELIVERY' ELSE 'PENDING_PAYMENT' END) IN ('PAID','PENDING_DELIVERY')
          OR (COALESCE(o.store_status,'PENDING_PAYMENT')='PENDING_PAYMENT' AND o.expected_at IS NOT NULL AND CAST(o.expected_at AS TIMESTAMPTZ)>CURRENT_TIMESTAMP)
        )
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
  const productIds = [...new Set(items.map((item) => item.productId))].sort((a, b) => a - b);
  return withKhoraTransaction(async (tx) => {
    // A product-scoped advisory lock serializes reservations and every other
    // critical store operation that opts into the same lock namespace.
    for (const productId of productIds) {
      await tx.prepare("SELECT pg_advisory_xact_lock(hashtextextended('khora-stock:' || ?::text, 0))").bind(productId).run();
    }
    await tx.prepare("UPDATE store_reservations SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE status='ACTIVE' AND expires_at<=CURRENT_TIMESTAMP").run();
    let reservation = await tx.prepare("SELECT id,token,status,expires_at FROM store_reservations WHERE token=? FOR UPDATE").bind(token).first<Row>();
    if (reservation && asString(reservation.status) === "COMMITTED") throw new Error("Este carrito ya generó un pedido.");
    const placeholders = productIds.map(() => "?").join(",");
    const availability = (await tx.prepare(`SELECT p.id,cb.code,cb.name,p.sale_price_cents,p.current_stock,
        GREATEST(0,p.current_stock
          -COALESCE((SELECT SUM(sri.quantity) FROM store_reservation_items sri JOIN store_reservations sr ON sr.id=sri.reservation_id WHERE sri.product_id=p.id AND sr.status='ACTIVE' AND sr.expires_at>CURRENT_TIMESTAMP AND sr.token<>?),0)
          -COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=p.id AND o.store_source='STORE' AND (
            COALESCE(o.store_status,CASE WHEN o.status='DELIVERED' THEN 'DELIVERED' WHEN o.status='CANCELLED' THEN 'CANCELLED' WHEN o.payment_status='PAID' THEN 'PENDING_DELIVERY' ELSE 'PENDING_PAYMENT' END) IN ('PAID','PENDING_DELIVERY')
            OR (COALESCE(o.store_status,'PENDING_PAYMENT')='PENDING_PAYMENT' AND o.expected_at IS NOT NULL AND CAST(o.expected_at AS TIMESTAMPTZ)>CURRENT_TIMESTAMP)
          )),0)
        ) available_stock,p.active,p.store_published
      FROM products p JOIN code_base cb ON cb.id=p.code_base_id WHERE p.id IN (${placeholders})`).bind(token, ...productIds).all<Row>()).results;
    const byId = new Map(availability.map((row) => [asNumber(row.id), row]));
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product || !Boolean(product.active) || !Boolean(product.store_published)) throw new Error("Uno de los productos ya no está disponible.");
      if (item.quantity > asNumber(product.available_stock) + 0.000001) throw new Error(`Solo quedan ${asNumber(product.available_stock)} unidades disponibles de ${asString(product.name)}.`);
    }
    if (!reservation) {
      reservation = await tx.prepare("INSERT INTO store_reservations(token,status,expires_at) VALUES(?, 'ACTIVE', CURRENT_TIMESTAMP + INTERVAL '5 minutes') RETURNING id,token,status,expires_at").bind(token).first<Row>();
    } else {
      reservation = await tx.prepare("UPDATE store_reservations SET status='ACTIVE',expires_at=CURRENT_TIMESTAMP + INTERVAL '5 minutes',updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING id,token,status,expires_at").bind(asNumber(reservation.id)).first<Row>();
    }
    if (!reservation) throw new Error("No se pudo crear la reserva.");
    const reservationId = asNumber(reservation.id);
    await tx.batch([
      tx.prepare("DELETE FROM store_reservation_items WHERE reservation_id=?").bind(reservationId),
      ...items.map((item) => tx.prepare("INSERT INTO store_reservation_items(reservation_id,product_id,quantity,unit_price_cents) VALUES(?,?,?,?)").bind(reservationId, item.productId, item.quantity, asNumber(byId.get(item.productId)!.sale_price_cents))),
    ]);
    return { token, expiresAt: asString(reservation.expires_at), items: items.map((item) => { const product = byId.get(item.productId)!; return { ...item, name: asString(product.name), code: asString(product.code), priceCents: asNumber(product.sale_price_cents), availableStock: asNumber(product.available_stock) }; }) };
  });
}
async function releaseCart(tokenInput: unknown) {
  await ensureStoreSchema();
  const token = asString(tokenInput);
  if (!token) return { released: false };
  const productIds = ((await db().prepare("SELECT DISTINCT product_id FROM store_reservation_items sri JOIN store_reservations sr ON sr.id=sri.reservation_id WHERE sr.token=? AND sr.status='ACTIVE'").bind(token).all<Row>()).results).map((row) => asNumber(row.product_id)).filter((id) => id > 0).sort((a, b) => a - b);
  return withKhoraTransaction(async (tx) => {
    // Release uses the same product locks as reservation updates, so two tabs
    // cannot leave the token in a stale ACTIVE state after an empty-cart action.
    for (const productId of productIds) await tx.prepare("SELECT pg_advisory_xact_lock(hashtextextended('khora-stock:' || ?::text, 0))").bind(productId).run();
    const released = await tx.prepare("UPDATE store_reservations SET status='RELEASED',updated_at=CURRENT_TIMESTAMP WHERE token=? AND status='ACTIVE' RETURNING id").bind(token).first<Row>();
    return { released: Boolean(released) };
  });
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
  try {
    const result = await withKhoraTransaction(async (tx) => {
      const existing = await tx.prepare("SELECT number FROM orders WHERE store_idempotency_key=? AND store_source='STORE'").bind(idempotencyKey).first<Row>();
      if (existing) return { duplicateNumber: asString(existing.number) };
      const reservationSummary = await tx.prepare("SELECT id,status,expires_at FROM store_reservations WHERE token=?").bind(token).first<Row>();
      if (!reservationSummary) throw new Error("La reserva venció. Volvé al carrito para comprobar la disponibilidad.");
      const initialItems = (await tx.prepare("SELECT product_id FROM store_reservation_items WHERE reservation_id=? ORDER BY id").bind(asNumber(reservationSummary.id)).all<Row>()).results;
      const productIds = [...new Set(initialItems.map((item) => asNumber(item.product_id)).filter((id) => id > 0))].sort((a, b) => a - b);
      if (!productIds.length) throw new Error("El carrito está vacío.");
      for (const productId of productIds) {
        await tx.prepare("SELECT pg_advisory_xact_lock(hashtextextended('khora-stock:' || ?::text, 0))").bind(productId).run();
      }
      const reservation = await tx.prepare("SELECT id,token,status,expires_at FROM store_reservations WHERE token=? FOR UPDATE").bind(token).first<Row>();
      if (!reservation || asString(reservation.status) !== "ACTIVE" || new Date(asString(reservation.expires_at)).getTime() <= Date.now()) throw new Error("La reserva venció. Volvé al carrito para comprobar la disponibilidad.");
      const reservationItems = (await tx.prepare(`SELECT sri.product_id,sri.quantity,sri.unit_price_cents,p.sale_price_cents,cb.name,p.current_stock,p.active,p.store_published
        FROM store_reservation_items sri JOIN products p ON p.id=sri.product_id JOIN code_base cb ON cb.id=p.code_base_id
        WHERE sri.reservation_id=? ORDER BY sri.id`).bind(asNumber(reservation.id)).all<Row>()).results;
      if (!reservationItems.length || reservationItems.length !== productIds.length) throw new Error("Uno de los productos ya no está disponible.");
      const changed = reservationItems.filter((item) => !Boolean(item.active) || !Boolean(item.store_published) || asNumber(item.unit_price_cents) !== asNumber(item.sale_price_cents)).map((item) => ({ productId: asNumber(item.product_id), name: asString(item.name), oldPriceCents: asNumber(item.unit_price_cents), newPriceCents: asNumber(item.sale_price_cents) }));
      if (changed.length) return { priceChanged: true, changes: changed };
      const placeholders = productIds.map(() => "?").join(",");
      const availability = (await tx.prepare(`SELECT p.id,cb.code,cb.name,p.sale_price_cents,p.current_stock,
          GREATEST(0,p.current_stock
            -COALESCE((SELECT SUM(sri.quantity) FROM store_reservation_items sri JOIN store_reservations sr ON sr.id=sri.reservation_id WHERE sri.product_id=p.id AND sr.status='ACTIVE' AND sr.expires_at>CURRENT_TIMESTAMP AND sr.token<>?),0)
            -COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=p.id AND o.store_source='STORE' AND (
              COALESCE(o.store_status,CASE WHEN o.status='DELIVERED' THEN 'DELIVERED' WHEN o.status='CANCELLED' THEN 'CANCELLED' WHEN o.payment_status='PAID' THEN 'PENDING_DELIVERY' ELSE 'PENDING_PAYMENT' END) IN ('PAID','PENDING_DELIVERY')
              OR (COALESCE(o.store_status,'PENDING_PAYMENT')='PENDING_PAYMENT' AND o.expected_at IS NOT NULL AND CAST(o.expected_at AS TIMESTAMPTZ)>CURRENT_TIMESTAMP)
            )),0)
          ) available_stock
        FROM products p JOIN code_base cb ON cb.id=p.code_base_id WHERE p.id IN (${placeholders})`).bind(token, ...productIds).all<Row>()).results;
      const byId = new Map(availability.map((row) => [asNumber(row.id), row]));
      for (const item of reservationItems) {
        const product = byId.get(asNumber(item.product_id));
        if (!product || asNumber(item.quantity) > asNumber(product.available_stock) + 0.000001) throw new Error(`Solo quedan ${asNumber(product?.available_stock ?? 0)} unidades disponibles de ${asString(item.name)}.`);
      }
      const existingClients = (await tx.prepare("SELECT id,name,phone,email,address,store_phone_normalized FROM clients WHERE active=1 ORDER BY id").all<Row>()).results;
      const phoneMatch = existingClients.find((client) => normalizePhone(client.store_phone_normalized ?? client.phone) === normalizedPhone);
      const emailMatch = !phoneMatch && email ? existingClients.find((client) => asString(client.email).toLowerCase() === email.toLowerCase()) : null;
      let clientId = asNumber(phoneMatch?.id || emailMatch?.id);
      if (clientId) await tx.prepare("UPDATE clients SET name=?,phone=?,email=?,address=?,store_phone_normalized=? WHERE id=?").bind(name, phone, email || null, location || null, normalizedPhone, clientId).run();
      else {
        const created = await tx.prepare("INSERT INTO clients(code,name,phone,email,address,store_phone_normalized) VALUES(?,?,?,?,?,?) RETURNING id").bind(code("CLI"), name, phone, email || null, location || null, normalizedPhone).first<Row>();
        clientId = asNumber(created?.id);
      }
      if (!clientId) throw new Error("No se pudo preparar el cliente.");
      const numberRow = await tx.prepare("SELECT 'KH-' || LPAD(nextval('store_order_number_seq')::text,6,'0') number").first<Row>();
      const number = asString(numberRow?.number);
      if (!number) throw new Error("No se pudo generar el número de pedido.");
      const totalCents = reservationItems.reduce((sum, item) => sum + Math.round(asNumber(item.quantity) * asNumber(item.sale_price_cents)), 0);
      const snapshotItems = reservationItems.map((item) => ({ productId: asNumber(item.product_id), name: asString(item.name), quantity: asNumber(item.quantity), priceCents: asNumber(item.sale_price_cents), lineTotalCents: Math.round(asNumber(item.quantity) * asNumber(item.sale_price_cents)) }));
      const createdOrder = await tx.prepare("INSERT INTO orders(number,client_id,status,payment_status,subtotal_cents,total_cents,expected_at,delivery_address,notes,store_source,store_idempotency_key,store_reservation_id,store_stock_committed_at,store_status,store_customer_snapshot) VALUES(?,?, 'PENDING','PENDING',?,?,(CURRENT_TIMESTAMP + INTERVAL '24 hours')::text,?,?, 'STORE',?,?,CURRENT_TIMESTAMP,'PENDING_PAYMENT',?::jsonb) RETURNING id").bind(number, clientId, totalCents, totalCents, location || null, `Origen: KHORA Tienda · ${phone}`, idempotencyKey, asNumber(reservation.id), JSON.stringify({ name, phone, email, location, items: snapshotItems })).first<Row>();
      const orderId = asNumber(createdOrder?.id);
      if (!orderId) throw new Error("No se pudo crear el pedido.");
      await tx.batch([
        ...reservationItems.map((item) => tx.prepare("INSERT INTO order_items(order_id,product_id,description,quantity,unit_price_cents,line_total_cents,requires_manufacturing) VALUES(?,?,?,?,?,?,FALSE)").bind(orderId, asNumber(item.product_id), asString(item.name), asNumber(item.quantity), asNumber(item.sale_price_cents), Math.round(asNumber(item.quantity) * asNumber(item.sale_price_cents)))),
        tx.prepare("UPDATE store_reservations SET status='COMMITTED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='ACTIVE'").bind(asNumber(reservation.id)),
        tx.prepare("INSERT INTO audit_logs(action,entity_type,entity_id,actor_email,summary,after_json) VALUES('CREATE','ORDER',?,'KHORA Tienda',?,?)").bind(orderId, `Pedido ${number} generado desde KHORA Tienda`, JSON.stringify({ source: "STORE", customerId: clientId, reservedUntil: asString(reservation.expires_at), committedUntilHours: 24, itemSnapshot: snapshotItems })),
      ]);
      return { number, possibleExistingClient: Boolean(emailMatch) };
    });
    if ("duplicateNumber" in result) return { order: await orderByNumber(asString(result.duplicateNumber)), duplicate: true, settings: await getSettings() };
    if ("priceChanged" in result && result.priceChanged) return { priceChanged: true, changes: result.changes, products: await listStoreProducts(token) };
    return { order: await orderByNumber(asString(result.number)), duplicate: false, settings: await getSettings(), possibleExistingClient: Boolean(result.possibleExistingClient) };
  } catch (cause) {
    // A repeated click can race the idempotency lookup; the unique key is the
    // final authority and the already committed order is returned to the client.
    if ((cause as { code?: string })?.code === "23505") {
      const duplicate = await db().prepare("SELECT number FROM orders WHERE store_idempotency_key=? AND store_source='STORE'").bind(idempotencyKey).first<Row>();
      if (duplicate) return { order: await orderByNumber(asString(duplicate.number)), duplicate: true, settings: await getSettings() };
    }
    throw cause;
  }
}
export async function GET(request: Request) {
  try {
    await ensureStoreSchema();
    const url = new URL(request.url);
    const entity = asString(url.searchParams.get("entity")) || "products";
    if (entity === "settings") return json(await getSettings());
    if (entity === "products") { const token = asString(url.searchParams.get("token")); const products = await listStoreProducts(token); const reservation = token ? await reservationByToken(token) : null; const reservationExpiresAt = reservation && asString(reservation.status) === "ACTIVE" && new Date(asString(reservation.expires_at)).getTime() > Date.now() ? asString(reservation.expires_at) : ""; return json({ products, reservationExpiresAt }); }
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
