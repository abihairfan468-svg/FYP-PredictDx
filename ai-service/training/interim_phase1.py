"""
Evaluates the phase-1 model (frozen DenseNet-121 + trained head) from the cached features, with no
extra forward passes, and writes cxr_gate.json + metrics.json so the app can use it while phase 2 trains.
Frozen features are exactly the phase-1 model's 'gap' layer output, so the numbers are the model's real ones.
"""
import json, os, time
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import numpy as np, pandas as pd, keras
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

OUT = r"D:\PredictDx-AI\out\phase1"
os.makedirs(OUT, exist_ok=True)
CLASSES = ["NORMAL", "PNEUMONIA", "TUBERCULOSIS", "NOT_CXR"]
df = pd.read_csv(r"D:\PredictDx-AI\data224\split.csv")
df["y"] = df.label.map(CLASSES.index)
cache = np.load(r"D:\PredictDx-AI\out\features_cache.npz")
F = lambda d: np.stack([cache[f.replace("/", "__")] for f in d.file])

model = keras.models.load_model(r"D:\PredictDx-AI\out\model_phase1.keras", compile=False)
W, b = model.get_layer("pred").get_weights()
softmax = lambda z: np.exp(z - z.max(1, keepdims=True)) / np.exp(z - z.max(1, keepdims=True)).sum(1, keepdims=True)

test = df[df.split == "test"].reset_index(drop=True)
p = softmax(F(test) @ W + b)
pred = p.argmax(1)
rep = classification_report(test.y, pred, target_names=CLASSES, digits=3, output_dict=True)
print(classification_report(test.y, pred, target_names=CLASSES, digits=3))
auc = {c: float(roc_auc_score((test.y == i).astype(int), p[:, i])) for i, c in enumerate(CLASSES)}
cm = confusion_matrix(test.y, pred)
test["correct"] = test.y == pred
by_source = test.groupby(["label", "source"]).correct.mean().round(4)
print(cm, "\n", by_source)

unit = lambda a: a / (np.linalg.norm(a, axis=-1, keepdims=True) + 1e-8)
tr = df[(df.split == "train") & (df.y < 3)]
g_tr = F(tr)
centroids = np.stack([unit(g_tr[(tr.y == i).values].mean(0)) for i in range(3)])
va = df[df.split == "val"].reset_index(drop=True)
sim_val = (unit(F(va)) @ centroids.T).max(1)
threshold = float(np.percentile(sim_val[(va.y < 3).values], 0.5))
sim_test = (unit(F(test)) @ centroids.T).max(1)
acc_x = float((sim_test[(test.y < 3).values] >= threshold).mean())
blk = float((sim_test[(test.y == 3).values] < threshold).mean())
print(f"gate threshold {threshold:.4f} | test X-rays accepted {acc_x:.3f} | test photos blocked by distance alone {blk:.3f}")
json.dump({"centroids": centroids.tolist(), "threshold": threshold}, open(os.path.join(OUT, "cxr_gate.json"), "w"))
json.dump({"classes": CLASSES, "test_images": int(len(test)), "accuracy": rep["accuracy"],
           "per_class": {c: {k: round(rep[c][k], 4) for k in ("precision", "recall", "f1-score", "support")} for c in CLASSES},
           "roc_auc": auc, "confusion_matrix": cm.tolist(),
           "accuracy_by_source": {f"{a}/{s}": float(v) for (a, s), v in by_source.items()},
           "gate": {"threshold": threshold, "test_xrays_accepted": acc_x, "test_photos_blocked": blk},
           "stage": "phase 1 (frozen backbone)", "created": time.strftime("%Y-%m-%d %H:%M")},
          open(os.path.join(OUT, "metrics.json"), "w"), indent=2)
