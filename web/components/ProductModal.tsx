"use client";

import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import type { Product } from "./ResultGrid";

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onFindSimilar: (results: Product[]) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Image could not be encoded"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Image could not be read"));
    reader.readAsDataURL(blob);
  });
}

export default function ProductModal({ product, onClose, onFindSimilar }: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function findSimilar() {
    setLoading(true);
    setError(null);
    try {
      const imageResponse = await fetch(product.image_path);
      if (!imageResponse.ok) throw new Error("Product image could not be loaded");
      const image = await blobToBase64(await imageResponse.blob());
      const searchResponse = await fetch("/api/search/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!searchResponse.ok) throw new Error("Similar product search failed");
      const payload = (await searchResponse.json()) as { results: Product[] };
      onFindSimilar(payload.results ?? []);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Similar product search failed");
    } finally {
      setLoading(false);
    }
  }

  const attributes = Object.entries(product.attributes ?? {}).filter(([, value]) => Boolean(value));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/75 p-4 sm:p-8" onMouseDown={handleBackdropClick} role="presentation">
      <section className="shadow-brut-accent mx-auto grid max-w-5xl border-[3px] border-ink bg-paper lg:grid-cols-2" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <div className="relative min-h-80 border-b-[3px] border-ink lg:min-h-[620px] lg:border-r-[3px] lg:border-b-0">
          <Image src={product.image_path} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-6" />
        </div>
        <div className="flex flex-col p-5 sm:p-8">
          <button className="ml-auto border-[3px] border-ink bg-paper px-3 py-1 text-xl font-bold hover:bg-accent" type="button" onClick={onClose} aria-label="Close product details">
            X
          </button>
          <p className="mt-8 text-xs font-bold uppercase text-accent">PRODUCT // {product.id}</p>
          <h2 id="product-modal-title" className="mt-2 text-3xl font-bold uppercase tracking-[-0.05em] sm:text-5xl">
            {product.name}
          </h2>
          <p className="mt-6 border-y-[3px] border-ink py-5 leading-7">{product.ai_description || "NO AI DESCRIPTION AVAILABLE."}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {attributes.map(([key, value]) => (
              <span key={key} className="border-[3px] border-ink px-3 py-2 text-xs font-bold uppercase">
                {key}: {value}
              </span>
            ))}
          </div>
          {error ? <p className="mt-6 border-[3px] border-ink bg-accent p-3 text-sm font-bold uppercase">{error}</p> : null}
          <button className="brut-button mt-auto min-h-14 px-5 py-3" type="button" onClick={findSimilar} disabled={loading}>
            {loading ? "SEARCHING…" : "FIND SIMILAR"}
          </button>
        </div>
      </section>
    </div>
  );
}
