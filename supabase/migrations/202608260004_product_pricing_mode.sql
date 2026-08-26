-- Persist how a product's current sale price is defined.
-- Existing products keep their current manual price as a safe fallback.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'manual_price';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS target_margin_percentage double precision;

UPDATE public.products
SET pricing_mode = 'manual_price'
WHERE pricing_mode IS NULL OR pricing_mode NOT IN ('manual_price', 'target_margin');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_pricing_mode_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_pricing_mode_check
      CHECK (pricing_mode IN ('manual_price', 'target_margin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_target_margin_nonnegative_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_target_margin_nonnegative_check
      CHECK (target_margin_percentage IS NULL OR target_margin_percentage >= 0);
  END IF;
END $$;
