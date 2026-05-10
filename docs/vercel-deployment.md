# Vercel Deployment

This project is ready for Vercel, but the local workspace must be linked or a GitHub Action must be given Vercel secrets.

## Option A - Deploy From Local CLI

Run from the repository root:

```powershell
npx vercel login
npx vercel link
npx vercel env add AI_BASE_URL production
npx vercel env add AI_API_KEY production
npx vercel env add AI_MODEL production
npx vercel env add AI_EMBEDDING_MODEL production
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add ADMIN_EMAILS production
npx vercel --prod
```

After deployment, update `README.md`:

```text
Production URL: https://your-project.vercel.app
```

## Option B - Deploy From GitHub Actions

The workflow is defined in `.github/workflows/vercel-production.yml`.

Add these GitHub repository secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Then trigger **Vercel Production** manually from the GitHub Actions tab, or merge/push to `main`.

## Production Verification

After deployment:

```powershell
npm run supabase:verify
```

Then test these production routes:

```text
/
/catalog
/quotes
/admin
```

Use the checklist in `docs/production-checklist.md` before submitting the repo and demo video.
