const app = document.getElementById('app');

const PHASE_LABELS = {
  groupe: 'Phase de groupes',
  classement_groupe: 'Classement de groupe',
  '16es': '16es de finale',
  '8es': '8es de finale',
  quarts: 'Quarts de finale',
  demis: 'Demi-finales',
  petite_finale: 'Petite finale (3e place)',
  finale: 'Finale'
};

const PHASE_ORDER = ['groupe', 'classement_groupe', '16es', '8es', 'quarts', 'demis', 'petite_finale', 'finale'];

const ICONS = {
  pronos: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/></svg>`,
  classement: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="14" width="4" height="6" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="18" y="4" width="4" height="16" rx="1"/></svg>`,
  key: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>`
};

let state = {
  code: localStorage.getItem('prono_code') || null,
  tab: 'pronos',
  data: null,
  ranking: null
};

function teamName(teams, code) {
  if (!code) return '?';
  return teams[code] || code;
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ---------- Login ----------
function renderLogin(errorMsg) {
  app.innerHTML = `
    <div class="login-screen">
      <div class="ball">⚽</div>
      <h1>Pronix</h1>
      <p>Entre ton code personnel pour voir tes pronostics et tes points en direct.</p>
      <input id="code-input" maxlength="12" placeholder="TON CODE" autocapitalize="characters" />
      <button id="login-btn">Voir mes pronos</button>
      <div class="error">${errorMsg || ''}</div>
    </div>
  `;
  const input = document.getElementById('code-input');
  input.focus();
  document.getElementById('login-btn').addEventListener('click', () => tryLogin(input.value.trim()));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(input.value.trim()); });
}

async function tryLogin(code) {
  if (!code) return;
  try {
    const data = await api(`/api/me/${encodeURIComponent(code)}`);
    state.code = code.toUpperCase();
    state.data = data;
    localStorage.setItem('prono_code', state.code);
    state.tab = 'pronos';
    renderMain();
  } catch (e) {
    renderLogin(e.message);
  }
}

// ---------- Main shell ----------
async function renderMain() {
  app.innerHTML = '<div class="loading">Chargement…</div>';

  const isAdmin = state.code === 'ARTHUR4388';

  try {
    if (state.code && !state.data) {
      state.data = await api(`/api/me/${encodeURIComponent(state.code)}`);
    }
    if (isAdmin && !state.ranking) {
      state.ranking = await api(`/api/ranking?code=${encodeURIComponent(state.code)}`);
    }
  } catch (e) {
    state.code = null;
    localStorage.removeItem('prono_code');
    return renderLogin(e.message);
  }

  const hasCode = !!state.code;
  if (!hasCode) return renderLogin();
  if (state.tab === 'classement' && !isAdmin) state.tab = 'pronos';

  app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>🏆 Pronix</h1>
        <div class="sub">${state.data.name}</div>
      </div>
      <button class="refresh-btn" id="refresh-btn">↻ Actualiser</button>
    </header>
    <main id="main-content"></main>
    <nav class="tabs">
      <button data-tab="pronos" class="${state.tab === 'pronos' ? 'active' : ''}">
        <span class="icon">${ICONS.pronos}</span>Mes pronos</button>
      ${isAdmin ? `<button data-tab="classement" class="${state.tab === 'classement' ? 'active' : ''}">
        <span class="icon">${ICONS.classement}</span>Classement</button>` : ''}
      <button data-tab="logout">
        <span class="icon">${ICONS.key}</span>Changer de code</button>
    </nav>
  `;

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    document.getElementById('refresh-btn').textContent = '…';
    await api('/api/refresh', { method: 'POST' });
    state.data = null;
    state.ranking = null;
    renderMain();
  });

  document.querySelectorAll('nav.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'logout') {
        state.code = null;
        state.data = null;
        localStorage.removeItem('prono_code');
        renderLogin();
        return;
      }
      state.tab = tab;
      renderMain();
    });
  });

  if (state.tab === 'classement' && isAdmin) renderClassement();
  else renderPronos();
}

// ---------- "Mes pronos" tab ----------
function renderPronos() {
  const content = document.getElementById('main-content');
  const { data } = state;
  const teams = data.teams;

  let html = `
    <div class="summary">
      <div>
        <div class="name">${data.name}</div>
        <div class="points">${data.total} <small>pts</small></div>
      </div>
      <div class="rank">
        <div>Classement</div>
        <b>${data.rank}<small>e</small> / ${data.nbParticipants}</b>
      </div>
    </div>
  `;

  // Regroupe les détails par phase, puis par groupe pour la phase de groupes
  const byPhase = {};
  for (const d of data.details) {
    byPhase[d.phase] = byPhase[d.phase] || [];
    byPhase[d.phase].push(d);
  }

  for (const phase of PHASE_ORDER) {
    const items = byPhase[phase];
    if (!items || !items.length) continue;

    if (phase === 'groupe') {
      // groupé par groupe A..L, trié par date
      const byGroup = {};
      for (const d of items) {
        byGroup[d.group] = byGroup[d.group] || [];
        byGroup[d.group].push(d);
      }
      for (const group of Object.keys(byGroup).sort()) {
        html += `<div class="section-title">Groupe ${group}</div>`;
        for (const d of byGroup[group].sort((a, b) => a.date.localeCompare(b.date))) {
          html += renderGroupMatch(d, teams);
        }
      }
    } else if (phase === 'classement_groupe') {
      html += `<div class="section-title">${PHASE_LABELS[phase]}</div>`;
      for (const d of items.sort((a, b) => a.group.localeCompare(b.group))) {
        html += renderGroupRanking(d, teams);
      }
    } else {
      html += `<div class="section-title">${PHASE_LABELS[phase]}</div>`;
      for (const d of items.sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
        html += renderKnockoutMatch(d, teams, phase);
      }
    }
  }

  content.innerHTML = html;
}

function pointsClass(points) {
  if (!points || points <= 0) return 'points-zero';
  if (points <= 3) return 'points-low';
  if (points <= 7) return 'points-mid';
  return 'points-high';
}

function resultClass(d) {
  if (d.matchStatus !== 'termine') return '';
  if (d.status === 'pas_de_prono') return '';
  if (d.status === 'exact') return 'result-exact';
  if (d.points > 0) return 'result-bon';
  return 'result-rate';
}

function matchStatusMeta(status) {
  switch (status) {
    case 'en_cours': return { cls: 'status-live', label: '🔴 En direct' };
    case 'termine': return { cls: 'status-finished', label: '✅ Terminé' };
    default: return { cls: 'status-upcoming', label: '⏳ À venir' };
  }
}

function renderGroupMatch(d, teams) {
  const real = d.real;
  const pred = d.pred;
  const played = real.score1 != null;
  const realScore = played ? `${real.score1} - ${real.score2}` : '—';
  const predScore = pred ? `${pred.score1} - ${pred.score2}` : 'non rempli';
  const meta = matchStatusMeta(d.matchStatus);

  return `
    <div class="match ${pointsClass(d.points)} ${meta.cls} ${resultClass(d)}">
      <div class="meta">
        <span>${fmtDate(d.date)}</span>
        <span class="status-label">${meta.label}</span>
      </div>
      <div class="row">
        <div class="teams">${teamName(teams, d.team1)}<br>${teamName(teams, d.team2)}</div>
        <div class="scoreblock live-score">
          <div class="label">Réel</div>
          <div class="score">${realScore}</div>
        </div>
        <div class="scoreblock pred-score">
          <div class="label">Ton prono</div>
          <div class="score">${predScore}</div>
        </div>
        <div class="points">${pred ? `${d.points} pt${d.points === 1 ? '' : 's'}` : '–'}</div>
      </div>
    </div>
  `;
}

function renderGroupRanking(d, teams) {
  const pred = d.pred;
  const real = d.real;
  if (!pred) {
    return `<div class="match"><div class="row"><div class="teams">Groupe ${d.group} — pas de prono de classement</div></div></div>`;
  }
  const line = (label, predTeam, realTeam, ok) => `
    <div class="row" style="font-size:13px; margin-top:4px;">
      <div class="teams">${label} : ${predTeam ? teamName(teams, predTeam) : '—'}</div>
      <div class="points" style="font-size:13px;">${ok === null ? '' : (ok ? '✅' : '—')}</div>
    </div>`;
  const realKnown = !!real;
  const meta = matchStatusMeta(d.matchStatus);
  return `
    <div class="match ${pointsClass(d.points)} ${meta.cls}">
      <div class="meta"><span>Groupe ${d.group}</span><span class="status-label">${realKnown ? '✅ Classement connu' : '🔴 En cours'}</span></div>
      ${line('1er prédit', pred.first, real && real.first, realKnown ? d.detail.premier === true : null)}
      ${line('2e prédit', pred.second, real && real.second, realKnown ? d.detail.deuxieme === true : null)}
      ${line('3e qualifié prédit', pred.thirdQualified, real && real.third, realKnown ? d.detail.meilleur3e === true : null)}
      <div class="row" style="margin-top:6px;">
        <div class="teams"></div>
        <div class="points">${d.points} pts</div>
      </div>
    </div>
  `;
}

function renderKnockoutMatch(d, teams, phase) {
  const pred = d.pred;
  const real = d.real;
  if (!pred) {
    return `<div class="match"><div class="row"><div class="teams">Pas encore de prono pour ce match</div></div></div>`;
  }
  const realKnown = real.team1 && real.team2;
  const realLabel = realKnown ? `${teamName(teams, real.team1)} vs ${teamName(teams, real.team2)}` : 'Équipes pas encore connues';
  const realScore = (real.score1 != null) ? `${real.score1} - ${real.score2}` : '—';
  const predScore = `${pred.score1} - ${pred.score2}`;

  let statusBadge = '';
  if (d.status === 'demi_equipe_1') statusBadge = '<span class="live-badge">1/2 équipe</span>';
  if (d.status === 'demi_equipe_0') statusBadge = '<span class="live-badge">0/2 équipe</span>';

  const meta = matchStatusMeta(d.matchStatus);

  return `
    <div class="match ${pointsClass(d.points)} ${meta.cls} ${resultClass(d)}">
      <div class="meta">
        <span>${fmtDate(d.date)} ${statusBadge}</span>
        <span class="status-label">${realKnown ? 'Réel : ' + realLabel : meta.label}</span>
      </div>
      <div class="row">
        <div class="teams">
          Ton prono : ${teamName(teams, pred.team1)} - ${teamName(teams, pred.team2)}<br>
          Qualifié prédit : ${teamName(teams, pred.qualified)}
        </div>
      </div>
      <div class="row" style="margin-top:6px;">
        <div class="scoreblock live-score">
          <div class="label">Score réel (90')</div>
          <div class="score">${realScore}</div>
        </div>
        <div class="scoreblock pred-score">
          <div class="label">Ton score</div>
          <div class="score">${predScore}</div>
        </div>
        <div class="points">${d.points} pts</div>
      </div>
    </div>
  `;
}

// ---------- "Classement" tab ----------
function renderClassement() {
  const content = document.getElementById('main-content');
  const ranking = state.ranking;
  if (!ranking || !ranking.length) {
    content.innerHTML = `<div class="empty-state">Pas encore de pronostics enregistrés.</div>`;
    return;
  }
  let html = `<div class="section-title">Classement général</div>`;
  for (const r of ranking) {
    const isMe = state.data && r.name === state.data.name;
    let cls = 'rank-row';
    if (r.rank === 1) cls += ' r1';
    else if (r.rank === 2) cls += ' r2';
    else if (r.rank === 3) cls += ' r3';
    if (isMe) cls += ' me';
    html += `
      <div class="${cls}">
        <div class="pos">${r.rank}</div>
        <div class="pname">${r.name}${isMe ? ' (toi)' : ''}</div>
        <div class="ptotal">${r.total} pts</div>
      </div>
    `;
  }
  content.innerHTML = html;
}

// ---------- Boot ----------
registerServiceWorker();
if (state.code) {
  renderMain();
} else {
  renderLogin();
}
