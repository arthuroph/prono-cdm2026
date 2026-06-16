// Moteur de calcul des points, fidèle au barème défini dans le classeur Excel
// (feuilles "Règles du jeu" et "Barème de points").

/**
 * Statut temporel d'un match : 'a_venir' | 'en_cours' | 'termine'.
 * Pas d'heure précise disponible côté source live, donc heuristique basée
 * sur la date du match :
 * - score connu (90') => terminé
 * - date <= aujourd'hui (et pas de score) => en cours
 * - date > aujourd'hui => à venir
 */
function getMatchStatus(dateStr, score1, score2) {
  if (score1 != null && score2 != null) return 'termine';
  if (!dateStr) return 'a_venir';
  const today = new Date().toISOString().slice(0, 10);
  return dateStr <= today ? 'en_cours' : 'a_venir';
}

/**
 * Phase de groupes — un match.
 * - Bon résultat (V/N/D) : 3 pts
 * - Score exact (résultat + écart inclus) : 7 pts au total
 * - Bon écart de buts (sans score exact, résultat inclus) : 5 pts au total
 */
function scoreGroupMatch(pred, real, cfg) {
  if (pred == null || pred.score1 == null || pred.score2 == null) {
    return { points: 0, status: 'pas_de_prono' };
  }
  if (real.score1 == null || real.score2 == null) {
    return { points: 0, status: 'a_venir' };
  }

  const predDiff = pred.score1 - pred.score2;
  const realDiff = real.score1 - real.score2;
  const sameResult = Math.sign(predDiff) === Math.sign(realDiff);
  if (!sameResult) return { points: 0, status: 'rate' };

  const exact = pred.score1 === real.score1 && pred.score2 === real.score2;
  if (exact) return { points: cfg.scoreExactTotal, status: 'exact' };
  if (predDiff === realDiff) return { points: cfg.ecartCorrectTotal, status: 'ecart' };
  return { points: cfg.resultatCorrect, status: 'resultat' };
}

/**
 * Bonus de classement final d'un groupe (indépendant des matchs).
 * pred = { first, second, thirdQualified } (noms d'équipes)
 */
function scoreGroupRanking(pred, groupStandings, best3rd, cfg) {
  if (!pred) return { points: 0, status: 'pas_de_prono', detail: {} };
  if (!groupStandings || !groupStandings.complete) {
    return { points: 0, status: 'a_venir', detail: {} };
  }

  let points = 0;
  const detail = {};

  if (pred.first && groupStandings.teams[0] && pred.first === groupStandings.teams[0].team) {
    points += cfg.premier;
    detail.premier = true;
  }
  if (pred.second && groupStandings.teams[1] && pred.second === groupStandings.teams[1].team) {
    points += cfg.deuxieme;
    detail.deuxieme = true;
  }
  if (
    pred.thirdQualified &&
    best3rd.complete &&
    groupStandings.teams[2] &&
    pred.thirdQualified === groupStandings.teams[2].team &&
    best3rd.teams.includes(pred.thirdQualified)
  ) {
    points += cfg.meilleur3e;
    detail.meilleur3e = true;
  }

  return { points, status: 'ok', detail };
}

/**
 * Phase finale — un match à élimination directe, avec règle de la demi-équipe.
 * pred = { team1, team2, score1, score2, qualified }
 * real = { team1, team2, score1, score2, qualified?, team1Resolved, team2Resolved }
 *   - team1/team2 sont les équipes réelles UNE FOIS RÉSOLUES (cf lib/bracket.js)
 *   - team1Resolved/team2Resolved sont null si pas encore déterminables
 *   - score1/score2 = score à 90' (null si pas encore joué)
 *   - qualified (optionnel) = override manuel en cas de tirs au but (data/overrides.json)
 */
function scoreKnockoutMatch(pred, real, phaseCfg) {
  if (pred == null || !pred.team1 || !pred.team2) {
    return { points: 0, status: 'pas_de_prono', overlap: null, detail: {} };
  }
  if (!real || !real.team1Resolved || !real.team2Resolved) {
    return { points: 0, status: 'a_venir', overlap: null, detail: {} };
  }

  const predTeams = [pred.team1, pred.team2];
  const realTeams = [real.team1, real.team2];
  const overlap = predTeams.filter(t => realTeams.includes(t)).length;

  if (overlap === 0) {
    return { points: 0, status: 'demi_equipe_0', overlap, detail: {} };
  }

  // Aligne le score réel sur les positions team1/team2 du pronostic
  let r1 = real.score1, r2 = real.score2, rt1 = real.team1, rt2 = real.team2;
  if (pred.team1 === rt2 || pred.team2 === rt1) {
    [r1, r2] = [r2, r1];
    [rt1, rt2] = [rt2, rt1];
  }

  // Qualifié réel : déduit du score à 90', sinon override (tirs au but)
  let realQualified = null;
  if (real.score1 != null && real.score2 != null) {
    if (real.score1 !== real.score2) {
      realQualified = real.score1 > real.score2 ? real.team1 : real.team2;
    } else if (real.qualified) {
      realQualified = real.qualified;
    }
  }

  const detail = {};
  let basePoints = 0;

  if (pred.qualified && realQualified && pred.qualified === realQualified) {
    basePoints += phaseCfg.qualifie;
    detail.qualifie = true;
  }

  if (r1 != null && r2 != null && pred.score1 != null && pred.score2 != null) {
    const exact = pred.score1 === r1 && pred.score2 === r2;
    const predDiff = pred.score1 - pred.score2;
    const realDiff = r1 - r2;
    if (exact) {
      basePoints += phaseCfg.scoreExactBonus;
      detail.scoreExact = true;
    } else if (predDiff === realDiff) {
      basePoints += phaseCfg.ecartBonus;
      detail.ecart = true;
    }
  }

  // Règle demi-équipe : 2 bonnes équipes = 100%, 1 = 50% (arrondi au 0,5 sup.)
  const multiplier = overlap === 2 ? 1 : 0.5;
  const points = Math.ceil(basePoints * multiplier * 2) / 2;

  return {
    points,
    status: overlap === 2 ? 'ok' : 'demi_equipe_1',
    overlap,
    detail,
    realQualified
  };
}

/**
 * Calcule le score complet d'un participant : détail match par match + total.
 *
 * @param {Object} participant - { groupPredictions, groupRanking, knockoutPredictions }
 * @param {Array} allMatches - data/matches.json fusionné avec les scores live
 * @param {Object} standings - computeGroupStandings()
 * @param {Object} best3rd - computeBest3rd()
 * @param {Map} resolvedBracket - resolveBracket()
 * @param {Object} config - data/config.json
 */
function computeParticipantScore(participant, allMatches, standings, best3rd, resolvedBracket, config) {
  const details = [];
  let total = 0;

  for (const match of allMatches.filter(m => m.group)) {
    const pred = participant.groupPredictions ? participant.groupPredictions[match.id] : null;
    const res = scoreGroupMatch(pred, match, config.groupe);
    total += res.points;
    details.push({
      matchId: match.id,
      phase: 'groupe',
      group: match.group,
      team1: match.team1,
      team2: match.team2,
      date: match.date,
      pred: pred || null,
      real: { score1: match.score1, score2: match.score2 },
      matchStatus: getMatchStatus(match.date, match.score1, match.score2),
      ...res
    });
  }

  for (const group of Object.keys(standings)) {
    const pred = participant.groupRanking ? participant.groupRanking[group] : null;
    const res = scoreGroupRanking(pred, standings[group], best3rd, config.groupRanking);
    total += res.points;
    details.push({
      phase: 'classement_groupe',
      group,
      pred: pred || null,
      real: standings[group].complete
        ? {
            first: standings[group].teams[0]?.team,
            second: standings[group].teams[1]?.team,
            third: standings[group].teams[2]?.team
          }
        : null,
      matchStatus: standings[group].complete ? 'termine' : 'en_cours',
      ...res
    });
  }

  for (const match of allMatches.filter(m => m.group == null)) {
    const pred = participant.knockoutPredictions ? participant.knockoutPredictions[match.id] : null;
    const phase = config.roundToPhase[match.round];
    const real = resolvedBracket.get(match.id);
    const res = scoreKnockoutMatch(pred, real, config.knockout[phase]);
    total += res.points;
    details.push({
      matchId: match.id,
      phase,
      date: match.date,
      pred: pred || null,
      real: {
        team1: real?.team1Resolved || null,
        team2: real?.team2Resolved || null,
        score1: real?.score1 ?? null,
        score2: real?.score2 ?? null
      },
      matchStatus: getMatchStatus(match.date, real?.score1 ?? null, real?.score2 ?? null),
      ...res
    });
  }

  return { total, details };
}

module.exports = {
  getMatchStatus,
  scoreGroupMatch,
  scoreGroupRanking,
  scoreKnockoutMatch,
  computeParticipantScore
};
