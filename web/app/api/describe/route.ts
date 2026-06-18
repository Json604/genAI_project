import { NextRequest, NextResponse } from "next/server";
import { geminiDescribe } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { image } = await req.json();
  try {
    return NextResponse.json(await geminiDescribe(image));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Describe request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
