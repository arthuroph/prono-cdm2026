// Récupère les scores en direct/à jour de la Coupe du Monde 2026 depuis une source
// publique gratuite et sans clé API (openfootball/worldcup.json sur GitHub), et les
// fusionne avec data/matches.json (calendrier, groupes, codes de tableau final) et
// data/overrides.json (corrections manuelles : tirs au but, etc.)

const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const CACHE_FILE = path.join(__dirname, '..', 'data', 'live_cache.json');
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

let cache = { fetchedAt: 0, scores: [] };

function loadDiskCache() {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {
    cache = { fetchedAt: 0, scores: [] };
  }
}

function saveDiskCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('Impossible d\'écrire le cache live:', e.message);
  }
}

// Construit une clé stable "team1|team2|date" pour relier la source externe à matches.json
function key(team1, team2, date) {
  return `${team1}|${team2}|${date}`;
}

async function refreshLiveScores() {
  try {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const scores = [];
    for (const m of json.matches || []) {
      const ft = m.score && m.score.ft;
      scores.push({
        key: key(m.team1, m.team2, m.date),
        team1: m.team1,
        team2: m.team2,
        date: m.date,
        score1: ft ? ft[0] : null,
        score2: ft ? ft[1] : null
      });
    }
    cache = { fetchedAt: Date.now(), scores };
    saveDiskCache();
    console.log(`[live] scores mis à jour (${scores.filter(s => s.score1 != null).length} matchs joués)`);
  } catch (e) {
    console.error('[live] échec de la mise à jour des scores:', e.message);
  }
}

function ensureFreshLoop() {
  if (Date.now() - cache.fetchedAt > REFRESH_MS) {
    refreshLiveScores();
  }
}

/**
 * Renvoie data/matches.json fusionné avec les derniers scores connus + overrides manuels.
 */
function getMergedMatches() {
  const baseMatches = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'matches.json'), 'utf8')
  );

  let overrides = {};
  try {
    overrides = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'overrides.json'), 'utf8'));
  } catch (e) {
    overrides = {};
  }

  const byKey = new Map(cache.scores.map(s => [s.key, s]));

  return baseMatches.map(m => {
    let score1 = m.score1;
    let score2 = m.score2;

    if (m.group) {
      // Match de groupe : on tente de retrouver le score live via team1|team2|date
      const live = byKey.get(key(m.team1, m.team2, m.date));
      if (live && live.score1 != null) {
        score1 = live.score1;
        score2 = live.score2;
      }
    } else {
      // Match à élimination directe : team1/team2 sont des codes de slot tant qu'ils
      // ne sont pas résolus (cf lib/bracket.js). On essaie quand même une correspondance
      // directe par nom d'équipe au cas où la source externe les a déjà résolus.
      const live = cache.scores.find(s => s.date === m.date && (
        (s.team1 === m.team1 && s.team2 === m.team2)
      ));
      if (live && live.score1 != null) {
        score1 = live.score1;
        score2 = live.score2;
      }
    }

    const override = overrides[m.id];
    const merged = { ...m, score1, score2 };
    if (override) Object.assign(merged, override);
    return merged;
  });
}

loadDiskCache();
ensureFreshLoop();
// Rafraîchit périodiquement en tâche de fond
setInterval(refreshLiveScores, REFRESH_MS);

module.exports = { getMergedMatches, refreshLiveScores, ensureFreshLoop };
