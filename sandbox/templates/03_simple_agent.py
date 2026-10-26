# Template 3 — A simple agent with one tool
# ───────────────────────────────────────────
# What this teaches:
#   The agent loop: the model decides which tool to call, reads the
#   result, and decides what to do next. You see each step printed.
#
# What to change:
#   - The knowledge base (line 18)
#   - Add more tools (copy the pattern on line 16)
#   - The question (line 41)

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool


@tool
def lookup_fact(topic: str) -> str:
    """Look up a fact about an AI concept. Input should be a short topic name."""
    facts = {
        "llm": "A Large Language Model predicts the next token in a sequence, trained on large text corpora.",
        "transformer": "Transformers use self-attention so every token can attend to every other token.",
        "agent": "An agent is a goal-driven loop: plan, act (call tools), observe, repeat or stop.",
        "embedding": "An embedding turns text into a numeric vector so similar meanings sit close together.",
        "rag": "Retrieval-Augmented Generation retrieves relevant documents and feeds them to the model.",
        "mcp": "Model Context Protocol is a standard for connecting AI models to external tools and data.",
    }
    topic_lower = topic.lower().strip()
    for key, value in facts.items():
        if key in topic_lower:
            return value
    return f"No fact found for '{topic}'. Available topics: {', '.join(facts.keys())}"


# --- Build the agent ---
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
agent = llm.bind_tools([lookup_fact])

from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

question = "What is an agent and how does it relate to an LLM?"

print(f"Question: {question}\n")
messages = [HumanMessage(content=question)]

# --- Run the loop (max 5 steps) ---
for step in range(5):
    print(f"--- Step {step + 1} ---")
    response = agent.invoke(messages)
    messages.append(response)

    if not response.tool_calls:
        print(f"Answer: {response.content}\n")
        break

    for call in response.tool_calls:
        print(f"  Tool call: {call['name']}({call['args']})")
        result = lookup_fact.invoke(call["args"])
        print(f"  Result:    {result}")
        messages.append(ToolMessage(content=result, tool_call_id=call["id"]))
    print()
else:
    print("Stopped: step limit reached.\n")

print("--- Done ---")
