# AgriFinConnect Rwanda

Github link: https://github.com/Annemarie535257/AgriFinConnect-Rwanda.git

```bash
git clone https://github.com/Annemarie535257/AgriFinConnect-Rwanda.git
```

---

## Description

AgriFinConnect Rwanda is a project aimed at **improving agricultural finance and services for smallholder farmers in Rwanda using AI**. It is an end‑to‑end platform that combines:

- A **React web app** for farmers, microfinance institutions (MFIs), and admins  
- A **Django REST API** for authentication, dashboards, and ML inference  
- **ML models** for loan eligibility, default risk scoring, and loan amount recommendation  
- A **financial assistant chatbot** (Flan‑T5) with support for **English, French, and Kinyarwanda**

The platform helps farmers explore loan eligibility and recommended amounts, allows MFIs to review applications and manage portfolio risk, and provides a multilingual AI assistant for loan-related questions.

It also includes a document-driven loan workflow where:
- farmers upload required application documents,
- both farmers and MFIs can review folder-style application packages,
- and each package can be downloaded as a ZIP (with summary PDF + attached documents) for audit and record keeping.

---

## Demo

link : https://drive.google.com/file/d/1X3JCoGWCgT6zR_3i8_JM-3kLIcqoSxFS/view?usp=sharing

---

## Demo

link : https://youtu.be/_h2mcfVPl2Y

---

## 1. High‑Level Architecture

- **Frontend** (`frontend/`)
  - React + Vite single‑page app
  - Landing page, “Try Models” playground, and role‑based dashboards
  - Floating chatbot + chatbot card calling the backend `/api/chat/`

- **Backend** (`backend/`)
  - Django REST Framework API
  - Endpoints for:
    - Auth (register/login, password reset)
    - ML models: eligibility, risk score, loan amount
    - Chatbot: `/api/chat/`
    - Farmer, Microfinance, and Admin dashboards
  - Swagger/OpenAPI at `/swagger/`, ReDoc at `/redoc/`

- **ML & Data Science** (`Notebooks/`, `datasets/`, `loan_default_risk_model/`)
  - `train_loan_default_risk_model.ipynb`: trains the three loan models and exports `.pkl` artifacts
  - `Financial_LLM_Chatbot.ipynb`: fine‑tunes Flan‑T5 on a loan/mortgage Q&A dataset and exports to `saved-model/`

- **Models on disk**
  - `loan_default_risk_model/` — sklearn / XGBoost models + preprocessing artifacts
  - `saved-model/` (not tracked by git) — T5 model + tokenizer for the chatbot

---

## 2. Features

- **Loan eligibility (Model 1)**
  - Predicts whether a loan application is likely to be **approved or denied**
  - Provides an explanation string describing key factors (income, credit score, etc.)

- **Default risk score (Model 2)**
  - Returns a numeric **risk score** and interpretation buckets (low/medium/high risk)

- **Loan amount recommendation (Model 3)**
  - Suggests a **recommended loan amount** for approved profiles
  - Explains the reasoning in plain language

- **Chatbot**
  - Uses a fine‑tuned **Flan‑T5** model served from `saved-model/`
  - Answers questions about loans, applications, repayment, etc.
  - Accepts a `language` field (`en`, `fr`, `rw`) and uses MarianMT models to translate
    questions/answers between English, French, and Kinyarwanda

- **Dashboards**
  - **Farmer dashboard**: profile, applications, approved loans, repayments, farm data, and downloadable application package
  - **MFI dashboard**: all applications (across statuses), document review, folder-style package download, portfolio stats, repayment performance
  - **Admin dashboard**: user stats, application breakdown, Get Started activity log

- **Application packages (new workflow)**
  - Each loan application can be exported as a ZIP package
  - Package includes:
    - `application_summary.pdf`
    - `application_summary.json`
    - uploaded supporting documents
  - Available for both:
    - farmer self-review/download
    - microfinance review/download

---

## 3. Project Structure

```text
AgriFinConnect-Rwanda/
├── backend/
│   ├── api/
│   │   ├── ml_service.py           # Load loan models (.pkl) and run predictions
│   │   ├── explanations.py         # Human‑readable explanations for ML outputs
│   │   ├── chatbot_service.py      # Load Flan‑T5 from saved-model/ and generate replies
│   │   ├── translation_service.py  # MarianMT translation EN<->FR/RW for chatbot
│   │   ├── views.py                # DRF views (auth, ML, chatbot, dashboards)
│   │   ├── urls.py                 # /api/... routes
│   │   ├── models.py               # UserProfile, FarmerProfile, Loan, Repayment, etc.
│   │   ├── serializers.py          # Auth & DTO serializers
│   │   └── management/commands/
│   │       └── createtestusers.py  # Helper to create demo users
│   ├── config/
│   │   ├── settings.py             # Django settings (MODELS_DIR, PROJECT_ROOT, CORS, etc.)
│   │   └── urls.py                 # /api/, /swagger/, /redoc/
│   ├── requirements.txt            # Backend dependencies (Django, DRF, TF, transformers, torch)
│   └── manage.py
│
├── frontend/
│   ├── src/
│   │   ├── api/client.js           # All API calls (auth, ML, chatbot, dashboards)
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── GetStartedPage.jsx
│   │   │   ├── TryModelsPage.jsx   # Loan cards + chatbot card
│   │   │   ├── FarmerDashboard.jsx
│   │   │   ├── MicrofinanceDashboard.jsx
│   │   │   └── AdminDashboard.jsx
│   │   ├── components/
│   │   │   ├── LoanEligibilityCard.jsx
│   │   │   ├── RiskAssessmentCard.jsx
│   │   │   ├── LoanRecommendationCard.jsx
│   │   │   ├── ChatbotCard.jsx
│   │   │   └── FloatingChatbot.jsx
│   │   └── context/LanguageContext.jsx
│   ├── vite.config.js              # Vite dev server + /api proxy -> 127.0.0.1:8080
│   └── package.json
│
├── Notebooks/
│   ├── train_loan_default_risk_model.ipynb
│   ├── Financial_LLM_Chatbot.ipynb
│   └── loan_default_risk_model/    # Notebook‑generated model artifacts (backup copy)
│
├── datasets/
│   ├── Loan.csv                    # Raw loan dataset (Kaggle)
│   ├── loan_cleaned.csv            # Cleaned dataset used for training
│   └── Bitext-mortgage-loans-llm-chatbot-training-dataset/
│       └── bitext-mortgage-loans-llm-chatbot-training-dataset.csv
│
├── loan_default_risk_model/        # Production model artifacts used by backend
│   ├── feature_columns.pkl
│   ├── scaler.pkl
│   ├── label_encoder.pkl
│   ├── loan_default_classifier.pkl
│   ├── risk_score_regressor.pkl
│   └── loan_amount_regressor.pkl
│
├── saved-model/                    # (ignored by git) Flan‑T5 chatbot model + tokenizer
├── requirements.txt                # Root DS requirements (for notebooks, optional)
└── README.md
```

---

## 4. Datasets

### Loan models

- **Source:** [Kaggle — Financial Risk for Loan Approval](https://www.kaggle.com/datasets/lorenzozoppelletto/financial-risk-for-loan-approval)  
- **Local:** `datasets/Loan.csv` (raw), `datasets/loan_cleaned.csv` (processed)
- **Used by:**
  - `Notebooks/train_loan_default_risk_model.ipynb`
  - Backend `ml_service.py` via the exported `.pkl` artifacts

### Chatbot

- **Source:** [Hugging Face — Bitext Mortgage Loans LLM Chatbot Training Dataset](https://huggingface.co/datasets/bitext/Bitext-mortgage-loans-llm-chatbot-training-dataset)
- **Local:** `datasets/Bitext-mortgage-loans-llm-chatbot-training-dataset/...`
- **Used by:** `Notebooks/Financial_LLM_Chatbot.ipynb` to fine‑tune Flan‑T5

---

## 5. Tech Stack

- **Backend**
  - Python 3.9+
  - Django 4.x, Django REST Framework
  - drf-yasg for Swagger/Redoc
  - SQLite (default) for persistence
  - ML: scikit‑learn, XGBoost (inside notebook), joblib
  - Chatbot: TensorFlow + `TFT5ForConditionalGeneration` (transformers 4.x)
  - Translation: MarianMT models (transformers + torch)

- **Frontend**
  - React 18
  - Vite 5
  - React Router

---
## 7. How to Set Up the Environment and the Project

### 7.1 Backend (API + ML + Chatbot)

From the repo root:

```bash
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8080
```

- API will be at `http://127.0.0.1:8080/api/`
- Swagger UI: `http://127.0.0.1:8080/swagger/`
- ReDoc: `http://127.0.0.1:8080/redoc/`

#### Models expected by the backend

- Loan models:
  - Directory: `loan_default_risk_model/` in project root (sibling of `backend/`)
  - Controlled by `MODELS_DIR` in `backend/config/settings.py`

- Chatbot model:
  - Directory: `saved-model/` in project root (not committed to git)
  - Controlled by `CHATBOT_MODEL_DIR` in `backend/api/chatbot_service.py` (via `settings.PROJECT_ROOT`)

If these directories are missing or incomplete, ML endpoints will return `503` with an error message.

### 7.2 Frontend (React app)

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

- App runs at `http://localhost:3000`
- Vite proxy forwards `/api` to `http://127.0.0.1:8080` (see `frontend/vite.config.js`)

---

## 8. Running the Full Experience

1. **Start backend** (Django on port 8080).
2. **Start frontend** (Vite on port 3000).
3. Open `http://localhost:3000`:
   - Explore the landing page
   - Go to **“Try Models”** to test:
     - Loan eligibility
     - Risk assessment
     - Loan amount recommendation
     - Chatbot card
   - Use the **floating chatbot** in the corner for Q&A

> The chatbot and the loan cards all call the backend through `frontend/src/api/client.js`.

---

## 9. Training / Updating the Models

### 9.1 Loan models

1. Open `Notebooks/train_loan_default_risk_model.ipynb`.
2. Ensure `datasets/Loan.csv` is present.
3. Run all cells:
   - Cleans the data and writes `datasets/loan_cleaned.csv`.
   - Trains:
     - Loan approval classifier
     - Risk score regressor
     - Loan amount regressor
   - Exports artifacts (`*.pkl`) into `loan_default_risk_model/`.
4. Restart the backend so it reloads the updated models.

### 9.2 Chatbot model

1. Open `Notebooks/Financial_LLM_Chatbot.ipynb`.
2. Ensure the Bitext dataset is available under `datasets/`.
3. Run all cells to fine‑tune Flan‑T5 on the mortgage/loan Q&A data.
4. At the end, export the model to **project root**:

   ```python
   save_dir = r"c:/Users/YourUser/Desktop/ALU/AgriFinConnect-Rwanda/saved-model"
   tokenizer.save_pretrained(save_dir)
   model.save_pretrained(save_dir)
   ```

5. Restart the backend; the chatbot should now use the updated model.

---

## 10. Key API Endpoints (overview)

Base path: `/api/`

- **ML models**
  - `POST /api/eligibility/` — loan approval prediction
  - `POST /api/risk/` — default risk score
  - `POST /api/recommend-amount/` — recommended loan amount

- **Chatbot**
  - `POST /api/chat/`
    - Body: `{ "message": "text", "language": "en" | "fr" | "rw" }`
    - Returns: `{ "reply": "...", "response": "..." }`

- **Auth**
  - `POST /api/auth/register/`
  - `POST /api/auth/login/`
  - `POST /api/auth/forgot-password/`
  - `POST /api/auth/reset-password/`

- **Farmer / MFI / Admin dashboards**
  - Farmer:
    - `/api/farmer/profile/`
    - `/api/farmer/applications/`
    - `/api/farmer/applications/<id>/documents/`
    - `/api/farmer/applications/<id>/package/`
    - `/api/farmer/loans/`
    - `/api/farmer/repayments/`
  - MFI:
    - `/api/mfi/applications/?status=all|pending|under_review|documents_requested|approved|rejected`
    - `/api/mfi/applications/<id>/package/`
    - `/api/mfi/applications/<id>/review/`
    - `/api/mfi/applications/<id>/update-status/`
    - `/api/mfi/portfolio/`
  - Admin: `/api/admin/users/`, `/api/admin/stats/`, `/api/admin/activity/`

See `/swagger/` for full schemas and example payloads.

---

## 11. Environment Variables

Backend (`backend/config/settings.py`):

- `DJANGO_SECRET_KEY` — Django secret key (use a strong value in production)
- `DJANGO_DEBUG` — `"1"` for debug, `"0"` for production
- `DJANGO_ALLOWED_HOSTS` — Comma‑separated hostnames
- `PASSWORD_RESET_FRONTEND_URL` — Base URL of the frontend (for password reset links)
- `DJANGO_EMAIL_BACKEND`, `DJANGO_FROM_EMAIL` — Email configuration for password reset

Frontend:

- `VITE_API_URL` — Optional; overrides the `/api` proxy base in production builds

---

## 12. Deployment Plan

High-level plan for deploying AgriFinConnect Rwanda to a production or staging environment.

| Step | Task | Notes |
|------|------|--------|
| 1 | **Backend hosting** | Deploy Django app to Render or Heroku. Use a production WSGI/ASGI server-Gunicorn. |
| 2 | **Database** | Replace SQLite with PostgreSQL (or another production DB). Set `DATABASES` in settings and run migrations. |
| 3 | **Static/media** | Serve static files via CDN or Nginx; use environment variables for `SECRET_KEY`, `ALLOWED_HOSTS`, `DEBUG=0`. |
| 4 | **Model artifacts** | Ensure `loan_default_risk_model/` and `saved-model/` are present on the server (or on shared storage) and paths in settings point to them. |
| 5 | **Frontend build** | Run `npm run build` in `frontend/`, then serve the `dist/` output via a static host-Netlify. Set `VITE_API_URL` to the production API base URL. |
| 6 | **API base URL** | Configure frontend to call the production API and ensure CORS allows the frontend origin. |
| 7 | **Email** | Configure a real email backend (SMTP or SendGrid) for password reset; set `PASSWORD_RESET_FRONTEND_URL` to the live frontend URL. |
| 8 | **HTTPS** | Use TLS (e.g. Let’s Encrypt) for both frontend and backend. |
| 9 | **Monitoring** | Optional: logging, health checks (`/api/` or a dedicated `/health/`), and error tracking (e.g. Sentry). |

### 12.1 Netlify (frontend) + Render (API)

- **Netlify** — In the Netlify dashboard: **Site settings → Environment variables**. Add:
  - `VITE_API_URL` = `https://agrifinconnectrwanda.onrender.com/api`
  - (Optional) `VITE_BACKEND_URL` = `https://agrifinconnectrwanda.onrender.com` (for the Django admin link in the admin dashboard; otherwise it is derived from `VITE_API_URL`.)
  Redeploy the site after adding or changing these so the build picks them up.

- **Render** — In the Render dashboard for your Django service, set:
  - `CORS_ALLOWED_ORIGINS` = your Netlify URL(s), e.g. `https://agrifinconnectrwanda.netlify.app` (comma-separated if you have multiple).
  - `DJANGO_ALLOWED_HOSTS` is already defaulted to include `agrifinconnectrwanda.onrender.com`; override via env if you use a custom domain.

- **Database** — For now you can keep **SQLite** on Render for testing (data may be lost on redeploy if the filesystem is ephemeral). For a persistent production setup, add a **PostgreSQL** database on Render, set `DATABASE_URL` (or configure `DATABASES` in `settings.py` from env), run `python manage.py migrate` in the build/start command or once manually, and use that database for the Django service.

---

