"use client";

import { useEffect, useState } from "react";

interface AnalyticsPayload {
  total_searches: number;
  zero_result_rate: number;
  abandonment_rate: number;
  ctr: number;
  gaps: [string, number][];
}

const EMPTY_ANALYTICS: AnalyticsPayload = {
  total_searches: 0,
  zero_result_rate: 0,
  abandonment_rate: 0,
  ctr: 0,
  gaps: [],
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const response = await fetch("/api/analytics");
        if (!response.ok) throw new Error("Analytics request failed");
        setAnalytics((await response.json()) as AnalyticsPayload);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Analytics request failed");
      } finally {
        setLoading(false);
      }
    }
    void loadAnalytics();
  }, []);

  const metrics = [
    ["TOTAL SEARCHES", analytics.total_searches.toLocaleString()],
    ["ZERO-RESULT %", percent(analytics.zero_result_rate)],
    ["ABANDONMENT %", percent(analytics.abandonment_rate)],
    ["CTR", percent(analytics.ctr)],
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8 sm:py-12">
      <header className="border-b-[3px] border-ink pb-8">
        <p className="mb-3 text-sm font-bold uppercase text-accent">SEARCH PERFORMANCE // LIVE</p>
        <h1 className="text-5xl font-bold uppercase leading-none tracking-[-0.07em] sm:text-7xl lg:text-8xl">ANALYTICS</h1>
      </header>

      {loading ? <div className="my-10 border-[3px] border-ink bg-ink p-8 text-center text-3xl font-bold uppercase text-white shadow-brut-accent">LOADING…</div> : null}
      {error ? <div className="my-10 border-[3px] border-ink bg-accent p-5 font-bold uppercase">ERROR // {error}</div> : null}

      {!loading && !error ? (
        <>
          <section className="grid gap-6 py-10 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(([label, value]) => (
              <article key={label} className="shadow-brut border-[3px] border-ink bg-paper p-5">
                <p className="text-xs font-bold uppercase text-accent">{label}</p>
                <p className="mt-5 break-words text-4xl font-bold uppercase tracking-[-0.06em] sm:text-5xl">{value}</p>
              </article>
            ))}
          </section>

          <section className="border-t-[3px] border-ink pt-8">
            <div className="mb-6">
              <h2 className="text-3xl font-bold uppercase tracking-[-0.05em] sm:text-5xl">CATALOGUE GAPS</h2>
              <p className="mt-2 text-sm font-bold uppercase text-accent">DEMAND WITH NO MATCHING PRODUCT</p>
            </div>
            <div className="overflow-x-auto border-[3px] border-ink shadow-brut-accent">
              {analytics.gaps.length > 0 ? (
                <table className="w-full border-collapse text-left">
                  <thead className="bg-ink text-white">
                    <tr>
                      <th className="border-r-[3px] border-ink p-4 text-xs uppercase">RANK</th>
                      <th className="border-r-[3px] border-ink p-4 text-xs uppercase">ZERO-RESULT QUERY</th>
                      <th className="p-4 text-right text-xs uppercase">COUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.gaps.map(([query, count], index) => (
                      <tr key={`${query}-${index}`} className="border-t-[3px] border-ink first:border-t-0">
                        <td className="border-r-[3px] border-ink p-4 font-bold">{String(index + 1).padStart(2, "0")}</td>
                        <td className="border-r-[3px] border-ink p-4 font-bold uppercase">{query}</td>
                        <td className="bg-accent p-4 text-right text-xl font-bold">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-10 text-center text-2xl font-bold uppercase">NO GAPS YET</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
