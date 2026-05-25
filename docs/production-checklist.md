# Production Submission Checklist

Verified for submission on `2026-05-25 12:51 +07:00`.

Latest automated checks:

```text
Production URL: https://qbuilt-ai.vercel.app
Git SHA: 727a9f6
npm run supabase:verify: PASS
npm run test:unit: PASS
npm run test:e2e: PASS (10/10)
$env:EVAL_BASE_URL="https://qbuilt-ai.vercel.app"; npm run eval:agents: 7/7 PASS
Production routes /, /catalog, /admin: HTTP 200
Production catalog product check: PASS
GitHub repository public/readable: PASS
```

## Deployment

- [x] Production URL opens: `https://qbuilt-ai.vercel.app`.
- [x] Production env vars are set and validated through live API/database checks:
  - `AI_BASE_URL`
  - `AI_API_KEY`
  - `AI_MODEL`
  - `AI_EMBEDDING_MODEL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_EMAILS`
- [x] `/catalog` loads product data.
- [x] `/admin` loads the Supabase admin auth gate.
- [ ] Final browser-console sweep during video recording.

## Database

- [x] `npm run supabase:verify` passes.
- [x] Products table reachable: 24 rows.
- [x] In-stock products have embeddings: 24/24.
- [x] `match_products` RPC works.
- [x] Service role connection verified.
- [x] RLS policies are included in Supabase migrations for quotations and agent trace tables.

## Automated Tests

- [x] `npm run test:unit` passes: calculator and Indonesian parser coverage.
- [x] `npm run test:e2e` passes: smoke UI, catalog, quote detail, admin, upload, and chat flows.
- [x] `npm run eval:agents` passes locally and against production.

## Demo Scenarios

- [x] Atap bocor 15 m2 returns waterproofing recommendation.
- [x] Pipa bocor setengah meter returns plumbing recommendation and `0.5 m`.
- [x] Pipa bocor seperempat meter returns plumbing recommendation and `0.25 m`.
- [x] Cat dinding 12 m2 warna krem does not ask color again.
- [x] Dinding rembes/retak 10 m2 returns wall repair recommendation.
- [x] Missing area asks one focused clarification.
- [x] Unsupported product request does not invent catalog items.
- [x] `$env:EVAL_BASE_URL="https://qbuilt-ai.vercel.app"; npm run eval:agents` passes: 7/7.

## Agent Evidence

- [x] Chat view shows **Agent Workflow Trace**.
- [x] Chat view shows **Agent message passing**.
- [x] Saved quotation detail shows the trace.
- [x] Trace includes at least 7 steps and typed message handoffs.

## Submission Assets

- [x] README has the production URL.
- [x] README maps the implementation to judging criteria.
- [x] `docs/agent-evaluation.md` latest run is filled in.
- [ ] Demo video follows `docs/submission-demo-script.md`.
- [x] GitHub branch is pushed to `origin/001-q-build-ai-agent`.
