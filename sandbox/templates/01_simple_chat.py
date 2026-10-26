# Template 1 — Simple chat with OpenAI
# ─────────────────────────────────────
# What this teaches:
#   A single model call. You send a system message and a user message.
#   The model returns one completion. No tools, no loop.
#
# What to change:
#   - The system message (line 16)
#   - The user question (line 17)
#   - The model name (line 14)

from openai import OpenAI

client = OpenAI()                        # uses OPENAI_API_KEY from env

response = client.chat.completions.create(
    model="gpt-4o-mini",                 # cheap, fast, good for learning
    messages=[
        {"role": "system", "content": "You are a helpful assistant that explains AI concepts in one short paragraph."},
        {"role": "user",   "content": "What is a large language model?"},
    ],
    max_tokens=200,
)

print(response.choices[0].message.content)
