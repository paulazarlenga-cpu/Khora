PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','PENDING','PREPARING','MANUFACTURING','READY','SHIPPED','DELIVERED','CANCELLED')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING','PARTIAL','PAID','REFUNDED')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK(discount_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK(shipping_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK(total_cents >= 0),
  expected_at TEXT,
  delivery_address TEXT,
  notes TEXT,
  internal_notes TEXT,
  sale_id INTEGER REFERENCES sales(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  customization TEXT,
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0),
  requires_manufacturing INTEGER NOT NULL DEFAULT 0 CHECK(requires_manufacturing IN (0,1))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  sale_id INTEGER REFERENCES sales(id),
  direction TEXT NOT NULL DEFAULT 'IN' CHECK(direction IN ('IN','OUT')),
  method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('PENDING','CONFIRMED','CANCELLED','REFUNDED')),
  paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference TEXT,
  notes TEXT,
  cancelled_at TEXT,
  CHECK(order_id IS NOT NULL OR sale_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  client_id INTEGER REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PREPARED','DISPATCHED','DELIVERED','CANCELLED')),
  address TEXT NOT NULL,
  carrier TEXT,
  tracking_code TEXT,
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_cents >= 0),
  dispatched_at TEXT,
  delivered_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  order_id INTEGER REFERENCES orders(id),
  sale_id INTEGER REFERENCES sales(id),
  client_id INTEGER REFERENCES clients(id),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK(status IN ('ISSUED','CANCELLED')),
  snapshot_json TEXT NOT NULL,
  file_key TEXT,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CONFIRMED','PARTIAL','RECEIVED','CANCELLED')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING','PARTIAL','PAID')),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK(total_cents >= 0),
  invoice_number TEXT,
  purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES raw_materials(id),
  quantity REAL NOT NULL CHECK(quantity > 0),
  unit TEXT NOT NULL,
  unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  actor_email TEXT,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_client_status ON orders(client_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_orders_expected_open ON orders(expected_at,status) WHERE status NOT IN ('DELIVERED','CANCELLED');
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id,status,paid_at);
CREATE INDEX IF NOT EXISTS idx_shipments_order_status ON shipments(order_id,status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_order ON delivery_notes(order_id,issued_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_date ON purchase_orders(supplier_id,purchased_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type,entity_id,created_at);

INSERT OR IGNORE INTO app_settings(key,value_json)
VALUES
  ('customer_inactivity_days','{"attention":30,"recover":60}'),
  ('business_profile','{"name":"KHORA","currency":"ARS","timezone":"America/Buenos_Aires"}'),
  ('payment_methods','["Efectivo","Transferencia","Mercado Pago","Otro"]');

PRAGMA optimize;
