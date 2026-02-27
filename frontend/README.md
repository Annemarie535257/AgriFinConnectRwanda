# AgriFinConnect Rwanda — Frontend

React (Vite) landing page and API spaces for the AI-powered digital microfinance platform.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s included

- **Hero** — Project name, tagline, and main objective
- **API spaces** (call backend when running):
  1. **Loan eligibility** — `POST /api/eligibility/` (Model 1)
  2. **Default risk assessment** — `POST /api/risk/` (Model 2)
  3. **Loan amount recommendation** — `POST /api/recommend-amount/` (Model 3)
  4. **Multilingual chatbot** — `POST /api/chat/` (Kinyarwanda, English, French)

If the backend is not running, each space shows a “Backend not connected” message after you submit.

## Backend (Django)

Configure your Django app to expose:

- `POST /api/eligibility/` — body: JSON with features (Age, AnnualIncome, CreditScore, etc.); response: `{ "approved": true|false }` or `{ "prediction": 0|1 }`
- `POST /api/risk/` — body: JSON with features; response: `{ "risk_score": number }` or `{ "score": number }`
- `POST /api/recommend-amount/` — body: JSON with features (no LoanAmount); response: `{ "recommended_amount": number }` or `{ "amount": number }`
- `POST /api/chat/` — body: `{ "message": string, "language": "en"|"fr"|"rw" }`; response: `{ "reply": string }`

In development, Vite proxies `/api` to `http://localhost:8000`, so run Django on port 8000 with URL prefix `/api` for the above endpoints.

## Build for production

```bash
npm run build
```

Output is in `dist/`. Set `VITE_API_URL` to your production API base URL (e.g. `https://your-api.com/api`) before building if needed.
