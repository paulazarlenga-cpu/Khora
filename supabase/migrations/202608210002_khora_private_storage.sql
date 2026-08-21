-- KHORA: almacenamiento privado para imágenes de productos y documentos.
-- Los archivos solo son accesibles para la cuenta administradora autorizada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'business-documents',
    'business-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "KHORA admin reads private files" on storage.objects;
create policy "KHORA admin reads private files"
on storage.objects for select
to authenticated
using (
  bucket_id in ('product-images', 'business-documents')
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'paulazarlenga@gmail.com'
);

drop policy if exists "KHORA admin uploads private files" on storage.objects;
create policy "KHORA admin uploads private files"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('product-images', 'business-documents')
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'paulazarlenga@gmail.com'
);

drop policy if exists "KHORA admin updates private files" on storage.objects;
create policy "KHORA admin updates private files"
on storage.objects for update
to authenticated
using (
  bucket_id in ('product-images', 'business-documents')
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'paulazarlenga@gmail.com'
)
with check (
  bucket_id in ('product-images', 'business-documents')
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'paulazarlenga@gmail.com'
);

drop policy if exists "KHORA admin deletes private files" on storage.objects;
create policy "KHORA admin deletes private files"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('product-images', 'business-documents')
  and lower(coalesce(auth.jwt() ->> 'email', '')) = 'paulazarlenga@gmail.com'
);
