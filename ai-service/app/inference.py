"""
Model loading, preprocessing, prediction, class activation maps and the chest X-ray gate.

Preprocessing is identical to training (D:\\PredictDx-AI\\prepare_v2.py + train_v2.py):
greyscale -> shorter side 224 -> centre crop 224x224 -> 3 channels -> DenseNet preprocess_input.
"""

import io
import json
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image, ImageOps

from .config import settings

_model = None      # full Keras model
_serve = None      # model -> [last conv activations, pooled features, probabilities]
_dense = None      # (1024, 4) weights of the final layer, for class activation maps
_gate = None       # {"centroids": [[...]x3], "threshold": float}


def load_model():
    """Loads the Keras model once at startup. Never per request."""
    global _model, _serve, _dense, _gate
    if _model is not None:
        return _model
    import keras

    _model = keras.models.load_model(settings.model_path, compile=False)
    _serve = keras.Model(_model.input, [_model.get_layer("relu").output, _model.get_layer("gap").output, _model.output])
    _dense = _model.get_layer("pred").get_weights()[0]
    with open(settings.gate_path) as f:
        g = json.load(f)
    _gate = {"centroids": np.asarray(g["centroids"], np.float32), "threshold": float(g["threshold"])}
    # warm-up so the first real request is fast
    _serve.predict(np.zeros((1, settings.image_size, settings.image_size, 3), np.float32), verbose=0)
    return _model


def is_loaded() -> bool:
    return _model is not None


@dataclass
class Prepared:
    batch: np.ndarray          # (1, 224, 224, 3) ready for the network
    original: Image.Image      # greyscale original (for the overlay)
    crop: tuple                # (left, top, side) of the analysed square in original pixels


def read_image(data: bytes) -> Image.Image:
    """PNG, JPEG, WEBP, BMP or DICOM bytes -> greyscale PIL image."""
    if len(data) > 132 and data[128:132] == b"DICM":
        import pydicom

        d = pydicom.dcmread(io.BytesIO(data))
        a = d.pixel_array.astype(np.float32)
        if a.ndim == 3:
            a = a[..., 0] if a.shape[-1] in (3, 4) else a[0]
        if getattr(d, "PhotometricInterpretation", "") == "MONOCHROME1":
            a = a.max() - a
        a = 255 * (a - a.min()) / max(float(a.max() - a.min()), 1.0)
        return Image.fromarray(a.astype(np.uint8), "L")
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (0, 0, 0))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    return im.convert("L")


def prepare(data: bytes) -> Prepared:
    from keras.applications.densenet import preprocess_input

    original = read_image(data)
    w, h = original.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    sq = original.crop((left, top, left + side, top + side)).resize((settings.image_size,) * 2, Image.LANCZOS)
    arr = np.asarray(sq.convert("RGB"), np.float32)[None]
    return Prepared(preprocess_input(arr), original, (left, top, side))


def predict(p: Prepared):
    """Returns (probabilities[4], pooled features[1024], conv activations[7,7,1024])."""
    conv, pooled, probs = _serve.predict(p.batch, verbose=0)
    return probs[0].astype(np.float64), pooled[0], conv[0]


def gate_similarity(pooled: np.ndarray) -> float:
    """Cosine similarity of the image to the nearest chest X-ray class centre (1.0 = typical X-ray)."""
    v = pooled / (np.linalg.norm(pooled) + 1e-8)
    return float((_gate["centroids"] @ v).max())


def gate_threshold() -> float:
    return _gate["threshold"]


def activation_map(conv: np.ndarray, class_index: int) -> np.ndarray:
    """Class activation map (exact for GAP -> Dense networks): which areas pushed this class up. 0..1, 7x7."""
    cam = np.maximum(conv @ _dense[:, class_index], 0)
    return cam / (cam.max() + 1e-8)


def overlay_png(p: Prepared, cam: np.ndarray, max_side: int = 640) -> bytes:
    """Transparent PNG the same shape as the uploaded X-ray, with the heatmap over the analysed square."""
    import cv2

    w, h = p.original.size
    scale = min(1.0, max_side / max(w, h))
    W, H = max(1, round(w * scale)), max(1, round(h * scale))
    left, top, side = (round(v * scale) for v in p.crop)
    side = max(1, min(side, W - left, H - top))
    heat = cv2.resize(cam.astype(np.float32), (side, side), interpolation=cv2.INTER_CUBIC)
    heat = np.clip(heat, 0, 1)
    colour = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * heat), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    alpha = np.uint8(np.clip((heat - 0.25) / 0.75, 0, 1) * 200)  # weak activations stay transparent
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[top:top + side, left:left + side, :3] = colour
    rgba[top:top + side, left:left + side, 3] = alpha
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG", optimize=True)
    return buf.getvalue()


def regions(p: Prepared, cam: np.ndarray, label: str, score: float, threshold: float = 0.6) -> list:
    """Bounding box of the strongest activation, in % of the uploaded image (for the viewer)."""
    from scipy import ndimage  # small and bundled with scikit-learn's dependencies

    import cv2

    big = cv2.resize(cam.astype(np.float32), (56, 56), interpolation=cv2.INTER_CUBIC)
    mask = big >= threshold
    lab, n = ndimage.label(mask)
    if n == 0:
        return []
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    out = []
    w, h = p.original.size
    left, top, side = p.crop
    for idx in np.argsort(sizes)[::-1][:2]:
        ys, xs = np.where(lab == idx + 1)
        if len(xs) < 6:
            continue
        x0, x1 = xs.min() / 56, (xs.max() + 1) / 56
        y0, y1 = ys.min() / 56, (ys.max() + 1) / 56
        out.append({
            "label": label,
            "score": round(float(score), 2),
            "x": round(100 * (left + x0 * side) / w, 1),
            "y": round(100 * (top + y0 * side) / h, 1),
            "w": round(100 * (x1 - x0) * side / w, 1),
            "h": round(100 * (y1 - y0) * side / h, 1),
        })
    return out


def preview_png(p: Prepared, max_side: int = 1024) -> Optional[bytes]:
    """Browser-viewable copy of the upload (used for DICOM files)."""
    im = p.original.copy()
    im.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()
