# Q-Build AI Submission Demo Script

Target duration: 5 minutes.

## 0:00-0:40 - Business Problem

Open with the customer pain:

> Pelanggan toko bahan bangunan sering datang dengan gejala, bukan daftar material. Contoh: "atap kamar bocor 15 meter persegi" atau "pipa wastafel bocor setengah meter". Mereka butuh diagnosis, produk, quantity, dan estimasi biaya.

Explain impact:

- Faster product decisions.
- More complete basket: main material, support material, and tools.
- Less repetitive triage for store staff.
- Quotation output can continue into sales workflow.

## 0:40-2:00 - Live Customer Demo

Use the main prompt:

```text
Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Preferensi standar. Saya harus beli apa dan kira-kira habis berapa?
```

Show:

- The assistant classifies the problem as waterproofing.
- Product recommendations come from Supabase catalog.
- Quantity is deterministic: `15 m2 x 2 lapis x 1 kg/m2/lapis = 30 kg`.
- Basket includes waterproofing material, reinforcement/sealant, and application tool.
- Subtotal comes from catalog unit prices.

## 2:00-3:10 - Agent Collaboration

Point to **Agent Workflow Trace** and **Agent message passing**.

Explain the typed handoff:

```text
Customer -> Intake Agent                  customer.request
Intake Agent -> Repair Diagnosis Agent    intake.result
Repair Diagnosis Agent -> Product RAG     diagnosis.result
Product RAG Agent -> Quantity Tool Agent  retrieval.result
Quantity Tool Agent -> Quotation Agent    quantity.result
Quotation Agent -> Critic Agent           quotation.draft
Critic Agent -> Audit Agent               critic.result
```

Judging point:

> This is not just one long prompt. Each stage has a clear responsibility, typed message contract, and auditable output.

## 3:10-4:00 - Edge Case Demos

Run fast examples:

```text
Pipa wastafel bocor setengah meter, standar.
```

Expected:

- `setengah meter` is normalized to `0.5 m`.
- Intent is `plumbing`.
- The basket includes pipe, glue, seal tape, and fitting if available.

```text
Mau cat dinding 12 m2 warna krem standar.
```

Expected:

- `krem` is recognized as a color.
- The assistant does not ask the color again.

```text
Dinding rembes dan retak rambut, luas sekitar 10 m2. Preferensi standar.
```

Expected:

- Intent is `wall_repair`, not generic paint.
- Basket includes putty/skim coat, finishing support, and tools.

## 4:00-4:40 - Quotation Workflow

Click **Simpan quotation**, then open the saved quote detail.

Show:

- Product line items.
- Quantity and subtotal.
- Agent Workflow Trace in the quotation document.
- Export PDF or print preview.

## 4:40-5:00 - Technical Summary

Close with:

- Next.js App Router and TypeScript.
- OpenAI-compatible AI provider.
- Supabase Postgres, RLS, and pgvector.
- Deterministic calculators for material math.
- Explicit `AgentChannel` message passing.
- E2E smoke tests and Supabase verification.
