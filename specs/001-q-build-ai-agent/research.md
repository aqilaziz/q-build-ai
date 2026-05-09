# Research: Q-Build AI Renovation Agent

## Decision 1: Next.js App Router + Vercel AI SDK

Decision: Use Next.js App Router with Vercel AI SDK for streaming chat and tool calls.

Rationale: The project needs a public Vercel deployment, fast prototype speed, server-side route handlers, and streamed AI responses. Vercel AI SDK reduces custom plumbing for tool invocation.

Alternatives considered:

- Separate backend API: more setup than needed for MVP.
- Client-only AI calls: rejected because API keys must stay server-side.

## Decision 2: Supabase Postgres + pgvector

Decision: Store products and embeddings in Supabase Postgres using `extensions.vector(1536)` and query through RPC.

Rationale: Supabase gives database, auth, RLS, and vector search in one platform. RPC is needed because PostgREST does not directly expose pgvector similarity operators cleanly.

Alternatives considered:

- In-memory JSON product search: too weak for technical judging.
- External vector DB: extra moving part and setup risk.

## Decision 3: OpenAI-Compatible Model Path

Decision: Default to OpenAI `gpt-4o-mini`-class model for tool calling and vision, and `text-embedding-3-small` for embeddings.

Rationale: This balances quality, cost, speed, tool calling, and vision support. The model choice can be abstracted behind Vercel AI SDK if switching provider is needed.

Alternatives considered:

- Larger premium model for all turns: better reasoning but higher cost and slower.
- Free-only model path: lower cost but more risk for tool/vision consistency.

## Decision 4: Deterministic Calculators

Decision: Implement calculators in TypeScript and expose them as AI tools.

Rationale: Judging rewards real agent actions. Calculators prevent numeric hallucination and make the business value visible.

Alternatives considered:

- Let the LLM calculate quantities: rejected due reliability.
- Store fixed formulas in prompt only: not enforceable.

## Decision 5: RLS-First Data Model

Decision: Enable RLS on all public tables. Products get a public read policy for in-stock rows. User-owned data uses `auth.uid()` ownership policies.

Rationale: Supabase public schema can be reachable via Data API. RLS avoids accidental data leakage and looks professional in review.

Alternatives considered:

- Service-role-only app access: simpler but hides broken security until later and is unsafe if misused.
