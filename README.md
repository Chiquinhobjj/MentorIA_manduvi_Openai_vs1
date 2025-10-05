## MentorIA - UI/UX + Backend com openai-agents

Este projeto cria um agente de mentoria com foco em UX e UI de chat, seguindo estritamente a instalação via ambiente virtual e a dependência `openai-agents`.

### Setup (obrigatório)

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install openai-agents
```

Defina a variável de ambiente `OPENAI_API_KEY` antes de executar o backend:

```bash
export OPENAI_API_KEY="sk-..."
```

### Executar o backend (exemplo mínimo)

```bash
source .venv/bin/activate
python src/backend/mentor_agent.py
```

### Conceitos de UX aplicados

- Onboarding ativo: mensagem inicial com botões de sugestão (quick replies)
- Memória de conversa: sessão persistente para manter contexto
- Feedback visual: respostas em Markdown com listas/checklists
- Layout de chat: mensagens do agente à esquerda, usuário à direita (a cargo do frontend)

### Estrutura inicial

```
src/
  backend/
    mentor_agent.py
```

### Servidor HTTP + Frontend simples

```bash
source .venv/bin/activate
export OPENAI_API_KEY="sk-..."
python src/backend/server.py
```

Abra `http://127.0.0.1:8000` no navegador para usar o chat com UI simples. O endpoint de API está em `POST /api/chat` com payload `{ message, sessionId }`.

### Criando e selecionando agentes

- Exemplos prontos em `src/backend/agents/`:
  - `study_planner.py` → agente "planner"
  - `concepts_helper.py` → agente "helper"
- No frontend, use o seletor (canto superior) para alternar; o cliente envia `agentId`.
- Na API, envie `agentId` no body:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Quero um plano", "sessionId":"abc", "agentId":"planner"}'
```

Para criar um novo agente, copie um arquivo existente em `src/backend/agents/`, ajuste `instructions`, e adicione um `if` no `get_agent_by_id` do `server.py`.


