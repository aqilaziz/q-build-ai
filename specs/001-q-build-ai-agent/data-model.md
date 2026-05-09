# Data Model: Q-Build AI Renovation Agent

## Product

Represents a QHomemart-style catalog item available for recommendation.

Fields:

- `id uuid primary key`
- `name text not null`
- `category text not null`
- `brand text`
- `description text not null`
- `use_cases text[] not null default '{}'`
- `unit text not null`
- `price numeric(12,2) not null`
- `stock_status text not null default 'in_stock'`
- `coverage_note text`
- `metadata jsonb not null default '{}'`
- `embedding extensions.vector(1536)`
- `created_at timestamptz not null default now()`

Validation:

- `price >= 0`
- `stock_status in ('in_stock', 'out_of_stock')`
- `embedding` generated with the same embedding model for all rows

RLS:

- Public read for rows where `stock_status = 'in_stock'`.
- No client-side insert/update/delete policy.

## Project

Represents a user's repair or renovation context.

Fields:

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `title text not null`
- `problem_summary text not null`
- `category text`
- `area_m2 numeric`
- `status text not null default 'draft'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS:

- Authenticated users can select, insert, update, and delete only their own rows.

## Quotation

Represents a saved shopping recommendation.

Fields:

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `project_id uuid references projects(id)`
- `title text not null`
- `summary text not null`
- `subtotal numeric(12,2) not null default 0`
- `installment_months int`
- `installment_amount numeric(12,2)`
- `created_at timestamptz not null default now()`

RLS:

- Authenticated users can select, insert, update, and delete only their own rows.

## Quotation Item

Represents itemized products inside a quotation.

Fields:

- `id uuid primary key`
- `quotation_id uuid not null references quotations(id) on delete cascade`
- `product_id uuid references products(id)`
- `name text not null`
- `unit text not null`
- `unit_price numeric(12,2) not null`
- `quantity numeric not null`
- `line_total numeric(12,2) not null`
- `reason text`

RLS:

- Access allowed only when parent quotation belongs to `auth.uid()`.

## Chat Message

Represents optional chat history for demo continuity.

Fields:

- `id uuid primary key`
- `user_id uuid not null references auth.users(id)`
- `project_id uuid references projects(id)`
- `role text not null`
- `content text not null`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

RLS:

- Authenticated users can access only their own messages.

## RPC: `match_products`

Purpose: semantic product search.

Input:

- `query_embedding extensions.vector(1536)`
- `match_threshold float`
- `match_count int`
- `category_filter text default null`

Output:

- `id`
- `name`
- `category`
- `brand`
- `description`
- `unit`
- `price`
- `stock_status`
- `coverage_note`
- `similarity`

Rules:

- Only return `stock_status = 'in_stock'`.
- Filter by category when provided.
- Order by cosine distance directly.
