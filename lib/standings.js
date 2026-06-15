// Calcule le classement de chaque groupe à partir des scores réels des matchs de groupe.
// Critères de classement : Points > Différence de buts > Buts marqués > ordre alphabétique (départage simple)

function emptyTeamStats(team) {
  return { team, pts: 0, played: 0, gf: 0, ga: 0, gd: 0 };
}

/**
 * @param {Array} matches - tous les matchs (data/matches.json), avec score1/score2 (réels, en direct)
 * @returns {Object} { A: [ {team, pts, played, gf, ga, gd, complete}, ... ], B: [...], ... }
 *   `complete` (au niveau du tableau, via le 7e champ groupComplete) indique si les 6 matchs du groupe sont joués
 */
function computeGroupStandings(matches) {
  const groups = {};

  for (const m of matches) {
    if (!m.group) continue;
    if (!groups[m.group]) groups[m.group] = {};
    const g = groups[m.group];
    if (!g[m.team1]) g[m.team1] = emptyTeamStats(m.team1);
    if (!g[m.team2]) g[m.team2] = emptyTeamStats(m.team2);

    if (m.score1 == null || m.score2 == null) continue; // pas encore joué

    const t1 = g[m.team1];
    const t2 = g[m.team2];
    t1.played++; t2.played++;
    t1.gf += m.score1; t1.ga += m.score2;
    t2.gf += m.score2; t2.ga += m.score1;

    if (m.score1 > m.score2) { t1.pts += 3; }
    else if (m.score1 < m.score2) { t2.pts += 3; }
    else { t1.pts += 1; t2.pts += 1; }
  }

  const result = {};
  for (const groupName of Object.keys(groups)) {
    const teams = Object.values(groups[groupName]).map(t => ({ ...t, gd: t.gf - t.ga }));
    teams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });
    const complete = teams.every(t => t.played === 3);
    result[groupName] = { teams, complete };
  }
  return result;
}

/**
 * Calcule les 8 meilleurs 3es de groupe (parmi les 12), avec le même critère de tri.
 * Ne renvoie un résultat "définitif" que si TOUS les groupes ont terminé leur phase de groupes.
 * @param {Object} standings - résultat de computeGroupStandings
 * @returns {{teams: string[], complete: boolean}} liste des équipes qualifiées en tant que meilleur 3e
 */
function computeBest3rd(standings) {
  const groupNames = Object.keys(standings);
  const allComplete = groupNames.every(g => standings[g].complete);

  const thirds = groupNames
    .filter(g => standings[g].teams.length >= 3)
    .map(g => ({ group: g, ...standings[g].teams[2] }));

  thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });

  return {
    teams: thirds.slice(0, 8).map(t => t.team),
    complete: allComplete
  };
}

module.exports = { computeGroupStandings, computeBest3rd };
