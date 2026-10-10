from typing import Dict, Optional

from pydantic import BaseModel, Field


class ClinicalIn(BaseModel):
    """Symptoms and history entered by the doctor (all optional apart from age)."""
    age: int = Field(0, ge=0, le=120)
    smoker: bool = False
    coughDays: int = Field(0, ge=0, le=365)
    fever: bool = False
    weightLoss: bool = False
    nightSweats: bool = False
    breathlessness: bool = False
    diabetes: bool = False
    hivPositive: bool = False
    tbContact: bool = False
    priorTb: bool = False
    spo2: int = Field(98, ge=50, le=100)


class RiskIn(BaseModel):
    probabilities: Dict[str, float]
    clinical: Optional[ClinicalIn] = None
    horizonMonths: int = 12
