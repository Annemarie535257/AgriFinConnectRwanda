import logging

logger = logging.getLogger(__name__)


def _runtime_versions():
    versions = {}
    try:
        import numpy as np
        versions["numpy"] = np.__version__
    except Exception:
        versions["numpy"] = "unavailable"

    try:
        import sklearn
        versions["scikit_learn"] = sklearn.__version__
    except Exception:
        versions["scikit_learn"] = "unavailable"

    try:
        import joblib
        versions["joblib"] = joblib.__version__
    except Exception:
        versions["joblib"] = "unavailable"

    return versions


def get_model_health():
    from api import fraud_service, ml_service

    loan = {"ready": False, "error": None}
    fraud = {"ready": False, "error": None}

    try:
        ml_service._load_artifacts()
        loan["ready"] = True
    except Exception as exc:
        loan["error"] = str(exc)

    try:
        fraud_service._load_artifacts()
        fraud["ready"] = True
    except Exception as exc:
        fraud["error"] = str(exc)

    overall = "ok" if (loan["ready"] and fraud["ready"]) else "degraded"

    return {
        "status": overall,
        "runtime_versions": _runtime_versions(),
        "models": {
            "loan": loan,
            "fraud": fraud,
        },
    }


def warmup_model_artifacts():
    health = get_model_health()
    if health["status"] == "ok":
        logger.info("Model warmup succeeded (loan + fraud artifacts loaded)")
        return

    logger.warning(
        "Model warmup degraded. loan_ready=%s fraud_ready=%s loan_error=%s fraud_error=%s",
        health["models"]["loan"]["ready"],
        health["models"]["fraud"]["ready"],
        health["models"]["loan"]["error"],
        health["models"]["fraud"]["error"],
    )
