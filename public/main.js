const XP_GOAL = 300;
let sessionId = crypto.randomUUID();
let currentSection = 'chat';
let currentAgent = 'tutor';
let cachedProgress = null;

const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const quickReplies = document.querySelector('.quick-replies');
const agentSelect = document.getElementById('agent');

// Navigation
function showSection(section) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  document.querySelectorAll('.content-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `${section}-section`);
  });

  currentSection = section;

  if (section === 'missions' || section === 'profile') {
    refreshProgress().catch(() => {});
  }

  if (section === 'admin') {
    checkHealth();
  }
}

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    const section = item.dataset.section;
    showSection(section);
  });
});

// Agent selection from cards
function setAgent(agentId) {
  currentAgent = agentId;
  if (agentSelect) {
    agentSelect.value = agentId;
  }
  addMessage(`Tutor alternado para **${agentLabel(agentId)}**. Vamos continuar?`, 'bot');
  refreshProgress().catch(() => {});
  showSection('chat');
}

document.querySelectorAll('[data-select-agent]').forEach((button) => {
  button.addEventListener('click', () => {
    const agentId = button.getAttribute('data-select-agent');
    setAgent(agentId);
  });
});

if (agentSelect) {
  currentAgent = agentSelect.value;
  agentSelect.addEventListener('change', (event) => {
    currentAgent = event.target.value;
    refreshProgress().catch(() => {});
  });
}

function agentLabel(agentId) {
  switch (agentId) {
    case 'planner':
      return 'Tutor Atendimento & Vendas';
    case 'helper':
      return 'Tutor Saúde Comunitária';
    default:
      return 'Tutor Tech Frontend';
  }
}

// Chat helpers
function renderText(text) {
  if (!text) return '';
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function addMessage(content, who = 'bot', meta = {}) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${who === 'me' ? 'me' : 'bot'}`;
  bubble.innerHTML = renderText(content);

  if (who === 'bot' && meta.sources && meta.sources.length) {
    const sourcesEl = document.createElement('div');
    sourcesEl.className = 'sources';
    sourcesEl.innerHTML = `<strong>Referências:</strong> ${meta.sources
      .map((src) => {
        const label = src.source || 'Acervo Manduvi';
        return `<span>${label}</span>`;
      })
      .join(' · ')}`;
    bubble.appendChild(sourcesEl);
  }

  if (who === 'bot' && typeof meta.xpAwarded === 'number') {
    const xpEl = document.createElement('div');
    xpEl.className = 'sources';
    const awarded = meta.xpAwarded;
    if (awarded > 0) {
      xpEl.innerHTML = `+${awarded} XP ganhos nesta interação.`;
    } else {
      xpEl.innerHTML = `Sem XP nesta interação. Que tal praticar para ganhar mais?`;
    }
    bubble.appendChild(xpEl);
  }

  if (who === 'bot' && meta.nextTask) {
    const nextEl = document.createElement('div');
    nextEl.className = 'sources';
    nextEl.innerHTML = `<strong>Próximo passo:</strong> ${meta.nextTask}`;
    bubble.appendChild(nextEl);
  }

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addTyping() {
  addMessage('Digitando...', 'bot');
}

function removeTyping() {
  if (messagesEl.lastChild) {
    messagesEl.removeChild(messagesEl.lastChild);
  }
}

async function sendMessage(text) {
  addMessage(text, 'me');
  addTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId,
        agentId: currentAgent,
      }),
    });

    const data = await res.json();
    removeTyping();

    if (!res.ok) {
      addMessage(`Erro: ${data.detail || res.status}`, 'bot');
      return;
    }

    addMessage(data.reply || 'Resposta vazia.', 'bot', {
      sources: data.sources || [],
      xpAwarded: data.xpAwarded,
      nextTask: data.nextTask,
    });

    if (data.progress) {
      updateProgressViews({
        xp: data.totalXp,
        goal: data.progress.goal,
        badges: data.badges || [],
        pathPosition: data.progress.pathPosition,
        gaps: data.progress.gaps,
        recentEvents: data.progress.recentEvents,
      });
    }
  } catch (error) {
    removeTyping();
    addMessage('Erro ao conectar com o servidor.', 'bot');
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(text);
});

quickReplies.addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  if (!btn) return;
  const text = btn.getAttribute('data-text') || btn.textContent;
  sendMessage(text);
});

document.getElementById('practice-btn').addEventListener('click', () => {
  sendMessage('Praticar agora');
});

document.getElementById('review-btn').addEventListener('click', () => {
  sendMessage('Quero revisar os pontos que errei.');
});

// Progress rendering
function updateProgressViews(progress) {
  if (!progress) return;
  cachedProgress = progress;

  const xp = progress.xp ?? 0;
  const goal = progress.goal ?? XP_GOAL;
  const path = progress.pathPosition || { level: 0, label: 'Diagnóstico', xpToNext: 50 };
  const badges = progress.badges || [];

  const fill = document.getElementById('xp-fill');
  if (fill) {
    const pct = Math.min(100, (xp / goal) * 100 || 0);
    fill.style.width = `${pct}%`;
  }

  const xpCurrent = document.getElementById('xp-current');
  const xpGoal = document.getElementById('xp-goal-top');
  const xpLevel = document.getElementById('xp-level');
  const xpLabel = document.getElementById('xp-label');
  if (xpCurrent) xpCurrent.textContent = xp;
  if (xpGoal) xpGoal.textContent = `${goal}`;
  if (xpLevel) xpLevel.textContent = path.level ?? 0;
  if (xpLabel) xpLabel.textContent = path.label ?? 'Diagnóstico';

  const sidebarXp = document.getElementById('sidebar-xp');
  if (sidebarXp) sidebarXp.textContent = xp;

  const badgeStrip = document.getElementById('badge-strip');
  if (badgeStrip) {
    badgeStrip.innerHTML = badges.length
      ? badges.map((badge) => `<span class="badge-pill">${badge}</span>`).join('')
      : '<span class="badge-pill">Sem badges ainda — pratique para ganhar!</span>';
  }

  if (currentSection === 'missions' || currentSection === 'profile') {
    renderMissions(progress);
    renderProfile(progress);
  }
}

function renderMissions(progress) {
  const missionList = document.getElementById('mission-list');
  const xpHistory = document.getElementById('xp-history');
  if (!missionList || !xpHistory) return;

  const missions = [];
  const path = progress.pathPosition || {};

  missions.push({
    title: 'Praticar com 3 questões rápidas',
    detail: `Ganhe +5 XP respondendo o próximo quiz (${path.label || 'Trilha'}).`,
  });

  if (progress.gaps && progress.gaps.length) {
    progress.gaps.slice(0, 3).forEach((gap) => {
      missions.push({
        title: `Reforçar: ${gap}`,
        detail: 'Peça ao tutor uma explicação resumida e um exercício dirigido.',
      });
    });
  } else {
    missions.push({
      title: 'Solicitar um mini-desafio aplicado',
      detail: 'Peça ao tutor um caso real para consolidar o aprendizado.',
    });
  }

  missionList.innerHTML = missions
    .map(
      (mission) => `
        <li class="mission-item">
          <strong>${mission.title}</strong>
          <span>${mission.detail}</span>
        </li>
      `,
    )
    .join('');

  const events = progress.recentEvents || [];
  xpHistory.innerHTML = events.length
    ? events
        .map((event) => {
          if (event.type === 'xp') {
            const xp = event.payload?.xp ?? 0;
            const reason = event.payload?.reason || 'Interação';
            return `<div class="xp-entry">+${xp} XP • ${reason} — ${new Date(event.timestamp).toLocaleString()}</div>`;
          }
          if (event.type === 'grade') {
            const score = event.payload?.score ?? '-';
            return `<div class="xp-entry" style="background: rgba(56, 189, 248, 0.18); border-color: rgba(56, 189, 248, 0.32);">Feedback avaliado • Nota ${score}</div>`;
          }
          return `<div class="xp-entry">${event.type}</div>`;
        })
        .join('')
    : '<p>Nenhum evento ainda. Faça uma prática para registrar progresso.</p>';
}

function renderProfile(progress) {
  const xp = progress.xp ?? 0;
  const path = progress.pathPosition || { level: 0, label: 'Diagnóstico', xpToNext: 50 };
  const badges = progress.badges || [];
  const gaps = progress.gaps || [];

  const profileXp = document.getElementById('profile-xp');
  const profileGoal = document.getElementById('profile-goal');
  const profileLevel = document.getElementById('profile-level');
  const profileLabel = document.getElementById('profile-label');
  const profileNext = document.getElementById('profile-next');

  if (profileXp) profileXp.textContent = xp;
  if (profileGoal) profileGoal.textContent = progress.goal ?? XP_GOAL;
  if (profileLevel) profileLevel.textContent = path.level ?? 0;
  if (profileLabel) profileLabel.textContent = path.label ?? 'Diagnóstico';
  if (profileNext) profileNext.textContent = path.xpToNext ?? Math.max(0, 50 - xp);

  const badgeList = document.getElementById('profile-badges');
  if (badgeList) {
    badgeList.innerHTML = badges.length
      ? badges
          .map(
            (badge) => `
            <li><span class="badge-icon">🏅</span><span>${badge}</span></li>
          `,
          )
          .join('')
      : '<li>Ainda sem badges — continue praticando!</li>';
  }

  const gapList = document.getElementById('profile-gaps');
  if (gapList) {
    gapList.innerHTML = gaps.length
      ? gaps.map((gap) => `<li>• ${gap}</li>`).join('')
      : '<li>Nenhuma lacuna registrada. Peça um novo desafio!</li>';
  }
}

async function refreshProgress() {
  try {
    const res = await fetch(`/api/progress?sessionId=${encodeURIComponent(sessionId)}&agentId=${encodeURIComponent(currentAgent)}`);
    if (!res.ok) return;
    const data = await res.json();
    updateProgressViews(data);
  } catch (error) {
    // ignore offline errors
  }
}

// API utilities (existing functionality)
async function checkAPI() {
  const statusEl = document.getElementById('api-status');
  if (statusEl) statusEl.textContent = 'Verificando...';

  try {
    const res = await fetch('/health');
    if (statusEl) statusEl.textContent = res.ok ? '✅ Conectado' : '❌ Erro';
  } catch (error) {
    if (statusEl) statusEl.textContent = '❌ Servidor offline';
  }
}

async function saveAPIKey() {
  const inputKey = document.getElementById('api-key-input');
  const persist = document.getElementById('persist-key').checked;
  const key = inputKey.value.trim();
  if (!key) {
    alert('Informe a chave OPENAI_API_KEY.');
    return;
  }

  try {
    const res = await fetch('/api/config/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key, persist }),
    });
    if (res.ok) {
      inputKey.value = '';
      await checkAPI();
      alert(persist ? 'Chave salva no processo e .env.' : 'Chave salva no processo.');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Falha ao salvar chave: ' + (err.detail || res.status));
    }
  } catch (error) {
    alert('Erro ao conectar ao backend.');
  }
}

async function runIngest() {
  alert('Use `python src/backend/rag/ingest.py` para reindexar o acervo. Endpoint remoto opcional.');
}

async function searchRAG() {
  const query = document.getElementById('rag-query').value.trim();
  if (!query) return;
  const resultsEl = document.getElementById('rag-results');
  resultsEl.innerHTML = '<p>Buscando...</p>';
  try {
    const res = await fetch(`/api/debug/retriever?q=${encodeURIComponent(query)}&k=6`);
    const data = await res.json();
    if (data.hits && data.hits.length) {
      resultsEl.innerHTML = data.hits
        .map(
          (hit) => `
            <div class="rag-result-item">
              <div><strong>${hit.source || 'Documento'}</strong></div>
              <div style="font-size:12px; color:#94a3b8;">Score: ${hit.score?.toFixed ? hit.score.toFixed(4) : hit.score}</div>
              <div style="margin-top:6px;">${hit.snippet}</div>
            </div>
          `,
        )
        .join('');
    } else {
      resultsEl.innerHTML = '<p>Nenhum resultado encontrado. Reindexe o acervo.</p>';
    }
  } catch (error) {
    resultsEl.innerHTML = '<p>Erro ao buscar no acervo.</p>';
  }
}

async function loadAgentConfig() {
  const agentId = document.getElementById('config-agent-select').value;
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) throw new Error('Falha ao carregar agentes');
    const data = await res.json();
    const config = data.agents[agentId];
    if (!config) {
      alert('Configuração não encontrada para este agente.');
      return;
    }
    document.getElementById('config-name').value = config.name || '';
    document.getElementById('config-model').value = config.model || 'gpt-4o-mini';
    document.getElementById('config-temperature').value = config.temperature || 0.7;
    document.getElementById('temp-value').textContent = config.temperature || 0.7;
    document.getElementById('config-max-tokens').value = config.max_tokens || 2000;
    document.getElementById('config-embed-model').value = config.embed_model || 'text-embedding-3-large';
    document.getElementById('config-rag-k').value = config.rag_k || 6;
    document.getElementById('config-chunk-size').value = config.rag_chunk_size || 800;
    document.getElementById('config-overlap').value = config.rag_overlap || 150;
    document.getElementById('config-tools-enabled').checked = config.tools_enabled || false;
    document.getElementById('config-system-prompt').value = config.system_prompt || '';
  } catch (error) {
    alert('Erro ao carregar configuração: ' + error.message);
  }
}

async function saveAgentConfig() {
  const agentId = document.getElementById('config-agent-select').value;
  const payload = {
    agent_id: agentId,
    name: document.getElementById('config-name').value,
    model: document.getElementById('config-model').value,
    temperature: parseFloat(document.getElementById('config-temperature').value),
    max_tokens: parseInt(document.getElementById('config-max-tokens').value, 10),
    embed_model: document.getElementById('config-embed-model').value,
    rag_k: parseInt(document.getElementById('config-rag-k').value, 10),
    rag_chunk_size: parseInt(document.getElementById('config-chunk-size').value, 10),
    rag_overlap: parseInt(document.getElementById('config-overlap').value, 10),
    tools_enabled: document.getElementById('config-tools-enabled').checked,
    system_prompt: document.getElementById('config-system-prompt').value,
  };

  try {
    const res = await fetch('/api/agents/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Configuração atualizada.');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Falha ao salvar: ' + (err.detail || res.status));
    }
  } catch (error) {
    alert('Erro ao salvar configuração: ' + error.message);
  }
}

function resetAgentConfig() {
  document.getElementById('config-name').value = '';
  document.getElementById('config-model').value = 'gpt-4o-mini';
  document.getElementById('config-temperature').value = 0.7;
  document.getElementById('temp-value').textContent = '0.7';
  document.getElementById('config-max-tokens').value = 2000;
  document.getElementById('config-embed-model').value = 'text-embedding-3-large';
  document.getElementById('config-rag-k').value = 6;
  document.getElementById('config-chunk-size').value = 800;
  document.getElementById('config-overlap').value = 150;
  document.getElementById('config-tools-enabled').checked = true;
  document.getElementById('config-system-prompt').value = '';
}

async function checkHealth() {
  try {
    const res = await fetch('/health');
    document.getElementById('server-status').textContent = res.ok ? '✅ Online' : '❌ Erro';
  } catch (error) {
    document.getElementById('server-status').textContent = '❌ Offline';
  }

  try {
    const res = await fetch('/api/debug/retriever?q=test&k=1');
    document.getElementById('embed-status').textContent = res.ok ? '✅ Funcionando' : '❌ Erro';
  } catch (error) {
    document.getElementById('embed-status').textContent = '❌ Erro';
  }

  try {
    const res = await fetch('/api/debug/retriever?q=test&k=1');
    const data = await res.json();
    document.getElementById('rag-status').textContent = data.hits ? '✅ Indexado' : '⚠️ Vazio';
  } catch (error) {
    document.getElementById('rag-status').textContent = '❌ Erro';
  }
}

// Initial state
addMessage(
  'Olá! Eu sou seu Mentor Manduvi. Vamos começar com um diagnóstico rápido ou prefere escolher um módulo para estudar? Clique em "Praticar agora" para ganhar seus primeiros 5 XP.',
  'bot',
);

refreshProgress().catch(() => {});
checkAPI();