import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { product_id, query } = await req.json();
  await supabase.from("searches").insert({ query, search_type: "click", clicked_product_id: product_id, num_results: 0 });
  return NextResponse.json({ ok: true });
}
