export interface SearchFilters {
  colour?: string;
  category?: string;
}

interface FilterChipsProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

const colours = ["black", "white", "red", "blue", "green", "pink", "purple", "yellow", "grey", "brown"];
const categories = ["Apparel", "Accessories", "Footwear", "Personal Care"];

function chipClass(active: boolean) {
  return `border-[3px] border-ink px-3 py-2 text-xs font-bold uppercase transition-colors ${
    active ? "bg-link text-white" : "bg-paper hover:bg-accent"
  }`;
}

export default function FilterChips({ filters, onChange }: FilterChipsProps) {
  return (
    <section className="space-y-4 border-y-[3px] border-ink py-5">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <h2 className="text-sm font-bold uppercase">COLOUR //</h2>
        <div className="flex flex-wrap gap-2">
          {colours.map((colour) => (
            <button
              key={colour}
              type="button"
              className={chipClass(filters.colour === colour)}
              aria-pressed={filters.colour === colour}
              onClick={() => onChange({ ...filters, colour: filters.colour === colour ? undefined : colour })}
            >
              {colour}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <h2 className="text-sm font-bold uppercase">CATEGORY //</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={chipClass(filters.category === category)}
              aria-pressed={filters.category === category}
              onClick={() => onChange({ ...filters, category: filters.category === category ? undefined : category })}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
