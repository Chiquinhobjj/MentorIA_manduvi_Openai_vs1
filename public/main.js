const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const quickReplies = document.querySelector('.quick-replies');
const agentSelect = document.getElementById('agent');

let sessionId = crypto.randomUUID();

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

// Mensagem inicial de onboarding no frontend
addMessage('Olá! Eu sou seu Mentor Virtual. Como posso te ajudar hoje?\n\n- [Quero criar um plano de estudos]\n- [Preciso de ajuda com um conceito específico]\n- [Estou buscando novas habilidades para minha carreira]');


