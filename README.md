# AgriFinConnect Rwanda

**AgriFinConnect Rwanda** is an AI-powered agricultural finance platform for smallholder farmers in Rwanda. It connects farmers with microfinance institutions (MFIs) through a full end-to-end loan lifecycle: application submission, AI-driven eligibility assessment, document upload, MFI review, loan approval, and a complete monthly repayment tracking system. The platform is backed by four ML models (loan eligibility classification, default risk scoring, loan amount recommendation, and fraud detection) and a multilingual AI chatbot (English, French, Kinyarwanda).

---

DEMO LINK: https://drive.google.com/file/d/1loEs-dxLta9XgLZvLriXO-GBeUfeL_SX/view?usp=sharing

---


## Live Deployment

DEPLOYMENT URL: https://video.kandaassist.com/

---

## Description

AgriFinConnect Rwanda is an end-to-end platform that combines:

- A **React + Vite** single-page app for farmers, MFI officers, and admins
- A **Django REST Framework** API for authentication, dashboards, and ML inference
- **Four ML models**: loan eligibility (classifier), default risk (regressor), recommended amount (regressor), fraud detection (gradient boosting + isolation forest)
- A **Flan-T5 chatbot** fine-tuned on mortgage/loan Q&A data, with MarianMT translation for French and Kinyarwanda
- A **document-driven loan workflow**: farmers upload required supporting documents; applications can be downloaded as ZIP packages (summary PDF + documents) for audit and record-keeping

---

## 1. High-Level Architecture

```
Browser
  |
  +-- React + Vite (Netlify)
       |  /api/*  (proxy in dev, direct in prod)
       v
  Django REST Framework (Render, port 8080)
       |
       +-- Authentication (register, login, JWT, password reset)
       +-- Farmer Portal   (applications, documents, loans, repayments, packages)
       +-- MFI Portal      (review applications, update status, portfolio stats)
       +-- Admin Portal    (user management, stats, application oversight)
       |
       +-- ML Pipeline
       |    +-- ml_service.py       -> loan eligibility, risk score, recommended amount
       |    +-- fraud_service.py    -> transaction fraud detection
       |    +-- chatbot_service.py  -> Flan-T5 answer generation
       |    +-- translation_service.py -> MarianMT (EN<->FR, EN<->RW)
       |    +-- explanations.py    -> multilingual result explanations
       |
       +-- SQLite / PostgreSQL (db.sqlite3 or DATABASE_URL)
       +-- Media files (loan_docs/)
```

---

## 2. Features

### ML Models
- **Loan Eligibility (Model 1)** — `RandomForestClassifier`: predicts Approved / Denied with a reason string. All monetary inputs arrive in RWF and are converted to USD (`RWF_TO_USD = 1350`) before inference; low incomes are scaled to match the training distribution while preserving the DTI ratio.
- **Default Risk Score (Model 2)** — `GradientBoostingRegressor`: returns a risk score (0–100) with a low / medium / high interpretation.
- **Loan Amount Recommendation (Model 3)** — `GradientBoostingRegressor`: suggests an amount in RWF capped at 35 % DTI, with explanation.
- **Fraud Detection (Model 4)** — `GradientBoostingRegressor` + `IsolationForest`: returns `is_fraud`, `fraud_probability`, `risk_score`, `risk_level`, `anomaly_score`.

### Loan Application Workflow
1. Farmer submits application → ML pipeline runs automatically → AI assessment stored on the application.
2. Farmer uploads supporting documents (National ID, land certificate, income proof, etc.).
3. MFI officer reviews AI outputs + documents → approves, rejects, or requests more documents.
4. On approval the system creates a `Loan` record and an amortised monthly `Repayment` schedule (due dates start from the approval day, landing on the same day-of-month for every subsequent month).
5. Admin can view the full application detail and override status at any point.
6. Full application package (PDF summary + documents) downloadable as ZIP for audit and record-keeping.

### Repayment Tracking System
- **Monthly repayment schedule** — generated automatically on loan approval; one row per month for the full loan duration, with correct calendar months (not 30-day rolling windows).
- **Automatic overdue marking** — when the MFI portfolio page is loaded, any `pending` repayment whose due date has passed is automatically flipped to `overdue` in the database.
- **MFI dashboard — repayment table** — the Portfolio tab shows a dedicated table for every approved loan:
  - Farmer name, email, and issued date in the loan header.
  - Progress bar showing paid-vs-total instalments.
  - Rows for each month (number, month name, due date, amount, status badge, paid-on date, action).
  - Status badges: **Paid** (green), **Pending** (amber), **Due now** (blue — current calendar month), **Overdue** (red).
  - Current-month row is highlighted in blue with a **"This month"** pill.
  - MFI officer clicks **Mark paid** to record a payment; the row updates instantly (optimistic UI) and the farmer sees the ✓ tick immediately.
- **Farmer dashboard — read-only calendar** — the Repayments tab shows a card-grid calendar with a green ✓ tick for paid months and a read-only amber/red pill for pending/overdue months. **Farmers cannot mark their own repayments as paid** — that action is restricted to the MFI institution.
- **Role enforcement** — both at the API level (`PATCH /api/farmer/repayments/<id>/mark-paid/` returns `403`) and in the UI (the button is not rendered on the farmer dashboard).

### Chatbot
- Fine-tuned **Flan-T5** on Bitext mortgage/loan Q&A dataset.
- Hosted on Hugging Face Hub; loaded at Render startup when `CHATBOT_MODEL_HF_REPO` is set.
- Supports `language: "en" | "fr" | "rw"` — MarianMT translates non-English input/output.
- Floating chatbot widget on every page + dedicated chatbot card in "Try Models".

### Dashboards
- **Farmer**: profile, applications list, AI assessment results, document upload, loan history, read-only repayment calendar (updated by MFI), downloadable application package.
- **MFI Officer**: all applications (filter by status), full application detail with AI outputs and documents, status update, per-loan repayment management table (mark paid), portfolio summary stats, application messaging, bank statement analysis.
- **Admin**: user stats, application breakdown, activity log, full application detail with status override, document download.

---

## 3. Project Structure

```
AgriFinConnectRwanda/
|
+-- backend/
|   +-- api/
|   |   +-- ml_service.py           # Loan eligibility, risk, amount models (.pkl)
|   |   +-- fraud_service.py        # Fraud detection models (.pkl)
|   |   +-- chatbot_service.py      # Flan-T5 chatbot inference
|   |   +-- translation_service.py  # MarianMT EN<->FR/RW
|   |   +-- explanations.py         # Multilingual result explanations (en/fr/rw)
|   |   +-- views.py                # All DRF views (auth, ML, dashboards, repayments)
|   |   +-- urls.py                 # /api/... route definitions
|   |   +-- models.py               # Django models (UserProfile, LoanApplication,
|   |   |                           #   Loan, Repayment, ApplicationStatusUpdate, …)
|   |   +-- serializers.py          # DRF serializers
|   |   +-- admin.py                # Django admin registration
|   |   +-- tests/                  # Unit and integration tests
|   |   +-- management/commands/    # createtestusers, etc.
|   |   +-- migrations/             # Database migrations (0001 – 0010)
|   +-- config/
|   |   +-- settings.py             # Django settings (MODELS_DIR, CORS, etc.)
|   |   +-- urls.py                 # Root URL conf (/api/, /swagger/, /redoc/)
|   +-- requirements.txt            # Full backend dependencies
|   +-- requirements-render.txt     # Lean Render dependencies (no torch/transformers)
|   +-- manage.py
|   +-- db.sqlite3
|
+-- frontend/
|   +-- src/
|   |   +-- api/client.js           # All API calls (auth, ML, chatbot, dashboards,
|   |   |                           #   repayment mark-paid)
|   |   +-- pages/
|   |   |   +-- LandingPage.jsx
|   |   |   +-- GetStartedPage.jsx
|   |   |   +-- TryModelsPage.jsx
|   |   |   +-- FarmerDashboard.jsx       # Read-only repayment calendar
|   |   |   +-- FarmerDashboard.css
|   |   |   +-- MicrofinanceDashboard.jsx # Repayment management table
|   |   |   +-- MicrofinanceDashboard.css
|   |   |   +-- AdminDashboard.jsx
|   |   |   +-- AdminLoginPage.jsx
|   |   +-- components/
|   |   |   +-- LoanEligibilityCard.jsx
|   |   |   +-- RiskAssessmentCard.jsx
|   |   |   +-- LoanRecommendationCard.jsx
|   |   |   +-- FraudDetectionCard.jsx
|   |   |   +-- ChatbotCard.jsx
|   |   |   +-- FloatingChatbot.jsx
|   |   |   +-- BankStatementAnalyzer.jsx
|   |   |   +-- ApplicationStatementScanner.jsx
|   |   |   +-- ApplicationTracker.jsx
|   |   +-- context/LanguageContext.jsx
|   |   +-- translations.js
|   +-- vite.config.js              # Dev proxy: /api -> 127.0.0.1:8080
|   +-- package.json
|
+-- loan_default_risk_model/        # Trained sklearn .pkl files (loan models)
|   +-- feature_columns.pkl
|   +-- scaler.pkl
|   +-- label_encoder.pkl
|   +-- loan_default_classifier.pkl
|   +-- risk_score_regressor.pkl
|   +-- loan_amount_regressor.pkl
|   +-- mlp_classifier.pkl
|
+-- fraud_detection_model/          # Trained sklearn .pkl files (fraud models)
|   +-- fraud_feature_columns.pkl
|   +-- fraud_scaler.pkl
|   +-- fraud_encoders.pkl
|   +-- fraud_isolation_forest.pkl
|   +-- fraud_classifier.pkl
|   +-- fraud_best_gradient_boosting.pkl
|
+-- AI_Chatbot_model/               # (not in git) Flan-T5 model + tokenizer
|                                   # Production: loaded from Hugging Face Hub
+-- Notebooks/
|   +-- train_loan_default_risk_model.ipynb
|   +-- train_fraud_detection_model.ipynb
|   +-- Financial_LLM_Chatbot.ipynb
|
+-- datasets/
|   +-- Loan.csv                    # Raw loan dataset (Kaggle) — 20,000 rows
|   +-- loan_cleaned.csv            # Cleaned version used for training
|   +-- bank_transactions_data_2.csv  # Fraud detection dataset
|   +-- Bitext-mortgage-loans-llm-chatbot-training-dataset/
|
+-- render.yaml                     # Render deployment configuration
+-- ML_MODELS_README.md             # ML model architecture + training details
+-- USE_CASE_DIAGRAM.md             # Full use case diagram for all actors
+-- requirements.txt                # Root DS requirements (notebooks)
+-- README.md
```

---

## 4. Data Models (key)

| Model | Key fields |
|---|---|
| `LoanApplication` | `user`, `status`, `loan_amount_requested`, `loan_duration_months`, `recommended_amount`, `eligibility_result`, `risk_score`, `reviewed_by`, `reviewed_at` |
| `Loan` | `application` (OneToOne), `amount`, `interest_rate`, `duration_months`, `monthly_payment`, `disbursed_at`, `created_at` |
| `Repayment` | `loan` (FK), `amount`, `due_date`, `status` (`pending`/`paid`/`overdue`), `paid_at` |
| `ApplicationStatusUpdate` | `application`, `status`, `note`, `updated_by`, `created_at` |
| `LoanApplicationDocument` | `application`, `document_type`, `file`, `uploaded_at` |
| `LoanApplicationMessage` | `application`, `sender`, `recipient`, `message`, `created_at` |

### Repayment schedule generation

When an MFI officer approves a loan, the backend:
1. Creates a `Loan` record with the amortised `monthly_payment` (standard mortgage formula).
2. Generates `duration_months` `Repayment` rows, each due on the same day-of-month as the approval date but in successive calendar months (e.g. approved March 12 → due April 12, May 12, … March 2029).
3. Uses `Loan.objects.get_or_create` to prevent duplicate loans if the approval request is accidentally submitted twice.

---

## 5. Datasets

| Dataset | Source | Used by |
|---|---|---|
| `datasets/Loan.csv` | [Kaggle — Financial Risk for Loan Approval](https://www.kaggle.com/datasets/lorenzozoppelletto/financial-risk-for-loan-approval) | `train_loan_default_risk_model.ipynb` → Models 1, 2, 3 |
| `datasets/bank_transactions_data_2.csv` | https://www.kaggle.com/datasets/valakhorasani/bank-transaction-dataset-for-fraud-detection?resource=download | `train_fraud_detection_model.ipynb` → Model 4 |
| `datasets/Bitext-mortgage-loans-llm-chatbot-training-dataset/` | [Hugging Face — Bitext Mortgage Loans LLM Chatbot](https://huggingface.co/datasets/bitext/Bitext-mortgage-loans-llm-chatbot-training-dataset) | `Financial_LLM_Chatbot.ipynb` → Flan-T5 fine-tuning |

**Loan dataset key statistics** (20,000 rows, `loan_cleaned.csv`):
- Approved: ~4,780 rows (24%) / Denied: ~15,220 rows (76%)
- Primary approval driver: `AnnualIncome` vs `LoanAmount` (TotalDebtToIncomeRatio). Approved mean income ≈ $93 k; denied mean ≈ $45 k.
- Practical rule of thumb: loan ≤ ~12 % of annual income keeps DTI low enough for approval.

---

## 6. Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 5, React Router |
| **Backend** | Python 3.11, Django 5, Django REST Framework, drf-yasg (Swagger) |
| **ML — Loan models** | scikit-learn (RandomForest, GradientBoosting), joblib, pandas, numpy |
| **ML — Fraud models** | scikit-learn (GradientBoosting, IsolationForest), joblib |
| **Chatbot** | Flan-T5 (transformers), TensorFlow, Hugging Face Hub |
| **Translation** | MarianMT (transformers + torch) |
| **Database** | SQLite (dev/staging), PostgreSQL (production via `DATABASE_URL`) |
| **File storage** | Django `MEDIA_ROOT` (`backend/media/loan_docs/`) |
| **Deployment** | Netlify (frontend), Render (backend), Hugging Face Hub (chatbot model) |

---

## 7. Local Setup

### Prerequisites
- Python 3.11 recommended
- Node.js 18+

### 7.1 Backend

```bash
# From the project root
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1     # Windows PowerShell
# source venv/bin/activate       # macOS / Linux

cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8080
```

- API: http://127.0.0.1:8080/api/
- Swagger: http://127.0.0.1:8080/swagger/
- ReDoc: http://127.0.0.1:8080/redoc/

To create demo users (farmer / MFI officer / admin):

```bash
python manage.py createtestusers
```

### 7.2 Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

App runs at http://localhost:3001 (or 3000 — check Vite output). The Vite dev proxy forwards `/api` requests to `http://127.0.0.1:8080`.

### 7.3 ML model artefacts expected by the backend

| Directory | Contents | Path controlled by |
|---|---|---|
| `loan_default_risk_model/` (project root) | `*.pkl` files for Models 1-3 | `MODELS_DIR` in `backend/config/settings.py` |
| `fraud_detection_model/` (project root) | `*.pkl` files for Model 4 | `FRAUD_MODELS_DIR` in settings |
| `AI_Chatbot_model/` (project root) | Flan-T5 weights + tokenizer | `CHATBOT_MODEL_DIR` in settings |

If a model directory is missing, the corresponding endpoint returns `503` with a descriptive error message. All other endpoints continue working.

---

## 8. Running the Full Experience

1. Start the backend (`python manage.py runserver 8080`)
2. Start the frontend (`npm run dev`)
3. Open http://localhost:3001:
   - **Landing page** — overview of the platform
   - **Get Started** — register or log in
   - **Try Models** — test loan eligibility, risk score, loan amount recommendation, and chatbot without logging in
   - **Farmer Dashboard** — submit a loan application, upload documents, track status, view read-only repayment calendar
   - **MFI Dashboard** — review applications, view AI outputs, approve/reject, manage monthly repayments (mark paid per farmer)
   - **Admin Dashboard** — manage users, view all application details, override statuses

### Loan eligibility — getting an approval (verified values)

The model was trained on USD values. The frontend converts RWF → USD at `RWF_TO_USD = 1350`. To reliably get an **Approved** result:

| Field | Value |
|---|---|
| Annual income | RWF 2,500,000 (or higher) |
| Loan amount requested | RWF 300,000 (≤ ~12 % of income) |
| Loan duration | 36 months |
| Employment status | Employed |

Keep the loan-to-income ratio low (≤ ~12 %) to keep the DTI under the model's approval threshold. A DTI above ~40 % almost always results in denial regardless of credit score.

---

## 9. Training / Updating the Models

### Loan models (Models 1-3)

1. Open `Notebooks/train_loan_default_risk_model.ipynb`
2. Ensure `datasets/Loan.csv` is present
3. Run all cells — exports `.pkl` artefacts to `loan_default_risk_model/`
4. Restart the backend to reload

### Fraud model (Model 4)

1. Open `Notebooks/train_fraud_detection_model.ipynb`
2. Ensure `datasets/bank_transactions_data_2.csv` is present
3. Run all cells — exports `.pkl` artefacts to `fraud_detection_model/`
4. Restart the backend to reload

### Chatbot model

1. Open `Notebooks/Financial_LLM_Chatbot.ipynb`
2. Run all cells to fine-tune Flan-T5 on the Bitext dataset
3. Export to `AI_Chatbot_model/`:

   ```python
   save_dir = r"C:/Users/Hp/Desktop/ALU/AgriFinConnectRwanda/AI_Chatbot_model"
   tokenizer.save_pretrained(save_dir)
   model.save_pretrained(save_dir)
   ```

4. To push to Hugging Face Hub for Render deployment:

   ```bash
   python backend/push_chatbot_to_huggingface.py Annemarie535257/agrifinconnect-chatbot
   ```

See `ML_MODELS_README.md` for full architecture, feature transformation, and retraining details.

---

## 10. API Endpoints

Base path: `/api/`

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register/` | Register a new farmer account |
| POST | `/auth/login/` | Login (returns token) |
| POST | `/auth/forgot-password/` | Request password reset email |
| POST | `/auth/reset-password/` | Complete password reset |

### ML Models

| Method | Endpoint | Description |
|---|---|---|
| POST | `/eligibility/` | Standalone loan eligibility check (not stored) |
| POST | `/risk/` | Standalone default risk score (not stored) |
| POST | `/recommend-amount/` | Standalone loan amount recommendation (not stored) |
| POST | `/fraud-detect/` | Transaction fraud detection |
| POST | `/fraud-detect/statement/` | Bank statement fraud/anomaly analysis |
| POST | `/chat/` | Chatbot — `{ "message": "...", "language": "en"/"fr"/"rw" }` |

### Farmer Portal

| Method | Endpoint | Description |
|---|---|---|
| GET/PATCH | `/farmer/profile/` | View or update farmer profile |
| GET/POST | `/farmer/applications/` | List applications or submit new (triggers ML pipeline) |
| GET/POST | `/farmer/applications/<id>/documents/` | List or upload application documents |
| GET | `/farmer/applications/<id>/package/` | Download ZIP package (PDF + documents) |
| GET | `/farmer/required-documents/` | List required document types |
| GET | `/farmer/loans/` | Approved loan records |
| GET | `/farmer/repayments/` | Repayment schedule grouped by loan (read-only) |
| PATCH | `/farmer/repayments/<id>/mark-paid/` | **Disabled — returns 403.** Only MFI can mark repayments paid. |

### MFI Officer Portal

| Method | Endpoint | Description |
|---|---|---|
| GET | `/mfi/applications/` | List applications (`?status=pending/approved/rejected/…`) |
| PATCH | `/mfi/applications/<id>/update-status/` | Approve, reject, or request documents |
| GET/POST | `/mfi/applications/<id>/review/` | Full application detail / approve-or-reject shortcut |
| POST | `/mfi/applications/<id>/messages/` | Send message to farmer |
| POST | `/mfi/applications/<id>/analyze-statement/` | Analyse attached bank statement |
| GET | `/mfi/applications/<id>/package/` | Download MFI application package |
| GET | `/mfi/portfolio/` | Portfolio stats + per-loan repayment schedules |
| PATCH | `/mfi/repayments/<id>/mark-paid/` | Mark a monthly repayment as paid (MFI only) |

### Admin Portal

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/users/` | All registered users |
| GET | `/admin/stats/` | Platform statistics |
| GET | `/admin/activity/` | Get Started activity log |
| GET | `/admin/applications/` | All applications list |
| GET | `/admin/applications/<id>/` | Full application detail (farmer info + AI + documents) |
| PATCH | `/admin/applications/<id>/status/` | Override application status |

Full request/response schemas: http://127.0.0.1:8080/swagger/

---

## 13. Known Behaviours & Notes

| Topic | Detail |
|---|---|
| **Repayment schedule backfill** | Loans approved before the repayment schedule feature was added have 0 repayment rows. Run the backfill script or re-approve to generate them. |
| **Duplicate approval guard** | `Loan.objects.get_or_create` prevents a `UNIQUE constraint` error if the approve button is clicked twice. |
| **Currency conversion** | All monetary form inputs (income, loan amount) are in **RWF**. `ml_service.py` converts to USD using `RWF_TO_USD = 1350` before ML inference. |
| **Income scaling** | If a farmer's income is below the training distribution minimum, it is scaled up to `TARGET_INCOME_USD = 45,000` while preserving the loan/income ratio (DTI) so the model gives a meaningful prediction. |
| **Mark paid — MFI only** | `PATCH /api/farmer/repayments/<id>/mark-paid/` always returns `403`. The "Mark paid" button does not exist on the farmer dashboard. |
| **Auto-overdue** | On every `GET /api/mfi/portfolio/` call, any `pending` repayment whose `due_date < today` is automatically updated to `overdue`. |
