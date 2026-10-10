"""Caches frozen DenseNet-121 features (1024-d) for every image in data224, so phase 1 never repeats work."""
import glob, os, time

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import numpy as np
import tensorflow as tf
import keras
from keras.applications.densenet import DenseNet121, preprocess_input

DATA = r"D:\PredictDx-AI\data224"
CACHE = r"D:\PredictDx-AI\out\features_cache.npz"
os.makedirs(os.path.dirname(CACHE), exist_ok=True)

K = lambda rel: rel.replace("/", "__")
cache = dict(np.load(CACHE)) if os.path.exists(CACHE) else {}
files = sorted(os.path.relpath(p, DATA).replace("\\", "/") for p in glob.glob(os.path.join(DATA, "*", "*.png")))
todo = [f for f in files if K(f) not in cache]
print(f"{len(files)} images, {len(cache)} cached, {len(todo)} to do", flush=True)
if todo:
    base = DenseNet121(include_top=False, weights="imagenet", input_shape=(224, 224, 3), pooling="avg")

    def load(rel):
        img = tf.io.decode_png(tf.io.read_file(DATA + "/" + rel), channels=3)
        return preprocess_input(tf.cast(tf.image.resize(img, (224, 224)), tf.float32))

    t0 = time.time()
    for start in range(0, len(todo), 512):
        chunk = todo[start:start + 512]
        ds = tf.data.Dataset.from_tensor_slices(chunk).map(load, num_parallel_calls=tf.data.AUTOTUNE).batch(32).prefetch(2)
        feats = base.predict(ds, verbose=0)
        cache.update(zip(map(K, chunk), feats.astype(np.float32)))
        np.savez(CACHE, **cache)
        done = start + len(chunk)
        rate = done / (time.time() - t0)
        print(f"{done}/{len(todo)}  {rate:.1f} img/s  ~{(len(todo)-done)/rate/60:.1f} min left", flush=True)
print("cached", len(cache), flush=True)
