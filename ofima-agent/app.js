/* ──────────────────────────────────────────
   app.js  –  Asistente Operaciones Ofima
   ────────────────────────────────────────── */

const SYSTEM = `Eres un asistente de IA especializado para una Coordinadora de Operaciones que trabaja en Ofima, empresa colombiana de software ERP líder (contabilidad, nómina, inventarios y manufactura para medianas empresas).

Tu rol es ayudarla con:
- Redacción de informes, correos y comunicaciones internas/externas en español formal
- Organización de prioridades, agendas y tareas del equipo
- Preparación de presentaciones y reportes de KPIs / indicadores operativos
- Estructuración de procesos, checklists y protocolos de operación
- Estrategias de coordinación entre áreas (comercial, contable, nómina, soporte, FDS)
- Respuestas y seguimiento a clientes empresariales
- Apoyo en documentación de procesos ERP

Habla siempre en español colombiano, tono profesional pero cercano. Sé conciso, práctico y orientado a resultados. Cuando generes documentos, usa estructura clara con secciones. Cuando des consejos, sé específico al contexto de una empresa de software B2B en Colombia.`;

// ── State ──
let chatHistory = [];
let tasks = [];
let actaText = '';
let currentFilter = 'all';

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
  addBotMessage('¡Hola! Soy tu asistente de operaciones para Ofima. Puedo ayudarte con informes, correos, actas, priorización de tareas y mucho más. ¿En qué empezamos hoy? 👆');
  renderTasks();

  // Auto-resize textarea
  const ta = document.getElementById('chat-input');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

  // Add tasks textarea enter
  document.getElementById('new-task-txt').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
});

// ── Tab switching ──
function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  const labels = { chat: 'Chat', acta: 'Generar Acta', tasks: 'Seguimiento' };
  document.getElementById('mobile-tab-indicator').textContent = labels[tab] || '';
  closeSidebar();
}

// ── Sidebar mobile ──
let overlay;
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('open');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('open', sb.classList.contains('open'));
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ── CHAT ──
function addBotMessage(text) {
  const el = document.createElement('div');
  el.className = 'msg bot';
  el.innerHTML = `
    <div class="msg-av bot-av">⚙️</div>
    <div class="bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>`;
  document.getElementById('messages').appendChild(el);
  scrollChat();
  return el;
}

function addUserMessage(text) {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.innerHTML = `<div class="msg-av user-av">👩</div><div class="bubble">${text.replace(/</g,'&lt;')}</div>`;
  document.getElementById('messages').appendChild(el);
  scrollChat();
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'msg bot'; el.id = 'typing';
  el.innerHTML = `<div class="msg-av bot-av">⚙️</div><div class="bubble"><div class="dots"><span></span><span></span><span></span></div></div>`;
  document.getElementById('messages').appendChild(el);
  scrollChat();
}
function removeTyping() { const t = document.getElementById('typing'); if(t) t.remove(); }
function scrollChat() { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = ''; input.style.height = 'auto';
  addUserMessage(text);
  chatHistory.push({ role: 'user', content: text });
  showTyping();

  const btn = document.getElementById('send-btn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, system: SYSTEM })
    });
    const data = await res.json();
    const reply = data.reply || 'Lo siento, hubo un error. Intenta de nuevo.';
    removeTyping();
    addBotMessage(reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch {
    removeTyping();
    addBotMessage('Hubo un error de conexión. Por favor intenta de nuevo.');
  }

  btn.disabled = false;
  input.focus();
}

function quickChat(text) {
  switchTab('chat');
  document.getElementById('chat-input').value = text;
  sendChat();
}

// ── ACTA ──
async function generateActa() {
  const fecha    = document.getElementById('f-fecha').value;
  const horaI    = document.getElementById('f-hora-i').value.trim();
  const horaF    = document.getElementById('f-hora-f').value.trim();
  const area     = document.getElementById('f-area').value.trim();
  const asist    = document.getElementById('f-asistentes').value.trim();
  const temas    = document.getElementById('f-temas').value.trim();
  const desa     = document.getElementById('f-desarrollo').value.trim();

  if (!desa) { showActaStatus('Por favor ingresa el contenido de la reunión.', 'error'); return; }

  document.getElementById('btn-gen-acta').disabled = true;
  document.getElementById('acta-loading').style.display = 'flex';
  document.getElementById('acta-preview').style.display = 'none';
  document.getElementById('acta-status').innerHTML = '';

  const fechaFmt = fecha
    ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', {day:'numeric', month:'long', year:'numeric'})
    : '';

  const prompt = `Eres experta en redacción de actas corporativas para Ofima, empresa colombiana de ERP.

Datos:
- Fecha: ${fechaFmt}
- Horario: ${[horaI,horaF].filter(Boolean).join(' // ')}
- Área: ${area}
- Asistentes: ${asist}
- Temas: ${temas}
- Contenido:
${desa}

Instrucciones:
1. Redacta el acta completa con este formato EXACTO:

ACTA DE REUNIÓN
[Fecha] – [Horario]
ÁREA & UNIDAD: [Área]
ASISTENTES:
- [nombre]
Temas:
- [tema]
Desarrollo:
[organizado por temas numerados con subtítulos en mayúscula y negrilla]
Tareas y/o pendientes:
[agrupados por responsable en negrilla]
Conclusiones:
- [punto clave]

2. Al final añade esta sección especial:
---PENDIENTES_JSON---
[{"tarea":"descripción","responsable":"nombre"}]
---FIN_JSON---

Responde SOLO con el acta y el JSON. Sin texto adicional.`;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], system: SYSTEM })
    });
    const data = await res.json();
    const full = data.reply || '';

    const jsonMatch = full.match(/---PENDIENTES_JSON---([\s\S]*?)---FIN_JSON---/);
    actaText = full.replace(/---PENDIENTES_JSON---[\s\S]*?---FIN_JSON---/, '').trim();

    document.getElementById('acta-content').textContent = actaText;
    document.getElementById('acta-preview').style.display = 'block';

    let extracted = 0;
    if (jsonMatch) {
      try {
        const raw = jsonMatch[1].trim().replace(/```json|```/g, '');
        const newTasks = JSON.parse(raw);
        newTasks.forEach(t => tasks.push({ id: Date.now() + Math.random(), tarea: t.tarea, responsable: t.responsable || '', done: false }));
        renderTasks(); updateBadge();
        extracted = newTasks.length;
      } catch {}
    }

    showActaStatus(`✓ Acta generada${extracted ? ` y ${extracted} pendientes extraídos automáticamente.` : '.'}`, 'success');
  } catch {
    showActaStatus('Error al conectar con la IA. Intenta de nuevo.', 'error');
  }

  document.getElementById('btn-gen-acta').disabled = false;
  document.getElementById('acta-loading').style.display = 'none';
}

function showActaStatus(msg, type) {
  const el = document.getElementById('acta-status');
  el.textContent = msg;
  el.className = type === 'success' ? 'st-success' : 'st-error';
}

function clearActaForm() {
  ['f-area','f-asistentes','f-temas','f-desarrollo','f-hora-i','f-hora-f'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('acta-preview').style.display = 'none';
  document.getElementById('acta-status').innerHTML = '';
}

function downloadActa() {
  if (!actaText) return;
  const blob = new Blob([actaText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'Acta_Reunion.txt'; a.click();
  URL.revokeObjectURL(url);
}

// ── TASKS ──
function addTask() {
  const txt = document.getElementById('new-task-txt').value.trim();
  if (!txt) return;
  tasks.push({ id: Date.now(), tarea: txt, responsable: document.getElementById('new-task-resp').value.trim(), done: false });
  document.getElementById('new-task-txt').value = '';
  document.getElementById('new-task-resp').value = '';
  renderTasks(); updateBadge();
}

function toggleTask(id) {
  const t = tasks.find(t => String(t.id) === String(id));
  if (t) { t.done = !t.done; renderTasks(); updateBadge(); }
}

function deleteTask(id) {
  tasks = tasks.filter(t => String(t.id) !== String(id));
  renderTasks(); updateBadge();
}

function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const filtered = tasks.filter(t => {
    if (currentFilter === 'pending') return !t.done;
    if (currentFilter === 'done')    return t.done;
    return true;
  });

  document.getElementById('st-total').textContent = tasks.length;
  document.getElementById('st-pend').textContent  = tasks.filter(t => !t.done).length;
  document.getElementById('st-done').textContent  = tasks.filter(t => t.done).length;

  if (!tasks.length) {
    list.innerHTML = `<div class="empty-state"><span class="big">📋</span>Genera un acta para extraer pendientes automáticamente, o agrégalos manualmente arriba.</div>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">No hay tareas en esta categoría.</div>`;
    return;
  }

  list.innerHTML = '';
  filtered.forEach(t => {
    const card = document.createElement('div');
    card.className = 'task-card' + (t.done ? ' done' : '');
    card.innerHTML = `
      <div class="check ${t.done?'on':''}" onclick="toggleTask('${t.id}')">${t.done?'✓':''}</div>
      <div class="task-info">
        <div class="task-text">${t.tarea}</div>
        <div class="task-meta">
          ${t.responsable ? `<span class="pill">👤 ${t.responsable}</span>` : ''}
          <span class="pill ${t.done?'done-pill':'pend-pill'}">${t.done?'✓ Completado':'⏳ Pendiente'}</span>
        </div>
      </div>
      <button class="del-task" onclick="deleteTask('${t.id}')" title="Eliminar">×</button>`;
    list.appendChild(card);
  });
}

function updateBadge() {
  const n = tasks.filter(t => !t.done).length;
  const badge = document.getElementById('badge-tasks');
  if (n > 0) { badge.textContent = n; badge.classList.add('visible'); }
  else { badge.classList.remove('visible'); }
}
