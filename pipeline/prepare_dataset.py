import json
import random
import shutil
from collections import defaultdict, deque
from pathlib import Path

import kagglehub
import pandas as pd
from datasets import load_dataset
from PIL import Image


SAMPLE_SIZE = 400
RANDOM_SEED = 42
HF_DATASET = "ashraq/fashion-product-images-small"
KAGGLE_DATASET = "paramaggarwal/fashion-product-images-small"
PIPELINE_DIR = Path(__file__).parent
PROJECT_DIR = PIPELINE_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "web" / "public" / "catalogue"
SAMPLE_PATH = PIPELINE_DIR / "cache" / "sample.json"
REQUIRED_COLUMNS = {
    "id",
    "gender",
    "masterCategory",
    "subCategory",
    "articleType",
    "baseColour",
    "productDisplayName",
}


def candidate_indices(article_types):
    grouped = defaultdict(list)
    for index, article_type in enumerate(article_types):
        if article_type:
            grouped[str(article_type)].append(index)

    rng = random.Random(RANDOM_SEED)
    queues = []
    for article_type in sorted(grouped):
        indices = grouped[article_type]
        rng.shuffle(indices)
        queues.append(deque(indices))

    while queues:
        remaining = []
        for queue in queues:
            yield queue.popleft()
            if queue:
                remaining.append(queue)
        queues = remaining


def record_from_row(row):
    product_id = str(row["id"])
    return {
        "id": product_id,
        "name": str(row["productDisplayName"] or ""),
        "category": str(row["masterCategory"] or ""),
        "sub_category": str(row["subCategory"] or ""),
        "article_type": str(row["articleType"] or ""),
        "base_colour": str(row["baseColour"] or ""),
        "gender": str(row["gender"] or ""),
        "image_path": f"/catalogue/{product_id}.jpg",
    }


def reset_output_dir():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for image_path in OUTPUT_DIR.glob("*.jpg"):
        image_path.unlink()


def save_image(image, destination):
    if not isinstance(image, Image.Image):
        raise TypeError("dataset image is not a Pillow image")
    image.convert("RGB").save(destination, format="JPEG", quality=90)


def sample_hugging_face():
    dataset = load_dataset(HF_DATASET, split="train")
    missing = REQUIRED_COLUMNS.difference(dataset.column_names)
    if missing:
        raise ValueError(f"Hugging Face dataset missing columns: {sorted(missing)}")

    records = []
    seen_ids = set()
    for index in candidate_indices(dataset["articleType"]):
        row = dataset[index]
        record = record_from_row(row)
        if record["id"] in seen_ids:
            continue
        try:
            save_image(row["image"], OUTPUT_DIR / f"{record['id']}.jpg")
        except Exception as error:
            print(f"skipping {record['id']}: {error}")
            continue
        records.append(record)
        seen_ids.add(record["id"])
        if len(records) == SAMPLE_SIZE:
            return records, f"Hugging Face: {HF_DATASET}"

    raise RuntimeError(f"Hugging Face source produced only {len(records)} valid products")


def find_kaggle_files(root):
    styles = next(root.rglob("styles.csv"), None)
    images = next((path for path in root.rglob("images") if path.is_dir()), None)
    if styles is None or images is None:
        raise FileNotFoundError("Kaggle dataset is missing styles.csv or images/")
    return styles, images


def sample_kaggle():
    root = Path(kagglehub.dataset_download(KAGGLE_DATASET))
    styles_path, images_dir = find_kaggle_files(root)
    frame = pd.read_csv(styles_path, on_bad_lines="skip")
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(f"Kaggle dataset missing columns: {sorted(missing)}")

    records = []
    seen_ids = set()
    for index in candidate_indices(frame["articleType"].tolist()):
        row = frame.iloc[index].to_dict()
        record = record_from_row(row)
        if record["id"] in seen_ids:
            continue
        source = images_dir / f"{record['id']}.jpg"
        if not source.exists():
            continue
        shutil.copy2(source, OUTPUT_DIR / source.name)
        records.append(record)
        seen_ids.add(record["id"])
        if len(records) == SAMPLE_SIZE:
            return records, f"Kaggle: {KAGGLE_DATASET}"

    raise RuntimeError(f"Kaggle source produced only {len(records)} valid products")


def main():
    reset_output_dir()
    try:
        records, source = sample_hugging_face()
    except Exception as error:
        print(f"Hugging Face source unavailable ({error}); trying Kaggle fallback")
        reset_output_dir()
        records, source = sample_kaggle()

    SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SAMPLE_PATH.write_text(json.dumps(records))
    print(f"sampled {len(records)} products")
    print(f"dataset source: {source}")


if __name__ == "__main__":
    main()
