# Deploy: Chatbot from Hub, Swagger API, and Netlify App

After pushing the chatbot to Hugging Face, use this so the **backend (e.g. Render)** loads the model from the Hub, **Swagger** works, and the **Netlify** frontend talks to the API correctly.

---

## 1. Backend (Render) – use the chatbot from Hugging Face

On Render (or any host without the local `AI_Chatbot_model/` folder), the backend can load the model from the Hub.

- **Option A – Default**  
  The code already uses repo `Annemarie535257/agrifinconnect-chatbot` when the local model directory is missing. No env var needed.

- **Option B – Override repo**  
  In Render **Environment** (or your host’s env), add:
  ```bash
  CHATBOT_MODEL_HF_REPO=Annemarie535257/agrifinconnect-chatbot
  ```
  Leave empty to disable Hub fallback.

On first chat request, the backend will download the model from the Hub (one-time, then cached). Cold starts may be slower until the model is cached.

---

## 2. Swagger API

- **Local:**  
  Run the backend, then open:  
  **http://localhost:8000/swagger/**

- **Production (Render):**  
  **https://agrifinconnectrwanda.onrender.com/swagger/**

There you can:
- Try **POST /api/chat/** with body `{"message": "What is a loan?", "language": "en"}`.
- Try other endpoints (auth, ML, farmer, MFI, admin).

If the backend loads the chatbot from the Hub, the chat endpoint will return real replies; otherwise you get the fallback message.

---

## 3. Netlify – frontend calling the API

The frontend uses `VITE_API_URL` at **build time**. For the **Netlify** app to call your Render API:

1. **Netlify → Site settings → Environment variables**
   - Add:
     - **Key:** `VITE_API_URL`  
     - **Value:** `https://agrifinconnectrwanda.onrender.com/api`
   - (Use your real Render URL if different.)

2. **Redeploy** the site so the new value is baked into the build.

3. **CORS on Render**  
   So the browser allows requests from your Netlify domain, set in Render **Environment**:
   ```bash
   CORS_ALLOWED_ORIGINS=https://agrifinconnectrwanda.netlify.app,https://your-custom-domain.com
   ```
   The backend already allows `https://agrifinconnectrwanda.netlify.app` by default; add more origins if you use other domains.

Result:
- Netlify app → `VITE_API_URL` → Render API (including **POST /api/chat/**).
- Chat on the Get Started page and the floating chatbot will use the backend (and the Hub-loaded model when applicable).

---

## Quick checklist

| Item | What to do |
|------|------------|
| Chatbot on Render | No extra step; Hub repo is default when local model is missing. Optionally set `CHATBOT_MODEL_HF_REPO`. |
| Swagger | Open `https://agrifinconnectrwanda.onrender.com/swagger/` and try **POST /api/chat/**. |
| Netlify → API | Set `VITE_API_URL=https://agrifinconnectrwanda.onrender.com/api` in Netlify env and redeploy. |
| CORS | Set `CORS_ALLOWED_ORIGINS` on Render if you use a domain not already allowed. |
