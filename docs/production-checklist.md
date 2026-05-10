# Production Submission Checklist

Use this before submitting the GitHub repo and demo video.

## Deployment

- [ ] Production URL opens on desktop and mobile.
- [ ] Production env vars are set:
  - `AI_BASE_URL`
  - `AI_API_KEY`
  - `AI_MODEL`
  - `AI_EMBEDDING_MODEL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_EMAILS`
- [ ] `/catalog` loads product data.
- [ ] `/admin` loads and rejects non-admin users.
- [ ] Browser console has no blocking runtime error.

## Database

- [ ] `npm run supabase:verify` passes.
- [ ] In-stock products have embeddings.
- [ ] `match_products` RPC works.
- [ ] RLS protects quotation and agent trace data.

## Demo Scenarios

- [ ] Atap bocor 15 m2 returns waterproofing recommendation.
- [ ] Pipa bocor setengah meter returns plumbing recommendation and `0.5 m`.
- [ ] Cat dinding 12 m2 warna krem does not ask color again.
- [ ] Dinding rembes/retak 10 m2 returns wall repair recommendation.
- [ ] Missing area asks one focused clarification.
- [ ] Unsupported product request does not invent catalog items.

## Agent Evidence

- [ ] Chat view shows **Agent Workflow Trace**.
- [ ] Chat view shows **Agent message passing**.
- [ ] Saved quotation detail shows the trace.
- [ ] Trace includes at least 7 steps and typed message handoffs.

## Submission Assets

- [ ] README has the production URL.
- [ ] README maps the implementation to judging criteria.
- [ ] Demo video follows `docs/submission-demo-script.md`.
- [ ] GitHub branch is pushed and public/reviewer-accessible.
