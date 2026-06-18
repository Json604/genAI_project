import { NextRequest, NextResponse } from "next/server";
import { jinaEmbed } from "@/lib/jina";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const {
    query,
    colour = null,
    category = null,
    style = null,
    material = null,
    shape = null,
  } = await req.json();

  const [vec] = await jinaEmbed([{ text: query }]);
  const { data, error } = await supabase.rpc("match_products_text", {
    query_embedding: vec,
    match_count: 24,
    filter_colour: colour,
    filter_category: category,
    filter_style: style,
    filter_material: material,
    filter_shape: shape,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("searches").insert({
    query,
    search_type: "text",
    filters: { colour, category, style, material, shape },
    num_results: data.length,
  });

  return NextResponse.json({ results: data });
}
