import Image from "next/image";

export interface ProductAttributes {
  colour?: string;
  style?: string;
  material?: string;
  shape?: string;
  category?: string;
}

export interface Product {
  id: string | number;
  name: string;
  category: string;
  base_colour: string;
  attributes: ProductAttributes | null;
  ai_description: string;
  image_path: string;
  score: number;
}

interface ResultGridProps {
  results: Product[];
  hasSearched: boolean;
  onSelect: (product: Product) => void;
}

export default function ResultGrid({ results, hasSearched, onSelect }: ResultGridProps) {
  if (hasSearched && results.length === 0) {
    return (
      <div className="shadow-brut-accent border-[3px] border-ink bg-paper p-8 text-center">
        <p className="text-2xl font-bold uppercase sm:text-3xl">NO MATCHES // LOGGED AS GAP</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {results.map((product) => (
        <button
          key={product.id}
          type="button"
          className="brut-interactive shadow-brut flex min-w-0 flex-col border-[3px] border-ink bg-paper text-left"
          onClick={() => onSelect(product)}
        >
          <div className="relative aspect-square w-full border-b-[3px] border-ink bg-paper">
            <Image src={product.image_path} alt={product.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-contain p-4" />
          </div>
          <div className="flex min-h-32 flex-1 flex-col justify-between gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 font-bold uppercase">{product.name}</h3>
              <span className="shrink-0 border-[3px] border-ink bg-accent px-2 py-1 text-xs font-bold">
                {Number(product.score).toFixed(2)}
              </span>
            </div>
            <span className="w-fit border-[3px] border-ink px-2 py-1 text-xs font-bold uppercase">
              {product.attributes?.colour || product.base_colour || "UNKNOWN"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
