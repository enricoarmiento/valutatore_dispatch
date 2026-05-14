/* ============================================================
   Valutatore Dispatch — App Logic
   Stores evaluations in localStorage, exports as JSON
   ============================================================ */

const APP_KEY = 'scare_dispatch_evaluations';

// ---- State ----
let state = {
  user: '',
  currentIndex: 0,
  pairs: [],
  votes: {} // { pairId: { vote: 'A'|'B'|'equal', feedback: '' } }
};

// ---- DOM refs ----
const $ = id => document.getElementById(id);
const screens = {
  login: $('screen-login'),
  eval: $('screen-eval'),
  results: $('screen-results'),
};

// ---- Simple Markdown → HTML ----
function mdToHtml(md) {
  if (!md) return '<p><em>Nessun contenuto disponibile</em></p>';
  
  let html = md
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers (keep h4+ visible)
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Tables
    .replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (_, header, sep, body) => {
      const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(row => {
        const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    // INCONGRUENZA tags → styled
    .replace(/\[INCONGRUENZA:\s*(.*?)\s*(?:—\s*Richiede verifica\.)?\s*\]/g,
      '<span class="incongruenza">⚠ INCONGRUENZA: $1</span>')
    // Line breaks → paragraphs
    .split('\n\n').map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<h') || block.startsWith('<table') || block.startsWith('<hr')) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');
  
  return html;
}

// ---- Load dispatch data ----
async function loadDispatches() {
  try {
    const resp = await fetch('data/dispatches.json');
    if (!resp.ok) throw new Error('File non trovato');
    const data = await resp.json();
    state.pairs = data.pairs || [];
  } catch (e) {
    console.error('Errore caricamento dispatch:', e);
    state.pairs = [];
  }
}

// ---- Screen management ----
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---- Render current pair ----
function renderPair() {
  const pair = state.pairs[state.currentIndex];
  if (!pair) return;

  // Update header
  $('progress-text').textContent = `${state.currentIndex + 1} / ${state.pairs.length}`;
  const pct = ((state.currentIndex) / state.pairs.length) * 100;
  $('progress-bar').style.width = `${pct}%`;

  // Patient info
  $('patient-id').textContent = pair.id;
  $('patient-info').textContent = pair.patient_info || '';

  // Render dispatch content
  $('content-a').innerHTML = mdToHtml(pair.version_a.content);
  $('content-b').innerHTML = mdToHtml(pair.version_b.content);

  // Add incongruenza styling
  document.querySelectorAll('.incongruenza').forEach(el => {
    el.style.cssText = 'display:block;margin:8px 0;padding:8px 12px;' +
      'border-left:3px solid #ef4444;background:rgba(239,68,68,0.08);' +
      'color:#fca5a5;font-size:0.78rem;font-weight:600;border-radius:0 6px 6px 0;';
  });

  // Restore vote state
  const existing = state.votes[pair.id];
  clearVoteUI();
  if (existing) {
    if (existing.vote) {
      const btn = $(`vote-${existing.vote.toLowerCase()}`);
      if (btn) btn.classList.add('active');
      updatePanelSelection(existing.vote);
    }
    $('feedback').value = existing.feedback || '';
    $('btn-next').disabled = false;
  } else {
    $('feedback').value = '';
    $('btn-next').disabled = true;
  }

  // Nav buttons
  $('btn-prev').disabled = state.currentIndex === 0;
  const isLast = state.currentIndex === state.pairs.length - 1;
  $('btn-next').querySelector('svg + svg, span')
  $('btn-next').innerHTML = isLast
    ? 'Termina <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : 'Prossimo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

  // Mobile: show panel A by default
  showMobileTab('a');

  // Scroll top
  window.scrollTo(0, 0);
}

function clearVoteUI() {
  document.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dispatch-panel').forEach(p => p.classList.remove('selected'));
}

function updatePanelSelection(vote) {
  $('panel-a').classList.toggle('selected', vote === 'A');
  $('panel-b').classList.toggle('selected', vote === 'B');
}

function saveVote(vote) {
  const pair = state.pairs[state.currentIndex];
  if (!pair) return;
  state.votes[pair.id] = {
    vote,
    feedback: $('feedback').value.trim(),
    timestamp: new Date().toISOString()
  };
  persist();
}

function persist() {
  localStorage.setItem(APP_KEY, JSON.stringify({
    user: state.user,
    votes: state.votes,
    lastIndex: state.currentIndex
  }));
}

function loadState() {
  const raw = localStorage.getItem(APP_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      state.user = saved.user || '';
      state.votes = saved.votes || {};
      state.currentIndex = saved.lastIndex || 0;
    } catch(e) {}
  }
}

// ---- Mobile tabs ----
function showMobileTab(tab) {
  document.querySelectorAll('.mobile-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  $('panel-a').classList.toggle('hidden-mobile', tab !== 'a');
  $('panel-b').classList.toggle('hidden-mobile', tab !== 'b');
}

// ---- Results ----
function showResults() {
  const tbody = $('results-tbody');
  tbody.innerHTML = '';

  let countA = 0, countB = 0, countEq = 0;
  state.pairs.forEach(pair => {
    const v = state.votes[pair.id];
    const tr = document.createElement('tr');
    const voteLabel = v ? (v.vote === 'A' ? 'Versione A' : v.vote === 'B' ? 'Versione B' : 'Equivalenti') : '—';
    if (v) {
      if (v.vote === 'A') countA++;
      else if (v.vote === 'B') countB++;
      else countEq++;
    }
    tr.innerHTML = `
      <td>${pair.id}</td>
      <td style="color: ${v?.vote === 'A' ? '#6366f1' : v?.vote === 'B' ? '#f97316' : '#10b981'}">${voteLabel}</td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${v?.feedback || '—'}</td>
    `;
    tbody.appendChild(tr);
  });

  $('results-summary').textContent =
    `Versione A preferita: ${countA} — Versione B preferita: ${countB} — Equivalenti: ${countEq}`;

  showScreen('results');
}

function exportResults() {
  const data = {
    evaluator: state.user,
    timestamp: new Date().toISOString(),
    total_pairs: state.pairs.length,
    evaluations: state.pairs.map(pair => {
      const v = state.votes[pair.id] || {};
      return {
        patient_id: pair.id,
        preference: v.vote || null,
        feedback: v.feedback || '',
        evaluated_at: v.timestamp || null
      };
    })
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `valutazione_${state.user.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Init ----
async function init() {
  await loadDispatches();
  loadState();

  // If user already logged in and dispatches loaded, resume
  if (state.user && state.pairs.length > 0) {
    $('header-user').textContent = state.user;
    showScreen('eval');
    renderPair();
  }

  // ---- Event listeners ----

  // Login
  $('login-form').addEventListener('submit', e => {
    e.preventDefault();
    state.user = $('username').value.trim();
    if (!state.user) return;
    $('header-user').textContent = state.user;
    persist();

    if (state.pairs.length === 0) {
      alert('Nessun dispatch caricato. Controlla il file data/dispatches.json');
      return;
    }

    showScreen('eval');
    renderPair();
  });

  // Vote buttons
  document.querySelectorAll('.btn-vote').forEach(btn => {
    btn.addEventListener('click', () => {
      clearVoteUI();
      btn.classList.add('active');
      const vote = btn.dataset.vote;
      updatePanelSelection(vote);
      saveVote(vote);
      $('btn-next').disabled = false;
    });
  });

  // Feedback auto-save
  $('feedback').addEventListener('input', () => {
    const pair = state.pairs[state.currentIndex];
    if (pair && state.votes[pair.id]) {
      state.votes[pair.id].feedback = $('feedback').value.trim();
      persist();
    }
  });

  // Navigation
  $('btn-next').addEventListener('click', () => {
    // Save current feedback
    const pair = state.pairs[state.currentIndex];
    if (pair && state.votes[pair.id]) {
      state.votes[pair.id].feedback = $('feedback').value.trim();
      persist();
    }

    if (state.currentIndex < state.pairs.length - 1) {
      state.currentIndex++;
      persist();
      renderPair();
    } else {
      showResults();
    }
  });

  $('btn-prev').addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      persist();
      renderPair();
    }
  });

  // Mobile tabs
  document.querySelectorAll('.mobile-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => showMobileTab(tab.dataset.tab));
  });

  // Finish/export
  $('btn-finish').addEventListener('click', showResults);
  $('btn-download').addEventListener('click', exportResults);

  // Restart
  $('btn-restart').addEventListener('click', () => {
    localStorage.removeItem(APP_KEY);
    state = { user: '', currentIndex: 0, pairs: state.pairs, votes: {} };
    $('username').value = '';
    showScreen('login');
  });
}

// GO
init();
