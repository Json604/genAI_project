interface AlphaSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function AlphaSlider({ value, onChange }: AlphaSliderProps) {
  return (
    <section className="border-[3px] border-ink p-4">
      <div className="mb-4 flex items-end justify-between gap-4 font-bold uppercase">
        <span>IMAGE</span>
        <span className="border-[3px] border-ink bg-accent px-3 py-1 text-lg">α {value.toFixed(2)}</span>
        <span>TEXT</span>
      </div>
      <label className="sr-only" htmlFor="alpha-slider">
        Image and text weighting
      </label>
      <input
        id="alpha-slider"
        className="brut-range"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        dir="rtl"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </section>
  );
}
