import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { image } = await req.json(); // base64 (no data: prefix)
  const [vec] = await jinaEmbed([{ image }]);
  const { data, error } = await supabase.rpc("match_products_image", { query_embedding: vec, match_count: 24 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("searches").insert({ query: "[image]", search_type: "image", num_results: data.length });
  return NextResponse.json({ results: data });
}
