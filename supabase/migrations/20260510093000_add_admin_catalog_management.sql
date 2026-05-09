create or replace function public.is_admin_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'email') = 'admin@gmail.com', false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

alter table public.products
  add column if not exists image_path text,
  add column if not exists image_alt text,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function private.set_updated_at();

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

create table if not exists public.product_labels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  color text not null default '#174832',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_labels_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9_-]*$')
);

create table if not exists public.product_label_links (
  product_id uuid not null references public.products(id) on delete cascade,
  label_id uuid not null references public.product_labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, label_id)
);

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at
before update on public.product_categories
for each row
execute function private.set_updated_at();

drop trigger if exists set_product_labels_updated_at on public.product_labels;
create trigger set_product_labels_updated_at
before update on public.product_labels
for each row
execute function private.set_updated_at();

create index if not exists product_categories_active_sort_idx
  on public.product_categories (is_active, sort_order, name);
create index if not exists product_labels_active_name_idx
  on public.product_labels (is_active, name);
create index if not exists product_label_links_label_id_idx
  on public.product_label_links (label_id);
create index if not exists products_updated_at_idx
  on public.products (updated_at desc);

alter table public.product_categories enable row level security;
alter table public.product_labels enable row level security;
alter table public.product_label_links enable row level security;

drop policy if exists "Public can read active product categories" on public.product_categories;
create policy "Public can read active product categories"
on public.product_categories
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage product categories" on public.product_categories;
create policy "Admins can manage product categories"
on public.product_categories
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public can read active product labels" on public.product_labels;
create policy "Public can read active product labels"
on public.product_labels
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage product labels" on public.product_labels;
create policy "Admins can manage product labels"
on public.product_labels
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Public can read in-stock product label links" on public.product_label_links;
create policy "Public can read in-stock product label links"
on public.product_label_links
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.stock_status = 'in_stock'
  )
);

drop policy if exists "Admins can manage product label links" on public.product_label_links;
create policy "Admins can manage product label links"
on public.product_label_links
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
on public.products
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

insert into public.product_categories (slug, name, description, sort_order)
select
  category,
  initcap(replace(category, '_', ' ')),
  'Kategori katalog awal dari data produk.',
  row_number() over (order by category) * 10
from (select distinct category from public.products) categories
on conflict (slug) do update
set name = excluded.name,
    updated_at = now();

insert into public.product_labels (slug, name, color)
values
  ('anti-bocor', 'Anti bocor', '#0f766e'),
  ('cat', 'Cat', '#2563eb'),
  ('keramik', 'Keramik', '#7c3aed'),
  ('plumbing', 'Plumbing', '#0369a1'),
  ('tools', 'Tools', '#92400e'),
  ('premium', 'Premium', '#b45309'),
  ('ekonomis', 'Ekonomis', '#15803d')
on conflict (slug) do update
set name = excluded.name,
    color = excluded.color,
    updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
)
with check (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
);
