import base64
import json
import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

CACHE = Path(__file__).parent / "cache"
CACHE.mkdir(exist_ok=True)

JINA_KEY = os.environ["JINA_API_KEY"]
GEMINI_KEY = os.environ["GEMINI_API_KEY"]


def cache_get(ns, key):
    cache_file = CACHE / ns / f"{key}.json"
    return json.loads(cache_file.read_text()) if cache_file.exists() else None


def cache_set(ns, key, val):
    cache_dir = CACHE / ns
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{key}.json").write_text(json.dumps(val))
    return val


def jina_embed(inputs):
    # inputs: list of {"text": ...} or {"image": <base64 or url>}
    for attempt in range(5):
        response = requests.post(
            "https://api.jina.ai/v1/embeddings",
            headers={
                "Authorization": f"Bearer {JINA_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": "jina-clip-v2", "input": inputs},
        )
        if response.status_code == 200:
            return [item["embedding"] for item in response.json()["data"]]
        if response.status_code in (429, 503):
            time.sleep(2**attempt)
            continue
        response.raise_for_status()
    raise RuntimeError("jina embed failed after retries")


def b64_image(path):
    return base64.b64encode(Path(path).read_bytes()).decode()
