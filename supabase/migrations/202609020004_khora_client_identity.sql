-- KHORA: identidad única de clientes y trazabilidad de origen.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone_normalized text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS possible_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS duplicate_note text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT current_timestamp;

UPDATE public.clients
SET phone_normalized = COALESCE(NULLIF(phone_normalized, ''), NULLIF(store_phone_normalized, ''), NULLIF(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), ''))
WHERE phone_normalized IS NULL OR phone_normalized = '';

UPDATE public.clients SET origin = 'MANUAL' WHERE origin IS NULL OR origin = '';
CREATE INDEX IF NOT EXISTS clients_phone_normalized_idx ON public.clients(phone_normalized);
CREATE INDEX IF NOT EXISTS clients_email_normalized_idx ON public.clients(LOWER(TRIM(email))) WHERE email IS NOT NULL;
