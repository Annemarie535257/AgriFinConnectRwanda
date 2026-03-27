"""
Load ML models and run inference. Uses artifacts from loan_default_risk_model/.
"""
import os
import joblib
import numpy as np
import threading
from pathlib import Path
from django.conf import settings

MODELS_DIR = getattr(settings, 'MODELS_DIR', None) or Path(__file__).resolve().parent.parent.parent / 'loan_default_risk_model'

# Categorical columns and their allowed values (sorted order to match sklearn LabelEncoder)
CATEGORICAL_OPTIONS = {
    'EmploymentStatus': ['Employed', 'Self-Employed', 'Unemployed'],
    'EducationLevel': ['Associate', 'Bachelor', 'High School', 'Master'],
    'MaritalStatus': ['Divorced', 'Married', 'Single'],
    'HomeOwnershipStatus': ['Mortgage', 'Own', 'Rent'],
    'LoanPurpose': ['Debt Consolidation', 'Education', 'Home', 'Other'],
}

# Default numeric values when not provided (rough mid-range)
DEFAULT_NUMERIC = {
    'Age': 40,
    'AnnualIncome': 60000,
    'CreditScore': 620,
    'Experience': 15,
    'LoanAmount': 20000,
    'LoanDuration': 48,
    'NumberOfDependents': 2,
    'MonthlyDebtPayments': 500,
    'CreditCardUtilizationRate': 0.3,
    'NumberOfOpenCreditLines': 3,
    'NumberOfCreditInquiries': 1,
    'DebtToIncomeRatio': 0.35,
    'BankruptcyHistory': 0,
    'PreviousLoanDefaults': 0,
    'PaymentHistory': 25,
    'LengthOfCreditHistory': 10,
    'SavingsAccountBalance': 5000,
    'CheckingAccountBalance': 3000,
    'TotalAssets': 50000,
    'TotalLiabilities': 20000,
    'MonthlyIncome': 5000,
    'UtilityBillsPaymentHistory': 0.85,
    'JobTenure': 5,
    'NetWorth': 30000,
    'BaseInterestRate': 0.2,
    'InterestRate': 0.22,
    'MonthlyLoanPayment': 600,
    'TotalDebtToIncomeRatio': 0.35,
}

_models = {}
_models_lock = threading.Lock()
_MODELS_READY = False
_REQUIRED_KEYS = (
    'feature_cols',
    'scaler',
    'label_encoder',
    'approved_label_idx',
    'classifier',
    'risk_regressor',
    'amount_regressor',
)


def _is_models_ready():
    return all(k in _models for k in _REQUIRED_KEYS)


def _load_artifacts():
    global _MODELS_READY
    if _MODELS_READY and _is_models_ready():
        return

    with _models_lock:
        if _MODELS_READY and _is_models_ready():
            return

        if not MODELS_DIR.exists():
            raise FileNotFoundError(f"Models directory not found: {MODELS_DIR}")

        loaded = {}
        try:
            loaded['feature_cols'] = joblib.load(MODELS_DIR / 'feature_columns.pkl')
            loaded['scaler'] = joblib.load(MODELS_DIR / 'scaler.pkl')
            loaded['label_encoder'] = joblib.load(MODELS_DIR / 'label_encoder.pkl')

            classes = [str(c).strip().lower() for c in loaded['label_encoder'].classes_]
            if 'approved' in classes:
                loaded['approved_label_idx'] = classes.index('approved')
            elif '1' in classes:
                loaded['approved_label_idx'] = classes.index('1')
            else:
                loaded['approved_label_idx'] = 1 if len(classes) > 1 else 0

            loaded['classifier'] = joblib.load(MODELS_DIR / 'loan_default_classifier.pkl')
            loaded['risk_regressor'] = joblib.load(MODELS_DIR / 'risk_score_regressor.pkl')
            loaded['amount_regressor'] = joblib.load(MODELS_DIR / 'loan_amount_regressor.pkl')

            amount_scaler_path = MODELS_DIR / 'loan_amount_scaler.pkl'
            amount_feature_cols_path = MODELS_DIR / 'loan_amount_feature_columns.pkl'
            loaded['amount_scaler'] = joblib.load(amount_scaler_path) if amount_scaler_path.exists() else None
            loaded['amount_feature_cols'] = joblib.load(amount_feature_cols_path) if amount_feature_cols_path.exists() else None
        except Exception:
            _models.clear()
            _MODELS_READY = False
            raise

        _models.clear()
        _models.update(loaded)
        _MODELS_READY = True


def _encode_categorical(name, value):
    options = CATEGORICAL_OPTIONS.get(name, [])
    if not options:
        return 0
    val_str = str(value).strip()
    try:
        return options.index(val_str)
    except ValueError:
        return 0


def _payload_to_vector(payload, include_loan_amount=True):
    """Build feature vector in feature_cols order. If include_loan_amount=False, exclude LoanAmount."""
    _load_artifacts()
    feature_cols = _models['feature_cols']
    vec = []
    for col in feature_cols:
        if col == 'LoanAmount' and not include_loan_amount:
            continue
        if col in CATEGORICAL_OPTIONS:
            raw = payload.get(col, list(CATEGORICAL_OPTIONS[col])[0])
            vec.append(_encode_categorical(col, raw))
        else:
            raw = payload.get(col, DEFAULT_NUMERIC.get(col, 0))
            try:
                vec.append(float(raw))
            except (TypeError, ValueError):
                vec.append(DEFAULT_NUMERIC.get(col, 0))
    return np.array(vec, dtype=np.float64).reshape(1, -1)


def predict_eligibility(payload):
    """Model 1: loan approval (0 = Denied, 1 = Approved)."""
    _load_artifacts()
    X = _payload_to_vector(payload, include_loan_amount=True)
    X_scaled = _models['scaler'].transform(X)
    pred = _models['classifier'].predict(X_scaled)[0]
    return int(pred) == int(_models['approved_label_idx'])


def predict_risk(payload):
    """Model 2: default risk score."""
    _load_artifacts()
    X = _payload_to_vector(payload, include_loan_amount=True)
    X_scaled = _models['scaler'].transform(X)
    score = _models['risk_regressor'].predict(X_scaled)[0]
    return float(score)


def recommend_amount(payload):
    """Model 3: recommended loan amount (trained on approved-only, 32 features)."""
    _load_artifacts()
    amount_scaler = _models.get('amount_scaler')
    amount_feature_cols = _models.get('amount_feature_cols')

    if amount_scaler is not None and amount_feature_cols:
        # New artifact set: Model 3 has its own scaler and explicit feature order.
        vec = []
        for col in amount_feature_cols:
            if col in CATEGORICAL_OPTIONS:
                raw = payload.get(col, list(CATEGORICAL_OPTIONS[col])[0])
                vec.append(_encode_categorical(col, raw))
            else:
                raw = payload.get(col, DEFAULT_NUMERIC.get(col, 0))
                try:
                    vec.append(float(raw))
                except (TypeError, ValueError):
                    vec.append(DEFAULT_NUMERIC.get(col, 0))
        X_amt = amount_scaler.transform(np.array(vec, dtype=np.float64).reshape(1, -1))
    else:
        # Backward compatibility for old artifacts.
        X = _payload_to_vector(payload, include_loan_amount=True)  # 33 cols
        X_scaled = _models['scaler'].transform(X)
        feature_cols = _models['feature_cols']
        idx_no_loan = [i for i, c in enumerate(feature_cols) if c != 'LoanAmount']
        X_amt = X_scaled[:, idx_no_loan]

    amount = _models['amount_regressor'].predict(X_amt)[0]
    return float(amount)
