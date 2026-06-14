# Multimodal Product Catalogue Intelligence — Design Spec

**Date:** 2026-06-14
**Assignment:** #8 — Multimodal Product Catalogue Intelligence (15 + 3 bonus marks, 5 students)
**Goal:** A multimodal product search system — text search, image search, combined search, automatic attribute extraction, AI-generated descriptions, and search analytics — deployed, free, and working.

---

## 1. Constraints & Decisions (locked)

| Decision | Choice |
|---|---|
| Product domain | Fashion |
| Dataset | Fashion Product Images (Small) — ~44k items w/ images + structured attributes; sample **400** |
| Embeddings | **Jina CLIP v2** API (free tier) — multimodal, images + text in one shared space |
| Vision AI | **Google Gemini** (free tier) — attribute extraction + description generation |
| DB / vector store | **Supabase** (Postgres + `pgvector`, free tier) |
| Frontend + API | **Next.js 14** (App Router, TypeScript) — **brutalist** design |
| Deployment | **Vercel** (free) |
| Code execution | Driven via `codex exec` per plan phase, verified by Claude |
| Catalogue size | 400 products |

**Why this architecture:** The brief requires matching images "using embedding similarity." A CLIP-style multimodal embedding (images + text in one vector space) is the literal, mark-aligned solution. Vercel serverless cannot host PyTorch/CLIP, so Jina's hosted CLIP API provides the same capability over HTTP — keeping the entire app on Vercel with no separate ML backend to maintain.

---

## 2. Architecture

### 2.1 Offline pipeline (run once, local Python — built by Codex)
1. Download the dataset; sample 400 products spread across categories.
2. For each product image, call **Gemini Vision** → extract attributes (`colour`, `style`, `material`, `shape`, `category`) + generate a clean natural-language description.
3. For each product, call **Jina CLIP** to embed:
   - the **product image** → `image_embedding`
   - the **text** (`productDisplayName` + description + attributes) → `text_embedding`
4. Upsert product rows (metadata, attributes, description, both embeddings) into Supabase.
5. Copy each product's thumbnail (~5 KB) into `web/public/catalogue/<id>.jpg` so Vercel serves images statically.
6. **Cache** all Gemini/Jina responses to disk so re-runs never re-spend free-tier quota.

### 2.2 Runtime (Vercel Next.js API routes)
- `POST /api/search/text` — embed query text (Jina) → pgvector cosine search on `text_embedding`; supports attribute filters (`WHERE colour=…`) and category navigation.
- `POST /api/search/image` — receive uploaded image → Jina image embedding → cosine search on `image_embedding`.
- `POST /api/search/combined` — image + text → blend `normalize(α·image_vec + (1-α)·text_vec)` → search. `α` is a UI slider (default 0.5).
- `POST /api/describe` — image → Gemini description + attribute tags (AI-description feature; also reusable to tag new products).
- `POST /api/track` — log a result click (for CTR / abandonment).
- `GET /api/analytics` — aggregates: total searches, zero-result rate, abandonment rate, CTR, top zero-result queries (catalogue gaps).
- Every search writes a row to a `searches` table.

### 2.3 Data model (Supabase)
```
products(
  id text primary key,
  name text,
  category text,
  sub_category text,
  article_type text,
  base_colour text,
  gender text,
  attributes jsonb,          -- {colour, style, material, shape, category}
  ai_description text,
  image_path text,           -- /catalogue/<id>.jpg
  image_embedding vector(N), -- Jina CLIP dim
  text_embedding vector(N)
)

searches(
  id uuid default gen_random_uuid() primary key,
  query text,
  search_type text,          -- text | image | combined
  filters jsonb,
  num_results int,
  clicked_product_id text,   -- null until a click is tracked
  created_at timestamptz default now()
)
```
Vector search via pgvector `<=>` cosine distance, exposed through Supabase RPC functions (`match_products_text`, `match_products_image`, `match_products_combined`).

---

## 3. Frontend (brutalist)

**Aesthetic:** stark black/white, thick visible borders, monospace type, raw rectangular blocks, one accent color, no soft rounded cards. High-contrast, structural, deliberately "raw."

**Views:**
1. **Search** — text bar; drag-and-drop image upload; combined-mode toggle with `α` weight slider; attribute filter chips; category navigation; results grid; conversational refine input ("…but in red").
2. **Product detail** (modal) — image, AI description, attribute tags, "find similar" (runs image search on that product).
3. **Analytics dashboard** — metric cards (total searches, zero-result %, abandonment %, CTR) + catalogue-gap list (top zero-result queries).

Clicking a result fires `/api/track` for CTR.

---

## 4. Error handling

- **Rate limits** (Jina/Gemini): retry with exponential backoff; offline pipeline caches every response so it is idempotent and quota-safe.
- **Zero results:** logged as a gap + friendly brutalist empty state.
- **Upload validation:** image MIME type + size cap before embedding.
- **Secrets:** all API keys in environment variables (`.env.local`, Vercel env). Never committed. `.env.example` documents required vars.

---

## 5. Validation plan

| Metric | How verified |
|---|---|
| Text search relevance | Diverse natural-language queries return semantically sensible results |
| Image search match | Held-out **10-image test set** returns the correct/near product |
| Combined > single signal | Curated cases (e.g. red-dress image + "in blue") where image-only and text-only each fail but combined wins |
| Attribute extraction ≥4 | Test images show ≥4 correct labels (colour, style, material, shape/category) |
| AI descriptions | Generate for products with blanked descriptions; check accuracy/usefulness |

---

## 6. Marks alignment

- **Core (15):** text / image / combined search, attribute extraction, AI descriptions, analytics — all covered.
- **Bonus (+3):** conversational refinement + demand-gap analytics (zero-result surfacing).

---

## 7. Setup checklist (from the user)

1. **Gemini API key** — ✅ obtained (Google AI Studio, free).
2. **Jina API key** — free signup at jina.ai/embeddings.
3. **Supabase project** — free; enable `pgvector`; collect project URL + anon key + service-role key.
4. **Vercel + GitHub** — free accounts for deployment.
5. **Codex CLI** — ✅ installed & authenticated; drives implementation per plan phase.

---

## 8. Repository layout (target)
```
genAI_project/
  web/                      # Next.js app (deployed to Vercel)
    app/                    # routes + API routes
    components/             # brutalist UI components
    lib/                    # jina, gemini, supabase clients; search logic
    public/catalogue/       # 400 product thumbnails
  pipeline/                 # offline Python: dataset prep + embedding precompute
    cache/                  # cached Gemini/Jina responses
  supabase/                 # SQL: schema + pgvector RPC functions
  docs/superpowers/specs/   # this spec + future docs
  .env.example
```
