export interface SearchFilters {
  colour?: string;
  category?: string;
  style?: string;
  material?: string;
  shape?: string;
}

interface FilterChipsProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

const GROUPS: { key: keyof SearchFilters; label: string; values: string[] }[] = [
  {
    key: "colour",
    label: "COLOUR",
    values: ["black", "white", "red", "blue", "green", "pink", "purple", "yellow", "grey", "brown"],
  },
  {
    key: "category",
    label: "CATEGORY",
    values: ["Apparel", "Accessories", "Footwear", "Personal Care"],
  },
  {
    key: "style",
    label: "STYLE",
    values: ["casual", "formal", "classic", "sporty", "athletic", "modern", "traditional", "compact"],
  },
  {
    key: "material",
    label: "MATERIAL",
    values: ["cotton", "leather", "metal", "plastic", "denim", "silk", "nylon", "fabric"],
  },
  {
    key: "shape",
    label: "SHAPE",
    values: ["round", "rectangular", "straight", "fitted", "a-line", "slim fit", "cylindrical", "square"],
  },
];

function chipClass(active: boolean) {
  return `border-[3px] border-ink px-3 py-2 text-xs font-bold uppercase transition-colors ${
    active ? "bg-link text-white" : "bg-paper hover:bg-accent"
  }`;
}

export default function FilterChips({ filters, onChange }: FilterChipsProps) {
  return (
    <section className="space-y-4 border-y-[3px] border-ink py-5">
      {GROUPS.map(({ key, label, values }) => (
        <div key={key} className="grid gap-3 sm:grid-cols-[110px_1fr]">
          <h2 className="text-sm font-bold uppercase">{`${label} //`}</h2>
          <div className="flex flex-wrap gap-2">
            {values.map((value) => {
              const active = filters[key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={chipClass(active)}
                  aria-pressed={active}
                  onClick={() => onChange({ ...filters, [key]: active ? undefined : value })}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
