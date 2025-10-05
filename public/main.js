// Global state
let sessionId = crypto.randomUUID();
let currentSection = 'chat';
let currentXP = 0;
let currentLevel = 0;

// XP System
const XP_LEVELS = [
  { level: 0, label: 'Diagnóstico', xp: 0 },
  { level: 1, label: 'Iniciante', xp: 50 },
  { level: 2, label: 'Aprendiz', xp: 100 },
  { level: 3, label: 'Intermediário', xp: 150 },
  { level: 4, label: 'Avançado', xp: 200 },
  { level: 5, label: 'Especialista', xp: 250 },
  { level: 6, label: 'Mestre', xp: 300 }
];

// DOM elements
const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const quickReplies = document.querySelector('.quick-replies');
const agentSelect = document.getElementById('agent');

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    showSection(section);
  });
});

function showSection(section) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-section="${section}"]`).classList.add('active');
  
  // Update content
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(`${section}-section`).classList.add('active');
  
  currentSection = section;
  
  // Load section-specific data
  if (section === 'admin') {
    checkHealth();
  } else if (section === 'missions') {
    loadMissions();
  } else if (section === 'profile') {
    loadProfile();
  }
}

// XP System Functions
function updateXP(points) {
  currentXP += points;
  updateXPDisplay();
  checkLevelUp();
}

function updateXPDisplay() {
  const level = getCurrentLevel();
  const progress = (currentXP / 300) * 100;
  
  // Update sidebar
  document.getElementById('sidebar-xp').textContent = currentXP;
  
  // Update chat header
  document.getElementById('xp-current').textContent = currentXP;
  document.getElementById('xp-level').textContent = level.level;
  document.getElementById('xp-label').textContent = level.label;
  document.getElementById('xp-fill').style.width = `${progress}%`;
  
  // Update profile
  document.getElementById('profile-xp').textContent = currentXP;
  document.getElementById('profile-level').textContent = level.level;
  document.getElementById('profile-label').textContent = level.label;
  
  const nextLevel = XP_LEVELS.find(l => l.level === level.level + 1);
  if (nextLevel) {
    document.getElementById('profile-next').textContent = nextLevel.xp - currentXP;
  }
}

function getCurrentLevel() {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (currentXP >= XP_LEVELS[i].xp) {
      return XP_LEVELS[i];
    }
  }
  return XP_LEVELS[0];
}

function checkLevelUp() {
  const currentLevel = getCurrentLevel();
  if (currentLevel.level > this.currentLevel) {
    this.currentLevel = currentLevel.level;
    showLevelUpNotification(currentLevel);
  }
}

function showLevelUpNotification(level) {
  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <h3>🎉 Level Up!</h3>
      <p>Você alcançou o nível ${level.level}: ${level.label}</p>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Tutor Selection
document.querySelectorAll('[data-select-agent]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const agentId = e.target.getAttribute('data-select-agent');
    agentSelect.value = agentId;
    showSection('chat');
    addMessage(`Tutor ${agentId} selecionado! Como posso te ajudar?`);
  });
});

// Chat functions
function addMessage(text, who = 'bot') {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${who === 'me' ? 'me' : 'bot'}`;
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage(text) {
  addMessage(text, 'me');
  addMessage('Digitando...', 'bot');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId, agentId: agentSelect.value })
    });
    const data = await res.json();

    messagesEl.lastChild.remove(); // remove "Digitando..."
    if (data.reply) {
      addMessage(data.reply, 'bot');
      // Award XP for interaction
      updateXP(5);
    } else {
      addMessage('Erro: resposta vazia', 'bot');
    }
  } catch (e) {
    messagesEl.lastChild.remove();
    addMessage('Erro ao conectar com o servidor.', 'bot');
  }
}

// Event listeners
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendMessage(text);
});

quickReplies.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const t = btn.getAttribute('data-text') || btn.textContent;
  sendMessage(t);
});

// Practice and Review buttons
document.getElementById('practice-btn')?.addEventListener('click', () => {
  sendMessage('Quero praticar agora! Me dê um exercício.');
});

document.getElementById('review-btn')?.addEventListener('click', () => {
  sendMessage('Quero revisar o que aprendi. Me faça perguntas sobre os tópicos estudados.');
});

// RAG search
async function searchRAG() {
  const query = document.getElementById('rag-query').value.trim();
  if (!query) return;
  
  const resultsEl = document.getElementById('rag-results');
  resultsEl.innerHTML = '<p>Buscando...</p>';
  
  try {
    const res = await fetch(`/api/debug/retriever?q=${encodeURIComponent(query)}&k=5`);
    const data = await res.json();
    
    if (data.hits && data.hits.length > 0) {
      resultsEl.innerHTML = data.hits.map(hit => `
        <div class="rag-result-item">
          <div class="rag-result-source">${hit.source}</div>
          <div class="rag-result-score">Score: ${hit.score.toFixed(4)}</div>
          <div class="rag-result-snippet">${hit.snippet}</div>
        </div>
      `).join('');
    } else {
      resultsEl.innerHTML = '<p>Nenhum resultado encontrado. Verifique se a ingestão foi executada.</p>';
    }
  } catch (e) {
    resultsEl.innerHTML = '<p>Erro ao buscar no acervo.</p>';
  }
}

// Configuration functions
async function checkAPI() {
  const statusEl = document.getElementById('api-status');
  statusEl.textContent = 'Verificando...';
  
  try {
    const res = await fetch('/health');
    if (res.ok) {
      statusEl.textContent = '✅ Conectado';
    } else {
      statusEl.textContent = '❌ Erro de conexão';
    }
  } catch (e) {
    statusEl.textContent = '❌ Servidor offline';
  }
}

async function runIngest() {
  // This would need a backend endpoint to trigger ingest
  alert('Funcionalidade de ingestão via UI será implementada em breve. Use: python src/backend/rag/ingest.py');
}

// Health check
async function checkHealth() {
  // Server status
  try {
    const res = await fetch('/health');
    const serverStatus = res.ok ? '✅ Online' : '❌ Erro';
    document.getElementById('server-status').textContent = serverStatus;
  } catch (e) {
    document.getElementById('server-status').textContent = '❌ Offline';
  }
  
  // Embeddings status (simplified check)
  try {
    const res = await fetch('/api/debug/retriever?q=test&k=1');
    const embedStatus = res.ok ? '✅ Funcionando' : '❌ Erro';
    document.getElementById('embed-status').textContent = embedStatus;
  } catch (e) {
    document.getElementById('embed-status').textContent = '❌ Erro';
  }
  
  // RAG status
  try {
    const res = await fetch('/api/debug/retriever?q=test&k=1');
    const data = await res.json();
    const ragStatus = data.hits ? '✅ Indexado' : '⚠️ Vazio';
    document.getElementById('rag-status').textContent = ragStatus;
  } catch (e) {
    document.getElementById('rag-status').textContent = '❌ Erro';
  }
}

// Missions and Profile functions
function loadMissions() {
  const missionList = document.getElementById('mission-list');
  const xpHistory = document.getElementById('xp-history');
  
  // Mock missions
  const missions = [
    { title: 'Complete seu diagnóstico inicial', xp: 10, completed: false },
    { title: 'Estude 3 tópicos diferentes', xp: 15, completed: false },
    { title: 'Pratique com 5 exercícios', xp: 20, completed: false },
    { title: 'Alcance 100 XP', xp: 25, completed: currentXP >= 100 }
  ];
  
  missionList.innerHTML = missions.map(mission => `
    <li class="${mission.completed ? 'completed' : ''}">
      <strong>${mission.title}</strong>
      <span class="xp-reward">+${mission.xp} XP</span>
    </li>
  `).join('');
  
  // Mock XP history
  const history = [
    { date: 'Hoje', action: 'Interação com tutor', xp: 5 },
    { date: 'Ontem', action: 'Exercício completado', xp: 10 },
    { date: '2 dias atrás', action: 'Diagnóstico inicial', xp: 15 }
  ];
  
  xpHistory.innerHTML = history.map(entry => `
    <li>
      <span class="date">${entry.date}</span>
      <span class="action">${entry.action}</span>
      <span class="xp">+${entry.xp} XP</span>
    </li>
  `).join('');
}

function loadProfile() {
  const badges = document.getElementById('profile-badges');
  const gaps = document.getElementById('profile-gaps');
  
  // Mock badges
  const userBadges = [
    { name: 'Primeiro Passo', icon: '🎯', earned: true },
    { name: 'Curioso', icon: '🤔', earned: true },
    { name: 'Persistente', icon: '💪', earned: currentXP >= 50 },
    { name: 'Especialista', icon: '🏆', earned: currentXP >= 200 }
  ];
  
  badges.innerHTML = userBadges.map(badge => `
    <li class="${badge.earned ? 'earned' : 'locked'}">
      ${badge.icon} ${badge.name}
    </li>
  `).join('');
  
  // Mock gaps
  const detectedGaps = [
    'Fundamentos de HTML semântico',
    'Responsividade em CSS',
    'JavaScript ES6+',
    'Testes automatizados'
  ];
  
  gaps.innerHTML = detectedGaps.map(gap => `
    <li>${gap}</li>
  `).join('');
}

// Save API key from UI
async function saveAPIKey() {
  const input = document.getElementById('api-key-input');
  const persist = document.getElementById('persist-key').checked;
  const key = input.value.trim();
  if (!key) {
    alert('Cole sua OPENAI_API_KEY.');
    return;
  }
  try {
    const res = await fetch('/api/config/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key, persist })
    });
    if (res.ok) {
      input.value = '';
      await checkAPI();
      alert(persist ? 'Chave salva no processo e no .env.' : 'Chave salva no processo.');
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Falha ao salvar chave: ' + (err.detail || res.status));
    }
  } catch (e) {
    alert('Erro de conexão ao salvar chave.');
  }
}

// Agent Configuration Functions
let currentAgentConfig = null;

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
    
    // Preencher formulário
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
    
    currentAgentConfig = config;
    
  } catch (e) {
    alert('Erro ao carregar configuração: ' + e.message);
  }
}

async function saveAgentConfig() {
  const agentId = document.getElementById('config-agent-select').value;
  
  const config = {
    agent_id: agentId,
    name: document.getElementById('config-name').value,
    model: document.getElementById('config-model').value,
    temperature: parseFloat(document.getElementById('config-temperature').value),
    max_tokens: parseInt(document.getElementById('config-max-tokens').value),
    embed_model: document.getElementById('config-embed-model').value,
    rag_k: parseInt(document.getElementById('config-rag-k').value),
    rag_chunk_size: parseInt(document.getElementById('config-chunk-size').value),
    rag_overlap: parseInt(document.getElementById('config-overlap').value),
    tools_enabled: document.getElementById('config-tools-enabled').checked,
    system_prompt: document.getElementById('config-system-prompt').value,
  };
  
  try {
    const res = await fetch('/api/agents/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    if (res.ok) {
      alert('Configuração salva com sucesso!');
      currentAgentConfig = config;
    } else {
      const err = await res.json().catch(() => ({}));
      alert('Falha ao salvar: ' + (err.detail || res.status));
    }
  } catch (e) {
    alert('Erro ao salvar configuração: ' + e.message);
  }
}

function resetAgentConfig() {
  if (currentAgentConfig) {
    loadAgentConfig();
  } else {
    // Reset para valores padrão
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initial message
  addMessage('Olá! Eu sou seu Mentor Virtual Manduvi. Vamos começar sua jornada de aprendizado!\n\n🎯 Escolha uma opção:\n- [Quero meu diagnóstico inicial]\n- [Me ensine um tópico com exemplo]\n- [Praticar agora]');
  
  // Check API status on load
  checkAPI();
  
  // Initialize XP display
  updateXPDisplay();
  
  // Temperature slider
  const tempSlider = document.getElementById('config-temperature');
  const tempValue = document.getElementById('temp-value');
  if (tempSlider && tempValue) {
    tempSlider.addEventListener('input', (e) => {
      tempValue.textContent = e.target.value;
    });
  }
});

// Add CSS for level up notification
const style = document.createElement('style');
style.textContent = `
  .level-up-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  }
  
  .notification-content h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
  }
  
  .notification-content p {
    margin: 0;
    font-size: 14px;
    opacity: 0.9;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .mission-list li.completed {
    opacity: 0.6;
    text-decoration: line-through;
  }
  
  .xp-reward {
    color: #22c55e;
    font-weight: 600;
    float: right;
  }
  
  .badge-list li.earned {
    background: #22c55e;
    color: white;
  }
  
  .badge-list li.locked {
    background: #374151;
    color: #9ca3af;
  }
`;
document.head.appendChild(style);