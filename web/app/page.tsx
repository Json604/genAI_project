"use client";

import { useState, type FormEvent } from "react";
import AlphaSlider from "@/components/AlphaSlider";
import FilterChips, { type SearchFilters } from "@/components/FilterChips";
import ImageDrop from "@/components/ImageDrop";
import ProductModal from "@/components/ProductModal";
import ResultGrid, { type Product } from "@/components/ResultGrid";
import SearchBar from "@/components/SearchBar";

type SearchMode = "TEXT" | "IMAGE" | "COMBINED";

interface SearchResponse {
  results?: Product[];
  error?: string;
}

function getSearchMode(query: string, imageBase64: string | null): SearchMode | null {
  if (imageBase64 && query.trim()) return "COMBINED";
  if (imageBase64) return "IMAGE";
  if (query.trim()) return "TEXT";
  return null;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [alpha, setAlpha] = useState(0.5);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [refine, setRefine] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = getSearchMode(query, imageBase64);

  async function runSearch(nextQuery = query, nextFilters = filters, nextImage = imageBase64) {
    const nextMode = getSearchMode(nextQuery, nextImage);
    if (!nextMode) return;

    const route = `/api/search/${nextMode.toLowerCase()}`;
    const body =
      nextMode === "TEXT"
        ? { query: nextQuery.trim(), ...nextFilters }
        : nextMode === "IMAGE"
          ? { image: nextImage }
          : { image: nextImage, query: nextQuery.trim(), alpha };

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(payload.error || "Search request failed");
      setResults(payload.results ?? []);
      setLastQuery(nextQuery.trim() || "[image]");
      setHasSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleFiltersChange(nextFilters: SearchFilters) {
    setFilters(nextFilters);
    if (getSearchMode(query, imageBase64)) void runSearch(query, nextFilters, imageBase64);
  }

  function handleRefine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refine.trim()) return;
    const nextQuery = `${query.trim()} ${refine.trim()}`.trim();
    setQuery(nextQuery);
    setRefine("");
    void runSearch(nextQuery, filters, imageBase64);
  }

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, query: lastQuery }),
    });
  }

  function showSimilarResults(nextResults: Product[]) {
    setResults(nextResults);
    setLastQuery("[image]");
    setHasSearched(true);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8 sm:py-12">
      <header className="grid gap-5 border-b-[3px] border-ink pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 text-sm font-bold uppercase text-accent">MULTIMODAL PRODUCT DISCOVERY // 001</p>
          <h1 className="max-w-5xl text-4xl font-bold uppercase leading-[0.92] tracking-[-0.07em] sm:text-6xl lg:text-8xl">
            SEARCH THE CATALOGUE
          </h1>
        </div>
        <div className="w-fit border-[3px] border-ink bg-accent px-4 py-2 text-sm font-bold uppercase">
          MODE // {mode ?? "WAITING"}
        </div>
      </header>

      <section className="grid border-b-[3px] border-ink lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5 py-8 lg:border-r-[3px] lg:border-ink lg:pr-8">
          <SearchBar query={query} loading={loading} canSearch={Boolean(mode)} onQueryChange={setQuery} onSubmit={() => void runSearch()} />
          {imageBase64 && query.trim() ? <AlphaSlider value={alpha} onChange={setAlpha} /> : null}
        </div>
        <div className="border-t-[3px] border-ink py-8 lg:border-t-0 lg:pl-8">
          <ImageDrop imageBase64={imageBase64} onImageChange={setImageBase64} />
        </div>
      </section>

      <FilterChips filters={filters} onChange={handleFiltersChange} />

      {error ? <div className="my-8 border-[3px] border-ink bg-accent p-5 font-bold uppercase">ERROR // {error}</div> : null}
      {loading ? <div className="my-10 border-[3px] border-ink bg-ink p-8 text-center text-3xl font-bold uppercase text-white shadow-brut-accent">LOADING…</div> : null}

      <section className="py-10">
        <div className="mb-8 flex items-end justify-between gap-4 border-b-[3px] border-ink pb-4">
          <h2 className="text-2xl font-bold uppercase sm:text-4xl">RESULTS // {results.length.toString().padStart(2, "0")}</h2>
          {hasSearched ? <span className="text-xs font-bold uppercase">QUERY: {lastQuery}</span> : null}
        </div>
        {!loading ? <ResultGrid results={results} hasSearched={hasSearched} onSelect={selectProduct} /> : null}
      </section>

      {hasSearched ? (
        <form onSubmit={handleRefine} className="grid gap-3 border-t-[3px] border-ink pt-8 md:grid-cols-[auto_1fr_auto] md:items-center">
          <label htmlFor="refine-query" className="text-xl font-bold uppercase">
            REFINE →
          </label>
          <input
            id="refine-query"
            className="brut-input min-h-14 px-4 font-bold"
            placeholder="BUT IN RED"
            value={refine}
            onChange={(event) => setRefine(event.target.value)}
          />
          <button className="brut-button min-h-14 px-6" type="submit" disabled={!refine.trim() || loading}>
            APPLY
          </button>
        </form>
      ) : null}

      {selectedProduct ? (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onFindSimilar={showSimilarResults} />
      ) : null}
    </div>
  );
}
