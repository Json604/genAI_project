import type { FormEvent } from "react";

interface SearchBarProps {
  query: string;
  loading: boolean;
  canSearch: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
}

export default function SearchBar({ query, loading, canSearch, onQueryChange, onSubmit }: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_auto]">
      <label className="sr-only" htmlFor="search-query">
        Describe what you want
      </label>
      <input
        id="search-query"
        className="brut-input min-h-16 w-full px-4 text-base font-bold uppercase sm:text-xl"
        placeholder="DESCRIBE WHAT YOU WANT…"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <button className="brut-button min-h-16 px-8 text-lg" type="submit" disabled={!canSearch || loading}>
        {loading ? "SEARCHING…" : "SEARCH"}
      </button>
    </form>
  );
}
