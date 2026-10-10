"""
Completes data224 after prepare_v2.py: adds cat and dog photos to NOT_CXR (Google's cats_and_dogs
set, fast mirror) and writes split.csv for every image present (70/15/15 per class + source).
"""
import csv, os, random, zipfile
from collections import Counter, defaultdict

from PIL import Image

from prepare_v2 import OUT, SEED, square

random.seed(SEED)
import io
import pyarrow.parquet as pq

def add(parquet, column, tag, n):
    rows = pq.read_table(parquet, columns=[column]).column(column).to_pylist()
    random.shuffle(rows)
    k = 0
    for r in rows:
        if k >= n:
            break
        dst = os.path.join(OUT, "NOT_CXR", f"photo_{tag}_{k}.png")
        try:
            if not os.path.exists(dst):
                square(Image.open(io.BytesIO(r["bytes"])), grey=random.random() < 0.7).save(dst)
            k += 1
        except Exception:
            pass   # a few photos in these sets are corrupt

add(r"D:\PredictDx-AI\cache\pets.parquet", "image", "pet", 1200)      # real cat and dog photos
add(r"D:\PredictDx-AI\cache\cifar10_test.parquet", "img", "object", 800)  # planes, cars, birds, ships, trucks...
print("pets done", flush=True)

rows = []
for label in ["NORMAL", "PNEUMONIA", "TUBERCULOSIS", "NOT_CXR"]:
    for name in sorted(os.listdir(os.path.join(OUT, label))):
        source = name.split("_")[0] if label != "NOT_CXR" else name.split("_")[1]   # adult/child, or flower/pet
        rows.append({"file": f"{label}/{name}", "label": label, "source": source})
groups = defaultdict(list)
for r in rows:
    groups[(r["label"], r["source"])].append(r)
for g in groups.values():
    random.shuffle(g)
    for i, r in enumerate(g):
        r["split"] = "train" if i < 0.70 * len(g) else ("val" if i < 0.85 * len(g) else "test")
with open(os.path.join(OUT, "split.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["file", "label", "source", "split"])
    w.writeheader()
    w.writerows(rows)
for k, v in sorted(Counter((r["label"], r["source"], r["split"]) for r in rows).items()):
    print(k, v)
