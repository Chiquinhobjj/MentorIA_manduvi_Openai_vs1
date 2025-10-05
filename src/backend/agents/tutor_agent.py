from typing import Any, Dict
import json

from agents import Agent
from ..rag.retriever import search_chunks
from .config import get_agent_config


def create_retriever_tool(agent_id: str = "tutor"):
    """Cria uma ferramenta retriever específica para um agente."""
    config = get_agent_config(agent_id)
    
    def retriever(query: str) -> str:
        """
        Busca trechos no acervo educacional local (FAISS).
        Retorna JSON string com estrutura: {"hits":[{"source": str, "score": float, "snippet": str}, ...]}
        """
        hits = search_chunks(
            query, 
            k=config.rag_k, 
            agent_id=agent_id,
            filters=config.filters
        )
        return json.dumps({"hits": hits}, ensure_ascii=False)
    
    return retriever


def create_tutor_agent(agent_id: str = "tutor") -> Agent:
    """Cria um agente tutor com configurações específicas."""
    config = get_agent_config(agent_id)
    
    retriever_tool = create_retriever_tool(agent_id)
    
    try:
        return Agent(
            name=config.name,
            instructions=config.system_prompt,
            tools=[retriever_tool] if config.tools_enabled else [],
        )
    except TypeError:
        def retriever_tool_wrapper(inputs: Dict[str, Any]) -> str:
            q = inputs.get("query", "")
            return retriever_tool(q)

        tool_spec = {
            "name": "retriever",
            "description": "Busca trechos relevantes no acervo educacional local (FAISS).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Pergunta ou tópico a pesquisar."}
                },
                "required": ["query"],
            },
            "func": retriever_tool_wrapper,
        }

        return Agent(
            name=config.name,
            instructions=config.system_prompt,
            tools=[tool_spec] if config.tools_enabled else [],
        )


# Agente padrão
tutor_agent = create_tutor_agent("tutor")


