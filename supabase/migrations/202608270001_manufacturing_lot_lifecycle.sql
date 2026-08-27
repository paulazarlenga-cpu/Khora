-- Estado auditable para lotes de fabricación y armado de combos.
-- Los lotes anulados se conservan para trazabilidad, pero no participan del stock/FIFO.
alter table public.manufacturing_batches
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.combo_batches
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.manufacturing_batches set status = 'ACTIVE' where status is null;
update public.combo_batches set status = 'ACTIVE' where status is null;

do $$ begin
  alter table public.manufacturing_batches
    add constraint manufacturing_batches_status_check check (status in ('ACTIVE','CANCELLED'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.combo_batches
    add constraint combo_batches_status_check check (status in ('ACTIVE','CANCELLED'));
exception when duplicate_object then null;
end $$;

create index if not exists manufacturing_batches_status_idx on public.manufacturing_batches(status);
create index if not exists combo_batches_status_idx on public.combo_batches(status);
