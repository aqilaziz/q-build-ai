create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  quotation_id uuid references public.quotations(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  session_id text,
  input_summary text not null,
  final_summary text,
  status text not null default 'completed'
    check (status in ('started', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  step_order int not null,
  agent_name text not null,
  role text not null,
  input text,
  output text not null,
  decision text,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (run_id, step_order)
);

create index if not exists agent_runs_user_id_idx on public.agent_runs (user_id);
create index if not exists agent_runs_quotation_id_idx on public.agent_runs (quotation_id);
create index if not exists agent_runs_project_id_idx on public.agent_runs (project_id);
create index if not exists agent_runs_user_created_at_idx on public.agent_runs (user_id, created_at desc);
create index if not exists agent_steps_run_id_idx on public.agent_steps (run_id);

alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;

drop policy if exists "Users can read own agent runs" on public.agent_runs;
create policy "Users can read own agent runs"
on public.agent_runs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own agent runs" on public.agent_runs;
create policy "Users can create own agent runs"
on public.agent_runs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own agent runs" on public.agent_runs;
create policy "Users can update own agent runs"
on public.agent_runs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own agent runs" on public.agent_runs;
create policy "Users can delete own agent runs"
on public.agent_runs
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own agent steps" on public.agent_steps;
create policy "Users can read own agent steps"
on public.agent_steps
for select
to authenticated
using (
  exists (
    select 1
    from public.agent_runs ar
    where ar.id = run_id
      and ar.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can create own agent steps" on public.agent_steps;
create policy "Users can create own agent steps"
on public.agent_steps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agent_runs ar
    where ar.id = run_id
      and ar.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update own agent steps" on public.agent_steps;
create policy "Users can update own agent steps"
on public.agent_steps
for update
to authenticated
using (
  exists (
    select 1
    from public.agent_runs ar
    where ar.id = run_id
      and ar.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.agent_runs ar
    where ar.id = run_id
      and ar.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own agent steps" on public.agent_steps;
create policy "Users can delete own agent steps"
on public.agent_steps
for delete
to authenticated
using (
  exists (
    select 1
    from public.agent_runs ar
    where ar.id = run_id
      and ar.user_id = (select auth.uid())
  )
);
