import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";

// Late fusion: score = alpha * image-similarity + (1 - alpha) * text-similarity,
// each query compared to its own catalogue embedding. This lets the image drive
// visual style while the text drives described attributes (e.g. colour).
export async function POST(req: NextRequest) {
  const { image, query, alpha = 0.5 } = await req.json();
  const [imgVec, txtVec] = await jinaEmbed([{ image }, { text: query }]);
  const { data, error } = await supabase.rpc("match_products_combined", {
    image_query: imgVec,
    text_query: txtVec,
    alpha,
    match_count: 24,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("searches").insert({ query, search_type: "combined", filters: { alpha }, num_results: data.length });
  return NextResponse.json({ results: data });
}
