// Global state
let sessionId = crypto.randomUUID();
let currentSection = 'chat';

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
  if (section === 'health') {
    checkHealth();
  }
}

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
    if (data.reply) addMessage(data.reply, 'bot');
    else addMessage('Erro: resposta vazia', 'bot');
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

// Agent testing
async function testAgent(agentId) {
  const testMessage = `Teste do agente ${agentId}: "Olá, como você pode me ajudar?"`;
  await sendMessage(testMessage);
}

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initial message
  addMessage('Olá! Eu sou seu Mentor Virtual. Como posso te ajudar hoje?\n\n- [Quero criar um plano de estudos]\n- [Preciso de ajuda com um conceito específico]\n- [Estou buscando novas habilidades para minha carreira]');
  
  // Check API status on load
  checkAPI();
  
  // Temperature slider
  const tempSlider = document.getElementById('config-temperature');
  const tempValue = document.getElementById('temp-value');
  if (tempSlider && tempValue) {
    tempSlider.addEventListener('input', (e) => {
      tempValue.textContent = e.target.value;
    });
  }
});

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


