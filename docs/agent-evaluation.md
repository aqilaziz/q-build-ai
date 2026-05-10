# Agent Evaluation

This file defines a small repeatable evaluation for the competition demo. It checks whether the production agent handles the core Indonesian renovation prompts and whether the visible multi-agent trace is present.

Run against local development:

```powershell
npm run eval:agents
```

Run against production:

```powershell
$env:EVAL_BASE_URL="https://qbuilt-ai.vercel.app"; npm run eval:agents
```

## Coverage

| Case | Prompt focus | Expected result |
| --- | --- | --- |
| `roof-waterproofing` | Atap bocor 15 m2 | `recommendation`, `intent=waterproofing`, `areaM2=15`, at least 7 trace steps |
| `pipe-half-meter` | Pipa bocor setengah meter | `recommendation`, `intent=plumbing`, `lengthM=0.5`, at least 7 trace steps |
| `pipe-quarter-meter` | Pipa bocor seperempat meter | `recommendation`, `intent=plumbing`, `lengthM=0.25`, at least 7 trace steps |
| `paint-krem` | Cat dinding warna krem | `recommendation`, `intent=paint`, `areaM2=12`, `color=krem`, at least 7 trace steps |
| `wall-repair` | Dinding rembes dan retak | `recommendation`, `intent=wall_repair`, `areaM2=10`, at least 7 trace steps |
| `clarify-missing-area` | Atap bocor tanpa luas | `clarification`, asks for area |
| `unsupported-product` | Kipas angin | `unavailable`, does not invent catalog items |

## Latest Verified Run

```text
Date: 2026-05-10 13:19 +07:00
Base URL: https://qbuilt-ai.vercel.app
Git SHA: ca97521
Result: 7/7 passed
Average latency: 9912 ms
Notes: Production API returned correct intent/fields for five recommendation scenarios, including setengah meter = 0.5 and seperempat meter = 0.25, plus one clarification scenario and one unsupported catalog scenario. Recommendation cases included at least 7 agent trace steps.
```
