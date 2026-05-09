# Implementation Plan: Q-Build AI Renovation Agent

**Branch**: `001-q-build-ai-agent` | **Date**: 2026-05-09 | **Spec**: `specs/001-q-build-ai-agent/spec.md`
**Input**: Feature specification from `/specs/001-q-build-ai-agent/spec.md`

## Summary

Build a mobile-first Next.js app where an AI agent helps QHomemart customers diagnose home repair needs, retrieve grounded product recommendations from Supabase pgvector, run deterministic material calculators, and save shopping quotations. The MVP focuses on roof leak/waterproofing and wall repainting demo scenarios.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+
**Primary Dependencies**: Next.js App Router, React, Tailwind CSS, Vercel AI SDK, `@supabase/supabase-js`, OpenAI SDK or Vercel AI provider package
**Storage**: Supabase Postgres with `vector` extension
**Testing**: Next.js lint/build, focused unit tests for calculators, manual quickstart demo
**Target Platform**: Vercel-hosted web app, mobile and desktop browsers
**Project Type**: Web application with server-side API routes
**Performance Goals**: Stream first useful text within 5 seconds; complete primary demo flow under 2 minutes
**Constraints**: Server-only API keys; RLS on public tables; product recommendations grounded in catalog data
**Scale/Scope**: Competition MVP with 20-40 seeded demo products and a small number of demo users

## Constitution Check

*GATE: Must pass before implementation.*

- Grounded recommendations: PASS. Product data comes from Supabase and RAG tool output.
- Tool-based calculations: PASS. Material and cost tools are required before assistant numeric output.
- Mobile-first demo: PASS. App entry point is the agent experience.
- Supabase security: PASS. RLS and owner policies are planned for all user data.
- Narrow MVP: PASS. Scope excludes checkout/payment and focuses on repair shopping assistance.

## Project Structure

### Documentation (this feature)

```text
specs/001-q-build-ai-agent/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── page.tsx
├── quotes/
│   ├── page.tsx
│   └── [id]/page.tsx
├── login/page.tsx
└── api/chat/route.ts

components/
├── chat-panel.tsx
├── image-upload.tsx
├── product-recommendation-list.tsx
├── quotation-preview.tsx
└── quote-history.tsx

lib/
├── ai/
│   ├── prompts.ts
│   └── tools.ts
├── calculators.ts
├── products.ts
└── supabase/
    ├── client.ts
    ├── server.ts
    └── types.ts

supabase/
├── migrations/
└── seed/

scripts/
└── seed-products.ts
```

**Structure Decision**: Single Next.js app at repository root. Server routes handle AI calls and privileged database operations. Browser components use public Supabase config only.

## Complexity Tracking

No constitution violations.
