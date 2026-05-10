# Q-Build AI Agent Architecture

Q-Build AI uses a staged multi-agent workflow. Each agent owns one responsibility, reads from an explicit inbox, writes to an outbox, and passes auditable messages through an `AgentChannel`.

## Agent Handoff

| Order | Agent | Execution | Input | Output |
| --- | --- | --- | --- | --- |
| 1 | Intake Agent | LLM structured output with deterministic fallback | Recent chat and optional image | Intent, area, budget preference, missing fields, confidence |
| 2 | Repair Diagnosis Agent | Separate LLM structured output with deterministic fallback | Intake JSON and chat transcript | Diagnosis summary, category decision, confidence |
| 3 | Product RAG Agent | Supabase pgvector `match_products`, with keyword fallback | Diagnosis category and retrieval query | Catalog-grounded product candidates |
| 4 | Quantity Tool Agent | Deterministic calculator | Area and category rules | Required material quantity and packaging round-up |
| 5 | Quotation Agent | Deterministic composer | Selected products, unit prices, quantities | Line items, subtotal, customer-facing rationale |
| 6 | Critic Agent | Separate LLM structured output with deterministic fallback | Full quotation draft and calculator output | Validation result, issues, decision, confidence |
| 7 | Audit Agent | Database persistence | All prior steps | Agent run and ordered agent steps |

## Communication Contract

The agents communicate through explicit messages, not hidden prompt state. Each message has:

- `from`: sender agent
- `to`: recipient agent
- `type`: message contract name, such as `intake.result` or `quotation.draft`
- `summary`: human-readable handoff summary
- `payload`: structured data for the recipient

The current message path is:

```text
Customer -> Intake Agent                  customer.request
Intake Agent -> Repair Diagnosis Agent    intake.result
Repair Diagnosis Agent -> Product RAG     diagnosis.result
Product RAG Agent -> Quantity Tool Agent  retrieval.result
Quantity Tool Agent -> Quotation Agent    quantity.result
Quotation Agent -> Critic Agent           quotation.draft
Critic Agent -> Audit Agent               critic.result
```

The agent trace UI displays this message passing log, and the audit payload stores it in trace metadata.

- `Intake Agent` returns an `Intake` object with `intent`, `areaM2`, preferences, missing fields, and confidence.
- `Repair Diagnosis Agent` consumes that object and returns a diagnosis decision without selecting products.
- `Product RAG Agent` only returns products found in Supabase catalog data.
- `Quantity Tool Agent` returns formula-based material calculations.
- `Critic Agent` checks the complete draft and records whether the result can be shown or saved.
- `Audit Agent` stores the workflow in `agent_runs` and `agent_steps` when a quotation is saved.

## Failure Handling

The demo is designed to keep running during live judging:

- If the LLM intake fails, deterministic keyword intake handles common roof leak, paint, and tile scenarios.
- If semantic search is unavailable, keyword search keeps recommendations catalog-grounded.
- If diagnosis or critic calls fail, deterministic fallback steps are still logged with `execution = deterministic_fallback`.
- If the user is not logged in, quotation saving falls back to local demo persistence while the API path remains available for authenticated Supabase users.

## Why This Fits the Competition

This architecture emphasizes agent reasoning, structured handoff, measurable outputs, and reproducibility:

- Reasoning is visible in the agent trace rather than hidden in one prompt.
- Retrieval and math are tool-backed, reducing hallucination risk.
- The final output is business-ready: a product basket, quantities, subtotal, and quotation trace.
