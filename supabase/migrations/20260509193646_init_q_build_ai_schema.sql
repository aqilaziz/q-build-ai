set check_function_bodies = off;

create schema if not exists extensions;

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  brand text,
  description text not null,
  use_cases text[] not null default '{}',
  unit text not null,
  price numeric(12,2) not null check (price >= 0),
  stock_status text not null default 'in_stock'
    check (stock_status in ('in_stock', 'out_of_stock', 'discontinued')),
  coverage_note text,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  problem_summary text not null,
  category text,
  area_m2 numeric check (area_m2 is null or area_m2 > 0),
  status text not null default 'draft'
    check (status in ('draft', 'saved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  summary text not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  installment_months int check (installment_months is null or installment_months > 0),
  installment_amount numeric(12,2) check (installment_amount is null or installment_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  unit text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity numeric not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  reason text
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function private.set_updated_at();

create index if not exists products_category_idx on public.products (category);
create index if not exists products_in_stock_category_idx
  on public.products (category, name)
  where stock_status = 'in_stock';
create index if not exists products_use_cases_gin_idx on public.products using gin (use_cases);
create index if not exists products_metadata_gin_idx on public.products using gin (metadata);
create index if not exists products_embedding_hnsw_idx
  on public.products
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null and stock_status = 'in_stock';

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_user_created_at_idx on public.projects (user_id, created_at desc);
create index if not exists quotations_user_id_idx on public.quotations (user_id);
create index if not exists quotations_project_id_idx on public.quotations (project_id);
create index if not exists quotations_user_created_at_idx on public.quotations (user_id, created_at desc);
create index if not exists quotation_items_quotation_id_idx on public.quotation_items (quotation_id);
create index if not exists quotation_items_product_id_idx on public.quotation_items (product_id);
create index if not exists chat_messages_user_id_idx on public.chat_messages (user_id);
create index if not exists chat_messages_project_id_idx on public.chat_messages (project_id);
create index if not exists chat_messages_user_created_at_idx on public.chat_messages (user_id, created_at);

alter table public.products enable row level security;
alter table public.projects enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Public can read in-stock products" on public.products;
create policy "Public can read in-stock products"
on public.products
for select
to anon, authenticated
using (stock_status = 'in_stock');

drop policy if exists "Users can read own projects" on public.projects;
create policy "Users can read own projects"
on public.projects
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own projects" on public.projects;
create policy "Users can create own projects"
on public.projects
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own projects" on public.projects;
create policy "Users can update own projects"
on public.projects
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own projects"
on public.projects
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own quotations" on public.quotations;
create policy "Users can read own quotations"
on public.quotations
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own quotations" on public.quotations;
create policy "Users can create own quotations"
on public.quotations
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own quotations" on public.quotations;
create policy "Users can update own quotations"
on public.quotations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can delete own quotations" on public.quotations;
create policy "Users can delete own quotations"
on public.quotations
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own quotation items" on public.quotation_items;
create policy "Users can read own quotation items"
on public.quotation_items
for select
to authenticated
using (
  exists (
    select 1
    from public.quotations q
    where q.id = quotation_id
      and q.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can create own quotation items" on public.quotation_items;
create policy "Users can create own quotation items"
on public.quotation_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quotations q
    where q.id = quotation_id
      and q.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own quotation items" on public.quotation_items;
create policy "Users can update own quotation items"
on public.quotation_items
for update
to authenticated
using (
  exists (
    select 1
    from public.quotations q
    where q.id = quotation_id
      and q.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.quotations q
    where q.id = quotation_id
      and q.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own quotation items" on public.quotation_items;
create policy "Users can delete own quotation items"
on public.quotation_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.quotations q
    where q.id = quotation_id
      and q.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read own chat messages" on public.chat_messages;
create policy "Users can read own chat messages"
on public.chat_messages
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own chat messages" on public.chat_messages;
create policy "Users can create own chat messages"
on public.chat_messages
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update own chat messages" on public.chat_messages;
create policy "Users can update own chat messages"
on public.chat_messages
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can delete own chat messages" on public.chat_messages;
create policy "Users can delete own chat messages"
on public.chat_messages
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.match_products(
  query_embedding extensions.vector(1536),
  match_threshold double precision default 0.25,
  match_count integer default 5,
  category_filter text default null
)
returns table (
  id uuid,
  name text,
  category text,
  brand text,
  description text,
  unit text,
  price numeric(12,2),
  stock_status text,
  coverage_note text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    p.id,
    p.name,
    p.category,
    p.brand,
    p.description,
    p.unit,
    p.price,
    p.stock_status,
    p.coverage_note,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.products p
  where p.stock_status = 'in_stock'
    and p.embedding is not null
    and (category_filter is null or p.category = category_filter)
    and 1 - (p.embedding <=> query_embedding) >= match_threshold
  order by p.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 5), 50));
$$;

grant execute on function public.match_products(extensions.vector, double precision, integer, text)
to anon, authenticated;
