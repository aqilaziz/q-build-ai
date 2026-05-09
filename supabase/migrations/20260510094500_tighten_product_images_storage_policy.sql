drop policy if exists "Public can read product images" on storage.objects;

drop policy if exists "Admins can list product images" on storage.objects;
create policy "Admins can list product images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
);
