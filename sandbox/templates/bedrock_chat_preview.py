# Next stage — same Simple Chat idea on Amazon Bedrock (no BYOK)
# ──────────────────────────────────────────────────────────────
# Users never see a key. Lambda runs this pattern with an IAM role.
# Cognito + TOTP gates who can call the Function URL.
# Budget: ~$1/day site cap via DynamoDB ledger + AWS Budgets.
#
# This file is a teaching preview — not wired to the browser yet.

import json
import boto3

bedrock = boto3.client("bedrock-runtime")  # credentials = Lambda IAM role

MODEL_ID = "eu.amazon.nova-micro-v1:0"  # example; pin in infra

def chat(system: str, user: str) -> str:
    response = bedrock.converse(
        modelId=MODEL_ID,
        system=[{"text": system}],
        messages=[
            {"role": "user", "content": [{"text": user}]},
        ],
        inferenceConfig={"maxTokens": 200},
    )
    return response["output"]["message"]["content"][0]["text"]


if __name__ == "__main__":
    print(chat(
        "You are a helpful assistant that explains AI concepts in one short paragraph.",
        "What is a large language model?",
    ))
