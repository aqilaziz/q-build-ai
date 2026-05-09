# Q-Build AI Constitution

## Core Principles

### I. Grounded AI Recommendations
The assistant must not behave as a generic chatbot. Every product recommendation must be grounded in catalog data stored in Supabase or clearly marked as unavailable. The LLM may explain and orchestrate, but product names, prices, stock status, and coverage notes come from the database.

### II. Tool-Based Calculations
Material quantity, subtotal, and installment estimates must be computed by deterministic tools. The assistant must not free-write numeric estimates when a calculator tool applies. Tool results must be visible in the response or quotation breakdown.

### III. Mobile-First Demo Quality
The primary demo must work on a phone. The first screen must be the usable chat/agent experience, not a landing page. The journey from problem input to saved quotation should complete in under two minutes.

### IV. Supabase Security by Default
Every table in the public schema must have Row Level Security enabled. Public product catalog reads are allowed only for intended catalog rows. User-owned data such as projects, chat messages, images, and quotations must be restricted to `auth.uid()`. Service role keys must never be exposed to client code.

### V. Narrow MVP, Strong Execution
The MVP focuses on home repair shopping assistance for roof leaks/waterproofing and wall repainting, with supporting products for plumbing, tiles, cement, and tools. No checkout, payment gateway, full marketplace, or contractor marketplace is required for the competition MVP.

## Technical Constraints

- Framework: Next.js App Router with TypeScript.
- Hosting: Vercel.
- Database/Auth/Vector store: Supabase Postgres with pgvector.
- AI orchestration: Vercel AI SDK.
- AI model: a tool-capable, vision-capable model for the demo path.
- Embeddings: one consistent embedding model for all product vectors.
- Secrets: AI API key and Supabase service role key only in server-side code or Vercel environment variables.

## Development Workflow

- Specs in `specs/` are the source of truth before implementation.
- Implement user stories in priority order: P1 text agent, P2 quotation saving, P3 image diagnosis, P4 business/demo polish.
- Each implementation slice must have a simple verification path.
- README must map the final product to QHomemart competition criteria: innovation, usefulness, technical quality, and demo/presentation.

## Governance

This constitution overrides ad hoc chat instructions for product scope and quality gates. Changes require updating the affected spec, plan, data model, and tasks. Scope expansion is rejected unless it directly improves the competition demo.

**Version**: 1.0.0 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-05-09
