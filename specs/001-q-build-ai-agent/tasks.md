# Tasks: Q-Build AI Renovation Agent

**Input**: Design documents from `/specs/001-q-build-ai-agent/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`

**Tests**: Include focused tests for deterministic calculators and run build/lint before demo.

## Phase 1: Setup

**Purpose**: Create the app skeleton and basic developer setup.

- [x] T001 Create Next.js App Router TypeScript Tailwind project at repository root
- [x] T002 Add dependencies: `ai`, AI provider SDK, `@supabase/supabase-js`
- [x] T003 Add `.env.example` with required variables
- [x] T004 Add base README with competition problem, solution, stack, and demo script
- [x] T005 Add `.gitignore` entries for `.env*`, `.vercel`, `node_modules`, and generated build output

---

## Phase 2: Foundational Infrastructure

**Purpose**: Shared database, auth, AI, and calculator infrastructure.

- [ ] T006 Create Supabase migration for `products`, `projects`, `quotations`, `quotation_items`, and `chat_messages`
- [ ] T007 Enable Supabase `vector` extension in migration
- [ ] T008 Add RLS policies for public product read and owner-only user data access
- [ ] T009 Create `match_products` RPC for pgvector semantic search
- [ ] T010 Create Supabase clients in `lib/supabase/client.ts` and `lib/supabase/server.ts`
- [ ] T011 Implement calculators in `lib/calculators.ts`
- [ ] T012 Add calculator unit tests for waterproofing and subtotal logic
- [ ] T013 Create seeded product dataset in `supabase/seed/products.ts`
- [ ] T014 Create product embedding seed script in `scripts/seed-products.ts`

**Checkpoint**: Foundation ready; product search and calculators can be verified without UI polish.

---

## Phase 3: User Story 1 - Grounded Repair Recommendations (Priority: P1) MVP

**Goal**: User gets grounded product recommendations and deterministic material estimates from chat.

**Independent Test**: Send the roof leak prompt and verify catalog-backed recommendations plus calculator output.

- [ ] T015 [US1] Create system prompt in `lib/ai/prompts.ts`
- [ ] T016 [US1] Implement AI tools in `lib/ai/tools.ts`: `searchProducts`, `calculateWaterproofing`, `calculatePaint`, `calculateSubtotal`, `calculateInstallment`
- [ ] T017 [US1] Implement streaming `/api/chat/route.ts`
- [ ] T018 [US1] Build `components/chat-panel.tsx`
- [ ] T019 [US1] Build `components/product-recommendation-list.tsx`
- [ ] T020 [US1] Build mobile-first `app/page.tsx`
- [ ] T021 [US1] Add graceful empty/no-match/error states

**Checkpoint**: Text-only MVP demo works.

---

## Phase 4: User Story 2 - Save Quotation (Priority: P2)

**Goal**: User can save and reopen shopping recommendations.

**Independent Test**: Save a generated recommendation and reopen it from quotation history.

- [ ] T022 [US2] Add Supabase Auth login page in `app/login/page.tsx`
- [ ] T023 [US2] Implement quotation persistence helper in `lib/quotations.ts`
- [ ] T024 [US2] Add `saveQuotation` tool or server action
- [ ] T025 [US2] Build `components/quotation-preview.tsx`
- [ ] T026 [US2] Build quote history page in `app/quotes/page.tsx`
- [ ] T027 [US2] Build quote detail page in `app/quotes/[id]/page.tsx`
- [ ] T028 [US2] Verify user cannot access another user's quotation

**Checkpoint**: Business workflow demo works.

---

## Phase 5: User Story 3 - Image Diagnosis (Priority: P3)

**Goal**: User uploads a repair photo and receives a grounded recommendation flow.

**Independent Test**: Upload repair image, receive category diagnosis, then continue to product search.

- [ ] T029 [US3] Build `components/image-upload.tsx`
- [ ] T030 [US3] Extend `/api/chat/route.ts` to accept one image attachment
- [ ] T031 [US3] Add vision prompt path for leak/crack/repaint/tile/pipe classification
- [ ] T032 [US3] Add unclear-image fallback response
- [ ] T033 [US3] Validate file size and supported image types

**Checkpoint**: Innovation demo works.

---

## Phase 6: User Story 4 - Competition Demo Polish (Priority: P4)

**Goal**: Repository and deployment are ready for judging.

- [ ] T034 [US4] Add sample prompts and demo script to README
- [ ] T035 [US4] Add architecture diagram text/mermaid to README
- [ ] T036 [US4] Map implementation to judging criteria in README
- [ ] T037 [US4] Add Vercel deployment notes
- [ ] T038 [US4] Test mobile viewport manually
- [ ] T039 [US4] Run `npm run lint` and `npm run build`

---

## Dependencies & Execution Order

- Phase 1 must complete first.
- Phase 2 blocks all user stories.
- P1 is the MVP and must complete before P2/P3 polish.
- P2 and P3 can proceed after Phase 2 but should integrate with P1 output.
- P4 happens after the desired demo stories are functional.

## Parallel Opportunities

- T006-T009 database work can proceed separately from T011-T012 calculator work.
- T018-T020 UI shell can proceed after `/api/chat` contract is known.
- T026 and T027 can be implemented in parallel after quotation schema exists.
- README polish can happen while final UI is being built.
