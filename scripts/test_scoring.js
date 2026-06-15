// Petits tests de non-régression du moteur de points, basés sur les exemples chiffrés
// donnés dans la feuille "Règles du jeu" du classeur Excel.
const assert = require('assert');
const { scoreGroupMatch, scoreKnockoutMatch, computeParticipantScore } = require('../lib/scoring');
const { computeGroupStandings, computeBest3rd } = require('../lib/standings');
const { resolveBracket } = require('../lib/bracket');
const config = require('../data/config.json');

let passed = 0;
function check(label, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${label}: attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  passed++;
  console.log(`OK  ${label}`);
}

// --- Phase de groupes ---
check('score exact (2-1 = 2-1) -> 7 pts',
  scoreGroupMatch({ score1: 2, score2: 1 }, { score1: 2, score2: 1 }, config.groupe).points, 7);

check('bon écart sans score exact (2-1 prédit, 3-2 réel) -> 5 pts',
  scoreGroupMatch({ score1: 2, score2: 1 }, { score1: 3, score2: 2 }, config.groupe).points, 5);

check('bon résultat seulement (2-0 prédit, 1-0 réel) -> 3 pts',
  scoreGroupMatch({ score1: 2, score2: 0 }, { score1: 1, score2: 0 }, config.groupe).points, 3);

check('mauvais résultat (2-1 prédit, 1-1 réel) -> 0 pt',
  scoreGroupMatch({ score1: 2, score2: 1 }, { score1: 1, score2: 1 }, config.groupe).points, 0);

check('match pas encore joué -> 0 pt',
  scoreGroupMatch({ score1: 2, score2: 1 }, { score1: null, score2: null }, config.groupe).points, 0);

// --- Phase finale : exemple "France vs Espagne" (Règles du jeu) ---
// Prono : France vs Espagne, 2-1, qualifié France. Réel à 90' : France 2 - 1 Espagne (qualifiée directement)
const quartsCfg = config.knockout.quarts;
const r1 = scoreKnockoutMatch(
  { team1: 'France', team2: 'Espagne', score1: 2, score2: 1, qualified: 'France' },
  { team1: 'France', team2: 'Espagne', team1Resolved: 'France', team2Resolved: 'Espagne', score1: 2, score2: 1 },
  quartsCfg
);
check('Quart France-Espagne : 12 (qualifié) + 6 (score exact) = 18', r1.points, 18);

// --- Phase finale : exemple "Brésil vs Argentine, tirs au but" (Règles du jeu) ---
// Prono : Brésil vs Argentine, 1-1, qualifié Brésil. Réel à 90' : 1-1, puis Brésil qualifié aux tab (override)
const r2 = scoreKnockoutMatch(
  { team1: 'Bresil', team2: 'Argentine', score1: 1, score2: 1, qualified: 'Bresil' },
  { team1: 'Bresil', team2: 'Argentine', team1Resolved: 'Bresil', team2Resolved: 'Argentine', score1: 1, score2: 1, qualified: 'Bresil' },
  quartsCfg
);
check('Quart Brésil-Argentine (tab) : 12 (qualifié) + 6 (score exact 1-1) = 18', r2.points, 18);

// --- Règle de la demi-équipe ---
// Prono : France vs Espagne (2-1, France qualifiée). Réel : France vs Allemagne, 2-1, France qualifiée.
// -> 1 bonne équipe sur 2 -> points / 2 (arrondi 0,5 sup.)
const r3 = scoreKnockoutMatch(
  { team1: 'France', team2: 'Espagne', score1: 2, score2: 1, qualified: 'France' },
  { team1: 'France', team2: 'Allemagne', team1Resolved: 'France', team2Resolved: 'Allemagne', score1: 2, score2: 1 },
  quartsCfg
);
// base = 12 (qualifié France ok) + 6 (score exact 2-1 = 2-1) = 18 -> /2 = 9
check('Demi-équipe (1/2) : (12+6) / 2 = 9', r3.points, 9);

// 0 bonne équipe -> 0 pt
const r4 = scoreKnockoutMatch(
  { team1: 'France', team2: 'Espagne', score1: 2, score2: 1, qualified: 'France' },
  { team1: 'Bresil', team2: 'Argentine', team1Resolved: 'Bresil', team2Resolved: 'Argentine', score1: 2, score2: 1 },
  quartsCfg
);
check('Demi-équipe (0/2) -> 0 pt', r4.points, 0);

// --- Test bout-en-bout avec les vraies données du Mondial (matchday 1, groupe A) ---
const matches = require('../data/matches.json');
const standings = computeGroupStandings(matches);
console.log('\nClassement Groupe A (après les matchs joués) :');
console.log(standings.A.teams);

const best3rd = computeBest3rd(standings);
const bracket = resolveBracket(matches, standings, best3rd);

const demoParticipant = {
  groupPredictions: {
    1: { score1: 2, score2: 0 }, // Mexique 2 - 0 Afrique du Sud (réel: 2-0 -> exact)
    2: { score1: 1, score2: 1 }  // Corée du Sud vs Rép. tchèque, prédit nul (réel 2-1 -> raté)
  }
};
const score = computeParticipantScore(demoParticipant, matches, standings, best3rd, bracket, config);
const m1 = score.details.find(d => d.matchId === 1);
const m2 = score.details.find(d => d.matchId === 2);
check('Match 1 (Mexique 2-0, prédit 2-0) -> exact, 7 pts', m1.points, 7);
check('Match 2 (Corée-Tchéquie, prédit nul, réel 2-1) -> raté, 0 pt', m2.points, 0);

console.log(`\n${passed} tests passés ✅`);
