# Feature Specification: Q-Build AI Renovation Agent

**Feature Branch**: `001-q-build-ai-agent`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "Build Q-Build AI, an AI renovation and shopping assistant for QHomemart competition, deployed with GitHub, Vercel, and Supabase."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get Grounded Repair Recommendations (Priority: P1)

A customer describes a home repair problem in Indonesian, such as a leaking roof or wall repainting need. The assistant diagnoses the likely category, searches relevant QHomemart-style catalog products, calculates required material quantity, and returns a shopping recommendation with estimated total.

**Why this priority**: This is the core "real AI agent solves real problem" demo. Without this, the product is only a chatbot.

**Independent Test**: Send "Atap kamar saya bocor, luas sekitar 15 meter persegi. Saya harus beli apa?" and verify the assistant recommends waterproofing products from catalog data, calculates quantity, and shows subtotal.

**Acceptance Scenarios**:

1. **Given** seeded waterproofing products exist, **When** user asks about a 15 m2 roof leak, **Then** assistant recommends relevant in-stock waterproofing products and supporting tools.
2. **Given** the user provides an area, **When** assistant needs material quantity, **Then** it uses a calculator tool and returns the computed quantity.
3. **Given** no catalog product matches the request, **When** assistant answers, **Then** it asks for clarification or says no matching product is available instead of inventing products.

---

### User Story 2 - Save a Quotation / Shopping List (Priority: P2)

A logged-in user can save the agent's recommendation as a quotation that contains the problem summary, selected products, quantities, item totals, subtotal, and optional installment estimate.

**Why this priority**: It turns advice into a business workflow that QHomemart could use to increase conversion and reduce staff workload.

**Independent Test**: Complete the roof leak recommendation, click save, then reopen the saved quotation from the history page.

**Acceptance Scenarios**:

1. **Given** a user is authenticated and has a recommendation, **When** they save it, **Then** a quotation is stored with itemized products and subtotal.
2. **Given** a quotation belongs to another user, **When** current user tries to access it, **Then** access is denied by data policy.
3. **Given** total exceeds a configured threshold, **When** installment calculation is requested, **Then** assistant shows monthly estimate using a deterministic tool.

---

### User Story 3 - Diagnose From Photo (Priority: P3)

A customer uploads a photo of a visible home issue. The assistant identifies the likely issue category and uses that diagnosis to drive the same catalog search and calculation flow.

**Why this priority**: This is the innovation hook for the competition: multimodal diagnosis plus action tools.

**Independent Test**: Upload a photo of a wall crack or leaking ceiling, then verify the assistant classifies the issue and recommends relevant products from the catalog.

**Acceptance Scenarios**:

1. **Given** user uploads a clear repair photo, **When** assistant analyzes it, **Then** it identifies a likely category and asks for dimensions if missing.
2. **Given** image is unclear, **When** assistant responds, **Then** it asks for text details instead of making a confident diagnosis.

---

### User Story 4 - Present a Competition-Ready Demo (Priority: P4)

The project has a polished README, architecture explanation, demo script, and public Vercel deployment that works on mobile.

**Why this priority**: Presentation is 20% of judging and the README is likely to be inspected.

**Independent Test**: Open deployed URL on phone, run the demo prompt, save a quotation, and follow README setup steps.

**Acceptance Scenarios**:

1. **Given** judge opens the Vercel URL, **When** they use the primary prompt, **Then** the app completes the core flow without local setup.
2. **Given** judge opens GitHub README, **When** they review the project, **Then** they see problem, solution, architecture, judging criteria mapping, and setup.

### Edge Cases

- User gives no dimensions: assistant asks one focused clarification before calculating.
- User asks for unrelated product category: assistant can search catalog but should stay in home-improvement context.
- Supabase product search returns no results: assistant reports no grounded match.
- AI provider fails: UI shows a recoverable error and lets user retry.
- User is not logged in: recommendation still works, but saving quotation asks user to log in.
- Uploaded image is too large or unsupported: UI rejects it with a clear message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a chat interface for Indonesian home repair and renovation assistance.
- **FR-002**: System MUST search product catalog semantically using product embeddings.
- **FR-003**: System MUST return only catalog-grounded product names, prices, units, and stock status.
- **FR-004**: System MUST provide deterministic calculator tools for waterproofing, paint, tiles, subtotal, and installment estimates.
- **FR-005**: System MUST show a visible recommendation breakdown with products, quantities, reasons, and total cost.
- **FR-006**: Authenticated users MUST be able to save and reopen quotations.
- **FR-007**: System MUST enforce user ownership for saved projects, messages, and quotations.
- **FR-008**: System MUST support one image upload in the chat for diagnosis.
- **FR-009**: System MUST ask clarification when required data is missing for reliable calculation.
- **FR-010**: System MUST include seeded demo products covering waterproofing, paint, plumbing, tiles, wall repair, and tools.
- **FR-011**: README MUST include demo URL placeholder, architecture, setup, sample prompts, and judging criteria mapping.

### Key Entities

- **Product**: Catalog item with name, category, brand, description, use cases, price, unit, stock status, coverage notes, and embedding.
- **Project**: User's renovation/repair context with title, problem summary, category, area, and status.
- **Quotation**: Saved shopping plan with summary, subtotal, optional installment estimate, and item rows.
- **Quotation Item**: Product line item with unit price, quantity, line total, and recommendation reason.
- **Chat Message**: User/assistant message history tied to a user and optional project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Primary roof leak demo completes from user prompt to saved quotation in under 2 minutes.
- **SC-002**: First assistant response starts streaming within 5 seconds on normal development connection.
- **SC-003**: At least 20 seeded products are available for semantic search.
- **SC-004**: The 15 m2 waterproofing scenario returns a deterministic quantity calculation, not a free-form estimate.
- **SC-005**: Public Vercel deployment is usable on a mobile viewport.
- **SC-006**: README clearly maps implementation to innovation, usefulness, technical quality, and presentation criteria.

## Assumptions

- Demo uses QHomemart-style dummy product data, not live inventory.
- No payment or checkout integration is needed for MVP.
- OpenAI-compatible model and embedding APIs are available through environment variables.
- Supabase Auth is sufficient for demo account login.
- Indonesian is the primary language for user-facing assistant responses.
