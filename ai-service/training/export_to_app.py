"""Copies the trained model into the app and writes the real training status the Diagnosis Center shows."""
import json, os, shutil, time
import pandas as pd

OUT = os.path.join(r"D:\PredictDx-AI", "final")   # deployed package: phase-1 model, best on the test set
APP = r"C:\Users\clicks\Documents\FYP\PredictDX-UPDATED\PredictDX-Final-Year-Project--main"
MODELS = os.path.join(APP, "ai-service", "models")
os.makedirs(MODELS, exist_ok=True)
for f in ["predictdx_densenet121_v1.keras", "cxr_gate.json", "metrics.json"]:
    shutil.copy2(os.path.join(OUT, f), os.path.join(MODELS, f))

# training scripts go into the repository so examiners can see exactly how the model was made
train_dir = os.path.join(APP, "ai-service", "training")
os.makedirs(train_dir, exist_ok=True)
for f in ["prepare_v2.py", "finish_dataset.py", "extract_features.py", "train_v2.py", "interim_phase1.py", "smoke_test.py", "make_demo_folder.py", "export_to_app.py"]:
    shutil.copy2(os.path.join(os.path.dirname(OUT), f), os.path.join(train_dir, f))
for f in ["train_log.txt", "history.json", "metrics.json"]:
    if os.path.exists(os.path.join(OUT, f)):
        shutil.copy2(os.path.join(OUT, f), os.path.join(train_dir, f))

m = json.load(open(os.path.join(OUT, "metrics.json")))
h = json.load(open(os.path.join(OUT, "history.json")))
df = pd.read_csv(r"D:\PredictDx-AI\data224\split.csv")
count = lambda label, source=None: int(((df.label == label) & ((df.source == source) if source else True)).sum())

p1, p2 = h["phase1"], h.get("phase2", {})
status = {
    "_comment": "Written by ai-service/training/export_to_app.py from the real training run.",
    "status": "trained",
    "updatedAt": time.strftime("%Y-%m-%d"),
    "owner": "Abiha Irfan",
    "datasets": [
        {"name": "Adult normal + TB (Balanced_dataset_clean, incl. TBX11K)", "images": count("NORMAL", "adult") + count("TUBERCULOSIS"), "classes": "Normal · TB", "state": "pre-processed"},
        {"name": "Paediatric chest X-ray (Kermany)", "images": count("NORMAL", "child") + count("PNEUMONIA", "child"), "classes": "Normal · Pneumonia", "state": "pre-processed"},
        {"name": "PredictDX adult pneumonia", "images": count("PNEUMONIA", "adult"), "classes": "Pneumonia (adult)", "state": "pre-processed"},
        {"name": "Not a chest X-ray (flowers, cats & dogs, objects)", "images": count("NOT_CXR"), "classes": "Rejected input", "state": "pre-processed"},
        {"name": "Local hospital cases", "images": 0, "classes": "Normal · Pneumonia · TB", "state": "collection in progress"},
    ],
    "pipeline": [
        {"step": "Data collection & cleaning (duplicates and mislabelled images removed)", "state": "done"},
        {"step": "Pre-processing (greyscale, 224×224 centre crop)", "state": "done"},
        {"step": "DenseNet-121 transfer learning (frozen + fine-tuned conv5)", "state": "done"},
        {"step": "Chest X-ray gate (NOT_CXR class + feature distance)", "state": "done"},
        {"step": "Activation heatmaps (CAM)", "state": "done"},
        {"step": "Future risk estimate (rule-based, symptoms + X-ray)", "state": "done"},
        {"step": "Integration with ai-service and the app", "state": "done"},
        {"step": "Risk model trained on follow-up visits", "state": "needs longitudinal data"},
    ],
    "run": {
        "model": "DenseNet-121 (ImageNet weights, fine-tuned)",
        "epochsDone": len(p1["loss"]) + len(p2.get("loss", [])),
        "epochsPlanned": len(p1["loss"]) + len(p2.get("loss", [])),
        "trainAccuracy": [round(v, 3) for v in p1["accuracy"] + p2.get("accuracy", [])],
        "valAccuracy": [round(v, 3) for v in p1["val_accuracy"] + p2.get("val_accuracy", [])],
        "valLoss": [round(v, 3) for v in p1["val_loss"] + p2.get("val_loss", [])],
        "testAccuracy": round(m["accuracy"], 4),
        "testImages": m["test_images"],
        "perClassRecall": {c: v["recall"] for c, v in m["per_class"].items()},
    },
}
json.dump(status, open(os.path.join(APP, "backend", "ai-training-status.json"), "w"), indent=2)
print("model, gate, metrics ->", MODELS)
print("training status ->", os.path.join(APP, "backend", "ai-training-status.json"))
