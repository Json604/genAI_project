import json
import re
import time
from pathlib import Path

import google.generativeai as genai

from lib import GEMINI_KEY, b64_image, cache_get, cache_set


ROOT = Path(__file__).parents[1] / "web/public"
SAMPLE_PATH = Path(__file__).parent / "cache" / "sample.json"
REQUIRED_KEYS = ("colour", "style", "material", "shape", "category", "description")
MAX_ATTEMPTS = 8
MIN_INTERVAL = 0.5  # gentle spacing; billed Tier-1 quota, call latency (~2s) is the real pace
_last_call = [0.0]


def _throttle():
    wait = MIN_INTERVAL - (time.monotonic() - _last_call[0])
    if wait > 0:
        time.sleep(wait)
    _last_call[0] = time.monotonic()


def _rate_limited(exc):
    text = str(exc).lower()
    return "429" in text or "resourceexhausted" in text or "quota" in text or "rate" in text


def _retry_delay(exc, fallback):
    match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", str(exc))
    return float(match.group(1)) + 1 if match else fallback

PROMPT = """You are a fashion cataloguer. Look at the product image and return STRICT JSON only:
{"colour": "...", "style": "...", "material": "...", "shape": "...", "category": "...",
 "description": "a natural 1-2 sentence product description"}
Use concise lowercase values. material/shape: best visual guess. No markdown, JSON only."""

genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel("gemini-2.5-flash-lite")


def valid_attributes(value):
    return (
        isinstance(value, dict)
        and all(isinstance(value.get(key), str) and value[key].strip() for key in REQUIRED_KEYS)
    )


def parse_attributes(text):
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[len("```json") :]
    elif cleaned.startswith("```"):
        cleaned = cleaned[len("```") :]
    if cleaned.endswith("```"):
        cleaned = cleaned[: -len("```")]

    attributes = json.loads(cleaned.strip())
    if not valid_attributes(attributes):
        missing = [key for key in REQUIRED_KEYS if not attributes.get(key)]
        raise ValueError(f"invalid attribute response; missing or empty keys: {missing}")
    return {key: attributes[key].strip() for key in REQUIRED_KEYS}


def extract(rec):
    cached = cache_get("attrs", rec["id"])
    if valid_attributes(cached):
        return cached

    image_path = ROOT / rec["image_path"].lstrip("/")
    image = {"mime_type": "image/jpeg", "data": b64_image(image_path)}
    last_error = None

    for attempt in range(MAX_ATTEMPTS):
        try:
            _throttle()
            response = model.generate_content([PROMPT, image], request_options={"timeout": 60})
            attributes = parse_attributes(response.text)
            return cache_set("attrs", rec["id"], attributes)
        except Exception as exc:
            last_error = exc
            if attempt == MAX_ATTEMPTS - 1:
                break
            # Honor server retry_delay on rate limits; short backoff otherwise.
            delay = _retry_delay(exc, min(60, 30)) if _rate_limited(exc) else 2**attempt
            print(f"{rec['id']} retry {attempt + 1}/{MAX_ATTEMPTS - 1} in {delay:.0f}s: {str(exc)[:80]}")
            time.sleep(delay)

    raise RuntimeError(f"Gemini extraction failed after {MAX_ATTEMPTS} attempts") from last_error


def main():
    sample = json.loads(SAMPLE_PATH.read_text())
    failed = []

    for index, rec in enumerate(sample, start=1):
        try:
            extract(rec)
            print(f"{index}/{len(sample)} {rec['id']} ok")
        except Exception as exc:
            failed.append(rec["id"])
            print(f"{index}/{len(sample)} {rec['id']} FAIL {exc}")

    if failed:
        print(f"failed products ({len(failed)}): {', '.join(failed)}")
        raise SystemExit(1)

    print(f"attribute files: {len(sample)}")


if __name__ == "__main__":
    main()
