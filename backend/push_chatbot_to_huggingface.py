#!/usr/bin/env python3
"""Push AI_Chatbot_model to Hugging Face Hub. Needs: pip install -U huggingface_hub, then HF_TOKEN or login."""

import os
import sys
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent / "AI_Chatbot_model"
DEFAULT_REPO_ID = "Annemarie535257/agrifinconnect-chatbot"


def main():
    repo_id = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_REPO_ID
    if not repo_id:
        print("Usage: python backend/push_chatbot_to_huggingface.py [USERNAME/repo-name]")
        print(f"Default: {DEFAULT_REPO_ID}")
        sys.exit(1)
    if "YourUsername" in repo_id or repo_id.startswith("USERNAME/"):
        print("Error: replace USERNAME/YourUsername with your real Hugging Face username.")
        print("Example: python backend/push_chatbot_to_huggingface.py Annemarie535257/agrifinconnect-chatbot")
        sys.exit(1)
    if not MODEL_DIR.exists():
        print(f"Error: not found: {MODEL_DIR}")
        sys.exit(1)

    from huggingface_hub import HfApi, login

    if not os.environ.get("HF_TOKEN"):
        login()  # prompts for token or uses cached
    api = HfApi()
    # Create repo if it doesn't exist (avoids 404 when uploading)
    try:
        api.create_repo(repo_id=repo_id, repo_type="model", exist_ok=True)
    except Exception as e:
        if "already exists" not in str(e).lower():
            print(f"Note: create_repo: {e}")
    api.upload_folder(
        folder_path=str(MODEL_DIR),
        repo_id=repo_id,
        repo_type="model",
        ignore_patterns=["tf_model.h5", "*.h5"],  # PyTorch only on Hub
    )
    print(f"Done: https://huggingface.co/{repo_id}")


if __name__ == "__main__":
    main()
