import json
import os
import time
from pathlib import Path

from supabase import create_client

from extract_attributes import extract, valid_attributes
from lib import b64_image, cache_get, cache_set, jina_embed


ROOT = Path(__file__).parents[1] / "web/public"
SAMPLE_PATH = Path(__file__).parent / "cache" / "sample.json"
EMBEDDING_DIMENSION = 1024
MAX_JINA_ROUNDS = 4
MAX_UPSERT_ATTEMPTS = 5


def valid_embedding(value):
    return (
        isinstance(value, list)
        and len(value) == EMBEDDING_DIMENSION
        and all(isinstance(item, (int, float)) for item in value)
    )


def valid_embedding_cache(value):
    return (
        isinstance(value, dict)
        and valid_embedding(value.get("text_vec"))
        and valid_embedding(value.get("img_vec"))
        and valid_attributes(value.get("attrs"))
    )


def embed_with_backoff(inputs, product_id, modality):
    last_error = None
    for round_number in range(MAX_JINA_ROUNDS):
        try:
            return jina_embed(inputs)
        except RuntimeError as exc:
            last_error = exc
            if round_number == MAX_JINA_ROUNDS - 1:
                break
            delay = 5 * (round_number + 1)
            print(f"{product_id} Jina {modality} throttled; sleeping {delay}s")
            time.sleep(delay)
    raise RuntimeError(f"Jina {modality} embedding failed after repeated retries") from last_error


def embedding_text(rec, attrs):
    return (
        f"{rec['name']}. {attrs['description']} "
        f"colour {attrs['colour']}, style {attrs['style']}, "
        f"material {attrs['material']}, shape {attrs['shape']}, "
        f"category {attrs['category']}."
    )


def embeddings_for(rec):
    cached = cache_get("emb", rec["id"])
    if valid_embedding_cache(cached):
        return cached

    attrs = extract(rec)
    text_vector = embed_with_backoff(
        [{"text": embedding_text(rec, attrs)}], rec["id"], "text"
    )[0]
    image_path = ROOT / rec["image_path"].lstrip("/")
    image_vector = embed_with_backoff(
        [{"image": b64_image(image_path)}], rec["id"], "image"
    )[0]

    embedded = {"text_vec": text_vector, "img_vec": image_vector, "attrs": attrs}
    if not valid_embedding_cache(embedded):
        raise ValueError(f"{rec['id']} received an invalid embedding response")
    return cache_set("emb", rec["id"], embedded)


def product_row(rec, embedded):
    attrs = embedded["attrs"]
    return {
        "id": rec["id"],
        "name": rec["name"],
        "category": rec["category"],
        "sub_category": rec["sub_category"],
        "article_type": rec["article_type"],
        "base_colour": rec["base_colour"],
        "gender": rec["gender"],
        "attributes": attrs,
        "ai_description": attrs["description"],
        "image_path": rec["image_path"],
        "text_embedding": embedded["text_vec"],
        "image_embedding": embedded["img_vec"],
    }


def upsert_with_retry(client, row):
    last_error = None
    for attempt in range(MAX_UPSERT_ATTEMPTS):
        try:
            client.table("products").upsert(row).execute()
            return
        except Exception as exc:
            last_error = exc
            if attempt == MAX_UPSERT_ATTEMPTS - 1:
                break
            delay = 2**attempt
            print(f"{row['id']} Supabase retry in {delay}s: {exc}")
            time.sleep(delay)
    raise RuntimeError(f"Supabase upsert failed for {row['id']}") from last_error


def exact_count(table, non_null_fields=()):
    query = table.select("id", count="exact", head=True)
    for field in non_null_fields:
        query = query.not_.is_(field, "null")
    response = query.execute()
    if response.count is None:
        raise RuntimeError("Supabase did not return an exact count")
    return response.count


def verify(client):
    products_count = exact_count(client.table("products"))
    embedded_count = exact_count(
        client.table("products"), ("text_embedding", "image_embedding")
    )
    return products_count, embedded_count


def main():
    sample = json.loads(SAMPLE_PATH.read_text())
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    for index, rec in enumerate(sample, start=1):
        embedded = embeddings_for(rec)
        upsert_with_retry(client, product_row(rec, embedded))
        print(f"{index}/{len(sample)} upserted {rec['id']}")

    products_count, embedded_count = verify(client)
    print(f"products in Supabase: {products_count}")
    print(f"products with non-null embeddings: {embedded_count}")
    if products_count != len(sample) or embedded_count != len(sample):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
