"""
Load ML models and run inference. Uses artifacts from loan_default_risk_model/.
"""
import os
import joblib
import numpy as np
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


def _load_artifacts():
    if _models:
        return
    if not MODELS_DIR.exists():
        raise FileNotFoundError(f"Models directory not found: {MODELS_DIR}")
    _models['feature_cols'] = joblib.load(MODELS_DIR / 'feature_columns.pkl')
    _models['scaler'] = joblib.load(MODELS_DIR / 'scaler.pkl')
    _models['label_encoder'] = joblib.load(MODELS_DIR / 'label_encoder.pkl')
    _models['classifier'] = joblib.load(MODELS_DIR / 'loan_default_classifier.pkl')
    _models['risk_regressor'] = joblib.load(MODELS_DIR / 'risk_score_regressor.pkl')
    _models['amount_regressor'] = joblib.load(MODELS_DIR / 'loan_amount_regressor.pkl')


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
    # label_encoder: typically 0=Denied, 1=Approved
    return int(pred) == 1


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
    X = _payload_to_vector(payload, include_loan_amount=True)  # 33 cols
    X_scaled = _models['scaler'].transform(X)
    feature_cols = _models['feature_cols']
    idx_no_loan = [i for i, c in enumerate(feature_cols) if c != 'LoanAmount']
    X_amt = X_scaled[:, idx_no_loan]
    amount = _models['amount_regressor'].predict(X_amt)[0]
    return float(amount)
