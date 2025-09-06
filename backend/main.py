# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import os, json

# Load environment variables
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY environment variable not set.")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

client = OpenAI(api_key=api_key)

app = FastAPI(title="Financial Chatbot API", version="1.0")

# Allow CORS from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic request model
class AskBody(BaseModel):
    question: str

# System prompt
SYSTEM = (
    "You are a concise financial assistant. Answer simply. "
    "Cite sources for your answers using URLs or publication names. "
    "Return a JSON object exactly with fields: "
    "answer (string), sources (array of URLs or citations, may be empty). "
    "Do not add any extra text outside the JSON."
)

@app.post("/ask")
def ask(body: AskBody):
    prompt = f"{SYSTEM}\nUser: {body.question}"

    try:
        resp = client.responses.create(model="gpt-4o-mini", input=prompt)
        txt = resp.output_text.strip()

        # Try parsing JSON normally
        try:
            parsed = json.loads(txt)
        except json.JSONDecodeError:
            # If the model returned JSON as a string with extra quotes, fix it
            txt_fixed = txt.strip('"').replace('\\"', '"')
            try:
                parsed = json.loads(txt_fixed)
            except Exception:
                # Final fallback: return raw text as answer
                parsed = {"answer": txt, "sources": []}

        # Ensure fields exist
        answer = str(parsed.get("answer", "")).strip()
        sources = parsed.get("sources", [])

        # Ensure sources is a list of strings
        if not isinstance(sources, list):
            sources = []
        sources = [str(s) for s in sources if str(s).strip()]

        # Add fallback source if empty
        if not sources:
            sources = ["General finance reference: Investopedia"]

        return {"answer": answer, "sources": sources}

    except Exception as e:
        # Final fallback if anything goes wrong
        return {"answer": f"⚠️ Error: {str(e)}", "sources": ["General finance reference: Investopedia"]}
