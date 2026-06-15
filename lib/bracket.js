// Résout les "codes de slot" du tableau final (ex: "1A", "2B", "3A/B/C/D/F", "W74", "L101")
// en noms d'équipes réelles, à partir du classement des groupes et des résultats déjà joués.
//
// NB: pour les codes "3X/Y/Z/..." (meilleur 3e), la table officielle FIFA des 495 combinaisons
// n'est pas reproduite ici. On choisit, parmi les groupes listés, le premier dont l'équipe 3e
// fait partie des 8 meilleurs 3es. C'est une approximation : à corriger manuellement si besoin
// une fois le tableau officiel publié par la FIFA.

function isSlotCode(code) {
  return typeof code === 'string' && /^([12]|3|W|L)/.test(code) && /[A-Za-z]/.test(code) && code.length <= 12 && !code.includes(' ');
}

/**
 * @param {string} code - code de slot ("1A", "3C/D/F/G/H", "W74", "L101") ou nom d'équipe réel
 * @param {Object} standings - computeGroupStandings()
 * @param {Object} best3rd - computeBest3rd()
 * @param {Map<number, object>} resolvedMatches - id de match -> { team1, team2, score1, score2 } (équipes déjà résolues)
 * @returns {string|null} nom de l'équipe, ou null si pas encore déterminable
 */
function resolveSlot(code, standings, best3rd, resolvedMatches) {
  if (!code) return null;

  // Position de groupe : "1A" (premier du groupe A), "2B" (deuxième du groupe B)
  let m = code.match(/^([12])([A-L])$/);
  if (m) {
    const [, pos, group] = m;
    const g = standings[group];
    if (!g || !g.complete) return null;
    return g.teams[Number(pos) - 1]?.team || null;
  }

  // Meilleur 3e parmi une liste de groupes : "3A/B/C/D/F"
  m = code.match(/^3([A-L](?:\/[A-L])*)$/);
  if (m) {
    if (!best3rd.complete) return null;
    const groups = m[1].split('/');
    for (const group of groups) {
      const g = standings[group];
      if (!g || g.teams.length < 3) continue;
      const candidate = g.teams[2].team;
      if (best3rd.teams.includes(candidate)) return candidate;
    }
    return null;
  }

  // Vainqueur / perdant d'un match précédent : "W74" / "L101"
  m = code.match(/^([WL])(\d+)$/);
  if (m) {
    const [, wl, idStr] = m;
    const ref = resolvedMatches.get(Number(idStr));
    if (!ref || ref.score1 == null || ref.score2 == null) return null;
    if (ref.score1 === ref.score2) return null; // nul à 90' -> prolongations/tab, pas résolu ici
    const winner = ref.score1 > ref.score2 ? ref.team1 : ref.team2;
    const loser = ref.score1 > ref.score2 ? ref.team2 : ref.team1;
    return wl === 'W' ? winner : loser;
  }

  // Sinon, c'est probablement déjà un nom d'équipe réel
  return code;
}

/**
 * Parcourt tous les matchs à élimination directe dans l'ordre et résout progressivement
 * les équipes réelles de chaque match (team1/team2), tour par tour.
 * @param {Array} matches - data/matches.json (avec scores live fusionnés)
 * @param {Object} standings
 * @param {Object} best3rd
 * @returns {Map<number, object>} id de match -> { ...match, team1Resolved, team2Resolved }
 */
function resolveBracket(matches, standings, best3rd) {
  const knockout = matches
    .filter(m => m.group == null)
    .sort((a, b) => a.id - b.id);

  const resolved = new Map();
  for (const match of knockout) {
    const team1 = resolveSlot(match.team1, standings, best3rd, resolved);
    const team2 = resolveSlot(match.team2, standings, best3rd, resolved);
    resolved.set(match.id, {
      ...match,
      team1: team1 || match.team1,
      team2: team2 || match.team2,
      team1Resolved: team1,
      team2Resolved: team2
    });
  }
  return resolved;
}

module.exports = { resolveSlot, resolveBracket, isSlotCode };
