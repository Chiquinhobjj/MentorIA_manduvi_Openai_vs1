"""Configurações individuais por agente."""
from typing import Dict, Any
from dataclasses import dataclass


@dataclass
class AgentConfig:
    """Configuração individual de um agente."""
    name: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 2000
    embed_model: str = "text-embedding-3-large"
    rag_k: int = 6
    rag_chunk_size: int = 800
    rag_overlap: int = 150
    system_prompt: str = ""
    tools_enabled: bool = True
    filters: Dict[str, Any] = None


# Configurações padrão por agente
AGENT_CONFIGS: Dict[str, AgentConfig] = {
    "tutor": AgentConfig(
        name="Tutor Manduvi",
        model="gpt-4o-mini",
        temperature=0.7,
        max_tokens=2000,
        embed_model="text-embedding-3-large",
        rag_k=6,
        rag_chunk_size=800,
        rag_overlap=150,
        system_prompt="""Você é o Tutor Manduvi (Socrático e alinhado à BNCC).
- Faça 1–2 perguntas diagnósticas antes de explicar.
- Explique simples, depois aprofunde com exemplos.
- Quando precisar de fatos do acervo, chame a ferramenta `retriever`.
- Sempre cite as fontes assim: (Fonte: {source})
- Termine com 2–3 exercícios práticos.
- Se faltar evidência no acervo, diga explicitamente e proponha próximo passo.
- Responda em PT-BR, tom acolhedor e objetivo.""",
        tools_enabled=True,
        filters={"subject": "educação"}
    ),
    
    "planner": AgentConfig(
        name="Planner",
        model="gpt-4o-mini",
        temperature=0.5,
        max_tokens=1500,
        embed_model="text-embedding-3-small",
        rag_k=3,
        rag_chunk_size=600,
        rag_overlap=100,
        system_prompt="""Você cria planos de estudo objetivos e semanais.
- Faça diagnóstico com poucas perguntas e entregue um plano claro, em Markdown.
- Com checklist e marcos por semana.
- Seja encorajador e pragmático.
- Foque em metas SMART e cronogramas realistas.""",
        tools_enabled=False,
        filters={"subject": "planejamento"}
    ),
    
    "helper": AgentConfig(
        name="Helper",
        model="gpt-4o-mini",
        temperature=0.8,
        max_tokens=1200,
        embed_model="text-embedding-3-small",
        rag_k=4,
        rag_chunk_size=500,
        rag_overlap=75,
        system_prompt="""Você explica conceitos difíceis com exemplos simples e analogias.
- Use passos curtos, listas, e proponha mini-exercícios no final.
- Adapte a explicação ao nível do usuário quando ele indicar.
- Use analogias do dia a dia para facilitar compreensão.""",
        tools_enabled=False,
        filters={"subject": "conceitos"}
    ),
    
    "assessment": AgentConfig(
        name="Avaliador Manduvi",
        model="gpt-4o-mini",
        temperature=0.3,  # Mais determinístico para avaliações consistentes
        max_tokens=1000,
        embed_model="text-embedding-3-small",
        rag_k=3,
        rag_chunk_size=600,
        rag_overlap=100,
        system_prompt="""Você é o avaliador pedagógico dos Mentores Manduvi.
Avalie respostas de alunos de forma criteriosa, seguindo este formato JSON SEMPRE:
{
  "score": <0-100>,
  "feedback": "texto curto explicando pontos fortes e correções",
  "xp_awarded": <0,2,5,10>,
  "remedial_task": "tarefa prática para reforçar",
  "gaps": ["lista de lacunas detectadas"],
  "strengths": ["lista de pontos positivos"]
}

Regras:
- Score 90-100 e resposta completa → xp_awarded = 10.
- Score 70-89 com boa base → xp_awarded = 5.
- Score 40-69 ou parcialmente correta → xp_awarded = 2.
- Score abaixo de 40 → xp_awarded = 0 e oriente revisão.
- Use tom encorajador e objetivo, em PT-BR.
- Se receber gabarito/rubrica, use-os para justificar feedback.
- Cite fontes do acervo quando mencionar fatos (formato: (Fonte: nome_do_arquivo)).
- Sempre ofereça uma próxima ação concreta no campo "remedial_task".""",
        tools_enabled=False,
        filters={"subject": "avaliação"}
    )
}


def get_agent_config(agent_id: str) -> AgentConfig:
    """Retorna a configuração de um agente."""
    return AGENT_CONFIGS.get(agent_id, AGENT_CONFIGS["tutor"])


def update_agent_config(agent_id: str, **kwargs) -> AgentConfig:
    """Atualiza configuração de um agente."""
    if agent_id not in AGENT_CONFIGS:
        AGENT_CONFIGS[agent_id] = AgentConfig(name=agent_id)
    
    config = AGENT_CONFIGS[agent_id]
    for key, value in kwargs.items():
        if hasattr(config, key):
            setattr(config, key, value)
    
    return config
