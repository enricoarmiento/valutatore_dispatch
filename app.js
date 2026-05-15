/* ============================================================
   Valutatore Dispatch — App Logic
   ============================================================ */

const APP_KEY = 'scare_dispatch_evaluations';
const ADMIN_KEY = 'scare_admin_aggregated'; // Per salvare dati aggregati importati

// ---- State ----
let state = {
  user: '',
  currentIndex: 0,
  pairs: [],
  votes: {} // { pairId: { vote: 'A'|'B', feedback: '' } }
};

let adminData = []; // array of evaluation exports

// ---- DOM refs ----
const $ = id => document.getElementById(id);
const screens = {
  login: $('screen-login'),
  eval: $('screen-eval'),
  results: $('screen-results'),
  admin: $('screen-admin')
};

// ---- Simple Markdown → HTML ----
function mdToHtml(md) {
  if (!md) return '<p><em>Nessun contenuto disponibile</em></p>';
  
  let html = md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, '')
    .replace(/RELAZIONE DI INTERVENTO - ARRESTO CARDIACO EXTRAOSPEDALIERO \(OHCA\)/gi, '')
    .replace(/^Paziente:.*$/gim, '')
    .replace(/^Data dell'evento:.*$/gim, '')
    .replace(/\[INCONGRUENZA:\s*(.*?)\s*(?:—\s*Richiede verifica\.)?\s*\]/g,
      '<span class="incongruenza">⚠ INCONGRUENZA: $1</span>')
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

  $('progress-text').textContent = `${state.currentIndex + 1} / ${state.pairs.length}`;
  const pct = ((state.currentIndex) / state.pairs.length) * 100;
  $('progress-bar').style.width = `${pct}%`;

  // Patient info banner removed

  $('content-a').innerHTML = mdToHtml(pair.version_a.content);
  $('content-b').innerHTML = mdToHtml(pair.version_b.content);

  const existing = state.votes[pair.id];
  clearVoteUI();
  if (existing && existing.vote) {
    updatePanelSelection(existing.vote);
    showVotedState(existing.vote);
    $('feedback').value = existing.feedback || '';
  } else {
    $('feedback').value = '';
  }

  $('btn-prev').disabled = state.currentIndex === 0;
  const isLast = state.currentIndex === state.pairs.length - 1;
  $('btn-next').innerHTML = isLast
    ? 'Termina <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : 'Prossimo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

  showMobileTab('a');
  scrollDispatchTop();
}

// Reset scroll for both window (desktop) and dispatch-container (mobile flex layout)
function scrollDispatchTop() {
  window.scrollTo(0, 0);
  const container = document.querySelector('.dispatch-container');
  if (container) container.scrollTop = 0;
  document.querySelectorAll('.dispatch-content').forEach(c => c.scrollTop = 0);
}

function clearVoteUI() {
  document.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dispatch-panel').forEach(p => p.classList.remove('selected'));
  // vote-state-choose is kept in DOM (empty, display:none) for JS compat only
  const choose = $('vote-state-choose');
  if (choose) choose.classList.remove('hidden');
  $('vote-state-voted').classList.remove('visible');
}

function showVotedState(vote) {
  const choose = $('vote-state-choose');
  if (choose) choose.classList.add('hidden');
  $('vote-state-voted').classList.add('visible');
  const badge = $('voted-badge');
  if (badge) badge.textContent = `✅ Hai scelto: Versione ${vote}`;
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
  // Reset scroll on tab switch — user expects to start from top of new version
  const container = document.querySelector('.dispatch-container');
  if (container) container.scrollTop = 0;
}

// ---- Results ----
function showResults() {
  const tbody = $('results-tbody');
  tbody.innerHTML = '';

  let countA = 0, countB = 0;
  state.pairs.forEach(pair => {
    const v = state.votes[pair.id];
    const tr = document.createElement('tr');
    const voteLabel = v ? (v.vote === 'A' ? 'Versione A' : 'Versione B') : '—';
    if (v) {
      if (v.vote === 'A') countA++;
      else if (v.vote === 'B') countB++;
    }
    tr.innerHTML = `
      <td>${pair.id}</td>
      <td style="color: ${v?.vote === 'A' ? 'var(--label-a)' : 'var(--label-b)'}">${voteLabel}</td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${v?.feedback || '—'}</td>
    `;
    tbody.appendChild(tr);
  });

  $('results-summary').textContent = `Versione A: ${countA} — Versione B: ${countB}`;
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

// ---- Admin Dashboard ----
function loadAdminData() {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (raw) {
    try { adminData = JSON.parse(raw); } catch(e) { adminData = []; }
  } else {
    adminData = [];
  }
}

function saveAdminData() {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(adminData));
}

function renderAdmin() {
  let evaluators = new Set();
  let totalVotes = 0;
  let prefA = 0;
  let prefB = 0;
  
  let patientStats = {}; // { id: { A: 0, B: 0 } }
  let allEvals = [];

  // Parse all imported data
  adminData.forEach(file => {
    evaluators.add(file.evaluator);
    (file.evaluations || []).forEach(ev => {
      if (!ev.preference) return;
      totalVotes++;
      
      if (ev.preference === 'A') prefA++;
      else if (ev.preference === 'B') prefB++;
      
      if (!patientStats[ev.patient_id]) patientStats[ev.patient_id] = { A: 0, B: 0 };
      patientStats[ev.patient_id][ev.preference]++;
      
      allEvals.push({
        evaluator: file.evaluator,
        date: new Date(ev.evaluated_at || file.timestamp).toLocaleDateString(),
        patient: ev.patient_id,
        vote: ev.preference,
        feedback: ev.feedback
      });
    });
  });

  $('stat-evaluators').textContent = evaluators.size;
  $('stat-total-votes').textContent = totalVotes;
  $('stat-pref-a').textContent = prefA;
  $('stat-pref-b').textContent = prefB;

  // Patient table
  const pTbody = $('admin-patient-tbody');
  pTbody.innerHTML = '';
  Object.keys(patientStats).sort().forEach(pid => {
    const s = patientStats[pid];
    const total = s.A + s.B;
    const pct = total > 0 ? Math.round((s.A / total) * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${pid}</strong></td>
      <td style="color:var(--label-a)">${s.A}</td>
      <td style="color:var(--label-b)">${s.B}</td>
      <td>${pct}%</td>
    `;
    pTbody.appendChild(tr);
  });

  // Evaluator table
  const eTbody = $('admin-evaluator-tbody');
  eTbody.innerHTML = '';
  const fList = $('admin-feedback-list');
  fList.innerHTML = '';

  allEvals.forEach(ev => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ev.evaluator}</td>
      <td>${ev.date}</td>
      <td>${ev.patient}</td>
      <td style="color:${ev.vote === 'A' ? 'var(--label-a)' : 'var(--label-b)'}">Versione ${ev.vote}</td>
      <td style="color:var(--text-muted);font-size:0.8rem">${ev.feedback ? 'Sì' : 'No'}</td>
    `;
    eTbody.appendChild(tr);

    if (ev.feedback) {
      const div = document.createElement('div');
      div.className = 'feedback-item';
      div.innerHTML = `
        <div class="feedback-meta">
          <span><strong>${ev.evaluator}</strong> su ${ev.patient}</span>
          <span style="color:${ev.vote === 'A' ? 'var(--label-a)' : 'var(--label-b)'}">Voto: ${ev.vote}</span>
        </div>
        <div class="feedback-text">${ev.feedback}</div>
      `;
      fList.appendChild(div);
    }
  });
  
  if (fList.innerHTML === '') fList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nessun feedback presente.</p>';
}

// ---- Init ----
async function init() {
  await loadDispatches();
  loadState();

  if (state.user === '@@@admin') {
    loadAdminData();
    showScreen('admin');
    renderAdmin();
  } else if (state.user && state.pairs.length > 0) {
    showScreen('eval');
    renderPair();
  }

  // ---- Event listeners ----

  // Login
  $('login-form').addEventListener('submit', e => {
    e.preventDefault();
    let val = $('username').value.trim();
    if (!val) val = "Anonimo";
    
    state.user = val;
    persist();

    if (val === '@@@admin') {
      loadAdminData();
      showScreen('admin');
      renderAdmin();
      return;
    }

    if (state.pairs.length === 0) {
      alert('Nessun dispatch caricato. Controlla il file data/dispatches.json');
      return;
    }

    showScreen('eval');
    renderPair();
  });

  // Vote buttons (also handles changing vote by clicking the other panel)
  document.querySelectorAll('.btn-vote').forEach(btn => {
    btn.addEventListener('click', () => {
      const vote = btn.dataset.vote;
      // Clear previous active btn
      document.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Update panel highlight
      updatePanelSelection(vote);
      // Save & show badge
      saveVote(vote);
      showVotedState(vote);
      $('btn-prev').disabled = state.currentIndex === 0;
    });
  });

  // Help popup
  $('btn-help').addEventListener('click', () => {
    $('help-overlay').classList.add('open');
  });
  $('help-close').addEventListener('click', () => {
    $('help-overlay').classList.remove('open');
  });
  $('help-cta-ok').addEventListener('click', () => {
    $('help-overlay').classList.remove('open');
  });
  $('help-overlay').addEventListener('click', (e) => {
    if (e.target === $('help-overlay')) $('help-overlay').classList.remove('open');
  });

  // Feedback auto-save
  $('feedback').addEventListener('input', () => {
    const pair = state.pairs[state.currentIndex];
    if (pair && state.votes[pair.id]) {
      state.votes[pair.id].feedback = $('feedback').value.trim();
      persist();
    }
  });

  // iOS keyboard handling: when textarea gains focus, ensure it's visible above keyboard.
  // interactive-widget=resizes-content handles most cases, but a manual scrollIntoView
  // provides a fallback for older Safari versions.
  $('feedback').addEventListener('focus', () => {
    setTimeout(() => {
      $('feedback').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300); // wait for keyboard animation
  });

  // Navigation
  $('btn-next').addEventListener('click', () => {
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
  // Finish button was removed
  // Logout from eval screen
  $('btn-logout').addEventListener('click', () => {
    if(confirm("Sei sicuro di voler uscire? I tuoi progressi non salvati andranno persi.")) {
      localStorage.removeItem(APP_KEY);
      state = { user: '', currentIndex: 0, pairs: state.pairs, votes: {} };
      $('username').value = '';
      showScreen('login');
    }
  });

  $('btn-download').addEventListener('click', exportResults);

  // Restart
  $('btn-restart').addEventListener('click', () => {
    localStorage.removeItem(APP_KEY);
    state = { user: '', currentIndex: 0, pairs: state.pairs, votes: {} };
    $('username').value = '';
    showScreen('login');
  });
  
  // Admin events
  $('btn-admin-logout').addEventListener('click', () => {
    localStorage.removeItem(APP_KEY);
    state.user = '';
    $('username').value = '';
    showScreen('login');
  });

  $('btn-admin-import').addEventListener('click', () => $('import-file').click());
  
  $('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const json = JSON.parse(evt.target.result);
        if (json.evaluator) {
          // Check if already imported
          const exists = adminData.find(d => d.evaluator === json.evaluator && d.timestamp === json.timestamp);
          if (!exists) {
            adminData.push(json);
            saveAdminData();
            renderAdmin();
            alert('File importato con successo!');
          } else {
            alert('Questo file è già stato importato.');
          }
        }
      } catch(err) {
        alert('Errore nel parsing del file JSON.');
      }
      $('import-file').value = ''; // reset
    };
    reader.readAsText(file);
  });
  
  $('btn-admin-export').addEventListener('click', () => {
    if (adminData.length === 0) {
      alert('Nessun dato da esportare.');
      return;
    }
    const blob = new Blob([JSON.stringify(adminData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SCARE_admin_export_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// GO
init();

/*
 * iOS Safari scroll lock
 * CSS overflow:hidden on body is ignored by iOS Safari — the browser
 * scrolls the viewport regardless. We must prevent touchmove at the
 * document level and only allow it inside .dispatch-container.
 */
document.addEventListener('touchmove', function(e) {
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen || activeScreen.id !== 'screen-eval') return;
  // Allow scroll only inside the dispatch container
  if (!e.target.closest('.dispatch-container')) {
    e.preventDefault();
  }
}, { passive: false });
