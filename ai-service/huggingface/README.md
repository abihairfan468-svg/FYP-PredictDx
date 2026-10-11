---
title: PredictDx AI
emoji: 🫁
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# PredictDx AI service

Chest X-ray analysis for the PredictDx FYP (Air University Islamabad): DenseNet-121 classifier
(Normal / Pneumonia / Tuberculosis / Not a chest X-ray), activation heatmap and risk estimate.

The `/analyse` endpoint only answers requests that carry the PredictDx backend's internal key.
`/health` is public and shows the model version and test accuracy.

Upload to this Space: this README, plus `Dockerfile`, `requirements.txt`, the `app/` folder and the
`models/` folder from `ai-service/` in the PredictDx repository.
