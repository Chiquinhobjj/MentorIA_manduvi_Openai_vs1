import os
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents import Agent, Runner, SQLiteSession
from .agents.study_planner import build_agent as build_planner
from .agents.concepts_helper import build_agent as build_helper
from .agents.tutor_agent import create_tutor_agent
from .agents.config import get_agent_config, update_agent_config, AGENT_CONFIGS
from .rag.retriever import search_chunks


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
    
    if agent in ("tutor", "mentor", "rag"):
        return create_tutor_agent("tutor")
    elif agent in ("planner", "study_planner"):
        return build_planner() if build_planner else Agent(name="Planner", instructions="Crie planos de estudo.")
    elif agent in ("helper", "concepts_helper"):
        return build_helper() if build_helper else Agent(name="Helper", instructions="Explique conceitos.")
    else:
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
    # Sessão namespaced por agente e usuário
    session = SQLiteSession(f"{req.agentId or 'planner'}_session_{req.sessionId}")

    try:
        result = await Runner.run(agent, req.message, session=session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"reply": result.final_output, "agent": req.agentId or "planner", "state": req.sessionId}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/debug/retriever")
def debug_retriever(q: str, k: int = 5, agent_id: str = "tutor"):
    try:
        hits = search_chunks(q, k=k, agent_id=agent_id)
        return {"query": q, "k": k, "agent_id": agent_id, "hits": hits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ApiKeyRequest(BaseModel):
    apiKey: str
    persist: Optional[bool] = False


@app.post("/api/config/api-key")
def set_api_key(req: ApiKeyRequest):
    if not req.apiKey:
        raise HTTPException(status_code=400, detail="apiKey é obrigatório")

    # Define para o processo atual
    os.environ["OPENAI_API_KEY"] = req.apiKey

    # Opcional: persiste no .env da raiz
    if req.persist:
        env_path = REPO_ROOT / ".env"
        lines = []
        if env_path.exists():
            lines = env_path.read_text(encoding="utf-8").splitlines()
            lines = [ln for ln in lines if not ln.startswith("OPENAI_API_KEY=")]
        lines.append(f"OPENAI_API_KEY={req.apiKey}")
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {"ok": True}


# Endpoints para configuração de agentes
@app.get("/api/agents")
def list_agents():
    """Lista todos os agentes disponíveis com suas configurações."""
    return {
        "agents": {
            agent_id: {
                "name": config.name,
                "model": config.model,
                "temperature": config.temperature,
                "max_tokens": config.max_tokens,
                "embed_model": config.embed_model,
                "rag_k": config.rag_k,
                "rag_chunk_size": config.rag_chunk_size,
                "rag_overlap": config.rag_overlap,
                "tools_enabled": config.tools_enabled,
                "filters": config.filters,
            }
            for agent_id, config in AGENT_CONFIGS.items()
        }
    }


class AgentConfigRequest(BaseModel):
    agent_id: str
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    embed_model: Optional[str] = None
    rag_k: Optional[int] = None
    rag_chunk_size: Optional[int] = None
    rag_overlap: Optional[int] = None
    system_prompt: Optional[str] = None
    tools_enabled: Optional[bool] = None
    filters: Optional[Dict[str, Any]] = None


@app.post("/api/agents/config")
def update_agent_config_endpoint(req: AgentConfigRequest):
    """Atualiza configuração de um agente."""
    try:
        config = update_agent_config(
            req.agent_id,
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            embed_model=req.embed_model,
            rag_k=req.rag_k,
            rag_chunk_size=req.rag_chunk_size,
            rag_overlap=req.rag_overlap,
            system_prompt=req.system_prompt,
            tools_enabled=req.tools_enabled,
            filters=req.filters,
        )
        return {"ok": True, "config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


