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

### Loop pedagógico Manduvi

O MVP "Mentores Manduvi" implementa o ciclo Diagnosticar → Ensinar → Testar → Feedback → Reforço → XP com memória de sessão e RAG.

#### Endpoints principais

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/chat` | Orquestra a conversa com o tutor-persona. Retorna resposta, fontes (RAG), XP ganho e sugestão de próximo passo. |
| `POST` | `/api/grade` | Envia respostas de exercícios para correção automática (avaliador dedicado). Retorna nota, feedback, XP e tarefa de reforço. |
| `GET` | `/api/progress` | Consulta XP acumulado, badges, nível atual, lacunas detectadas e eventos recentes. |

Payload mínimo de `/api/chat`:

```json
{
  "message": "Praticar agora",
  "sessionId": "aluno-1",
  "agentId": "tutor"
}
```

Resposta exemplo:

```json
{
  "reply": "...",
  "sources": [{"source": "aula_frontend.pdf", "snippet": "..."}],
  "xpAwarded": 5,
  "nextTask": "Clique em 'Praticar agora' para o próximo desafio",
  "progress": {
    "goal": 300,
    "pathPosition": {"level": 1, "label": "Fundamentos", "xpToNext": 45},
    "gaps": ["Semântica HTML"],
    "recentEvents": [...]
  }
}
```

Para `/api/grade`, envie:

```json
{
  "answer": "Minha resposta...",
  "question": "Explique o que é CSS flexbox",
  "sessionId": "aluno-1",
  "agentId": "tutor"
}
```

O avaliador retorna JSON com `score`, `feedback`, `xpAwarded`, `remedialTask` e atualiza o progresso.

### API com FastAPI/Uvicorn (opcional)

```bash
source .venv/bin/activate
export OPENAI_API_KEY="sk-..."
uvicorn src.backend.server_fastapi:app --host 127.0.0.1 --port 8000 --reload
```

A UI está montada em `/` e a API em `POST /api/chat` (campos: `message`, `sessionId`, `agentId`).

## MentorIA – Tutor com RAG (Embeddings + FAISS)

### 1) Pré-requisitos

- Python 3.10+
- Virtualenv ativo
- Variável `OPENAI_API_KEY`

### 2) Instalar dependências

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3) Preparar conteúdo

Coloque seus PDFs/MD/TXT em:

```
src/backend/rag/data/
```

### 4) Ingestão (gera embeddings e índice FAISS)

```bash
source .venv/bin/activate
export OPENAI_API_KEY="sua_chave"
python src/backend/rag/ingest.py
```

Saída esperada:
`OK! Índice salvo em .../src/backend/rag/index/ (faiss.index + meta.json)`

### 5) Subir a API (FastAPI/Uvicorn)

```bash
uvicorn src.backend.server_fastapi:app --host 127.0.0.1 --port 8000 --reload
```

- UI estática: http://127.0.0.1:8000
- API principal: `POST http://127.0.0.1:8000/api/chat`
- Correção automática: `POST http://127.0.0.1:8000/api/grade`
- Dashboard de XP: `GET http://127.0.0.1:8000/api/progress?sessionId=...&agentId=...`

### 6) Testar (Tutor com RAG)

```bash
curl -s -X POST http://127.0.0.1:8000/api/chat \
  -H 'Content-Type': 'application/json' \
  -d '{"message":"Explique frações para 5º ano e proponha 2 exercícios","sessionId":"aluno-1","agentId":"tutor"}' | jq
```

Se a resposta usar trechos do acervo, o agente deve citar as fontes (ex.: `(Fonte: meu_arquivo.pdf)`).

### Snippet Frontend (fetch)

```ts
export async function askTutor(message: string, sessionId = "aluno-1") {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ message, sessionId, agentId: "tutor" }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.reply as string;
}
```

### Checklist rápido

- [ ] `requirements.txt` instalado no mesmo venv
- [ ] PDFs/MD/TXT em `src/backend/rag/data/`
- [ ] `python src/backend/rag/ingest.py` rodado sem erros
- [ ] `uvicorn src.backend.server_fastapi:app --reload` no ar
- [ ] `POST /api/chat` com `agentId="tutor"` responde e cita `(Fonte: …)`

### Como atualizar o código no GitHub

1. **Clonar e criar branch**
   ```bash
   git clone git@github.com:<seu-usuario>/<seu-fork>.git
   cd <seu-fork>
   git checkout -b feat/minha-atualizacao
   ```
2. **Editar os arquivos localmente** (VS Code, vim etc.) ou, se preferir, use o editor web do GitHub (`.` no repositório ou "Edit this file").
3. **Testar e validar** no seu ambiente (`pytest`, `uvicorn`, ingestão etc.).
4. **Commitar e enviar**
   ```bash
   git status            # conferir mudanças
   git add .             # selecionar arquivos (ou git add <arquivo>)
   git commit -m "feat: descreva sua mudança"
   git push origin feat/minha-atualizacao
   ```
5. **Abrir Pull Request** no GitHub comparando sua branch com `main`.

> Dica: se precisar aplicar apenas um ajuste rápido, o botão **Edit** no GitHub permite alterar o arquivo, adicionar uma mensagem de commit e criar PR direto no navegador.

### Troubleshooting

1) `FileNotFoundError: .../rag/index/faiss.index`
   - Rode a ingestão primeiro e confirme que há arquivos em `src/backend/rag/data/`.

2) `OPENAI_API_KEY não definido` / `BadRequestError`
   - Garanta `export OPENAI_API_KEY="..."` no mesmo terminal/venv.
   - Teste rápido:

```python
from openai import OpenAI
print(len(OpenAI().embeddings.create(model="text-embedding-3-large", input=["ok"]).data[0].embedding))
# deve imprimir 3072
```

3) `ModuleNotFoundError: faiss`
   - Use `faiss-cpu` (já está no requirements). Se necessário: `pip install --upgrade pip setuptools wheel`.

4) Resposta sem citações
   - Pode ser pergunta opinativa. Para perguntas factuais, o prompt do tutor já orienta a chamar `retriever`. Você pode reforçar no `server_fastapi.py` a instrução “se precisar de evidência, chame `retriever`”.

5) Trocar fonte dos dados
   - Adicione/edite PDFs/MD/TXT em `src/backend/rag/data/` e rode a ingestão novamente.

### Estrutura relevante

```
src/backend/
  agents/
    tutor_agent.py        # Agent (usa a tool retriever)
  rag/
    data/                 # seus PDFs/MD/TXT
    ingest.py             # gera embeddings + índice
    retriever.py          # busca FAISS + embeddings de query
    index/
      faiss.index
      meta.json
server_fastapi.py         # endpoint /api/chat (agentId: tutor/planner/helper)
```


