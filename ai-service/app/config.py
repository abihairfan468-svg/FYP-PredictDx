import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # ai-service/


class Settings:
    """Configuration read from the environment. No secrets in code."""

    internal_api_key: str = os.getenv("INTERNAL_API_KEY", "dev-internal-key")
    model_path: str = os.getenv("MODEL_PATH", os.path.join(HERE, "models", "predictdx_densenet121_v1.keras"))
    gate_path: str = os.getenv("GATE_PATH", os.path.join(HERE, "models", "cxr_gate.json"))
    metrics_path: str = os.getenv("METRICS_PATH", os.path.join(HERE, "models", "metrics.json"))
    image_size: int = 224

    model_name: str = "densenet121-4class"
    model_version: str = os.getenv("MODEL_VERSION", "PredictDx CXR v1.0")

    # Assessment bands on the share of disease probability (pneumonia + TB) among chest X-ray classes.
    suspicious_from: float = 0.20      # 20-50 %: looks normal but a subtle finding is flagged
    disease_from: float = 0.50         # top class is a disease at >= 50 %
    report_gate: float = 0.70          # below 70 % confidence: radiologist review recommended
    not_cxr_from: float = 0.50         # NOT_CXR probability that rejects the image


settings = Settings()
CLASSES = ["NORMAL", "PNEUMONIA", "TUBERCULOSIS", "NOT_CXR"]
CXR_CLASSES = CLASSES[:3]
DISPLAY = {"NORMAL": "Normal", "PNEUMONIA": "Pneumonia", "TUBERCULOSIS": "Tuberculosis"}
