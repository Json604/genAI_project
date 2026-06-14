import os, json, base64, time, hashlib, requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
CACHE = Path(__file__).parent / "cache"; CACHE.mkdir(exist_ok=True)
JINA_KEY = os.environ["JINA_API_KEY"]; GEMINI_KEY = os.environ["GEMINI_API_KEY"]

def cache_get(ns, key):
    f = CACHE / ns / f"{key}.json"
    return json.loads(f.read_text()) if f.exists() else None

def cache_set(ns, key, val):
    d = CACHE / ns; d.mkdir(parents=True, exist_ok=True)
    (d / f"{key}.json").write_text(json.dumps(val)); return val

def jina_embed(inputs):
    # inputs: list of {"text": ...} or {"image": <base64 or url>}
    for attempt in range(5):
        r = requests.post("https://api.jina.ai/v1/embeddings",
            headers={"Authorization": f"Bearer {JINA_KEY}", "Content-Type": "application/json"},
            json={"model": "jina-clip-v2", "input": inputs})
        if r.status_code == 200:
            return [d["embedding"] for d in r.json()["data"]]
        if r.status_code in (429, 503): time.sleep(2 ** attempt); continue
        r.raise_for_status()
    raise RuntimeError("jina embed failed after retries")

def b64_image(path):
    return base64.b64encode(Path(path).read_bytes()).decode()
