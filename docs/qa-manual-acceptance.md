# QA Manual Acceptance Checklist

Use this checklist before recording or presenting the Q-Build AI demo. Record pass/fail notes with the build SHA, browser, viewport, and Supabase project used.

## Test Setup

- [ ] App runs locally or on the target Vercel deployment.
- [ ] `.env.local` or Vercel env vars are configured.
- [ ] Supabase migrations are applied.
- [ ] Product seed includes waterproofing, membrane/fiber, roller/brush, paint, pipe, tile, cement, and tools.
- [ ] Demo user can sign in.
- [ ] Browser viewport is tested at mobile width, for example 390 x 844.

## Scenario 1: Atap Bocor 15 m2

Prompt:

```text
Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Saya harus beli apa dan kira-kira habis berapa?
```

Expected result:

- [ ] Assistant classifies the issue as roof leak/waterproofing.
- [ ] Assistant does not ask unnecessary clarification because area is provided.
- [ ] Product recommendations come from Supabase catalog data.
- [ ] Recommended basket includes waterproofing material.
- [ ] Recommended basket includes membrane/fiber or crack reinforcement when catalog data has it.
- [ ] Recommended basket includes roller/brush or relevant application tool when catalog data has it.
- [ ] Calculator output uses deterministic formula: `15 m2 x 2 coats x 1 kg/m2/coat = 30 kg`.
- [ ] Packaging quantity is rounded up to purchasable units.
- [ ] Subtotal is calculated from product unit prices and quantities.
- [ ] Assistant states when a relevant product is not found instead of inventing names.
- [ ] Mobile layout remains readable with no overlapping controls or text.

Pass notes:

```text
Result:
Products shown:
Calculated kg:
Subtotal:
Issues:
```

## Scenario 2: Save Quotation

Starting point: complete Scenario 1 while signed in.

Expected result:

- [ ] UI offers to save recommendation as a quotation/shopping list.
- [ ] Save action succeeds without exposing service role keys in browser-visible code.
- [ ] Saved quotation includes project title.
- [ ] Saved quotation includes problem summary.
- [ ] Saved quotation includes product names, quantities, unit prices, and line totals.
- [ ] Saved quotation includes subtotal.
- [ ] Saved quotation includes created date.
- [ ] If installment is shown, amount is calculated by tool output.
- [ ] User sees a clear success state or can immediately open the saved quotation.

Pass notes:

```text
Quotation title:
Quotation ID or URL:
Saved subtotal:
Issues:
```

## Scenario 3: Quote History

Starting point: at least one quotation exists for the signed-in demo user.

Expected result:

- [ ] User can open quotation history.
- [ ] Latest saved quotation appears in history.
- [ ] History item shows enough context to recognize the roof leak project.
- [ ] User can reopen quotation detail.
- [ ] Detail view matches the saved products, quantities, and subtotal.
- [ ] User can copy or export the quotation summary if the feature is present.
- [ ] Signing in as another user does not show the first user's quotation.
- [ ] Empty history state is understandable when no quotations exist.

Pass notes:

```text
History URL:
Reopened quotation:
Access-control check:
Issues:
```

## Regression Checks

- [ ] Prompt with missing area asks for dimensions instead of guessing.
- [ ] Prompt for wall repainting uses paint calculation rather than waterproofing calculation.
- [ ] Unclear uploaded image asks for text details.
- [ ] Out-of-stock or irrelevant products are not recommended.
- [ ] Lint passes.
- [ ] Build passes.
