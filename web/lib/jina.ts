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
