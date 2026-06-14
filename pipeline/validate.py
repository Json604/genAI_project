"""Validate the catalogue API against the project's success metrics."""

from __future__ import annotations

import base64
import json
import os
import random
from datetime import date
from pathlib import Path
from typing import Any

import requests


PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_DIR.parent
SAMPLE_PATH = PIPELINE_DIR / "cache" / "sample.json"
ATTRS_DIR = PIPELINE_DIR / "cache" / "attrs"
CATALOGUE_DIR = PROJECT_ROOT / "web" / "public" / "catalogue"
REPORT_PATH = PROJECT_ROOT / "docs" / "validation-results.md"
BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
REQUEST_TIMEOUT = 60
ATTRIBUTE_KEYS = ("colour", "style", "material", "shape", "category")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def image_base64(product_id: str) -> str:
    encoded = base64.b64encode(
        (CATALOGUE_DIR / f"{product_id}.jpg").read_bytes()
    ).decode("ascii")
    return encoded.split(",", 1)[-1] if encoded.startswith("data:") else encoded


def post_results(
    session: requests.Session, endpoint: str, payload: dict[str, Any]
) -> list[dict[str, Any]]:
    response = session.post(
        f"{BASE_URL}/api/search/{endpoint}",
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    body = response.json()
    if not isinstance(body, dict):
        raise ValueError(f"/{endpoint} response is not a JSON object")
    results = body.get("results")
    if not isinstance(results, list):
        raise ValueError(f"/{endpoint} response does not contain a results list")
    if not all(isinstance(result, dict) for result in results):
        raise ValueError(f"/{endpoint} response contains a non-object result")
    return results


def product_label(product: dict[str, Any] | None) -> str:
    if not product:
        return "no result"
    return (
        f"{product.get('id', '?')} - {product.get('name', 'unnamed')} "
        f"[{product.get('base_colour', 'unknown colour')}]"
    )


def test_image_search(
    session: requests.Session, products: list[dict[str, Any]]
) -> tuple[int, int, list[str]]:
    eligible = [
        product
        for product in products
        if (CATALOGUE_DIR / f"{product['id']}.jpg").is_file()
    ]
    if len(eligible) < 10:
        raise RuntimeError(f"need 10 catalogue images, found {len(eligible)}")

    selected = eligible[:10]
    passed = 0
    details = []
    print("\nTest 1: image search top-5 self match")

    for product in selected:
        product_id = str(product["id"])
        try:
            results = post_results(
                session, "image", {"image": image_base64(product_id)}
            )
            top_five_ids = {str(result.get("id")) for result in results[:5]}
            assert product_id in top_five_ids, f"{product_id} absent from top 5"
        except (AssertionError, OSError, ValueError, requests.RequestException) as exc:
            message = f"FAIL {product_id}: {exc}"
        else:
            passed += 1
            message = f"PASS {product_id}: found in top 5"
        print(message)
        details.append(message)

    rate = passed / len(selected) * 100
    print(f"Image-search pass rate: {passed}/{len(selected)} ({rate:.1f}%)")
    return passed, len(selected), details


def choose_combined_cases(
    products: list[dict[str, Any]], count: int = 6
) -> list[tuple[dict[str, Any], str]]:
    by_article_type: dict[str, list[dict[str, Any]]] = {}
    for product in products:
        article_type = str(product.get("article_type", "")).strip().casefold()
        if article_type:
            by_article_type.setdefault(article_type, []).append(product)

    cases = []
    used_article_types = set()
    for product in products:
        product_id = str(product["id"])
        article_type = str(product.get("article_type", "")).strip().casefold()
        source_colour = str(product.get("base_colour", "")).strip().casefold()
        if not article_type or article_type in used_article_types:
            continue
        if not (CATALOGUE_DIR / f"{product_id}.jpg").is_file():
            continue

        alternatives = by_article_type.get(article_type, [])
        target = next(
            (
                candidate
                for candidate in alternatives
                if str(candidate.get("base_colour", "")).strip().casefold()
                and str(candidate.get("base_colour", "")).strip().casefold()
                != source_colour
            ),
            None,
        )
        if target is None:
            continue
        cases.append((product, str(target["base_colour"])))
        used_article_types.add(article_type)
        if len(cases) == count:
            return cases

    raise RuntimeError(f"could not construct {count} different-colour, same-style cases")


def colour_matches(result: dict[str, Any] | None, requested_colour: str) -> bool:
    if not result:
        return False
    values = [result.get("base_colour", "")]
    attributes = result.get("attributes")
    if isinstance(attributes, dict):
        values.append(attributes.get("colour", ""))
    needle = requested_colour.casefold()
    return any(needle in str(value).casefold() for value in values)


def style_matches(
    result: dict[str, Any] | None,
    source: dict[str, Any],
    products_by_id: dict[str, dict[str, Any]],
) -> bool:
    if not result:
        return False
    matched_product = products_by_id.get(str(result.get("id")))
    if not matched_product:
        return False
    return str(matched_product.get("article_type", "")).casefold() == str(
        source.get("article_type", "")
    ).casefold()


def signal_score(
    result: dict[str, Any] | None,
    source: dict[str, Any],
    requested_colour: str,
    products_by_id: dict[str, dict[str, Any]],
) -> tuple[int, bool, bool]:
    has_style = style_matches(result, source, products_by_id)
    has_colour = colour_matches(result, requested_colour)
    return int(has_style) + int(has_colour), has_style, has_colour


def test_combined_search(
    session: requests.Session, products: list[dict[str, Any]]
) -> list[str]:
    products_by_id = {str(product["id"]): product for product in products}
    observations = []
    print("\nTest 2: combined search vs single signals")

    for index, (source, target_colour) in enumerate(choose_combined_cases(products), 1):
        query = f"in {target_colour}"
        source_id = str(source["id"])
        payload_image = image_base64(source_id)

        # Uploading an exact catalogue image trivially self-matches (image-sim = 1.0),
        # which is not the real use case. Exclude the source product so we compare the
        # next-best matches the way a real uploaded photo would behave.
        def top_excl(kind: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
            results = [r for r in post_results(session, kind, payload) if str(r["id"]) != source_id]
            return results[:1]

        try:
            image_top = top_excl("image", {"image": payload_image})
            text_top = top_excl("text", {"query": query})
            combined_top = top_excl(
                "combined",
                {"image": payload_image, "query": query, "alpha": 0.5},
            )
            tops = {
                "image": image_top[0] if image_top else None,
                "text": text_top[0] if text_top else None,
                "combined": combined_top[0] if combined_top else None,
            }
            scores = {
                name: signal_score(result, source, target_colour, products_by_id)
                for name, result in tops.items()
            }
            combined_better = (
                scores["combined"][1]
                and scores["combined"][2]
                and scores["combined"][0] > scores["image"][0]
                and scores["combined"][0] > scores["text"][0]
            )
            verdict = "PASS" if combined_better else "OBSERVE"
            observation = (
                f"{verdict} case {index}: source {product_label(source)}, query "
                f"'{query}'. Image-only: {product_label(tops['image'])}; text-only: "
                f"{product_label(tops['text'])}; combined: {product_label(tops['combined'])}. "
                f"Combined style={scores['combined'][1]}, colour={scores['combined'][2]}; "
                f"better than both single signals={combined_better}."
            )
        except (OSError, ValueError, requests.RequestException) as exc:
            observation = f"FAIL case {index}: {exc}"
        print(observation)
        observations.append(observation)

    return observations


def test_attributes() -> tuple[int, int, list[str]]:
    files = sorted(ATTRS_DIR.glob("*.json"))
    if len(files) < 5:
        raise RuntimeError(f"need 5 attribute files, found {len(files)}")

    selected = random.sample(files, 5)
    passed = 0
    details = []
    print("\nTest 3: extracted attributes")

    for path in selected:
        try:
            attributes = load_json(path)
            non_empty = [
                key
                for key in ATTRIBUTE_KEYS
                if isinstance(attributes.get(key), str) and attributes[key].strip()
            ]
            assert len(non_empty) >= 4, f"only {len(non_empty)} non-empty values"
        except (AssertionError, OSError, ValueError, AttributeError) as exc:
            message = f"FAIL {path.stem}: {exc}"
        else:
            passed += 1
            message = f"PASS {path.stem}: {len(non_empty)}/5 non-empty values"
        print(message)
        details.append(message)

    print(f"Attribute check: {passed}/{len(selected)} passed")
    return passed, len(selected), details


def write_report(
    image_result: tuple[int, int, list[str]],
    combined_observations: list[str],
    attribute_result: tuple[int, int, list[str]],
) -> None:
    image_passed, image_total, image_details = image_result
    attrs_passed, attrs_total, attrs_details = attribute_result
    image_rate = image_passed / image_total * 100 if image_total else 0.0
    lines = [
        "# Validation Results",
        "",
        f"Date: {date.today().isoformat()}",
        f"Base URL: `{BASE_URL}`",
        "",
        "## Image Search",
        "",
        f"Pass rate: **{image_passed}/{image_total} ({image_rate:.1f}%)**",
        "",
        *[f"- {detail}" for detail in image_details],
        "",
        "## Combined Search",
        "",
        *[f"- {observation}" for observation in combined_observations],
        "",
        "## Attribute Check",
        "",
        f"Result: **{attrs_passed}/{attrs_total} passed**",
        "",
        *[f"- {detail}" for detail in attrs_details],
        "",
    ]
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote validation summary to {REPORT_PATH}")


def main() -> None:
    products = load_json(SAMPLE_PATH)
    if not isinstance(products, list):
        raise ValueError(f"{SAMPLE_PATH} must contain a JSON list")

    with requests.Session() as session:
        image_result = test_image_search(session, products)
        combined_observations = test_combined_search(session, products)
    attribute_result = test_attributes()
    write_report(image_result, combined_observations, attribute_result)

    image_passed, image_total, _ = image_result
    attrs_passed, attrs_total, _ = attribute_result
    if image_passed != image_total or attrs_passed != attrs_total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
