from typing import Any, Dict
import json

from agents import Agent
from backend.rag.retriever import search_chunks


def retriever(query: str) -> str:
    """
    Busca trechos no acervo educacional local (FAISS).
    Retorna JSON string com estrutura: {"hits":[{"source": str, "score": float, "snippet": str}, ...]}
    """
    hits = search_chunks(query, k=6)
    return json.dumps({"hits": hits}, ensure_ascii=False)


SYSTEM_PROMPT = """
Você é o Tutor Manduvi (Socrático e alinhado à BNCC).
- Faça 1–2 perguntas diagnósticas antes de explicar.
- Explique simples, depois aprofunde com exemplos.
- Quando precisar de fatos do acervo, chame a ferramenta `retriever`.
- Sempre cite as fontes assim: (Fonte: {source})
- Termine com 2–3 exercícios práticos.
- Se faltar evidência no acervo, diga explicitamente e proponha próximo passo.
- Responda em PT-BR, tom acolhedor e objetivo.
"""


try:
    tutor_agent = Agent(
        name="Tutor Manduvi",
        instructions=SYSTEM_PROMPT,
        tools=[retriever],
    )
except TypeError:
    def retriever_tool(inputs: Dict[str, Any]) -> str:
        q = inputs.get("query", "")
        return retriever(q)

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
        "func": retriever_tool,
    }

    tutor_agent = Agent(
        name="Tutor Manduvi",
        instructions=SYSTEM_PROMPT,
        tools=[tool_spec],
    )


