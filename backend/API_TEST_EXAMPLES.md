# API Test Examples — AgriFinConnect Rwanda

Use these samples to test the ML and chatbot APIs (Swagger, Postman, or curl).  
All request bodies are **JSON**. Base URL: `http://127.0.0.1:8000/api/` (or your server).

---

## 1. Loan eligibility (Model 1)

**Endpoint:** `POST /api/eligibility/`  
**Purpose:** Predict whether a loan application is approved (1) or denied (0).

### Example 1 — Sample from dataset (likely **denied**)

**Request body:**

```json
{
  "Age": 45,
  "AnnualIncome": 39948,
  "CreditScore": 617,
  "EmploymentStatus": "Employed",
  "EducationLevel": "Master",
  "Experience": 22,
  "LoanAmount": 13152,
  "LoanDuration": 48,
  "MaritalStatus": "Married",
  "NumberOfDependents": 2,
  "HomeOwnershipStatus": "Own",
  "MonthlyDebtPayments": 183,
  "CreditCardUtilizationRate": 0.35,
  "NumberOfOpenCreditLines": 1,
  "NumberOfCreditInquiries": 2,
  "DebtToIncomeRatio": 0.36,
  "BankruptcyHistory": 0,
  "LoanPurpose": "Home",
  "PreviousLoanDefaults": 0,
  "PaymentHistory": 29,
  "LengthOfCreditHistory": 9,
  "SavingsAccountBalance": 7632,
  "CheckingAccountBalance": 1202,
  "TotalAssets": 146111,
  "TotalLiabilities": 19183,
  "MonthlyIncome": 3329,
  "UtilityBillsPaymentHistory": 0.72,
  "JobTenure": 11,
  "NetWorth": 126928,
  "BaseInterestRate": 0.20,
  "InterestRate": 0.23,
  "MonthlyLoanPayment": 420,
  "TotalDebtToIncomeRatio": 0.18
}
```

**Expected response (200):**

```json
{
  "approved": false,
  "prediction": 0,
  "reason": "Denied: The application was not approved primarily due to credit score (617), high debt-to-income ratio (36%).",
  "description": "Approved means the model predicts the application would be accepted; denied means it would likely be rejected. The reason is derived from your application features (e.g. credit score, income, debt-to-income, employment, payment history)."
}
```

- **approved** (boolean): predicted outcome.  
- **prediction** (0 or 1): 0 = Denied, 1 = Approved.  
- **reason** (string): short explanation of why approved or denied based on the features you sent.  
- **description** (string): what the approval/denial and reason mean in general.

---

### Example 2 — Sample from dataset (likely **approved**)

**Request body:**

```json
{
  "Age": 37,
  "AnnualIncome": 103264,
  "CreditScore": 594,
  "EmploymentStatus": "Employed",
  "EducationLevel": "Associate",
  "Experience": 17,
  "LoanAmount": 9184,
  "LoanDuration": 36,
  "MaritalStatus": "Married",
  "NumberOfDependents": 1,
  "HomeOwnershipStatus": "Mortgage",
  "MonthlyDebtPayments": 274,
  "CreditCardUtilizationRate": 0.32,
  "NumberOfOpenCreditLines": 0,
  "NumberOfCreditInquiries": 0,
  "DebtToIncomeRatio": 0.08,
  "BankruptcyHistory": 0,
  "LoanPurpose": "Debt Consolidation",
  "PreviousLoanDefaults": 0,
  "PaymentHistory": 26,
  "LengthOfCreditHistory": 27,
  "SavingsAccountBalance": 1555,
  "CheckingAccountBalance": 4981,
  "TotalAssets": 244305,
  "TotalLiabilities": 17286,
  "MonthlyIncome": 8605,
  "UtilityBillsPaymentHistory": 0.94,
  "JobTenure": 5,
  "NetWorth": 227019,
  "BaseInterestRate": 0.20,
  "InterestRate": 0.18,
  "MonthlyLoanPayment": 330,
  "TotalDebtToIncomeRatio": 0.07
}
```

**Expected response (200):**

```json
{
  "approved": true,
  "prediction": 1,
  "reason": "Approved: The application was approved based on acceptable credit score (594). income supports the requested loan amount and repayment. manageable debt-to-income ratio (8%). stable employment status. no previous loan defaults. no bankruptcy history. good payment history.",
  "description": "Approved means the model predicts the application would be accepted; denied means it would likely be rejected. The reason is derived from your application features (e.g. credit score, income, debt-to-income, employment, payment history)."
}
```

---

## 2. Default risk score (Model 2)

**Endpoint:** `POST /api/risk/`  
**Purpose:** Get a risk score for the application (higher = higher default risk).

Use the **same request body** as for eligibility (e.g. Example 1 or 2 above).

**Expected response (200):**

```json
{
  "risk_score": 49.0,
  "score": 49.0,
  "interpretation": "Moderate risk",
  "description": "Risk score: 49.0. This is a relative measure of default risk (higher number = higher risk). Interpretation: Moderate risk — The score indicates a moderate level of default risk. Lenders may apply standard terms or request additional assurance.",
  "score_meaning": "Scores are typically in a range where lower values (e.g. below 40) indicate lower default risk and higher values (e.g. above 55) indicate higher default risk. The exact scale depends on the model training data."
}
```

- **risk_score** / **score** (float): model output; higher = higher default risk.  
- **interpretation** (string): "Low risk", "Moderate risk", or "Higher risk" based on score bands.  
- **description** (string): what the number means and how it is interpreted.  
- **score_meaning** (string): general explanation of the score scale.

---

## 3. Loan amount recommendation (Model 3)

**Endpoint:** `POST /api/recommend-amount/`  
**Purpose:** Get a recommended loan amount (model uses same features but **without** LoanAmount; it predicts the amount).

Use the **same request body** as for eligibility, but you can **omit** `LoanAmount` (the backend ignores it for this model).

**Request body (minimal — optional fields use defaults):**

```json
{
  "Age": 37,
  "AnnualIncome": 103264,
  "CreditScore": 594,
  "EmploymentStatus": "Employed",
  "EducationLevel": "Associate",
  "Experience": 17,
  "LoanDuration": 36,
  "MaritalStatus": "Married",
  "NumberOfDependents": 1,
  "HomeOwnershipStatus": "Mortgage",
  "MonthlyDebtPayments": 274,
  "DebtToIncomeRatio": 0.08,
  "LoanPurpose": "Debt Consolidation",
  "PaymentHistory": 26,
  "LengthOfCreditHistory": 27,
  "SavingsAccountBalance": 1555,
  "CheckingAccountBalance": 4981,
  "TotalAssets": 244305,
  "TotalLiabilities": 17286,
  "MonthlyIncome": 8605,
  "JobTenure": 5,
  "NetWorth": 227019
}
```

**Expected response (200):**

```json
{
  "recommended_amount": 15000.0,
  "recommendedAmount": 15000.0,
  "amount": 15000.0,
  "prediction": 15000.0,
  "explanation": "The recommended amount of 15000 RWF is based on your profile: your annual income (103264 RWF), your credit score (594), your debt-to-income ratio (8%), your net worth (227019 RWF), savings and reserves (1555 RWF), employment status (Employed), requested loan duration (36 months). The model considers these and other application features to suggest a loan amount that aligns with typical approvals for similar profiles while respecting affordability and risk.",
  "basis": "The recommendation is driven by income, credit score, debt burden, assets, employment, and loan term from your application."
}
```

- **recommended_amount** / **amount** / **prediction** (float): suggested loan amount (same units as training data, e.g. RWF).  
- **explanation** (string): why this amount was recommended, referencing the main features you sent.  
- **basis** (string): short summary of what drives the recommendation.

---

## 4. Chatbot

**Endpoint:** `POST /api/chat/`  
**Purpose:** Send a message and get a reply. Uses the **saved T5 chatbot model** (`saved-model/`) from `Notebooks/Financial_LLM_Chatbot.ipynb` when available; otherwise returns a short fallback message.

**Request body:**

```json
{
  "message": "How do I apply for a loan?",
  "language": "en"
}
```

**Allowed `language` values:** `"en"` (English), `"fr"` (French), `"rw"` (Kinyarwanda). The model was trained on English (Bitext mortgage/loans); `language` is used for the fallback message when the model is unavailable.

**Expected response (200)** when the model is loaded (example):

```json
{
  "reply": "<model-generated reply about loan application steps>",
  "response": "<same as reply>"
}
```

If the model is not available (e.g. `saved-model/` missing or TensorFlow/transformers not installed), you get a fallback message:

```json
{
  "reply": "Thank you for your message. The chatbot model is not available right now. ...",
  "response": "..."
}
```

**Example (French):**

```json
{
  "message": "Comment demander un prêt ?",
  "language": "fr"
}
```

---

## Categorical values (must match exactly)

Use these strings for categorical fields:

| Field | Allowed values |
|-------|----------------|
| **EmploymentStatus** | `"Employed"`, `"Self-Employed"`, `"Unemployed"` |
| **EducationLevel** | `"Associate"`, `"Bachelor"`, `"High School"`, `"Master"` |
| **MaritalStatus** | `"Divorced"`, `"Married"`, `"Single"` |
| **HomeOwnershipStatus** | `"Mortgage"`, `"Own"`, `"Rent"` |
| **LoanPurpose** | `"Debt Consolidation"`, `"Education"`, `"Home"`, `"Other"` |

---

## Minimal request (eligibility / risk)

You can send only a subset of fields; the backend fills the rest with defaults:

```json
{
  "Age": 40,
  "AnnualIncome": 60000,
  "CreditScore": 620,
  "LoanAmount": 20000,
  "LoanDuration": 48,
  "EmploymentStatus": "Employed",
  "EducationLevel": "Bachelor",
  "DebtToIncomeRatio": 0.35
}
```

---

## curl examples

```bash
# Eligibility
curl -X POST http://127.0.0.1:8000/api/eligibility/ \
  -H "Content-Type: application/json" \
  -d "{\"Age\": 45, \"AnnualIncome\": 39948, \"CreditScore\": 617, \"EmploymentStatus\": \"Employed\", \"EducationLevel\": \"Master\", \"LoanAmount\": 13152, \"LoanDuration\": 48}"

# Risk
curl -X POST http://127.0.0.1:8000/api/risk/ \
  -H "Content-Type: application/json" \
  -d "{\"Age\": 45, \"AnnualIncome\": 39948, \"CreditScore\": 617, \"EmploymentStatus\": \"Employed\", \"EducationLevel\": \"Master\", \"LoanAmount\": 13152, \"LoanDuration\": 48}"

# Recommend amount
curl -X POST http://127.0.0.1:8000/api/recommend-amount/ \
  -H "Content-Type: application/json" \
  -d "{\"Age\": 37, \"AnnualIncome\": 103264, \"CreditScore\": 594, \"EmploymentStatus\": \"Employed\", \"LoanDuration\": 36}"

# Chat
curl -X POST http://127.0.0.1:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"How do I apply?\", \"language\": \"en\"}"
```

---

## Dataset source

Sample payloads above are derived from `datasets/Loan.csv` (rows with known `LoanApproved` and `RiskScore`). You can export more rows from that CSV (excluding `ApplicationDate`, `LoanApproved`, `RiskScore`) to test the models.
