"""
Fraud detection service for microfinance transactions.
Loads models from fraud_detection_model/:
  - fraud_best_gradient_boosting.pkl  — primary model (GBR risk score 0-100)
  - fraud_isolation_forest.pkl        — anomaly scorer (unsupervised baseline)

Usage:
    from api.fraud_service import predict_fraud
    result = predict_fraud(payload)   # dict with transaction fields
"""
import logging
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)

_project_root = getattr(settings, "PROJECT_ROOT", None) or Path(__file__).resolve().parent.parent.parent
FRAUD_MODELS_DIR = Path(getattr(settings, "FRAUD_MODELS_DIR", None) or (_project_root / "fraud_detection_model"))

FEATURE_COLS = [
    "TransactionAmount",
    "TransactionDuration",
    "LoginAttempts",
    "AccountBalance",
    "CustomerAge",
    "DaysSinceLastTx",
    "AmountToBalanceRatio",
    "TxHour",
    "IsNightTx",
    "TxTypeCode",
    "ChannelCode",
    "OccupCode",
]

# Categorical encodings (mirrors what was used during training)
_TX_TYPE_MAP = {"Credit": 0, "Debit": 1}
_CHANNEL_MAP = {"Online": 0, "ATM": 1, "Branch": 2}
_OCC_MAP = {"Doctor": 0, "Engineer": 1, "Retired": 2, "Student": 3}

_artifacts = {}


def _load_artifacts():
    if _artifacts:
        return
    if not FRAUD_MODELS_DIR.exists():
        raise FileNotFoundError(f"Fraud model directory not found: {FRAUD_MODELS_DIR}")
    _artifacts["feature_cols"] = joblib.load(FRAUD_MODELS_DIR / "fraud_feature_columns.pkl")
    _artifacts["scaler"]       = joblib.load(FRAUD_MODELS_DIR / "fraud_scaler.pkl")
    _artifacts["encoders"]     = joblib.load(FRAUD_MODELS_DIR / "fraud_encoders.pkl")
    _artifacts["iso"]          = joblib.load(FRAUD_MODELS_DIR / "fraud_isolation_forest.pkl")
    # Primary model: best Gradient Boosting regressor (risk score 0-100)
    _artifacts["best_model"]   = joblib.load(FRAUD_MODELS_DIR / "fraud_best_gradient_boosting.pkl")
    logger.info("Fraud detection models loaded from %s", FRAUD_MODELS_DIR)


def _payload_to_vector(payload: dict) -> np.ndarray:
    """
    Convert an API payload to the 12-column feature vector expected by the models.
    Accepts either raw transaction fields (TransactionType, Channel, etc.) or
    pre-computed numeric fields.
    """
    _load_artifacts()
    encoders = _artifacts["encoders"]

    def _safe_float(val, default=0.0):
        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    # Encode TransactionType
    tx_type_raw = str(payload.get("TransactionType", "Debit")).strip()
    tx_type_code = encoders["tx_type"].get(tx_type_raw, 1)

    # Encode Channel
    channel_raw = str(payload.get("Channel", "Online")).strip()
    channel_code = encoders["channel"].get(channel_raw, 0)

    # Encode CustomerOccupation
    occ_raw = str(payload.get("CustomerOccupation", "")).strip()
    occ_code = encoders["occupation"].get(occ_raw, 0)

    # Compute derived features when not pre-supplied
    tx_amount = _safe_float(payload.get("TransactionAmount", 0))
    account_balance = _safe_float(payload.get("AccountBalance", 1))
    login_attempts = _safe_float(payload.get("LoginAttempts", 1))

    # AmountToBalanceRatio — accept pre-computed or derive
    amount_to_balance = _safe_float(
        payload.get("AmountToBalanceRatio"),
        default=tx_amount / (account_balance + 1e-6),
    )

    # TxHour — accept pre-computed or derive from TransactionDate string
    tx_hour = _safe_float(payload.get("TxHour"), default=12.0)
    if "TxHour" not in payload and "TransactionDate" in payload:
        try:
            import re
            m = re.search(r"T?(\d{2}):", str(payload["TransactionDate"]))
            if m:
                tx_hour = float(m.group(1))
        except Exception:
            pass

    is_night = _safe_float(
        payload.get("IsNightTx"),
        default=1.0 if (tx_hour >= 23 or tx_hour <= 5) else 0.0,
    )

    days_since_last_tx = _safe_float(payload.get("DaysSinceLastTx"), default=1.0)

    vec = np.array([
        tx_amount,
        _safe_float(payload.get("TransactionDuration", 60)),
        login_attempts,
        account_balance,
        _safe_float(payload.get("CustomerAge", 35)),
        days_since_last_tx,
        amount_to_balance,
        tx_hour,
        is_night,
        float(tx_type_code),
        float(channel_code),
        float(occ_code),
    ], dtype=np.float64).reshape(1, -1)
    return vec


def predict_fraud(payload: dict) -> dict:
    """
    Run all three fraud detection models on a transaction payload.

    Returns:
        {
            "is_fraud": bool,
            "fraud_probability": float (0.0-1.0),
            "anomaly_score": float (higher = more anomalous),
            "risk_score": float (0-100),
            "risk_level": "LOW" | "MEDIUM" | "HIGH",
        }
    """
    _load_artifacts()
    vec = _payload_to_vector(payload)
    vec_s = _artifacts["scaler"].transform(vec)

    # Primary model: Gradient Boosting risk score (0-100)
    risk_score = float(np.clip(_artifacts["best_model"].predict(vec_s)[0], 0, 100))
    # Derive binary fraud flag and probability from the risk score
    is_fraud   = risk_score >= 50
    fraud_prob = round(risk_score / 100.0, 4)

    # Supplementary: Isolation Forest anomaly score
    raw_score     = float(_artifacts["iso"].score_samples(vec_s)[0])  # negative
    anomaly_score = round(float(-raw_score), 4)

    risk_level = "HIGH" if risk_score >= 50 else ("MEDIUM" if risk_score >= 20 else "LOW")

    return {
        "is_fraud": is_fraud,
        "fraud_probability": round(fraud_prob, 4),
        "anomaly_score": anomaly_score,
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
    }
