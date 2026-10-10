"""
PredictDx training set v2 (run with D:\\PredictDx-AI\\venv python).

Classes: NORMAL, PNEUMONIA, TUBERCULOSIS, NOT_CXR
Every image -> greyscale -> shorter side 224 -> centre crop 224x224 -> PNG.
224 is the smallest source size (the adult pneumonia set), so no class is sharper or blurrier
than another - the model has to learn anatomy, not image quality.
"""
import csv, os, random, tarfile
from collections import Counter, defaultdict

import numpy as np
from PIL import Image, ImageOps

SRC = r"C:\Users\clicks\Documents\FYP\Balanced_dataset_clean"
OUT = r"D:\PredictDx-AI\data224"
SIZE, SEED = 224, 42
random.seed(SEED)

FOLDERS = [
    ("Normal", "NORMAL", "adult"),
    ("Pediatric_Normal", "NORMAL", "child"),
    ("Pediatric_Pneumonia", "PNEUMONIA", "child"),
    (r"PredictDX_Adult_Pneumonia\PredictDX_Adult_Pneumonia", "PNEUMONIA", "adult"),
    ("TB", "TUBERCULOSIS", "adult"),
]
# identical to images in Normal/ (pixel-for-pixel) and visibly clear lungs -> label conflict, excluded
EXCLUDE = {"pneumonia_1021.png", "pneumonia_0761.png", "pneumonia_0620.png",
           "pneumonia_0579.png", "pneumonia_0162.png", "pneumonia_1162.png"}


def square(im, grey=True):
    im = ImageOps.exif_transpose(im)
    im = im.convert("L") if grey else im.convert("RGB")
    w, h = im.size
    s = SIZE / min(w, h)
    im = im.resize((max(SIZE, round(w * s)), max(SIZE, round(h * s))), Image.LANCZOS)
    w, h = im.size
    l, t = (w - SIZE) // 2, (h - SIZE) // 2
    return im.crop((l, t, l + SIZE, t + SIZE))


def main():
    rows = []
    for folder, label, source in FOLDERS:
        d = os.path.join(SRC, folder)
        os.makedirs(os.path.join(OUT, label), exist_ok=True)
        tag = folder.split("\\")[-1].lower()
        for name in sorted(os.listdir(d)):
            if name in EXCLUDE or not name.lower().endswith((".png", ".jpg", ".jpeg")):
                continue
            rel = f"{label}/{source}_{tag}_{os.path.splitext(name)[0]}.png"
            square(Image.open(os.path.join(d, name))).save(os.path.join(OUT, rel))
            rows.append({"file": rel, "label": label, "source": source})
        print(folder, "done", flush=True)

    # NOT_CXR: real photos + everyday objects/animals; 70% greyscale so colour is not the cue
    import keras
    os.makedirs(os.path.join(OUT, "NOT_CXR"), exist_ok=True)
    tgz = keras.utils.get_file("flower_photos.tgz", "https://storage.googleapis.com/download.tensorflow.org/example_images/flower_photos.tgz",
                               cache_dir=r"D:\PredictDx-AI\cache")
    with tarfile.open(tgz) as t:
        members = [m for m in t.getmembers() if m.name.endswith(".jpg")]
        random.shuffle(members)
        for i, m in enumerate(members[:1500]):
            rel = f"NOT_CXR/photo_flower_{i}.png"
            square(Image.open(t.extractfile(m)), grey=random.random() < 0.7).save(os.path.join(OUT, rel))
            rows.append({"file": rel, "label": "NOT_CXR", "source": "photo"})
    (xc, _), _ = keras.datasets.cifar10.load_data()
    for i in np.random.default_rng(SEED).choice(len(xc), 1500, replace=False):
        rel = f"NOT_CXR/photo_cifar_{i}.png"
        square(Image.fromarray(xc[i]), grey=random.random() < 0.7).save(os.path.join(OUT, rel))
        rows.append({"file": rel, "label": "NOT_CXR", "source": "object"})
    print("NOT_CXR done", flush=True)

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


if __name__ == "__main__":
    main()
