---
language:
  - en
  - fr
  - rw
license: apache-2.0
pipeline_tag: text-generation
tags:
  - t5
  - flan-t5
  - finance
  - loans
  - agriculture
  - rwanda
---

# AgriFinConnect Chatbot

Fine-tuned **Flan-T5-small** for agricultural loan Q&A in Rwanda.

Trained on the [Bitext mortgage/loans LLM chatbot dataset](https://huggingface.co/datasets/bitext/Bitext-mortgage-loans-llm-chatbot-training-dataset).

## Usage

```python
from transformers import T5ForConditionalGeneration, T5TokenizerFast

tokenizer = T5TokenizerFast.from_pretrained("Annemarie535257/agrifinconnect-chatbot")
model = T5ForConditionalGeneration.from_pretrained("Annemarie535257/agrifinconnect-chatbot")

inputs = tokenizer("answer the question: How do I apply for a loan?", return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=128)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```
