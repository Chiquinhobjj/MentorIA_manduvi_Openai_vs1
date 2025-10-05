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
});


