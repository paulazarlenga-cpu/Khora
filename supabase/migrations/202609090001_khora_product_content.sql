-- Public commercial copy is intentionally separate from code_base.description,
-- which KHORA Administración already uses for private operational notes.
alter table public.products
  add column if not exists store_description text;
