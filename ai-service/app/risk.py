"""
Future risk estimate: the X-ray result combined with the patient's symptoms and history.

Transparent, rule-based weights (no training data exists that follows patients over time, so
nothing here is "learned"; every factor can be explained to a doctor or an examiner):
  - TB factors follow the WHO TB screening criteria: cough >= 2 weeks, weight loss, night sweats,
    fever, TB contact, HIV, prior TB, diabetes, smoking.
  - Pneumonia factors follow common severity signs: fever, breathlessness, SpO2 < 94 %, age >= 60.
The imaging probability of each disease counts 0.75x: a clear finding (>= 90 %) alone gives HIGH,
a subtle one (20-50 %) gives LOW-MEDIUM until symptoms raise it.
Phase 2 (once repeat visits are collected): replace with a model trained on real follow-up outcomes.
"""

from typing import Dict, Optional

from .schemas import ClinicalIn

TB_FACTORS = {
    "tbContact": 0.15, "hivPositive": 0.12, "priorTb": 0.10, "weightLoss": 0.10,
    "nightSweats": 0.10, "diabetes": 0.06, "smoker": 0.04, "fever": 0.04,
}
PNEU_FACTORS = {
    "fever": 0.12, "breathlessness": 0.12, "smoker": 0.06, "diabetes": 0.04, "hivPositive": 0.05,
}
NICE = {
    "tbContact": "Contact with a TB patient", "hivPositive": "HIV positive", "priorTb": "Previous TB",
    "weightLoss": "Unexplained weight loss", "nightSweats": "Night sweats", "diabetes": "Diabetes",
    "smoker": "Smoker", "fever": "Fever", "breathlessness": "Breathlessness",
    "chronicCough": "Cough for 2 weeks or more", "recentCough": "Recent cough", "lowSpo2": "Oxygen saturation below 94 %",
    "age60": "Age 60 or over", "imaging": "X-ray findings",
}
FOLLOW_UP = {
    ("TUBERCULOSIS", "HIGH"): "Sputum test (GeneXpert / AFB) now, repeat chest X-ray in 2-4 weeks, screen close contacts.",
    ("TUBERCULOSIS", "MEDIUM"): "Repeat chest X-ray in 4-8 weeks; sputum test if the cough lasts beyond 2 weeks.",
    ("PNEUMONIA", "HIGH"): "Clinical review within 24-48 hours, treat per guidelines, repeat chest X-ray in 4-6 weeks.",
    ("PNEUMONIA", "MEDIUM"): "Review in 1-2 weeks if symptoms continue; repeat chest X-ray in 4-6 weeks.",
}


def _band(score: float) -> str:
    return "LOW" if score < 0.33 else ("MEDIUM" if score < 0.66 else "HIGH")


def score_risk(probabilities: Dict[str, float], clinical: Optional[ClinicalIn], horizon_months: int = 12) -> dict:
    """probabilities: 0..1 for NORMAL / PNEUMONIA / TUBERCULOSIS (chest X-ray classes only)."""
    c = clinical or ClinicalIn(age=0)
    out = {}
    for disease, factors in (("TUBERCULOSIS", TB_FACTORS), ("PNEUMONIA", PNEU_FACTORS)):
        p = float(probabilities.get(disease, 0.0))
        parts = [("imaging", 0.75 * p)]
        parts += [(k, w) for k, w in factors.items() if getattr(c, k, False)]
        if disease == "TUBERCULOSIS" and c.coughDays >= 14:
            parts.append(("chronicCough", 0.12))
        if disease == "PNEUMONIA":
            if 0 < c.coughDays < 14:
                parts.append(("recentCough", 0.05))
            if c.spo2 < 94:
                parts.append(("lowSpo2", 0.15))
            if c.age >= 60:
                parts.append(("age60", 0.08))
        score = min(1.0, sum(w for _, w in parts))
        out[disease] = (score, parts)

    disease = max(out, key=lambda k: out[k][0])
    score, parts = out[disease]
    band = _band(score)
    top = sorted(parts, key=lambda x: x[1], reverse=True)[:5]
    return {
        "riskScore": round(score, 4),
        "riskBand": band,
        "condition": disease,
        "horizonMonths": horizon_months,
        "scores": {k: round(v[0], 4) for k, v in out.items()},
        "topFactors": [{"factor": NICE[k], "weight": round(w, 3)} for k, w in top if w > 0],
        "followUp": FOLLOW_UP.get((disease, band), "Routine care. Repeat the chest X-ray only if new symptoms appear."),
        "clinicalProvided": clinical is not None,
        "method": "rule-based (WHO TB screening criteria + pneumonia severity signs)",
    }
