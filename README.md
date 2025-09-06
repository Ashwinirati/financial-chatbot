# Financial Chatbot

## Overview
AI-powered financial chatbot (Next.js + Tailwind frontend, FastAPI backend + OpenAI).

## Local setup

### Backend
1. Open terminal:
```bash
cd backend
source .venv/Scripts/activate  # Windows PowerShell/Command Prompt: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
