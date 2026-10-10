"""
PredictDx AI service.

Stateless and anonymous: it receives image bytes and optional symptoms, and returns numbers.
It never sees a patient name and never touches the database.
Reachable only from the NestJS API (shared X-Internal-Key header).
"""

import base64
import json
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from . import inference
from .config import CLASSES, CXR_CLASSES, DISPLAY, settings
from .risk import score_risk
from .schemas import ClinicalIn, RiskIn


@asynccontextmanager
async def lifespan(_app: FastAPI):
    inference.load_model()          # loaded once, not per request
    yield


app = FastAPI(
    title="PredictDx AI Service",
    description="Chest X-ray classification (DenseNet-121), chest X-ray gate, activation heatmaps and risk scoring",
    version="1.0.0",
    lifespan=lifespan,
)


def check_key(key: Optional[str]) -> None:
    if key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


def percentages(values) -> list:
    """Rounds to whole percentages that add up to exactly 100."""
    raw = np.asarray(values, np.float64) * 100
    out = np.floor(raw).astype(int)
    for i in np.argsort(raw - out)[::-1][: 100 - out.sum()]:
        out[i] += 1
    return out.tolist()


@app.get("/health")
def health():
    metrics = None
    if os.path.exists(settings.metrics_path):
        with open(settings.metrics_path) as f:
            m = json.load(f)
        metrics = {"testAccuracy": m.get("accuracy"), "testImages": m.get("test_images"), "created": m.get("created")}
    return {"status": "ok", "modelLoaded": inference.is_loaded(), "model": settings.model_name,
            "version": settings.model_version, "metrics": metrics}


@app.post("/analyse")
async def analyse(
    file: UploadFile = File(...),
    clinical: Optional[str] = Form(None),
    x_internal_key: Optional[str] = Header(None),
):
    check_key(x_internal_key)
    started = time.perf_counter()
    data = await file.read()
    try:
        prep = inference.prepare(data)
    except Exception:
        raise HTTPException(status_code=422, detail="This file could not be read as an image")
    symptoms = ClinicalIn(**json.loads(clinical)) if clinical else None

    probs, pooled, conv = inference.predict(prep)
    similarity = inference.gate_similarity(pooled)
    threshold = inference.gate_threshold()
    model = {"name": settings.model_name, "version": settings.model_version}
    preview = inference.preview_png(prep) if data[128:132] == b"DICM" else None
    base = {
        "notCxrProbability": round(float(probs[3]) * 100, 1),
        "gateSimilarity": round(similarity, 4),
        "gateThreshold": round(threshold, 4),
        "imageSize": list(prep.original.size),
        "previewPng": base64.b64encode(preview).decode() if preview else None,
        "model": model,
    }

    # 1. Is this a chest X-ray at all? (trained NOT_CXR class + distance to known chest X-rays)
    if probs[3] >= settings.not_cxr_from or similarity < threshold:
        why = ("The model recognises this as a photo or object, not a chest X-ray."
               if probs[3] >= settings.not_cxr_from else
               "This image does not resemble the chest X-rays the model was trained on.")
        return {**base, "isChestXray": False, "reason": why,
                "inferenceMs": int((time.perf_counter() - started) * 1000)}

    # 2. Diagnosis over the three chest X-ray classes
    cxr = probs[:3] / probs[:3].sum()
    idx = int(cxr.argmax())
    key = CXR_CLASSES[idx]
    confidence = float(cxr[idx])
    disease_share = float(cxr[1] + cxr[2])
    if key != "NORMAL" and confidence >= settings.disease_from:
        band, text = "DISEASE", f"{DISPLAY[key]} pattern detected."
    elif disease_share >= settings.suspicious_from:
        band, text = "SUSPICIOUS", "Looks mostly normal, but the model found a subtle area that matches early disease. Follow-up advised."
    else:
        band, text = "NORMAL", "No signs of pneumonia or tuberculosis found."

    # 3. Where: activation map for the predicted disease, or for the more likely disease if normal
    cam_idx = idx if idx != 0 else (1 if cxr[1] >= cxr[2] else 2)
    cam = inference.activation_map(conv, cam_idx)
    heatmap = inference.overlay_png(prep, cam)
    region_label = {1: "Consolidation / opacity", 2: "TB-pattern opacity"}[cam_idx]
    regions = [] if band == "NORMAL" else inference.regions(prep, cam, region_label, float(cxr[cam_idx]))

    # 4. Future risk from the X-ray plus the symptoms
    risk = score_risk({"NORMAL": float(cxr[0]), "PNEUMONIA": float(cxr[1]), "TUBERCULOSIS": float(cxr[2])}, symptoms)

    pct = percentages(cxr)
    return {
        **base,
        "isChestXray": True,
        "label": DISPLAY[key],
        "labelKey": key,
        "confidence": round(confidence * 100, 1),
        "probabilities": {DISPLAY[c]: pct[i] for i, c in enumerate(CXR_CLASSES)},
        "gatePassed": confidence >= settings.report_gate,
        "assessment": {"band": band, "text": text, "diseaseProbability": round(disease_share * 100, 1),
                       "heatmapFor": DISPLAY[CXR_CLASSES[cam_idx]]},
        "regions": regions,
        "heatmapPng": base64.b64encode(heatmap).decode(),
        "risk": risk,
        "inferenceMs": int((time.perf_counter() - started) * 1000),
    }


@app.post("/risk")
def risk(body: RiskIn, x_internal_key: Optional[str] = Header(None)):
    check_key(x_internal_key)
    return score_risk(body.probabilities, body.clinical, body.horizonMonths)
