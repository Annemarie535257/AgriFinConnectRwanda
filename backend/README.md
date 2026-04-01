# AgriFinConnect Rwanda

AgriFinConnect Rwanda is an AI-powered agricultural finance platform for smallholder farmers in Rwanda. It connects farmers with microfinance institutions (MFIs) through a full end-to-end loan lifecycle: application submission, AI-driven eligibility assessment, document upload, MFI review, loan approval, and monthly repayment tracking.

The platform includes four ML models (loan eligibility classification, default risk scoring, loan amount recommendation, and fraud detection) plus a multilingual AI chatbot (English, French, Kinyarwanda).

## Demo and Live Links

- Demo video: https://drive.google.com/file/d/1loEs-dxLta9XgLZvLriXO-GBeUfeL_SX/view?usp=sharing
- Live platform: https://agrifinconnect.online/
- Production Swagger docs: https://agrifinconnectrwanda.onrender.com/swagger/

## Description

AgriFinConnect Rwanda combines:

- A React + Vite frontend for farmers, MFI officers, and admins
- A Django REST Framework API for authentication, dashboards, and ML inference
- Four ML models:
  - Loan eligibility (classifier)
  - Default risk (regressor)
  - Recommended amount (regressor)
  - Fraud detection (gradient boosting + isolation forest)
- A Flan-T5 chatbot fine-tuned on mortgage/loan Q&A data, with MarianMT translation for French and Kinyarwanda
- A document-driven loan workflow with downloadable ZIP packages (PDF summary + uploaded documents)

## 1. High-Level Architecture

```text
Browser
  |
  +-- React + Vite
       |  /api/* (proxy in dev, direct in prod)
       v
  Django REST Framework
       |
       +-- Authentication (register, login, token auth, password reset)
       +-- Farmer portal (applications, docs, loans, repayments, packages)
       +-- MFI portal (review, status updates, portfolio stats)
       +-- Admin portal (users, stats, application oversight)
       |
       +-- ML pipeline
       |    +-- ml_service.py          -> eligibility, risk score, recommended amount
       |    +-- fraud_service.py       -> transaction fraud detection
       |    +-- chatbot_service.py     -> Flan-T5 answer generation
       |    +-- translation_service.py -> EN <-> FR / RW translation
       |    +-- explanations.py        -> multilingual result explanations
       |
       +-- SQLite
       +-- Media files (loan_docs/)
```

## 2. Feature Highlights

### ML models

- Loan Eligibility (Model 1) - XGBoost Classifier
  - Predicts Approved / Denied with reason text
  - Inputs arrive in RWF and are converted to USD model space (`RWF_TO_USD = 1350`)
  - Very low incomes are scaled to training distribution while preserving DTI
- Default Risk Score (Model 2) - GradientBoostingRegressor
  - Returns a risk score with low/medium/high interpretation
- Loan Amount Recommendation (Model 3) - GradientBoostingRegressor
  - Recommends amount in RWF, constrained by DTI guardrails
- Fraud Detection (Model 4)
  - Gradient boosting + isolation forest hybrid scoring
  - Returns `is_fraud`, `fraud_probability`, `risk_score`, `risk_level`, `anomaly_score`

### Loan workflow

1. Farmer submits application and ML pipeline runs automatically.
2. Farmer uploads required documents (ID, land certificate, income proof, etc.).
3. MFI officer reviews AI outputs and documents, then approves/rejects/requests more docs.
4. On approval, backend creates a `Loan` and full monthly `Repayment` schedule.
5. Admin can inspect details and override status.
6. Application package is downloadable as ZIP (summary PDF + docs).

### Repayment tracking system

- Monthly schedule is created at approval time and follows calendar months (not 30-day windows)
- Overdue status is auto-updated when MFI portfolio endpoint is loaded
- MFI can mark installments paid from portfolio table
- Farmer view is read-only for repayment status
- API and UI enforce role restriction on farmer mark-paid attempts (403)

### Chatbot

- Fine-tuned Flan-T5 model from `Notebooks/Financial_LLM_Chatbot.ipynb`
- Local runtime loading from `AI_Chatbot_model/` configured in Django settings
- Supports `en`, `fr`, `rw` via translation service wrappers
- Available in floating widget and Try Models page

## 3. Project Structure

```text
AgriFinConnectRwanda/
|
+-- backend/
|   +-- api/
|   |   +-- ml_service.py
|   |   +-- fraud_service.py
|   |   +-- chatbot_service.py
|   |   +-- translation_service.py
|   |   +-- explanations.py
|   |   +-- views.py
|   |   +-- urls.py
|   |   +-- models.py
|   |   +-- serializers.py
|   |   +-- admin.py
|   |   +-- tests/
|   |   +-- management/commands/
|   |   +-- migrations/
|   +-- config/
|   |   +-- settings.py
|   |   +-- urls.py
|   +-- manage.py
|   +-- db.sqlite3
|
+-- frontend/
|   +-- src/
|   |   +-- api/client.js
|   |   +-- pages/
|   |   +-- components/
|   |   +-- context/LanguageContext.jsx
|   |   +-- translations.js
|   +-- vite.config.js
|   +-- package.json
|
+-- loan_default_risk_model/
+-- fraud_detection_model/
+-- AI_Chatbot_model/
+-- Notebooks/
+-- datasets/
+-- render.yaml
+-- requirements.txt
+-- README.md
```

## 4. Local Setup and Dependency Installation

### Prerequisites

- Python 3.11 recommended
- Node.js 18+
- npm 9+

### Backend setup

From repository root:

```bash
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py runserver 8001
```

If you prefer backend on 8000, set frontend proxy override before running Vite:

```powershell
$env:VITE_DEV_API_PROXY="http://127.0.0.1:8000"
```

Backend URLs (default local run shown above):

- API base: http://127.0.0.1:8001/api/
- Swagger: http://127.0.0.1:8001/swagger/
- ReDoc: http://127.0.0.1:8001/redoc/

### Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` by default.

### Create demo users

```bash
cd backend
python manage.py createtestusers
```

Default credentials:

- Farmer: `farmer@test.agrifinconnect.rw` / `Farmer123!`
- Microfinance: `microfinance@test.agrifinconnect.rw` / `Microfinance123!`

## 5. Model Artifacts Required by Backend

Expected at project root:

- `loan_default_risk_model/`
  - `feature_columns.pkl`
  - `scaler.pkl`
  - `label_encoder.pkl`
  - `loan_default_classifier.pkl`
  - `risk_score_regressor.pkl`
  - `loan_amount_regressor.pkl`
- `fraud_detection_model/`
  - Fraud model and encoder artifacts
- `AI_Chatbot_model/`
  - Flan-T5 model + tokenizer files produced by notebook export

When artifacts are missing, affected endpoints return `503` with descriptive error details while unrelated endpoints continue working.

## 6. Auth and Password Reset

- Admin users are backend-managed only (no public admin registration)
- Farmer and microfinance roles can register through API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register/` | Register farmer or microfinance user |
| POST | `/api/auth/login/` | Login and receive token + role |
| POST | `/api/auth/forgot-password/` | Request reset token email |
| POST | `/api/auth/reset-password/` | Reset password via token |

SMTP environment configuration (optional):

```bash
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_HOST_USER=<your_email_username>
EMAIL_HOST_PASSWORD=<your_app_password>
DJANGO_FROM_EMAIL=<from_email>
PASSWORD_RESET_FRONTEND_URL=http://localhost:3000
```

## 7. API Endpoints (Core)

Base path: `/api/`

### ML and chatbot

| Method | Endpoint | Description |
|---|---|---|
| POST | `/eligibility/` | Standalone eligibility prediction |
| POST | `/risk/` | Standalone default risk score |
| POST | `/recommend-amount/` | Standalone recommendation |
| POST | `/fraud-detect/` | Fraud detection from transaction payload |
| POST | `/fraud-detect/statement/` | Fraud/anomaly analysis from statement file |
| POST | `/chat/` | Chatbot response for `message` + `language` |

### Farmer portal

| Method | Endpoint | Description |
|---|---|---|
| GET/PATCH | `/farmer/profile/` | View or update farmer profile |
| GET/POST | `/farmer/applications/` | List or submit applications |
| GET/POST | `/farmer/applications/<id>/documents/` | List/upload documents |
| GET | `/farmer/applications/<id>/package/` | Download ZIP package |
| GET | `/farmer/required-documents/` | List required docs |
| GET | `/farmer/loans/` | Approved loans |
| GET | `/farmer/repayments/` | Repayment schedule (read-only) |
| PATCH | `/farmer/repayments/<id>/mark-paid/` | Always 403 for farmer role |

### MFI portal

| Method | Endpoint | Description |
|---|---|---|
| GET | `/mfi/applications/` | List applications |
| PATCH | `/mfi/applications/<id>/update-status/` | Approve/reject/request docs |
| GET/POST | `/mfi/applications/<id>/review/` | Detail + review action |
| POST | `/mfi/applications/<id>/messages/` | Send message to farmer |
| POST | `/mfi/applications/<id>/analyze-statement/` | Analyze attached statement |
| GET | `/mfi/applications/<id>/package/` | Download package |
| GET | `/mfi/portfolio/` | Portfolio and repayment schedules |
| PATCH | `/mfi/repayments/<id>/mark-paid/` | Mark repayment as paid |

### Admin portal

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/users/` | List users |
| GET | `/admin/stats/` | Platform stats |
| GET | `/admin/activity/` | Get Started activity log |
| GET | `/admin/applications/` | List all applications |
| GET | `/admin/applications/<id>/` | Full application detail |
| PATCH | `/admin/applications/<id>/status/` | Override status |

Full API schema: `/swagger/` and `/redoc/`

## 8. Activity Tracking

| Method | Path | Description |
|---|---|---|
| POST | `/api/activity/log/` | Log Get Started interactions |
| GET | `/api/admin/activity/` | Fetch activity entries (admin auth) |

## 9. Running End-to-End Locally

1. Start backend on port 8001.
2. Start frontend on port 3000.
3. Open `http://localhost:3000` and use Get Started.
4. Test roles and workflows:
   - Farmer: create application, upload docs, view repayments
   - MFI: review status, mark repayments paid, inspect portfolio
   - Admin: monitor users/stats/applications and override status

## 10. Training and Refreshing Models

- Loan models: run `Notebooks/train_loan_default_risk_model.ipynb`
- Fraud model: run `Notebooks/train_fraud_detection_model.ipynb`
- Chatbot model: run `Notebooks/Financial_LLM_Chatbot.ipynb`, export with:

```python
save_dir = r"C:/Users/Hp/Desktop/ALU/AgriFinConnectRwanda/AI_Chatbot_model"
tokenizer.save_pretrained(save_dir)
model.save_pretrained(save_dir)
```

Restart backend after updating model artifacts.

## 11. Key Data Models

| Model | Key fields |
|---|---|
| LoanApplication | user, status, amount, duration, AI outputs, review fields |
| Loan | application, amount, interest_rate, duration, monthly_payment |
| Repayment | loan, amount, due_date, status, paid_at |
| ApplicationStatusUpdate | application, status, note, updated_by |
| LoanApplicationDocument | application, document_type, file |
| LoanApplicationMessage | application, sender, recipient, message |

Repayment generation behavior:

- Uses amortized mortgage formula for monthly installment
- Generates one row per calendar month for full duration
- Uses `Loan.objects.get_or_create` guard to avoid duplicate loan creation

## 12. Known Behaviors and Notes

- Farmer mark-paid endpoint is intentionally blocked with `403`
- Overdue statuses are auto-updated on MFI portfolio retrieval
- Statement scanner returns parser diagnostics in API output
- Fraud model artifacts are loaded atomically to fail fast on version mismatch
- Profile photos are persisted with DB metadata and file storage

## 13. CORS

`django-cors-headers` is configured for local frontend origins and production domains. Add custom origins through `CORS_ALLOWED_ORIGINS` in `backend/config/settings.py`.
