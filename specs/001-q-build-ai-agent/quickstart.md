# Quickstart: Q-Build AI Renovation Agent

## Local Setup

1. Install dependencies.

```powershell
npm install
```

2. Create `.env.local`.

```env
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

3. Run Supabase SQL migration from `supabase/migrations`.

4. Seed demo products and embeddings.

```powershell
npm run seed:products
```

5. Start app.

```powershell
npm run dev
```

6. Open `http://localhost:3000`.

## Primary Demo Prompt

```text
Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Saya harus beli apa dan kira-kira habis berapa?
```

Expected result:

- Assistant diagnoses waterproofing need.
- Assistant searches catalog.
- Assistant calculates required material.
- Assistant recommends waterproofing product, membrane/fiber, and roller/brush.
- Assistant shows estimated subtotal.
- User can save quotation.

## Verification Checklist

- Product recommendations are from seeded catalog.
- 15 m2 waterproofing calculation uses tool output.
- Unauthenticated users can chat but must log in to save.
- Authenticated users can reopen only their own quotations.
- Mobile viewport does not overlap text or controls.
