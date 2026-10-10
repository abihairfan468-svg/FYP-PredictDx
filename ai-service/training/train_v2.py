"""
PredictDx model training on a CPU-only laptop (DenseNet-121 transfer learning, TensorFlow/Keras).

  phase 1  backbone frozen: every image goes through DenseNet-121 once, the 1024-d features are
           cached, and the classifier head is trained on them (minutes instead of hours).
  phase 2  fine-tune the last dense block (conv5) end to end with augmentation (in the background).
  then     test-set metrics, "is this a chest X-ray?" gate calibration, stress test, export.

Run:  D:\\PredictDx-AI\\venv\\Scripts\\python.exe train_v2.py [--phase2-epochs N]
"""
import argparse, json, os, time

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import numpy as np, pandas as pd
import tensorflow as tf, keras
from keras import layers
from keras.applications.densenet import DenseNet121, preprocess_input
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

DATA = r"D:\PredictDx-AI\data224"
OUT = r"D:\PredictDx-AI\out"
CLASSES = ["NORMAL", "PNEUMONIA", "TUBERCULOSIS", "NOT_CXR"]
IMG, BATCH, SEED = 224, 32, 42
os.makedirs(OUT, exist_ok=True)
keras.utils.set_random_seed(SEED)

ap = argparse.ArgumentParser()
ap.add_argument("--phase2-epochs", type=int, default=4)
args = ap.parse_args()

df = pd.read_csv(os.path.join(DATA, "split.csv"))
df["path"] = DATA + "/" + df["file"]
df["y"] = df["label"].map(CLASSES.index)
print(df.groupby(["label", "split"]).size().unstack(), flush=True)


def load(path, y):
    img = tf.io.decode_png(tf.io.read_file(path), channels=3)   # greyscale replicated to 3 channels
    img = tf.image.resize(img, (IMG, IMG))
    return tf.cast(img, tf.float32), y


augment = keras.Sequential([
    layers.RandomRotation(0.03, fill_mode="constant"),
    layers.RandomZoom((-0.1, 0.1), fill_mode="constant"),
    layers.RandomTranslation(0.05, 0.05, fill_mode="constant"),
    layers.RandomContrast(0.2),
    layers.RandomBrightness(0.1, value_range=(0, 255)),
], name="augment")


def make(split, train=False):
    d = df[df.split == split]
    ds = tf.data.Dataset.from_tensor_slices((d.path.values, d.y.values))
    if train:
        ds = ds.shuffle(len(d), seed=SEED, reshuffle_each_iteration=True)
    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE).batch(BATCH)
    if train:
        ds = ds.map(lambda x, y: (augment(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)
    return ds.map(lambda x, y: (preprocess_input(x), y), num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)


counts = df[df.split == "train"].y.value_counts().sort_index()
n_train = int(counts.sum())
class_weight = {int(i): float(n_train / (len(CLASSES) * c)) for i, c in counts.items()}

# ---------------------------------------------------------------- model (flat, so CAM can reach 'relu')
base = DenseNet121(include_top=False, weights="imagenet", input_shape=(IMG, IMG, 3))
gap = layers.GlobalAveragePooling2D(name="gap")(base.output)
x = layers.Dropout(0.3, name="drop")(gap)
out = layers.Dense(len(CLASSES), activation="softmax", name="pred")(x)
model = keras.Model(base.input, out, name="predictdx_densenet121")

# ---------------------------------------------------------------- phase 1: cached features
import subprocess, sys
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "extract_features.py")], check=True)
cache = np.load(os.path.join(OUT, "features_cache.npz"))
feats = {s: np.stack([cache[f.replace("/", "__")] for f in df[df.split == s].file]) for s in ["train", "val", "test"]}
print({s: f.shape for s, f in feats.items()}, flush=True)

y = {s: df[df.split == s].y.values for s in ["train", "val", "test"]}
head_in = keras.Input((1024,))
h = layers.Dropout(0.3)(head_in)
h = layers.Dense(len(CLASSES), activation="softmax")(h)
head = keras.Model(head_in, h)
head.compile(keras.optimizers.Adam(1e-3), "sparse_categorical_crossentropy", metrics=["accuracy"])
h1 = head.fit(feats["train"], y["train"], validation_data=(feats["val"], y["val"]), epochs=60, batch_size=64,
              class_weight=class_weight, verbose=0,
              callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=6, restore_best_weights=True)])
print(f"phase 1 head: {len(h1.history['loss'])} epochs, val acc {max(h1.history['val_accuracy']):.3f}", flush=True)
model.get_layer("pred").set_weights(head.layers[-1].get_weights())
hist = {"phase1": {k: [float(v) for v in vals] for k, vals in h1.history.items()}}
model.save(os.path.join(OUT, "model_phase1.keras"))

# ---------------------------------------------------------------- phase 2: fine-tune conv5 (BatchNorm frozen)
if args.phase2_epochs > 0:
    for l in base.layers:
        l.trainable = l.name.startswith("conv5_") and not isinstance(l, layers.BatchNormalization)
    model.compile(keras.optimizers.Adam(2e-5), "sparse_categorical_crossentropy", metrics=["accuracy"])
    t0 = time.time()
    h2 = model.fit(make("train", True), validation_data=make("val"), epochs=args.phase2_epochs, class_weight=class_weight,
                   verbose=2, callbacks=[
                       keras.callbacks.ModelCheckpoint(os.path.join(OUT, "best_phase2.keras"), monitor="val_loss", save_best_only=True),
                       keras.callbacks.EarlyStopping(monitor="val_loss", patience=2, restore_best_weights=True),
                       keras.callbacks.CSVLogger(os.path.join(OUT, "history_phase2.csv"))])
    print(f"phase 2: {(time.time()-t0)/60:.1f} min", flush=True)
    hist["phase2"] = {k: [float(v) for v in vals] for k, vals in h2.history.items()}

model.save(os.path.join(OUT, "predictdx_densenet121_v1.keras"))
json.dump(hist, open(os.path.join(OUT, "history.json"), "w"), indent=1)

# ---------------------------------------------------------------- evaluation on the untouched test set
serve = keras.Model(model.input, [model.get_layer("gap").output, model.output])
test = df[df.split == "test"].reset_index(drop=True)
g_test, p_test = serve.predict(make("test"), verbose=0)
pred = p_test.argmax(1)
report = classification_report(test.y, pred, target_names=CLASSES, digits=3, output_dict=True)
print(classification_report(test.y, pred, target_names=CLASSES, digits=3), flush=True)
auc = {c: float(roc_auc_score((test.y == i).astype(int), p_test[:, i])) for i, c in enumerate(CLASSES)}
cm = confusion_matrix(test.y, pred)
test["correct"] = test.y == pred
by_source = test.groupby(["label", "source"]).correct.mean().round(4)
print("ROC-AUC", {k: round(v, 4) for k, v in auc.items()}, "\n", cm, "\n", by_source, flush=True)

# ---------------------------------------------------------------- chest X-ray gate (second safety net)
# cosine similarity of the image's DenseNet features to the nearest chest-X-ray class centre;
# threshold = 1st percentile of the validation chest X-rays.
tr = df[(df.split == "train") & (df.y < 3)].groupby("label", group_keys=False).apply(lambda g: g.sample(min(600, len(g)), random_state=SEED))
ds_tr = tf.data.Dataset.from_tensor_slices((tr.path.values, tr.y.values)).map(load).batch(BATCH).map(lambda x, y: (preprocess_input(x), y))
g_train, _ = serve.predict(ds_tr, verbose=0)
unit = lambda a: a / (np.linalg.norm(a, axis=-1, keepdims=True) + 1e-8)
centroids = np.stack([unit(g_train[(tr.y == i).values].mean(0)) for i in range(3)])
g_val, p_val = serve.predict(make("val"), verbose=0)
va = df[df.split == "val"]
sim_val = (unit(g_val) @ centroids.T).max(1)
threshold = float(np.percentile(sim_val[(va.y < 3).values], 1))
sim_test = (unit(g_test) @ centroids.T).max(1)
gate_cxr_pass = float((sim_test[(test.y < 3).values] >= threshold).mean())
gate_neg_block = float((sim_test[(test.y == 3).values] < threshold).mean())
print(f"gate threshold {threshold:.4f} | test X-rays accepted {gate_cxr_pass:.3f} | test photos blocked {gate_neg_block:.3f}", flush=True)
json.dump({"centroids": centroids.tolist(), "threshold": threshold}, open(os.path.join(OUT, "cxr_gate.json"), "w"))

metrics = {
    "classes": CLASSES, "test_images": int(len(test)), "accuracy": report["accuracy"],
    "per_class": {c: {k: round(report[c][k], 4) for k in ("precision", "recall", "f1-score", "support")} for c in CLASSES},
    "roc_auc": auc, "confusion_matrix": cm.tolist(),
    "accuracy_by_source": {f"{a}/{b}": float(v) for (a, b), v in by_source.items()},
    "gate": {"threshold": threshold, "test_xrays_accepted": gate_cxr_pass, "test_photos_blocked": gate_neg_block},
    "train_images": int(n_train), "phase2_epochs": args.phase2_epochs,
    "tensorflow": tf.__version__, "created": time.strftime("%Y-%m-%d %H:%M"),
}
json.dump(metrics, open(os.path.join(OUT, "metrics.json"), "w"), indent=2)
print("saved to", OUT, flush=True)
