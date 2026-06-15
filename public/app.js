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
      <h1>Prono Coupe du Monde 2026</h1>
      <p>Entre ton code personnel pour voir tes pronostics et tes points en direct.</p>
      <input id="code-input" maxlength="12" placeholder="TON CODE" autocapitalize="characters" />
      <button id="login-btn">Voir mes pronos</button>
      <div class="error">${errorMsg || ''}</div>
      <a class="ranking-link" id="show-ranking">Voir le classement général sans code</a>
    </div>
  `;
  const input = document.getElementById('code-input');
  input.focus();
  document.getElementById('login-btn').addEventListener('click', () => tryLogin(input.value.trim()));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(input.value.trim()); });
  document.getElementById('show-ranking').addEventListener('click', e => {
    e.preventDefault();
    state.code = null;
    state.tab = 'classement';
    renderMain();
  });
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

  try {
    if (state.code && !state.data) {
      state.data = await api(`/api/me/${encodeURIComponent(state.code)}`);
    }
    if (!state.ranking) {
      state.ranking = await api('/api/ranking');
    }
  } catch (e) {
    state.code = null;
    localStorage.removeItem('prono_code');
    return renderLogin(e.message);
  }

  const hasCode = !!state.code;

  app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>🏆 Prono CDM 2026</h1>
        ${hasCode ? `<div class="sub">${state.data.name}</div>` : `<div class="sub">Classement général</div>`}
      </div>
      <button class="refresh-btn" id="refresh-btn">↻ Actualiser</button>
    </header>
    <main id="main-content"></main>
    <nav class="tabs">
      ${hasCode ? `<button data-tab="pronos" class="${state.tab === 'pronos' ? 'active' : ''}">
        <span class="icon">📋</span>Mes pronos</button>` : ''}
      <button data-tab="classement" class="${state.tab === 'classement' ? 'active' : ''}">
        <span class="icon">📊</span>Classement</button>
      ${hasCode ? `<button data-tab="logout" >
        <span class="icon">🔑</span>Changer de code</button>` : `<button data-tab="login">
        <span class="icon">🔑</span>Entrer un code</button>`}
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
      if (tab === 'login') {
        renderLogin();
        return;
      }
      state.tab = tab;
      renderMain();
    });
  });

  if (state.tab === 'pronos' && hasCode) renderPronos();
  else renderClassement();
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
  return points > 0 ? 'points-positive' : 'points-zero';
}

function renderGroupMatch(d, teams) {
  const real = d.real;
  const pred = d.pred;
  const played = real.score1 != null;
  const realScore = played ? `${real.score1} - ${real.score2}` : '—';
  const predScore = pred ? `${pred.score1} - ${pred.score2}` : 'non rempli';

  return `
    <div class="match ${pointsClass(d.points)}">
      <div class="meta">
        <span>${fmtDate(d.date)}</span>
        <span>${played ? 'Terminé / en cours' : 'À venir'}</span>
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
  return `
    <div class="match ${pointsClass(d.points)}">
      <div class="meta"><span>Groupe ${d.group}</span><span>${realKnown ? 'Classement connu' : 'En cours'}</span></div>
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

  return `
    <div class="match ${pointsClass(d.points)}">
      <div class="meta">
        <span>${fmtDate(d.date)} ${statusBadge}</span>
        <span>${realKnown ? 'Réel : ' + realLabel : ''}</span>
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
