import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents import Agent, Runner, SQLiteSession
from backend.agents.study_planner import build_agent as build_planner
from backend.agents.concepts_helper import build_agent as build_helper
from backend.agents.tutor_agent import tutor_agent
from backend.rag.retriever import search_chunks


load_dotenv()

app = FastAPI(title="MentorIA API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DIR = REPO_ROOT / "public"
PUBLIC_DIR.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="public")


def get_agent(agent_id: Optional[str]) -> Agent:
    agent = (agent_id or "planner").lower()
    if agent in ("tutor", "mentor", "rag") and tutor_agent:
        return tutor_agent
    if agent in ("planner", "study_planner") and build_planner:
        return build_planner()
    if agent in ("helper", "concepts_helper") and build_helper:
        return build_helper()
    return build_planner() if build_planner else Agent(name="Mentor", instructions="Seja útil e claro.")


class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = "default"
    agentId: Optional[str] = "planner"


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.message:
        raise HTTPException(status_code=400, detail="Campo 'message' é obrigatório.")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY não definido no ambiente.")

    agent = get_agent(req.agentId)
    session = SQLiteSession(f"mentor_session_{req.sessionId}")

    try:
        result = await Runner.run(agent, req.message, session=session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"reply": result.final_output, "agent": req.agentId or "planner", "state": req.sessionId}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/debug/retriever")
def debug_retriever(q: str, k: int = 5):
    try:
        hits = search_chunks(q, k=k)
        return {"query": q, "k": k, "hits": hits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


