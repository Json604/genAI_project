import { NextRequest, NextResponse } from "next/server";
import { geminiDescribe } from "@/lib/gemini";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const { image } = await req.json();
  try { return NextResponse.json(await geminiDescribe(image)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
