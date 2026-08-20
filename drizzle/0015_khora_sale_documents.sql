CREATE TABLE IF NOT EXISTS sale_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  order_id INTEGER REFERENCES orders(id),
  type TEXT NOT NULL CHECK(type IN ('REMITO','RECEIPT')),
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','GENERATED','ERROR','CANCELLED')),
  snapshot_json TEXT,
  pdf_base64 TEXT,
  error_message TEXT,
  generated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_at TEXT,
  UNIQUE(sale_id,type,version)
);

CREATE INDEX IF NOT EXISTS idx_sale_documents_sale
ON sale_documents(sale_id,type,version DESC);

INSERT OR IGNORE INTO app_settings(key,value_json)
VALUES
  ('document_remito_prefix','"sales-documents/remitos"'),
  ('document_receipt_prefix','"sales-documents/comprobantes"'),
  ('document_remito_include_prices','false');
