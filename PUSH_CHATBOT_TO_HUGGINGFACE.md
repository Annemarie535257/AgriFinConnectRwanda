# Step-by-step: Push your AgriFinConnect chatbot to Hugging Face

This guide walks you through uploading your T5 chatbot model (in `AI_Chatbot_model/`) to the Hugging Face Hub so others can use it or you can load it from the cloud.

---

## Prerequisites

- Your chatbot model is in the folder **`AI_Chatbot_model/`** at the project root (you already have this).
- The folder should contain at least **PyTorch** weights so the Hub can use them:
  - Either **`model.safetensors`** or **`pytorch_model.bin`** (plus `config.json`, tokenizer files, etc.)
  - If you only have **`tf_model.h5`**, run the export script first (Step 2 below).

---

## Step 1: Create a Hugging Face account and get a token

1. Go to **[huggingface.co](https://huggingface.co)** and sign up or log in.
2. Click your profile (top right) → **Settings**.
3. Open **Access tokens** in the left sidebar.
4. Click **New token**, give it a name (e.g. `agrifinconnect-upload`), choose **Write** access, then create it.
5. **Copy the token** and keep it somewhere safe (you won’t see it again).

---

## Step 2 (optional): Export TensorFlow → PyTorch

Only do this if `AI_Chatbot_model/` has **`tf_model.h5`** but **no** `model.safetensors` or `pytorch_model.bin`.

From the **project root** (e.g. `AgriFinConnectRwanda`):

```powershell
# Use a venv if you have one
pip install "transformers>=4.30,<5" tensorflow torch
python backend/export_chatbot_to_pytorch.py
```

This writes PyTorch weights into `AI_Chatbot_model/`. The push script will then upload those (and ignores `.h5` files).

---

## Step 3: Install the Hugging Face Hub library

From the project root:

```powershell
pip install -U huggingface_hub
```

(Your `backend/requirements.txt` already has `huggingface-hub>=0.20`, so this may already be installed.)

---

## Step 4: Log in to Hugging Face

**Option A – Token in environment (recommended for scripts/CI)**

```powershell
$env:HF_TOKEN = "hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Replace `hf_xxx...` with your real token.

**Option B – Interactive login**

Don’t set `HF_TOKEN` and run the push script (Step 5). When prompted, paste your token. It will be cached for future use.

---

## Step 5: Create the repo on the Hub (one-time)

1. Go to **[huggingface.co/new](https://huggingface.co/new)**.
2. Choose **Model** (not Dataset or Space).
3. Set:
   - **Owner:** your username (e.g. `Annemarie535257`).
   - **Model name:** e.g. `agrifinconnect-chatbot`.
4. Pick **Public** or **Private**, then **Create model**.

Your **repo id** is: `USERNAME/model-name` (e.g. `Annemarie535257/agrifinconnect-chatbot`).

---

## Step 6: Run the push script

From the **project root**:

```powershell
python backend/push_chatbot_to_huggingface.py USERNAME/repo-name
```

**Example:**

```powershell
python backend/push_chatbot_to_huggingface.py Annemarie535257/agrifinconnect-chatbot
```

- The script uploads everything in **`AI_Chatbot_model/`**.
- It **skips** `tf_model.h5` and other `*.h5` files (Hub expects PyTorch/safetensors).
- When it finishes, it prints: `Done: https://huggingface.co/USERNAME/repo-name`.

---

## Step 7: Add a README and card (optional but recommended)

1. Open your model page: `https://huggingface.co/USERNAME/repo-name`.
2. Click **Edit model card** (or add a `README.md` in the repo).
3. Add a short description, e.g.:

```markdown
# AgriFinConnect Rwanda – Financial T5 Chatbot

T5-based chatbot for agricultural finance (loans, eligibility, recommendations).
Trained for the AgriFinConnect Rwanda project. Supports English; use with translation for Kinyarwanda/French.
```

4. Save. This helps others (and you) understand the model later.

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | Hugging Face account + **Write** token |
| 2 | (If needed) Run `export_chatbot_to_pytorch.py` so PyTorch/safetensors exist |
| 3 | `pip install -U huggingface_hub` |
| 4 | Set `HF_TOKEN` or run and paste token when asked |
| 5 | Create Model repo on Hub (e.g. `USERNAME/agrifinconnect-chatbot`) |
| 6 | `python backend/push_chatbot_to_huggingface.py USERNAME/repo-name` |
| 7 | Add README / model card on the Hub |

---

## Loading the model from the Hub later

After pushing, you can load the model in code without the local folder:

```python
from transformers import T5ForConditionalGeneration, T5TokenizerFast

model = T5ForConditionalGeneration.from_pretrained("USERNAME/agrifinconnect-chatbot")
tokenizer = T5TokenizerFast.from_pretrained("USERNAME/agrifinconnect-chatbot")
```

Replace `USERNAME/agrifinconnect-chatbot` with your actual repo id.

---

## Troubleshooting

- **“not found: AI_Chatbot_model”**  
  Run the script from the **project root** (parent of `backend/`), not from inside `backend/`.

- **“Authentication failed”**  
  Check that `HF_TOKEN` is correct and has **Write** access, or run without `HF_TOKEN` and log in when prompted.

- **Only .h5 in the folder**  
  Run Step 2 to export to PyTorch; then run the push script again.

- **Repo name already exists**  
  Create a new model repo with a different name, or use the existing one (same `USERNAME/repo-name`) to update it.
