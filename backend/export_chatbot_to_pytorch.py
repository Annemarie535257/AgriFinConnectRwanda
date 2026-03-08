#!/usr/bin/env python3
"""
Export the TensorFlow chatbot model (tf_model.h5) to PyTorch so the backend can load it
on Render without TensorFlow.

Requires: transformers 4.x and TensorFlow (transformers 5 removed TF support).
If you see "no file named pytorch_model.bin" or ImportError for TFT5, run this script
in an environment with transformers 4.x:

  pip install "transformers>=4.30,<5" tensorflow torch
  python backend/export_chatbot_to_pytorch.py

Usage (from repo root):
  python backend/export_chatbot_to_pytorch.py [source_dir] [output_dir]

  source_dir: directory with tf_model.h5 (default: AI_Chatbot_model)
  output_dir: where to write PyTorch model (default: same as source_dir)
"""
import sys
from pathlib import Path

# Repo root (parent of backend/)
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_MODEL_DIR = PROJECT_ROOT / "AI_Chatbot_model"


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MODEL_DIR
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else source
    source = source.resolve()
    output = output.resolve()

    if not source.exists():
        print(f"Error: model dir not found: {source}")
        print("Train and save the chatbot first (e.g. Financial_LLM_Chatbot.ipynb -> AI_Chatbot_model/)")
        sys.exit(1)

    if not (source / "tf_model.h5").exists():
        print(f"Error: no tf_model.h5 in {source}. This script converts TensorFlow (tf_model.h5) to PyTorch.")
        sys.exit(1)

    import transformers
    vers = getattr(transformers, "__version__", "?")
    if vers.startswith("5."):
        print("Your transformers version is", vers, "(TF support was removed in 5.x).")
        print("Run this script in an environment with transformers 4.x and TensorFlow:")
        print('  pip install "transformers>=4.30,<5" tensorflow torch')
        print("  python backend/export_chatbot_to_pytorch.py")
        sys.exit(1)

    print(f"Loading TF model (tf_model.h5) from {source} ...")
    try:
        from transformers import T5Config, T5ForConditionalGeneration, T5TokenizerFast
        from transformers.modeling_tf_pytorch_utils import load_tf2_checkpoint_in_pytorch_model

        tokenizer = T5TokenizerFast.from_pretrained(str(source))
        config = T5Config.from_pretrained(str(source))
        # Create PyTorch model from config only (real tensors, no meta device).
        # Then load TF weights into it so we can save without "Cannot copy out of meta tensor".
        pt_model = T5ForConditionalGeneration(config)
        tf_path = source / "tf_model.h5"
        pt_model, _ = load_tf2_checkpoint_in_pytorch_model(
            pt_model, str(tf_path), allow_missing_keys=True, output_loading_info=True
        )
        print(f"Saving PyTorch model to {output} ...")
        output.mkdir(parents=True, exist_ok=True)
        pt_model.save_pretrained(str(output))
        tokenizer.save_pretrained(str(output))
        print("Done. Deploy this directory to Render; the backend will use PyTorch (no TensorFlow needed).")
    except Exception as e:
        err = str(e)
        if "pytorch_model.bin" in err or "safetensors" in err:
            print("Error: from_tf=True did not run (library looked for PyTorch weights first).")
            print("Use an environment with transformers 4.30–4.45 and TensorFlow:")
            print('  pip install "transformers>=4.30,<4.46" tensorflow torch')
            print("  python backend/export_chatbot_to_pytorch.py")
        else:
            print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
