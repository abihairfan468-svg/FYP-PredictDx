"""Copies unseen TEST-set X-rays (original files) into FYP\\PredictDx_demo_xrays and records what the model says."""
import csv, os, shutil
import pandas as pd
from smoke_test import call, original

DEST = r"C:\Users\clicks\Documents\FYP\PredictDx_demo_xrays"
os.makedirs(DEST, exist_ok=True)
df = pd.read_csv(r"D:\PredictDx-AI\data224\split.csv")
test = df[(df.split == "test") & (df.label != "NOT_CXR")]
rows = []
for (label, source), g in test.groupby(["label", "source"]):
    folder = os.path.join(DEST, f"{label.title()}_{source}")
    os.makedirs(folder, exist_ok=True)
    for rel in g.sample(5, random_state=11).file:
        src = original(rel)
        dst = os.path.join(folder, os.path.basename(src))
        shutil.copy2(src, dst)
        r = call(os.path.basename(src), open(src, "rb").read())
        rows.append({
            "file": os.path.relpath(dst, DEST), "true label": label.title(),
            "model says": r["label"] if r["isChestXray"] else "NOT A CHEST X-RAY",
            "confidence %": r.get("confidence", ""), "band": r.get("assessment", {}).get("band", ""),
            "risk (X-ray only)": r.get("risk", {}).get("riskBand", ""),
            "correct": "yes" if r.get("labelKey") == label else "NO",
        })
        print(rows[-1], flush=True)
with open(os.path.join(DEST, "model_results.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
print("correct:", sum(r["correct"] == "yes" for r in rows), "/", len(rows))
