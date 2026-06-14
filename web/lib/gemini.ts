const PROMPT = `You are a fashion cataloguer. Return STRICT JSON only:
{"colour":"...","style":"...","material":"...","shape":"...","category":"...","description":"1-2 sentence product description"}
Lowercase concise values, JSON only.`;
export async function geminiDescribe(base64Jpeg: string) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [
        { text: PROMPT },
        { inline_data: { mime_type: "image/jpeg", data: base64Jpeg } }] }] }) });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const txt = j.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(txt);
}
