"""
Train fraud detection models from bank_transactions_data_2.csv.
Run from the project root:  python Notebooks/run_fraud_train.py
"""
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest, RandomForestClassifier, GradientBoostingRegressor
from sklearn.metrics import classification_report, roc_auc_score, mean_absolute_error, r2_score
import joblib

DATASETS_DIR = Path("datasets")
MODELS_DIR = Path("fraud_detection_model")
MODELS_DIR.mkdir(exist_ok=True)

# ── Load ──────────────────────────────────────────────────────────────────────
df = pd.read_csv(DATASETS_DIR / "bank_transactions_data_2.csv")
print("Shape:", df.shape)

# ── Feature engineering ───────────────────────────────────────────────────────
df["TransactionDate"] = pd.to_datetime(df["TransactionDate"])
df["PreviousTransactionDate"] = pd.to_datetime(df["PreviousTransactionDate"])

df["DaysSinceLastTx"] = (
    df["TransactionDate"] - df["PreviousTransactionDate"]
).dt.total_seconds().abs() / 86400.0
df["DaysSinceLastTx"] = df["DaysSinceLastTx"].clip(lower=0)

df["AmountToBalanceRatio"] = df["TransactionAmount"] / (df["AccountBalance"] + 1e-6)
df["TxHour"] = df["TransactionDate"].dt.hour
df["IsNightTx"] = df["TxHour"].apply(lambda h: 1 if (h >= 23 or h <= 5) else 0)

tx_type_map = {"Credit": 0, "Debit": 1}
channel_map = {"Online": 0, "ATM": 1, "Branch": 2}
occ_map = {v: i for i, v in enumerate(sorted(df["CustomerOccupation"].unique()))}

df["TxTypeCode"] = df["TransactionType"].map(tx_type_map).fillna(0).astype(int)
df["ChannelCode"] = df["Channel"].map(channel_map).fillna(0).astype(int)
df["OccupCode"] = df["CustomerOccupation"].map(occ_map).fillna(0).astype(int)

# ── Pseudo-labels ─────────────────────────────────────────────────────────────
amount_mean = df["TransactionAmount"].mean()
amount_std = df["TransactionAmount"].std()

rule1 = df["LoginAttempts"] >= 4
rule2 = df["AmountToBalanceRatio"] > 0.8
rule3 = df["DaysSinceLastTx"] < 0.03
rule4 = df["TransactionAmount"] > (amount_mean + 3 * amount_std)
rule5 = (df["LoginAttempts"] >= 3) & (df["AmountToBalanceRatio"] > 0.5)

df["IsFraud"] = (rule1 | rule2 | rule3 | rule4 | rule5).astype(int)
fraud_rate = df["IsFraud"].mean()
print("Fraud distribution:", df["IsFraud"].value_counts().to_dict())
print("Fraud rate: {:.2%}".format(fraud_rate))

# ── Risk score target (0-100) ─────────────────────────────────────────────────
risk_score = (
    rule1.astype(float) * 30
    + rule2.astype(float) * 25
    + rule3.astype(float) * 20
    + rule4.astype(float) * 15
    + rule5.astype(float) * 10
    + (df["LoginAttempts"] / 5.0) * 5
    + df["AmountToBalanceRatio"].clip(0, 1) * 5
).clip(0, 100)

# ── Features ──────────────────────────────────────────────────────────────────
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

X = df[FEATURE_COLS].values.astype(np.float64)
y = df["IsFraud"].values
ys = risk_score.values

X_train, X_test, y_train, y_test, ys_train, ys_test = train_test_split(
    X, y, ys, test_size=0.2, random_state=42, stratify=y
)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

# ── Save helpers ──────────────────────────────────────────────────────────────
joblib.dump(FEATURE_COLS, MODELS_DIR / "fraud_feature_columns.pkl")
joblib.dump(scaler, MODELS_DIR / "fraud_scaler.pkl")
joblib.dump(
    {"tx_type": tx_type_map, "channel": channel_map, "occupation": occ_map},
    MODELS_DIR / "fraud_encoders.pkl",
)
print("Train:", X_train.shape, "| Test:", X_test.shape)

# ── Model 1: Isolation Forest ─────────────────────────────────────────────────
contamination = float(max(0.01, min(fraud_rate, 0.5)))
iso = IsolationForest(
    n_estimators=200, contamination=contamination, random_state=42, n_jobs=-1
)
iso.fit(X_train_s)
iso_pred = (iso.predict(X_test_s) == -1).astype(int)
joblib.dump(iso, MODELS_DIR / "fraud_isolation_forest.pkl")
print("\n== Model 1: Isolation Forest ==")
print(classification_report(y_test, iso_pred, target_names=["Legit", "Fraud"], zero_division=0))

# ── Model 2: Random Forest classifier ─────────────────────────────────────────
rf = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
rf.fit(X_train_s, y_train)
y_pred = rf.predict(X_test_s)
y_prob = rf.predict_proba(X_test_s)[:, 1]
joblib.dump(rf, MODELS_DIR / "fraud_classifier.pkl")
print("\n== Model 2: Random Forest Classifier ==")
print(classification_report(y_test, y_pred, target_names=["Legit", "Fraud"], zero_division=0))
print("ROC-AUC:", round(roc_auc_score(y_test, y_prob), 4))

# ── Model 3: Gradient Boosting risk scorer ────────────────────────────────────
gbr = GradientBoostingRegressor(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    random_state=42,
)
gbr.fit(X_train_s, ys_train)
ys_pred = gbr.predict(X_test_s).clip(0, 100)
joblib.dump(gbr, MODELS_DIR / "fraud_risk_scorer.pkl")
print("\n== Model 3: Gradient Boosting Risk Scorer ==")
print("MAE: {:.2f}".format(mean_absolute_error(ys_test, ys_pred)))
print("R2:  {:.4f}".format(r2_score(ys_test, ys_pred)))

# ── List saved files ──────────────────────────────────────────────────────────
print("\n== Saved artifacts ==")
for f in sorted(MODELS_DIR.iterdir()):
    print("  {:45s} {:8.1f} KB".format(f.name, f.stat().st_size / 1024))

print("\nDone!")
