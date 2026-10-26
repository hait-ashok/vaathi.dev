# Template 2 — Ask a question about a document
# ──────────────────────────────────────────────
# What this teaches:
#   Split a document into chunks, embed them, store them in a vector
#   index, then retrieve the relevant chunks when answering a question.
#   This is the simplest Retrieval-Augmented Generation (RAG) pattern.
#
# What to change:
#   - The document text (line 18)
#   - The question (line 39)
#   - chunk_size / chunk_overlap (line 30)

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA

# --- The document (paste your own text here) ---
document = """
Artificial intelligence is the simulation of human intelligence by machines.
A large language model (LLM) predicts the next token in a sequence using
patterns learned from large amounts of text during training.

Transformers are the architecture behind modern LLMs. They use an attention
mechanism so every token can look at every other token in the input.

An agent is a system that uses a model inside a loop: set a goal, plan steps,
call tools, read the results, and decide whether to continue or stop. The
model is the reasoning engine; the tools are the hands.
"""

# --- Split into small chunks ---
splitter = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=30)
chunks = splitter.split_text(document)
print(f"Document split into {len(chunks)} chunks.\n")

# --- Embed and store ---
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = FAISS.from_texts(chunks, embeddings)

# --- Build a QA chain ---
llm = ChatOpenAI(model="gpt-4o-mini", max_tokens=300)
qa = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectorstore.as_retriever(search_kwargs={"k": 2}),
    return_source_documents=True,
)

# --- Ask ---
question = "What is the role of the model inside an agent?"
print(f"Q: {question}\n")

result = qa.invoke({"query": question})
print(f"A: {result['result']}\n")

print("--- Retrieved chunks ---")
for i, doc in enumerate(result["source_documents"], 1):
    print(f"  [{i}] {doc.page_content[:120]}...")
