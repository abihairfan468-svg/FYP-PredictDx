# PredictDx AI service

FastAPI service that the NestJS backend calls for every chest X-ray analysis (`POST /analyse`).
Stateless and anonymous: it receives image bytes and optional symptoms, never patient names.

## What it does for one image
1. **Is this a chest X-ray?** Two checks: the model's `NOT_CXR` class (trained on flowers, cats, dogs and
   everyday objects) and the distance of the image's DenseNet features to known chest X-rays
   (`models/cxr_gate.json`). Anything else is rejected and never diagnosed.
2. **Diagnosis:** DenseNet-121 (ImageNet weights, fine-tuned) over Normal / Pneumonia / Tuberculosis.
3. **Assessment band:** NORMAL (disease probability < 20 %), SUSPICIOUS (20-50 %: looks normal but a
   subtle area matches early disease, follow-up advised), DISEASE (top class pneumonia/TB >= 50 %).
4. **Where:** class activation map (exact for GAP + Dense networks) returned as a transparent PNG
   the same shape as the upload, plus bounding boxes of the strongest areas.
5. **Future risk:** `app/risk.py` combines the X-ray probabilities with symptoms and history
   (WHO TB screening criteria, pneumonia severity signs) into Low / Medium / High with a follow-up plan.
   It is rule-based and explainable; a learned risk model needs follow-up data over time.

## Run
`npm run dev` in the project root starts it automatically (`ai-service/start.mjs`).
Manually, with Python 3.12 (TensorFlow does not support 3.14):

```
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

`models/` must contain `predictdx_densenet121_v1.keras`, `cxr_gate.json` and `metrics.json`
(produced by `training/`; the `.keras` file is git-ignored because of its size).

## Training (`training/`)
| Script | Step |
|---|---|
| `prepare_v2.py` | Converts Balanced_dataset_clean to greyscale 224×224, removes 6 images that were in both Normal and Adult Pneumonia |
| `finish_dataset.py` | Adds the NOT_CXR photos and writes the 70/15/15 split (`split.csv`) |
| `extract_features.py` | Caches frozen DenseNet-121 features (CPU-friendly phase 1) |
| `train_v2.py` | Trains the classifier head, fine-tunes the last dense block, evaluates on the untouched test set, calibrates the X-ray gate |
| `export_to_app.py` | Copies the model here and writes `backend/ai-training-status.json` |

Results: `training/metrics.json` and `training/train_log.txt`.
