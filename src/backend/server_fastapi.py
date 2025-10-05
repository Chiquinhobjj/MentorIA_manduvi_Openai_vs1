import os
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents import Agent, Runner, SQLiteSession
from .agents.study_planner import build_agent as build_planner
from .agents.concepts_helper import build_agent as build_helper
from .agents.tutor_agent import create_tutor_agent
from .agents.assessment_agent import build_assessment_agent
from .agents.config import get_agent_config, update_agent_config, AGENT_CONFIGS
from .rag.retriever import search_chunks
from .progress_tracker import ProgressTracker


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


progress_tracker = ProgressTracker()


def detect_intent(message: str) -> str:
    text = (message or "").lower()
    if any(keyword in text for keyword in ("pratic", "teste", "quiz", "desafio")):
        return "practice"
    if "revis" in text or "review" in text:
        return "review"
    return "chat"


def build_next_task(intent: str, path_label: str) -> str:
    if intent == "practice":
        return "Revise o feedback do exercício e peça um novo desafio avançado ou aplique em um caso real."
    if intent == "review":
        return "Escolha um tópico com lacuna e solicite um mini-resumo antes de praticar novamente."
    if path_label == "Diagnóstico":
        return "Clique em 'Praticar agora' para responder ao diagnóstico inicial do módulo."
    if path_label == "Fundamentos":
        return "Peça ao tutor exercícios guiados para consolidar os fundamentos."
    if path_label == "Prática Guiada":
        return "Solicite um caso aplicado ou simulação para ganhar +10 XP."
    return "Combine um desafio prático com uma revisão rápida para manter o ritmo de XP."


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


class GradeRequest(BaseModel):
    answer: str
    sessionId: Optional[str] = "default"
    agentId: Optional[str] = "tutor"
    question: Optional[str] = None
    expected: Optional[str] = None
    rubric: Optional[str] = None


def _format_sources(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sources = []
    for hit in hits[:3]:
        source = {
            "source": hit.get("source"),
            "snippet": hit.get("snippet"),
        }
        if hit.get("score") is not None:
            source["score"] = hit["score"]
        sources.append(source)
    return sources


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.message:
        raise HTTPException(status_code=400, detail="Campo 'message' é obrigatório.")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY não definido no ambiente.")

    agent = get_agent(req.agentId)
    # Sessão namespaced por agente e usuário
    session = SQLiteSession(f"{req.agentId or 'planner'}_session_{req.sessionId}")

    intent = detect_intent(req.message)
    xp_amount = 5 if intent == "practice" else 2

    try:
        result = await Runner.run(agent, req.message, session=session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    hits = []
    try:
        hits = search_chunks(req.message, k=6, agent_id=req.agentId or "tutor")
    except Exception:
        hits = []

    progress = progress_tracker.award_xp(
        req.sessionId,
        req.agentId or "planner",
        xp_amount,
        reason="chat",
        payload={"intent": intent, "message": req.message},
    )
    progress_tracker.log_event(
        req.sessionId,
        req.agentId or "planner",
        "chat",
        {"message": req.message, "reply": result.final_output},
    )

    return {
        "reply": result.final_output,
        "agent": req.agentId or "planner",
        "state": req.sessionId,
        "sources": _format_sources(hits),
        "xpAwarded": progress.awarded,
        "totalXp": progress.xp,
        "badges": progress.badges,
        "nextTask": build_next_task(intent, progress.path_position.get("label", "")),
        "progress": {
            "goal": progress.goal,
            "pathPosition": progress.path_position,
            "gaps": progress.gaps,
            "recentEvents": progress.recent_events,
        },
    }


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


@app.post("/api/grade")
async def grade(req: GradeRequest):
    if not req.answer:
        raise HTTPException(status_code=400, detail="Campo 'answer' é obrigatório.")

    agent = build_assessment_agent()
    session = SQLiteSession(f"assessment_{req.sessionId}")

    prompt_parts = ["Avalie a resposta do aluno seguindo a rubrica."]
    if req.question:
        prompt_parts.append(f"Pergunta: {req.question}")
    if req.expected:
        prompt_parts.append(f"Gabarito ou pontos esperados: {req.expected}")
    if req.rubric:
        prompt_parts.append(f"Rubrica adicional: {req.rubric}")
    prompt_parts.append(f"Resposta do aluno: {req.answer}")

    try:
        result = await Runner.run(agent, "\n\n".join(prompt_parts), session=session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    raw_output = result.final_output.strip()
    if raw_output.startswith("```"):
        raw_output = raw_output.strip("`").strip()
        if raw_output.startswith("json"):
            raw_output = raw_output[4:].strip()

    try:
        grade_data = json.loads(raw_output)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Falha ao interpretar avaliação: {exc}")

    xp_awarded = int(grade_data.get("xp_awarded", 0) or 0)
    gaps = grade_data.get("gaps") if isinstance(grade_data.get("gaps"), list) else None

    progress = progress_tracker.award_xp(
        req.sessionId,
        req.agentId or "tutor",
        xp_awarded,
        reason="grade",
        payload={"question": req.question, "score": grade_data.get("score")},
        gaps=gaps,
    )
    progress_tracker.log_event(
        req.sessionId,
        req.agentId or "tutor",
        "grade",
        {
            "score": grade_data.get("score"),
            "feedback": grade_data.get("feedback"),
        },
    )

    response = {
        "score": grade_data.get("score"),
        "feedback": grade_data.get("feedback"),
        "xpAwarded": xp_awarded,
        "remedialTask": grade_data.get("remedial_task"),
        "badges": progress.badges,
        "totalXp": progress.xp,
        "progress": {
            "goal": progress.goal,
            "pathPosition": progress.path_position,
            "gaps": progress.gaps,
            "recentEvents": progress.recent_events,
        },
    }

    if "strengths" in grade_data:
        response["strengths"] = grade_data["strengths"]

    return response


@app.get("/api/progress")
def get_progress(sessionId: str = "default", agentId: str = "tutor"):
    progress = progress_tracker.get_progress(sessionId, agentId)
    return {
        "xp": progress.xp,
        "goal": progress.goal,
        "badges": progress.badges,
        "pathPosition": progress.path_position,
        "gaps": progress.gaps,
        "recentEvents": progress.recent_events,
    }


