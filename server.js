const express = require('express');
const path = require('path');
const fs = require('fs');

const { getMergedMatches, refreshLiveScores, ensureFreshLoop } = require('./lib/liveData');
const { computeGroupStandings, computeBest3rd } = require('./lib/standings');
const { resolveBracket } = require('./lib/bracket');
const { computeParticipantScore } = require('./lib/scoring');

const config = require('./data/config.json');
const teamsFr = require('./data/teams_fr.json');

const PORT = process.env.PORT || 3000;
const PREDICTIONS_FILE = path.join(__dirname, 'data', 'predictions.json');

function loadPredictions() {
  return JSON.parse(fs.readFileSync(PREDICTIONS_FILE, 'utf8'));
}

// Recalcule tout (matchs live + classements + tableau final + scores de chacun)
function computeEverything() {
  const matches = getMergedMatches();
  const standings = computeGroupStandings(matches);
  const best3rd = computeBest3rd(standings);
  const bracket = resolveBracket(matches, standings, best3rd);
  const { participants } = loadPredictions();

  const results = participants.map(p => {
    const { total, details } = computeParticipantScore(p, matches, standings, best3rd, bracket, config);
    return { code: p.code, name: p.name, total, details };
  });

  results.sort((a, b) => b.total - a.total);
  results.forEach((r, i) => { r.rank = i + 1; });

  return { matches, standings, best3rd, bracket, results };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Calendrier + scores live (sans pronostics)
app.get('/api/matches', (req, res) => {
  ensureFreshLoop();
  const { matches } = computeEverything();
  res.json({ matches, teams: teamsFr, config });
});

// Classement général : réservé à Arthur O (ARTHUR4388)
app.get('/api/ranking', (req, res) => {
  const code = String(req.query.code || '').toUpperCase();
  if (code !== 'ARTHUR4388') {
    return res.status(403).json({ error: 'Classement réservé.' });
  }
  ensureFreshLoop();
  const { results } = computeEverything();
  res.json(results.map(r => ({ rank: r.rank, name: r.name, total: r.total })));
});

// Données personnelles d'un pronostiqueur : son détail complet + sa position au classement
app.get('/api/me/:code', (req, res) => {
  ensureFreshLoop();
  const everything = computeEverything();
  const me = everything.results.find(r => r.code.toUpperCase() === req.params.code.toUpperCase());
  if (!me) {
    return res.status(404).json({ error: 'Code inconnu. Vérifie ton code personnel.' });
  }
  res.json({
    name: me.name,
    total: me.total,
    rank: me.rank,
    nbParticipants: everything.results.length,
    details: me.details,
    teams: teamsFr,
    standings: everything.standings,
    best3rd: everything.best3rd
  });
});

// Force un rafraîchissement immédiat des scores live
app.post('/api/refresh', async (req, res) => {
  await refreshLiveScores();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Prono CDM 2026 lancé sur http://localhost:${PORT}`);
});
