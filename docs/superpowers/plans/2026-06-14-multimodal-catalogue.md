# Multimodal Product Catalogue Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Execution note:** This project is implemented by driving `codex exec` per phase. Each Task below is a self-contained Codex prompt unit. Claude verifies output between tasks.

**Goal:** Build and deploy a free, working multimodal fashion-catalogue search system (text / image / combined search, attribute extraction, AI descriptions, analytics) on Vercel.

**Architecture:** Next.js 14 (App Router, TS) on Vercel handles UI + serverless API routes. Jina CLIP v2 provides multimodal embeddings; Google Gemini does vision (attributes + descriptions); Supabase Postgres + pgvector stores products, embeddings, and analytics. A one-time local Python pipeline prepares the 400-item catalogue.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, Supabase (pgvector), Jina Embeddings API, Google Gemini API, Python 3.11 (pipeline).

---

## Phase 0 — Accounts & scaffolding

### Task 0.1: User-side account setup (manual — blocks pipeline + runtime)

**Owner:** User. Claude provides exact steps; nothing to code yet.

- [ ] **Gemini API key** — already obtained (Google AI Studio → "Get API key"). Value → `GEMINI_API_KEY`.
- [ ] **Jina key** — go to https://jina.ai/embeddings → "API" → copy the free key (1M free tokens). Value → `JINA_API_KEY`.
- [ ] **Supabase project** — https://supabase.com → New project (free). From Project Settings → API copy: Project URL → `SUPABASE_URL`, `anon` key → `SUPABASE_ANON_KEY`, `service_role` key → `SUPABASE_SERVICE_KEY`.
- [ ] **GitHub repo + Vercel** — create empty GitHub repo; sign in to Vercel with GitHub (done at deploy phase).
- [ ] Paste the four secret values back to Claude/Codex so `.env.local` and `pipeline/.env` can be filled.

### Task 0.2: Repo scaffold

**Files:**
- Create: `web/` (Next.js app via `create-next-app`)
- Create: `.env.example`
- Create: `pipeline/requirements.txt`, `pipeline/.env.example`

- [ ] **Step 1:** Scaffold Next.js app.
```bash
npx create-next-app@latest web --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --use-npm
cd web && npm i @supabase/supabase-js
```
- [ ] **Step 2:** Create `.env.example` at repo root:
```
# web (Vercel) — server-side only
GEMINI_API_KEY=
JINA_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
```
- [ ] **Step 3:** Create `pipeline/requirements.txt`:
```
requests
pandas
pillow
python-dotenv
supabase
kagglehub
google-generativeai
```
- [ ] **Step 4:** Create `pipeline/.env.example` (same five vars as above).
- [ ] **Step 5:** Commit.
```bash
git add -A && git commit -m "chore: scaffold next.js app and pipeline skeleton"
```

---

## Phase 1 — Supabase schema + vector RPCs

### Task 1.1: Schema + pgvector + match functions

**Files:**
- Create: `supabase/schema.sql`

Jina CLIP v2 returns **1024-dim** vectors. Use `vector(1024)`.

- [ ] **Step 1:** Write `supabase/schema.sql`:
```sql
create extension if not exists vector;

create table if not exists products (
  id text primary key,
  name text,
  category text,
  sub_category text,
  article_type text,
  base_colour text,
  gender text,
  attributes jsonb,
  ai_description text,
  image_path text,
  image_embedding vector(1024),
  text_embedding vector(1024)
);

create table if not exists searches (
  id uuid default gen_random_uuid() primary key,
  query text,
  search_type text,
  filters jsonb,
  num_results int,
  clicked_product_id text,
  created_at timestamptz default now()
);

-- Text search: cosine distance on text_embedding, with optional filters
create or replace function match_products_text(
  query_embedding vector(1024),
  match_count int default 24,
  filter_colour text default null,
  filter_category text default null
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         1 - (p.text_embedding <=> query_embedding) as score
  from products p
  where (filter_colour is null or p.attributes->>'colour' ilike filter_colour)
    and (filter_category is null or p.category ilike filter_category)
  order by p.text_embedding <=> query_embedding
  limit match_count;
$$;

-- Image search: cosine distance on image_embedding
create or replace function match_products_image(
  query_embedding vector(1024),
  match_count int default 24
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         1 - (p.image_embedding <=> query_embedding) as score
  from products p
  order by p.image_embedding <=> query_embedding
  limit match_count;
$$;

-- Combined: caller passes a pre-blended query vector; match against image_embedding
create or replace function match_products_combined(
  query_embedding vector(1024),
  match_count int default 24
) returns table (
  id text, name text, category text, base_colour text,
  attributes jsonb, ai_description text, image_path text, score float
) language sql stable as $$
  select p.id, p.name, p.category, p.base_colour, p.attributes,
         p.ai_description, p.image_path,
         1 - (p.image_embedding <=> query_embedding) as score
  from products p
  order by p.image_embedding <=> query_embedding
  limit match_count;
$$;
```
- [ ] **Step 2:** Run it in Supabase SQL editor (paste + Run). Expected: "Success. No rows returned."
- [ ] **Step 3:** Verify: `select * from pg_extension where extname='vector';` returns one row.
- [ ] **Step 4:** Commit `supabase/schema.sql`.

---

## Phase 2 — Offline pipeline (Python, local)

All scripts live in `pipeline/`, load secrets from `pipeline/.env`, and **cache every API response** under `pipeline/cache/` keyed by product id so re-runs are quota-safe and idempotent.

### Task 2.1: Dataset download + sampling

**Files:**
- Create: `pipeline/prepare_dataset.py`
- Create: `pipeline/lib.py` (shared helpers: env load, cache get/set, jina embed, gemini call)

- [ ] **Step 1:** `pipeline/lib.py` — shared helpers:
```python
import os, json, base64, time, hashlib, requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
CACHE = Path(__file__).parent / "cache"; CACHE.mkdir(exist_ok=True)
JINA_KEY = os.environ["JINA_API_KEY"]; GEMINI_KEY = os.environ["GEMINI_API_KEY"]

def cache_get(ns, key):
    f = CACHE / ns / f"{key}.json"
    return json.loads(f.read_text()) if f.exists() else None

def cache_set(ns, key, val):
    d = CACHE / ns; d.mkdir(parents=True, exist_ok=True)
    (d / f"{key}.json").write_text(json.dumps(val)); return val

def jina_embed(inputs):
    # inputs: list of {"text": ...} or {"image": <base64 or url>}
    for attempt in range(5):
        r = requests.post("https://api.jina.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {JINA_KEY}", "Content-Type": "application/json"},
            json={"model": "jina-clip-v2", "input": inputs})
        if r.status_code == 200:
            return [d["embedding"] for d in r.json()["data"]]
        if r.status_code in (429, 503): time.sleep(2 ** attempt); continue
        r.raise_for_status()
    raise RuntimeError("jina embed failed after retries")

def b64_image(path):
    return base64.b64encode(Path(path).read_bytes()).decode()
```
- [ ] **Step 2:** `pipeline/prepare_dataset.py` — download via `kagglehub`, sample 400 spread across `articleType`, copy thumbnails to `web/public/catalogue/`, write `pipeline/cache/sample.json` (list of `{id,name,category,sub_category,article_type,base_colour,gender,image_path}`):
```python
import kagglehub, pandas as pd, shutil
from pathlib import Path

root = Path(kagglehub.dataset_download("paramaggarwal/fashion-product-images-small"))
df = pd.read_csv(root / "styles.csv", on_bad_lines="skip")
# 400 spread across article types
sample = df.groupby("articleType", group_keys=False).apply(
    lambda g: g.sample(min(len(g), 8), random_state=42)).sample(400, random_state=42)
out_imgs = Path(__file__).parents[1] / "web/public/catalogue"; out_imgs.mkdir(parents=True, exist_ok=True)
records = []
for _, row in sample.iterrows():
    src = root / "images" / f"{row['id']}.jpg"
    if not src.exists(): continue
    shutil.copy(src, out_imgs / f"{row['id']}.jpg")
    records.append({"id": str(row["id"]), "name": row["productDisplayName"],
        "category": row["masterCategory"], "sub_category": row["subCategory"],
        "article_type": row["articleType"], "base_colour": row["baseColour"],
        "gender": row["gender"], "image_path": f"/catalogue/{row['id']}.jpg"})
import json; (Path(__file__).parent/"cache"/"sample.json").write_text(json.dumps(records[:400]))
print(f"sampled {len(records[:400])} products")
```
- [ ] **Step 3:** Run: `cd pipeline && python prepare_dataset.py`. Expected: `sampled 400 products` and `web/public/catalogue/` populated. (If kagglehub auth needed, run `kagglehub login` or set `KAGGLE_USERNAME`/`KAGGLE_KEY`; fallback dataset id: `ashraq/fashion-product-images-small` on HF.)
- [ ] **Step 4:** Commit `pipeline/lib.py`, `pipeline/prepare_dataset.py`, and the catalogue images.

### Task 2.2: Gemini attribute + description extraction

**Files:**
- Create: `pipeline/extract_attributes.py`

- [ ] **Step 1:** Write the extractor. Strict JSON prompt; cache per id.
```python
import json, google.generativeai as genai
from pathlib import Path
from lib import GEMINI_KEY, cache_get, cache_set, b64_image

genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")
ROOT = Path(__file__).parents[1] / "web/public"

PROMPT = """You are a fashion cataloguer. Look at the product image and return STRICT JSON only:
{"colour": "...", "style": "...", "material": "...", "shape": "...", "category": "...",
 "description": "a natural 1-2 sentence product description"}
Use concise lowercase values. material/shape: best visual guess. No markdown, JSON only."""

def extract(rec):
    cached = cache_get("attrs", rec["id"])
    if cached: return cached
    img = {"mime_type": "image/jpeg", "data": b64_image(ROOT / rec["image_path"].lstrip("/"))}
    resp = model.generate_content([PROMPT, img])
    text = resp.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    data = json.loads(text)
    return cache_set("attrs", rec["id"], data)

if __name__ == "__main__":
    sample = json.loads((Path(__file__).parent/"cache"/"sample.json").read_text())
    for i, rec in enumerate(sample):
        try:
            extract(rec); print(f"{i+1}/{len(sample)} {rec['id']} ok")
        except Exception as e:
            print(f"{rec['id']} FAIL {e}")
```
- [ ] **Step 2:** Run: `cd pipeline && python extract_attributes.py`. Expected: 400 lines `ok`; `cache/attrs/*.json` populated. Re-run is free (cache hit).
- [ ] **Step 3:** Spot-check 3 cached files have all 6 keys (≥4-attribute metric).
- [ ] **Step 4:** Commit `pipeline/extract_attributes.py`.

### Task 2.3: Embed + upsert to Supabase

**Files:**
- Create: `pipeline/build_index.py`

- [ ] **Step 1:** For each product: build text = `name + description + attributes`; get `text_embedding` (Jina text) and `image_embedding` (Jina image, base64). Upsert via supabase-py service key. Cache embeddings per id.
```python
import json, os
from pathlib import Path
from supabase import create_client
from lib import jina_embed, b64_image, cache_get, cache_set
from extract_attributes import extract

ROOT = Path(__file__).parents[1] / "web/public"
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
sample = json.loads((Path(__file__).parent/"cache"/"sample.json").read_text())

def emb_for(rec):
    c = cache_get("emb", rec["id"])
    if c: return c
    attrs = extract(rec)
    text = f"{rec['name']}. {attrs['description']} colour {attrs['colour']}, style {attrs['style']}, material {attrs['material']}, shape {attrs['shape']}, category {attrs['category']}."
    text_vec = jina_embed([{"text": text}])[0]
    img_vec = jina_embed([{"image": b64_image(ROOT / rec['image_path'].lstrip('/'))}])[0]
    return cache_set("emb", rec["id"], {"text_vec": text_vec, "img_vec": img_vec, "attrs": attrs})

for i, rec in enumerate(sample):
    e = emb_for(rec)
    sb.table("products").upsert({
        "id": rec["id"], "name": rec["name"], "category": rec["category"],
        "sub_category": rec["sub_category"], "article_type": rec["article_type"],
        "base_colour": rec["base_colour"], "gender": rec["gender"],
        "attributes": e["attrs"], "ai_description": e["attrs"]["description"],
        "image_path": rec["image_path"], "text_embedding": e["text_vec"],
        "image_embedding": e["img_vec"],
    }).execute()
    print(f"{i+1}/{len(sample)} upserted {rec['id']}")
```
- [ ] **Step 2:** Run: `cd pipeline && python build_index.py`. Expected: 400 `upserted` lines.
- [ ] **Step 3:** Verify in Supabase: `select count(*) from products;` → 400; `select count(*) from products where image_embedding is not null;` → 400.
- [ ] **Step 4:** Commit `pipeline/build_index.py`.

---

## Phase 3 — Web shared libs

### Task 3.1: Clients + blend logic (with test)

**Files:**
- Create: `web/lib/supabase.ts`, `web/lib/jina.ts`, `web/lib/gemini.ts`, `web/lib/blend.ts`
- Test: `web/lib/blend.test.ts`

- [ ] **Step 1: Write failing test** `web/lib/blend.test.ts` (the one piece of pure logic — vector blend):
```ts
import { describe, it, expect } from "vitest";
import { blend } from "./blend";

describe("blend", () => {
  it("alpha=1 returns normalized image vector direction", () => {
    const out = blend([3, 4], [0, 1], 1);
    expect(out[0]).toBeCloseTo(0.6); expect(out[1]).toBeCloseTo(0.8);
  });
  it("alpha=0 returns normalized text vector direction", () => {
    const out = blend([0, 5], [6, 8], 0);
    expect(out[0]).toBeCloseTo(0.6); expect(out[1]).toBeCloseTo(0.8);
  });
  it("output is unit length", () => {
    const out = blend([1, 2], [3, 4], 0.5);
    const n = Math.hypot(...out); expect(n).toBeCloseTo(1);
  });
});
```
- [ ] **Step 2:** `cd web && npm i -D vitest && npx vitest run lib/blend.test.ts` → FAIL (blend undefined).
- [ ] **Step 3:** Implement `web/lib/blend.ts`:
```ts
export function blend(imageVec: number[], textVec: number[], alpha: number): number[] {
  const mixed = imageVec.map((v, i) => alpha * v + (1 - alpha) * textVec[i]);
  const norm = Math.hypot(...mixed) || 1;
  return mixed.map((v) => v / norm);
}
```
- [ ] **Step 4:** `npx vitest run lib/blend.test.ts` → PASS.
- [ ] **Step 5:** `web/lib/jina.ts` — server-side embed helper:
```ts
export async function jinaEmbed(input: Array<{ text: string } | { image: string }>): Promise<number[][]> {
  const r = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.JINA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "jina-clip-v2", input }),
  });
  if (!r.ok) throw new Error(`jina ${r.status}`);
  const j = await r.json();
  return j.data.map((d: any) => d.embedding);
}
```
- [ ] **Step 6:** `web/lib/supabase.ts` — service-role client (server only):
```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
```
- [ ] **Step 7:** `web/lib/gemini.ts` — describe-from-image helper (REST, no SDK needed server-side):
```ts
const PROMPT = `You are a fashion cataloguer. Return STRICT JSON only:
{"colour":"...","style":"...","material":"...","shape":"...","category":"...","description":"1-2 sentence product description"}
Lowercase concise values, JSON only.`;
export async function geminiDescribe(base64Jpeg: string) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [
        { text: PROMPT },
        { inline_data: { mime_type: "image/jpeg", data: base64Jpeg } }] }] }) });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const txt = j.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(txt);
}
```
- [ ] **Step 8:** Commit lib + test.

---

## Phase 4 — API routes

All routes are `app/api/.../route.ts`, `runtime = "nodejs"`, server-only secrets.

### Task 4.1: Text search route

**Files:** Create `web/app/api/search/text/route.ts`

- [ ] **Step 1:** Implement:
```ts
import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query, colour = null, category = null } = await req.json();
  const [vec] = await jinaEmbed([{ text: query }]);
  const { data, error } = await supabase.rpc("match_products_text", {
    query_embedding: vec, match_count: 24, filter_colour: colour, filter_category: category });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("searches").insert({ query, search_type: "text",
    filters: { colour, category }, num_results: data.length });
  return NextResponse.json({ results: data });
}
```
- [ ] **Step 2:** Test locally once Phase 3 env is set: `curl -s localhost:3000/api/search/text -d '{"query":"red summer dress"}' -H 'content-type: application/json' | head`. Expected: JSON `results` array, length > 0.
- [ ] **Step 3:** Commit.

### Task 4.2: Image search route

**Files:** Create `web/app/api/search/image/route.ts`

- [ ] **Step 1:** Accept base64 image (JSON `{ image }`), embed, search:
```ts
import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { image } = await req.json(); // base64 (no data: prefix)
  const [vec] = await jinaEmbed([{ image }]);
  const { data, error } = await supabase.rpc("match_products_image", { query_embedding: vec, match_count: 24 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("searches").insert({ query: "[image]", search_type: "image", num_results: data.length });
  return NextResponse.json({ results: data });
}
```
- [ ] **Step 2:** Commit.

### Task 4.3: Combined search route

**Files:** Create `web/app/api/search/combined/route.ts`

- [ ] **Step 1:** Embed image + text, blend, search:
```ts
import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { blend } from "@/lib/blend";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { image, query, alpha = 0.5 } = await req.json();
  const [imgVec, txtVec] = await jinaEmbed([{ image }, { text: query }]);
  const mixed = blend(imgVec, txtVec, alpha);
  const { data, error } = await supabase.rpc("match_products_combined", { query_embedding: mixed, match_count: 24 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("searches").insert({ query, search_type: "combined", filters: { alpha }, num_results: data.length });
  return NextResponse.json({ results: data });
}
```
- [ ] **Step 2:** Commit.

### Task 4.4: Describe route

**Files:** Create `web/app/api/describe/route.ts`

- [ ] **Step 1:**
```ts
import { NextRequest, NextResponse } from "next/server";
import { geminiDescribe } from "@/lib/gemini";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { image } = await req.json();
  try { return NextResponse.json(await geminiDescribe(image)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
```
- [ ] **Step 2:** Commit.

### Task 4.5: Track + analytics routes

**Files:** Create `web/app/api/track/route.ts`, `web/app/api/analytics/route.ts`

- [ ] **Step 1:** `track` — record a click on the most recent matching search (simplest: insert a click row):
```ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { product_id, query } = await req.json();
  await supabase.from("searches").insert({ query, search_type: "click", clicked_product_id: product_id, num_results: 0 });
  return NextResponse.json({ ok: true });
}
```
- [ ] **Step 2:** `analytics` — aggregate metrics:
```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export async function GET() {
  const { data } = await supabase.from("searches").select("*").order("created_at", { ascending: false }).limit(2000);
  const rows = data ?? [];
  const searches = rows.filter((r) => r.search_type !== "click");
  const clicks = rows.filter((r) => r.search_type === "click");
  const zero = searches.filter((r) => r.num_results === 0);
  const total = searches.length || 1;
  const gaps = Object.entries(zero.reduce((m: any, r) => ((m[r.query] = (m[r.query] || 0) + 1), m), {}))
    .sort((a: any, b: any) => b[1] - a[1]).slice(0, 10);
  return NextResponse.json({
    total_searches: searches.length,
    zero_result_rate: +(zero.length / total).toFixed(3),
    abandonment_rate: +(1 - clicks.length / total).toFixed(3),
    ctr: +(clicks.length / total).toFixed(3),
    gaps,
  });
}
```
- [ ] **Step 3:** Commit.

---

## Phase 5 — Brutalist frontend

**Design language:** stark white background, pure-black thick (3–4px) borders, monospace font (e.g. `font-mono`), one accent (`#FF3B00` / hot orange), hard shadows (`box-shadow: 6px 6px 0 #000`), no rounded corners, uppercase labels, visible grid structure. Apply globally in `app/globals.css` + Tailwind.

### Task 5.1: Layout, theme, nav

**Files:** Modify `web/app/layout.tsx`, `web/app/globals.css`; Create `web/components/Nav.tsx`

- [ ] **Step 1:** Set brutalist globals (black borders default, mono font, accent var, hard shadow utility `.brut`).
- [ ] **Step 2:** `Nav.tsx` — top bar with thick bottom border, links: `SEARCH` `/`, `ANALYTICS` `/analytics`.
- [ ] **Step 3:** Commit.

### Task 5.2: Search page + components

**Files:** Modify `web/app/page.tsx`; Create `web/components/SearchBar.tsx`, `web/components/ImageDrop.tsx`, `web/components/ResultGrid.tsx`, `web/components/ProductModal.tsx`, `web/components/FilterChips.tsx`, `web/components/AlphaSlider.tsx`

- [ ] **Step 1:** `page.tsx` (client) holds state: `mode` (text|image|combined), `query`, `imageBase64`, `alpha`, `filters {colour,category}`, `results`, `loading`. On submit, POST to the route for the active mode; render `ResultGrid`.
- [ ] **Step 2:** `ImageDrop.tsx` — drag/drop or file picker; validates `image/*` and < 5 MB; converts to base64 (strip `data:` prefix); shows preview. When an image is present, reveal `AlphaSlider` + enable combined mode if `query` also set.
- [ ] **Step 3:** `SearchBar.tsx` — text input + uppercase SEARCH button; supports the conversational refine box (append text → re-run text/combined search).
- [ ] **Step 4:** `FilterChips.tsx` — colour + category chips that set `filters` and re-run.
- [ ] **Step 5:** `ResultGrid.tsx` — grid of bordered cards (image, name, score, colour tag). Click → opens `ProductModal` AND POSTs `/api/track` `{product_id, query}`.
- [ ] **Step 6:** `ProductModal.tsx` — large image, AI description, attribute tags, `FIND SIMILAR` button → runs image search on that product's `image_path` (fetch the static image → base64 → `/api/search/image`).
- [ ] **Step 7:** Zero-result brutalist empty state ("NO MATCHES — LOGGED AS GAP").
- [ ] **Step 8:** `npm run dev`, manually exercise text/image/combined + a click. Commit.

### Task 5.3: Analytics dashboard

**Files:** Create `web/app/analytics/page.tsx`

- [ ] **Step 1:** Client page fetches `/api/analytics`; render 4 metric blocks (total searches, zero-result %, abandonment %, CTR) as bordered cards + a "CATALOGUE GAPS" table from `gaps`.
- [ ] **Step 2:** Commit.

---

## Phase 6 — Validation & deploy

### Task 6.1: Validation against success metrics

**Files:** Create `pipeline/validate.py` (uses deployed or local API base URL)

- [ ] **Step 1:** Held-out image test: pick 10 catalogue images NOT among results-of-themselves edge; POST each to `/api/search/image`; assert the same/similar product ranks in top-5. Print pass rate.
- [ ] **Step 2:** Combined-vs-single cases: e.g. a red-dress image + query "in blue" → assert a blue dress ranks higher in combined than in image-only. Print comparison.
- [ ] **Step 3:** Attribute check: assert ≥4 non-empty attribute keys on 5 random products.
- [ ] **Step 4:** Run `python validate.py`; record results in `docs/validation-results.md`. Commit.

### Task 6.2: Deploy to Vercel

- [ ] **Step 1:** Push repo to GitHub.
- [ ] **Step 2:** Vercel → New Project → import repo → **Root Directory = `web`** → add env vars (`GEMINI_API_KEY`, `JINA_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) → Deploy.
- [ ] **Step 3:** Smoke-test the live URL: text search, image upload, combined, analytics page.
- [ ] **Step 4:** Add the live URL to `README.md`; commit.

---

## Self-Review

**Spec coverage:** Text (4.1) · Image (4.2) · Combined w/ blend (4.3, 3.1) · Attribute extraction (2.2, ≥4 keys) · AI descriptions (2.2, 4.4) · Analytics incl. gaps/abandonment/CTR (4.5, 5.3) · Brutalist UI on Vercel (5.x, 6.2) · Conversational refine (5.2 step 3) — all mapped.
**Types consistent:** `jinaEmbed`, `blend(imageVec,textVec,alpha)`, RPC names `match_products_text|image|combined`, `vector(1024)` used identically across schema, libs, routes.
**No placeholders:** concrete code/SQL/commands in every code step.
**Risk notes:** confirm Jina `jina-clip-v2` dim is 1024 at Task 2.3 (first embed) — if different, update `vector(N)` in schema before upsert. Gemini model id `gemini-2.0-flash` (free); fall back to `gemini-1.5-flash` if quota/availability differs.
