# Q-Build AI

Q-Build AI is a mobile-first renovation shopping agent for the QHomemart AI Agent Competition. It helps customers move from a vague home repair problem to grounded product recommendations, material quantities, cost estimates, and a saved quotation.

## Live Demo

Production URL: https://qbuilt-ai.vercel.app

Local URL:

```text
http://localhost:3000
```

Submission assets:

- [Agent architecture](docs/agent-architecture.md)
- [5-minute demo script](docs/submission-demo-script.md)
- [Production checklist](docs/production-checklist.md)
- [Vercel deployment guide](docs/vercel-deployment.md)
- [Manual QA checklist](docs/qa-manual-acceptance.md)

## Problem

Home-improvement customers often know the symptom but not the right material, quantity, or budget. A customer might say:

```text
Atap kamar saya bocor setelah hujan. Area sekitar 15 meter persegi. Saya harus beli apa?
```

Without assistance, they must translate that problem into product categories, coverage calculations, supporting tools, and a shopping list. This slows decisions and increases the support burden for store staff.

## Solution

Q-Build AI works as a repair and shopping assistant:

- diagnoses a home repair need from Indonesian text or an uploaded photo
- retrieves relevant QHomemart-style products from Supabase catalog data
- calculates material needs with deterministic tools instead of free-form model guesses
- estimates subtotal from selected catalog products
- saves the result as a quotation/shopping list for later review

The core demo is roof leak/waterproofing, with additional validated flows for paint, tile, plumbing, and wall repair.

## Architecture

```text
Browser
  -> Next.js App Router UI
  -> /api/recommendation
     -> AgentChannel message passing
     -> Intake Agent
     -> Repair Diagnosis Agent
     -> Product RAG Agent
     -> Quantity Tool Agent
     -> Quotation Agent
     -> Critic Agent
     -> Audit Agent
     -> Supabase Postgres + pgvector
     -> OpenAI-compatible model
```

Core principles:

- Product facts come from Supabase, not the LLM.
- Numeric outputs come from calculator tools.
- Secret keys stay server-side.
- Public catalog rows are readable, user quotations are protected by RLS.
- Demo must work well on mobile.

## Multi-Agent Workflow Trace

The demo exposes a professional audit trail called **Agent Workflow Trace** in the chat workspace and in saved quotation detail/PDF output. `Recommendation` and `SavedQuote` can carry an optional `agentTrace`, so API-backed quotes and local fallback quotes can use the same UI without breaking older records.

The detailed handoff contract is documented in [docs/agent-architecture.md](docs/agent-architecture.md). The current runtime uses an explicit `AgentChannel` inbox/outbox so each agent exchanges typed messages such as `intake.result`, `diagnosis.result`, `retrieval.result`, `quantity.result`, `quotation.draft`, and `critic.result`. Intake, Repair Diagnosis, and Critic use separate structured model calls; retrieval, calculation, quotation composition, and audit persistence are independent tool-backed stages with deterministic fallbacks.

| Trace step | Demo agent | Responsibility |
| --- | --- | --- |
| Problem Intake | Intake Agent | Normalizes the customer problem, area, and optional photo context. |
| Diagnosis | Repair Diagnosis Agent | Classifies the repair case, such as roof leak/waterproofing or repainting. |
| Catalog Retrieval | Product RAG Agent | Selects grounded QHomemart-style catalog products for the problem. |
| Material Calculator | Quantity Tool Agent | Computes deterministic material needs and package round-up. |
| Quotation | Quotation Agent | Builds the shopping list, line totals, subtotal, and customer-facing rationale. |
| Validation/Critic | Critic Agent | Checks product completeness, quantity math, and subtotal consistency. |
| Trace Logger | Audit Agent | Stores the trace with the quotation for review and PDF export. |

## Demo Scenarios

Use these prompts to verify the main judging flows:

```text
Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Preferensi standar. Saya harus beli apa dan kira-kira habis berapa?
```

```text
Pipa wastafel bocor setengah meter, standar.
```

```text
Mau cat dinding 12 m2 warna krem standar.
```

```text
Dinding rembes dan retak rambut, luas sekitar 10 m2. Preferensi standar.
```

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel AI SDK
- OpenAI model and embeddings
- Supabase Auth, Postgres, RLS, and pgvector
- Vercel deployment

## Repository Map

```text
app/                         Next.js routes and UI
specs/001-q-build-ai-agent/  Local feature specs and quickstart
docs/                        QA and demo acceptance checklists
.github/workflows/           CI workflow
```

Primary source-of-truth specs:

1. `specs/001-q-build-ai-agent/spec.md`
2. `specs/001-q-build-ai-agent/plan.md`
3. `specs/001-q-build-ai-agent/data-model.md`
4. `specs/001-q-build-ai-agent/tasks.md`
5. `specs/001-q-build-ai-agent/quickstart.md`

## Local Setup

Prerequisites:

- Node.js 20+
- npm
- Supabase project for full AI/RAG and quotation features
- OpenAI API key for chat and embeddings

Install and run:

```powershell
npm ci
npm run dev
```

Open:

```text
http://localhost:3000
```

Run checks:

```powershell
npm run lint
npm run build
```

## Environment Variables

Create `.env.local` from `.env.example`.

```env
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=gemini/gemini-2.5-flash
AI_FALLBACK_MODELS=gpt-4o-mini,gpt-4.1-mini
AI_ATTEMPT_TIMEOUT_MS=6000
AI_EMBEDDING_MODEL=text-embedding-3-small
SUPABASE_PROJECT_REF=ksemrhvevevyjxgdsznw
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAILS=admin@gmail.com
```

Variable usage:

- `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`: OpenAI-compatible chat provider configuration. Current Sumopod model is `gemini/gemini-2.5-flash`.
- `AI_FALLBACK_MODELS`: comma-separated chat model fallback list. The recommendation API tries the primary model first, then these fallback models before using local deterministic parsing.
- `AI_ATTEMPT_TIMEOUT_MS`: timeout per chat model attempt before trying the next model or local parser.
- `OPENAI_API_KEY`: optional fallback for standard OpenAI-compatible chat and embedding calls when `AI_API_KEY` is not set.
- `AI_EMBEDDING_API_KEY` / `AI_EMBEDDING_MODEL` / `AI_EMBEDDING_BASE_URL`: optional override for product embedding generation and runtime semantic search. For Sumopod, set `AI_EMBEDDING_MODEL=text-embedding-3-small`; `AI_EMBEDDING_API_KEY` and `AI_EMBEDDING_BASE_URL` can be omitted so they inherit `AI_API_KEY` and `AI_BASE_URL`.
- `SUPABASE_PROJECT_REF`: hosted Supabase project ref. Defaults to `ksemrhvevevyjxgdsznw` in scripts when URL is omitted.
- `NEXT_PUBLIC_SUPABASE_URL`: browser-safe Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser-safe Supabase anon key for public catalog reads and authenticated user calls.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for privileged seed/embedding jobs. Never expose this in client components.
- `ADMIN_EMAILS`: comma-separated Supabase Auth emails that can access `/admin`.

Optional provider key if Gemini is used later:

```env
GOOGLE_GENERATIVE_AI_API_KEY=
```

## Supabase Migration and Seed

Expected database capabilities:

- enable `vector` extension
- create product catalog table with embedding column
- create projects, quotations, quotation items, and chat message tables
- enable RLS on public tables
- allow public read only for in-stock products
- restrict quotation/project/history rows to `auth.uid()`
- create `match_products` RPC for pgvector product search

The anon key and service role key are API keys, not database owner credentials. They can verify the REST API and seed data after tables exist, but they cannot apply DDL migrations such as `create extension`, `create table`, RLS policies, or indexes.

Hosted production project:

```text
ksemrhvevevyjxgdsznw
```

Apply migrations to the hosted project with Supabase CLI from the repository root:

```powershell
$env:SUPABASE_ACCESS_TOKEN="<supabase-personal-access-token>"
$env:SUPABASE_DB_PASSWORD="<database-password>"
supabase link --project-ref ksemrhvevevyjxgdsznw --password $env:SUPABASE_DB_PASSWORD
supabase db push --password $env:SUPABASE_DB_PASSWORD
supabase migration list --password $env:SUPABASE_DB_PASSWORD
```

`supabase db push` can also include `--include-seed` because `supabase/config.toml` points to `supabase/seed.sql`. For production, the safer repeatable data path is to apply schema first, then run the service-role seed script below.

Manual Dashboard alternative:

1. Open Supabase Dashboard for project `ksemrhvevevyjxgdsznw`.
2. Go to SQL Editor.
3. Run `supabase/migrations/20260509193646_init_q_build_ai_schema.sql`.
4. Run `supabase/seed.sql`, or use the service-role seed command below.

Seed requirements for the competition demo:

- at least 20 QHomemart-style products
- categories include waterproofing, paint, pipe, tile, cement, and tools
- embeddings generated with one consistent model, planned as `text-embedding-3-small`
- waterproofing search for `atap bocor 15 meter` returns anti-bocor, membrane/fiber, and roller/brush options

Use the service-role scripts from the repository root after the schema exists:

```powershell
npm run supabase:verify -- --allow-missing-embeddings
npm run seed:products
npm run embeddings:products
npm run supabase:verify
```

`npm run embeddings:products` generates pgvector embeddings for in-stock products that do not have one yet. Use `npm run embeddings:products -- --force` to regenerate all in-stock product embeddings with the currently configured embedding model. Production runtime also needs `AI_EMBEDDING_MODEL=text-embedding-3-small`, otherwise the app will fall back to keyword search.

The final `npm run supabase:verify` is strict: it reports total products, in-stock products, in-stock products with embeddings, and fails if semantic RAG is not ready because any in-stock product is missing an embedding. The `--allow-missing-embeddings` mode is only for early schema/connectivity checks before seed or embedding generation.

The verify, seed, and embedding scripts are non-DDL. They use `SUPABASE_SERVICE_ROLE_KEY` plus either `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`, or derive the hosted URL from `SUPABASE_PROJECT_REF`.

## Demo Script

Target duration: under 2 minutes.

1. Open the Vercel URL or local app on a phone-size viewport.
2. Sign in or use the prepared demo session.
3. Send:

   ```text
   Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Saya harus beli apa dan kira-kira habis berapa?
   ```

4. Show that the assistant classifies the issue as waterproofing/roof leak.
5. Show catalog-grounded products: waterproofing, membrane/fiber reinforcement, and roller/brush.
6. Show calculator output for 15 m2 waterproofing: 2 coats x 1 kg/m2/coat = 30 kg.
7. Show subtotal based on product prices, not guessed text.
8. Point to the **Agent Workflow Trace** panel and explain the 7-step multi-agent handoff.
9. Save the recommendation as a quotation.
10. Open quote history and reopen the saved quotation.
11. Export PDF or print preview and show the Agent Workflow Trace summary in the quotation document.
12. Explain business value: faster customer decision, larger relevant basket, auditable recommendations, and less repetitive staff triage.

## Manual QA

Use [docs/qa-manual-acceptance.md](docs/qa-manual-acceptance.md) before demo submission. It covers:

- atap bocor 15 m2 recommendation flow
- save quotation flow
- quote history and reopen flow

## Sample Prompts

Primary:

```text
Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Saya harus beli apa dan kira-kira habis berapa?
```

Repainting:

```text
Dinding kamar 3 x 4 meter mulai kusam. Saya ingin cat ulang dua lapis, produk apa yang cocok?
```

Clarification test:

```text
Tembok rumah saya rembes. Saya belum tahu luasnya.
```

Image diagnosis:

```text
Saya upload foto plafon bernoda air. Tolong cek kemungkinan masalah dan daftar belanja yang perlu disiapkan.
```

Unavailable product guardrail:

```text
Saya butuh bahan khusus yang tidak ada di katalog. Apakah ada rekomendasi?
```

## Judging Criteria Mapping

| Criteria | How Q-Build AI demonstrates it |
| --- | --- |
| Kualitas Reasoning Agent | Intake, Diagnosis, and Critic use structured model outputs with deterministic fallback; material math and subtotal are tool-calculated. |
| Kolaborasi Antar Agent | `AgentChannel` records typed handoffs across Intake, Diagnosis, Product RAG, Quantity, Quotation, Critic, and Audit agents. |
| Dampak Dunia Nyata | Converts home-repair symptoms into grounded product baskets, quantities, subtotal, and saved quotations for store workflow. |
| Kejelasan Arsitektur | README, specs, and `docs/agent-architecture.md` document the system, message contracts, and database design. |
| Reproducibility | Supabase migrations, seed/embedding scripts, `.env.example`, smoke E2E tests, and production checklist are included. |

## Acceptance Targets

- First useful assistant response appears within 5 seconds on a normal connection.
- Primary roof leak demo completes in under 2 minutes.
- Recommendations are grounded in seeded catalog products.
- 15 m2 waterproofing returns 30 kg before packaging round-up.
- Authenticated user can save and reopen a quotation.
- User-owned quotation data is not visible to other users.
