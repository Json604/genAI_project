# 🛍️ Multimodal Product Catalogue Intelligence

Search a fashion catalogue the way a customer thinks — by text, by photo, or both at once. Built for Assignment #8 (Multimodal).

**Live demo:** _added after Vercel deploy_

---

## What it does

| Feature | How |
|---|---|
| **Text search** | Natural-language query → Jina CLIP text embedding → pgvector cosine search, with colour/category filters and conversational refinement |
| **Image search** | Upload a photo → Jina CLIP image embedding → match against catalogue image embeddings |
| **Combined search** | Image **and** text → weighted blend `α·image + (1-α)·text` in CLIP space (α slider in the UI) |
| **Attribute extraction** | Gemini vision labels colour, style, material, shape, category for every product |
| **AI descriptions** | Gemini generates a natural-language description from each product image |
| **Search analytics** | Tracks searches, zero-result rate, abandonment, CTR, and surfaces catalogue gaps (demand with no matching product) |

## Architecture

```
Next.js (brutalist UI + API routes)  ──►  Vercel
        │
        ├─ Jina CLIP v2 API        (multimodal embeddings: text + image, 1024-dim)
        ├─ Google Gemini API       (attribute extraction + descriptions)
        └─ Supabase (pgvector)     (product vectors + analytics)

Offline (one-time):  pipeline/  ──►  download 400 fashion products,
   Gemini attributes/descriptions, Jina embeddings, upsert to Supabase.
```

Everything runs on free tiers. The heavy ML (CLIP) lives in Jina's hosted API, so the whole app deploys to Vercel with no separate ML backend.

## Repository layout

```
web/                  Next.js 14 app (App Router, TS, Tailwind) — deployed to Vercel
  app/                pages + /api routes (text/image/combined/describe/track/analytics)
  components/         brutalist UI components
  lib/                jina / gemini / supabase clients + blend logic (+ blend.test.ts)
  public/catalogue/   400 product thumbnails (served statically)
pipeline/             one-time Python: dataset prep, attribute extraction, embedding/upsert, validation
supabase/schema.sql   tables + pgvector match functions
docs/                 design spec, implementation plan, validation results
```

## Local development

```bash
# 1. Web app
cd web
cp ../.env.example .env.local   # fill GEMINI_API_KEY, JINA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
npm install
npm run dev                     # http://localhost:3000

# 2. (One-time) build the catalogue index
cd pipeline
python -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env            # same four secrets
./.venv/bin/python prepare_dataset.py     # sample 400 products + thumbnails
./.venv/bin/python extract_attributes.py  # Gemini attributes + descriptions (cached, resumable)
./.venv/bin/python build_index.py         # Jina embeddings → Supabase upsert
```

The Supabase schema (`supabase/schema.sql`) must be applied once via the Supabase SQL editor before running `build_index.py`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Vercel → **New Project** → import the repo.
3. Set **Root Directory = `web`**.
4. Add Environment Variables: `GEMINI_API_KEY`, `JINA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
5. **Deploy.** Because the catalogue lives in Supabase, the deployed app has data as soon as the pipeline finishes — no redeploy needed.

## Validation

`pipeline/validate.py` checks the success metrics (image-search top-5 accuracy, combined-beats-single cases, ≥4 attributes per product). Results are written to `docs/validation-results.md`.

## Models

- **Embeddings:** `jina-clip-v2` (1024-dim, multimodal)
- **Vision:** `gemini-2.5-flash-lite` (attribute extraction + descriptions)
