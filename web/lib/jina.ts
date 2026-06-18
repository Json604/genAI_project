interface JinaEmbedding {
  embedding: number[];
}

interface JinaEmbeddingResponse {
  data: JinaEmbedding[];
}

export async function jinaEmbed(input: Array<{ text: string } | { image: string }>): Promise<number[][]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "jina-clip-v2", input }),
  });

  if (!response.ok) throw new Error(`jina ${response.status}`);

  const payload = (await response.json()) as JinaEmbeddingResponse;
  return payload.data.map((item) => item.embedding);
}
