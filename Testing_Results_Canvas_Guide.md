# AgriFinConnect Rwanda — Testing Results & Deliverable Guide (Canvas)

Use this guide to demonstrate planned functionalities, capture screenshots, and write Analysis, Discussion, and Recommendations. **No separate documentation required** — this structure is for the testing deliverable only.

---

## 1. Testing Results [Screenshots with Relevant Demos]

### 1.1 Demonstration of functionality under different **testing strategies**

Capture screenshots/video for **each** strategy:

| Strategy | What to show | Where / How |
|----------|--------------|-------------|
| **API testing** | Call ML and chatbot endpoints with different inputs; show request/response. | Open **Swagger**: `https://agrifinconnectrwanda.onrender.com/swagger/` — use **ML Models** (eligibility, risk, recommend-amount) and **Chatbot** (POST /api/chat/). Screenshot: request body + 200 response with `approved`, `risk_score`, `recommended_amount`, or `reply`. |
| **UI / E2E flow** | Full user journey: register → login → use dashboard. | **Farmer**: Register → Login → Dashboard → fill loan form → run “Check eligibility” / “Risk score” / “Recommended amount” → submit application. **MFI**: Login → Applications → open one → view documents / approve or reject. Screenshot each main screen. |
| **Role-based access** | Different views and permissions per role. | Screenshot: **Farmer dashboard** (applications, loans, repayments); **MFI dashboard** (all applications, portfolio); **Admin** (users, stats). Show that Farmers cannot see MFI/Admin pages (or 403). |
| **Chatbot + language** | Same functionality in EN, FR, RW. | In Swagger or in the app: POST `/api/chat/` with `{"message": "What documents do I need for a loan?", "language": "en"}` then `"fr"` then `"rw"`. Screenshot the three responses (or the floating chatbot in the app in each language). |

**Screenshot checklist (testing strategies):**
- [ ] Swagger: at least one ML endpoint (eligibility or risk or amount) — request + response
- [ ] Swagger: Chatbot request + response (one language)
- [ ] Farmer dashboard: model preview (eligibility/risk/amount) visible
- [ ] Farmer or MFI: one application flow (submit or review)
- [ ] Two different roles (e.g. Farmer vs MFI) to show role-based behaviour

---

### 1.2 Demonstration of functionality with **different data values**

Show that the product behaves correctly and **changes output** when inputs change.

| Feature | Data variation | What to capture |
|---------|-----------------|-----------------|
| **Eligibility (Model 1)** | **Case A:** High income, good credit → expect approved. **Case B:** Low income or low credit → expect denied (or different explanation). | Two Swagger or UI screenshots: different `AnnualIncome` / `CreditScore` / `LoanAmount` → different `approved` (true/false) and explanation. |
| **Risk score (Model 2)** | **Case A:** Conservative profile → lower risk. **Case B:** Higher DTI or lower credit → higher risk. | Two screenshots: different inputs → different `risk_score` and low/medium/high label. |
| **Loan amount (Model 3)** | **Case A:** Higher income + assets → higher recommended amount. **Case B:** Lower capacity → lower amount. | Two screenshots: different `recommended_amount` and explanation. |
| **Chatbot** | Different questions (e.g. “What is a loan?” vs “How do I repay?”). | Two screenshots: different `message` → different `reply`. |
| **Application workflow** | Different application statuses (e.g. Pending, Approved, Rejected). | Screenshot: list or detail showing at least two different statuses. |

**Screenshot checklist (different data values):**
- [ ] Eligibility: 2 different input sets → 2 different outcomes (approved vs denied or different explanations)
- [ ] Risk: 2 different input sets → 2 different risk scores/levels
- [ ] Recommended amount: 2 different input sets → 2 different amounts
- [ ] Chatbot: 2 different questions → 2 different replies
- [ ] (Optional) Applications with different statuses

---

### 1.3 Performance on **different hardware or software**

Compare behaviour or performance in at least **2** of the following:

| Scenario | What to do | What to show |
|----------|------------|--------------|
| **Local vs deployed** | Run the same action locally (e.g. `npm run dev` + Django runserver) and on production (Netlify + Render). | Screenshot or short note: “Same eligibility check: local ~X s, Render ~Y s” or “Chatbot reply: local vs Render both succeed.” |
| **Different browsers** | Open the app in Chrome and Firefox (or Edge). | Screenshot: same page (e.g. Farmer dashboard or Try Models) in 2 browsers — show UI works. |
| **Different devices/specs** | Use a low-spec machine vs a normal one, or desktop vs mobile view. | Screenshot: mobile view (responsive) and desktop; optional: note “Tested on 4 GB RAM vs 8 GB RAM” or “Mobile Chrome vs Desktop Chrome.” |
| **API under load** | Send a few repeated requests to one endpoint (e.g. eligibility) and note response time or success. | Screenshot: Swagger or browser network tab showing multiple 200 responses; optional: note “N requests in Y seconds.” |

**Screenshot/note checklist (performance):**
- [ ] At least one comparison: e.g. local vs Render, or Browser A vs Browser B, or desktop vs mobile
- [ ] Short note on results (e.g. “Both environments returned correct results”; “Response time ~Z s on Render”)

---

## 2. Analysis

**Content:** Compare the testing results to the **objectives in your project proposal** (agreed with your supervisor).

- **Objectives achieved:** For each major objective (e.g. “Farmer can check eligibility,” “MFI can review applications,” “Chatbot in EN/FR/RW,” “Deploy on Render/Netlify”), state that it was achieved and point to the relevant screenshots or tests (e.g. “See Section 1.1 – API testing and UI flow”).
- **Objectives missed or partial:** If something was not fully met (e.g. chatbot not loaded on Render, or a feature not implemented), state it briefly and say why (e.g. “Chatbot model not deployed due to size; fallback message shown”).
- **Summary:** 2–3 sentences: overall, the product meets / partially meets / does not meet the proposal objectives, with reference to the evidence above.

**Suggested length:** About half a page to one page.

---

## 3. Discussion

**Content:** Explain the **importance of the milestones** and the **impact of the results** (with your supervisor in mind).

- **Milestones:** Refer to your project plan (e.g. “Phase 1: Auth and ML APIs,” “Phase 2: Farmer/MFI dashboards,” “Phase 3: Chatbot and deployment”). For each, say why it mattered (e.g. “ML APIs first allowed us to test models independently before building the UI”; “Deployment milestone proved the app works in a production-like environment”).
- **Impact of results:** What do the results mean in practice? (e.g. “Farmers can see eligibility before submitting; MFIs get a clear list of applications; the chatbot provides consistent answers in three languages.”) Mention any limitation (e.g. “Chatbot depends on model being deployed; without it, users see a fallback message.”)
- **Supervisor alignment:** If you discussed scope, timeline, or priorities with your supervisor, briefly note how the milestones and results align with those discussions.

**Suggested length:** About half a page to one page.

---

## 4. Recommendations

**Content:** Two parts (as per the brief).

### 4.1 Recommendations to the **community** (application of the product)

- **Who:** Smallholder farmers, MFIs, extension services, or policymakers in Rwanda (or similar contexts).
- **What to recommend:** How they should use or adopt the product (e.g. “MFIs can use the platform to screen applications and track risk”; “Farmers should use the eligibility and amount tools before applying”; “Deploy the chatbot where internet and model hosting are available”). Mention data quality (e.g. “Accurate income and credit data improve predictions”).
- **2–4 short, concrete recommendations.**

### 4.2 **Future work** (with supervisor)

- **Technical:** e.g. add PostgreSQL, add automated tests, improve chatbot model or add more languages, add document fraud detection when that notebook is integrated.
- **Product:** e.g. SMS fallback for low-connectivity users, more loan products, integration with mobile money.
- **Research / evaluation:** e.g. user study with farmers/MFIs, A/B test on explanation texts, measure impact on application success rates.
- **3–5 bullet points** that you could pursue with your supervisor in a follow-up project or next phase.

**Suggested length:** About half a page total for Recommendations.

---

## 5. Submitting on Canvas

- **Link:** Submit the **live app** and/or **Swagger** link so the marker can try the product:
  - App: `https://agrifinconnectrwanda.netlify.app/`
  - Swagger: `https://agrifinconnectrwanda.onrender.com/swagger/`
- **Video (if required):** Walk through: (1) Swagger – one ML call + one chatbot call, (2) Farmer flow – login → model preview → application, (3) MFI flow – applications list → one application detail, (4) Optional: different data values and one performance comparison. Keep it under 5–7 minutes.
- **Document:** One PDF or Word document containing:
  - **Testing Results:** Screenshots with short captions (testing strategies, different data values, performance).
  - **Analysis** (objectives vs results).
  - **Discussion** (milestones and impact).
  - **Recommendations** (community + future work).

No separate documentation is required; this file is a guide for producing the testing deliverable only.
