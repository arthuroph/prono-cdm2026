# Prono Coupe du Monde 2026 📱⚽

Application web (PWA) installable sur iPhone qui affiche, pour chaque participant :
- ses pronostics match par match,
- les scores réels (mis à jour automatiquement),
- les points gagnés selon le barème,
- le classement général.

Chaque participant a un **code personnel** pour voir ses propres pronos/points. Le classement général (noms + total) est visible par tous, sans code.

---

## 1. Pronostics de chacun

Tous les pronostics des 17 grilles (`Recap participants.xlsx`) ont été importés dans `data/predictions.json` : scores de phase de groupes (72 matchs), classements de groupe (A à L) et pronos de phases finales (matchs 73 à 104).

⚠️ **Arthur Lv** (Arthur Levy) n'a pas rempli sa grille pour les phases finales — ses pronos de phase de groupes/classements sont là, mais `knockoutPredictions` est vide pour lui. Il peut compléter plus tard en éditant `data/predictions.json` (voir structure ci-dessous).

⚠️ **Arthur O2** correspond à la 2e grille remplie sous le nom "Arthur Ophele" (numéro de grille 2) — à renommer si elle correspond en fait à quelqu'un d'autre.

Pour chaque participant, le fichier contient :

```json
{
  "code": "ARTHUR4388",
  "name": "Arthur O",
  "groupPredictions": {
    "1": { "score1": 2, "score2": 0 }
  },
  "groupRanking": {
    "A": { "first": "Mexico", "second": "South Korea", "thirdQualified": "Czech Republic" }
  },
  "knockoutPredictions": {
    "73": { "team1": "South Korea", "team2": "Canada", "score1": 1, "score2": 0, "qualified": "South Korea" }
  }
}
```

- **`groupPredictions`** : clé = numéro du match (voir `data/matches.json`, champ `id`), valeur = score prédit (`score1` = équipe `team1`, `score2` = équipe `team2`).
- **`groupRanking`** : clé = lettre du groupe (A à L), avec le pays pronostiqué 1er, 2e, et "meilleur 3e qualifié".
- **`knockoutPredictions`** : clé = numéro du match à élimination directe (73 à 104). `team1`/`team2` = les deux équipes pronostiquées (pas forcément connues à l'avance), `score1`/`score2` = score prédit à 90 min, `qualified` = équipe pronostiquée qualifiée (en cas d'égalité, ce champ tranche).

Les noms d'équipes doivent être en anglais, exactement comme dans `data/teams_fr.json` (clé de gauche), par ex. `"South Korea"`, `"Czech Republic"`, `"Bosnia & Herzegovina"`, `"USA"`, etc. — c'est ce fichier qui gère la traduction en français + drapeaux pour l'affichage.

💡 Le plus simple : demander à chaque ami ses pronos (Excel, message...), puis je peux t'aider à les convertir et compléter `predictions.json` d'un coup avant le déploiement.

---

## 2. Codes d'accès personnels

| Participant | Code d'accès |
|---|---|
| Arthur O (toi) | `ARTHUR4388` |
| Arthur O2 | `ARTHURO27634` |
| Arthur C | `ARTHUR7097` |
| Arthur L | `ARTHUR1383` |
| Arthur Lv | `ARTLEVY9215` |
| Camille O | `CAMILL6041` |
| Gautier M | `GAUTIE1386` |
| Gregoire H | `GREGOI8583` |
| Marin B | `MARINB2713` |
| Maxime P | `MAXIME2334` |
| Olivier O | `OLIVIE5280` |
| Pablo | `PABLO1228` |
| Paul J | `PAULJ1459` |
| Paul O | `PAULO5643` |
| Thibault C | `THIBAC3382` |
| Thibault R | `THIBAR7720` |
| Valens K | `VALENS4459` |

Chaque code est insensible à la casse. À envoyer à chaque participant individuellement (ex: par message privé).

---

## 3. Tester en local (optionnel)

```bash
cd prono-app
npm install
npm test        # vérifie le moteur de points (11 tests)
npm start        # lance le serveur sur http://localhost:3000
```

---

## 4. Déployer sur Render.com (gratuit)

Render propose un hébergement gratuit pour les apps Node.js. Le plan gratuit "endort" l'app après 15 min d'inactivité (premier chargement un peu plus lent ensuite), ce qui est suffisant pour un usage entre amis.

### Étape 1 — Mettre le projet sur GitHub
1. Crée un compte GitHub si besoin (https://github.com).
2. Crée un nouveau repository (peut être privé), par ex. `prono-cdm2026`.
3. Mets-y tout le contenu du dossier `prono-app/` (glisser-déposer sur GitHub, ou via `git push` si tu es à l'aise avec git).

### Étape 2 — Créer le service sur Render
1. Va sur https://render.com et crée un compte (tu peux te connecter avec GitHub directement).
2. Clique sur **New +** → **Web Service**.
3. Connecte ton repository `prono-cdm2026`.
4. Configuration :
   - **Name** : `prono-cdm2026` (ou ce que tu veux — ça donnera l'URL `https://prono-cdm2026.onrender.com`)
   - **Region** : Frankfurt (le plus proche de la France)
   - **Branch** : `main`
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free
5. Clique **Create Web Service**. Le déploiement prend 1-2 minutes.
6. Une fois déployé, ton appli est accessible à l'URL fournie par Render (ex: `https://prono-cdm2026.onrender.com`).

### Mettre à jour l'appli plus tard
Si tu modifies des fichiers (par ex. `predictions.json` pour corriger un prono, ou `overrides.json`), il suffit de pousser les changements sur GitHub : Render redéploie automatiquement.

---

## 5. Installer sur iPhone (écran d'accueil)

À partager avec tous les participants :

1. Ouvrir le lien de l'appli dans **Safari** (important : pas Chrome, pour l'icône PWA sur iPhone).
2. Appuyer sur le bouton **Partager** (carré avec flèche vers le haut).
3. Choisir **"Sur l'écran d'accueil"**.
4. Valider — l'icône ⚽ apparaît sur l'écran d'accueil, et l'appli s'ouvre en plein écran comme une vraie app.

Une fois le code entré, il est mémorisé sur l'appareil (pas besoin de le retaper).

---

## 6. Scores en direct

Les scores réels viennent automatiquement d'une source publique (openfootball, données officielles FIFA), rafraîchie toutes les **5 minutes**. Un bouton "↻ Actualiser" en haut de l'appli permet de forcer une mise à jour immédiate.

### Corrections manuelles (`data/overrides.json`)
Si un score est faux/manquant, ou pour préciser l'équipe qualifiée après une séance de tirs au sort (la source automatique ne donne que le score à 90 min), tu peux ajouter une correction manuelle dans `data/overrides.json` :

```json
{
  "73": { "score1": 1, "score2": 1, "qualified": "Canada" }
}
```

La clé est le numéro du match (`id` dans `data/matches.json`). Après modif, redéploie (ou redémarre le serveur en local).

⚠️ **Important — phases finales** : les matchs à élimination directe (16es à finale) référencent des "places" comme *1er du groupe A* ou *vainqueur du match 74*. Ces places se résolvent automatiquement au fur et à mesure que les résultats des groupes/tours précédents sont connus. Le calcul du "meilleur 3e" est une approximation simplifiée (la FIFA utilise une grille officielle à 495 combinaisons) — à vérifier/ajuster manuellement via `overrides.json` si besoin une fois les groupes terminés.

---

## 7. Barème de points (rappel)

- **Phase de groupes** : résultat correct = 3 pts, écart de buts correct = 5 pts (total), score exact = 7 pts (total)
- **Classement de groupe** : 1er = +4, 2e = +3, meilleur 3e qualifié = +2
- **Phases finales** (qualifié / bonus score exact / bonus écart / max) :
  - 16es : 5 / 4 / 2 / 9
  - 8es : 8 / 5 / 2 / 13
  - Quarts : 12 / 6 / 3 / 18
  - Demi-finales : 18 / 7 / 3 / 25
  - Petite finale : 8 / 4 / 2 / 12
  - Finale : 30 / 8 / 4 / 38
- **Règle "demi-équipe"** (phases finales) : si tu as prédit les 2 bonnes équipes du match → 100% des points ; 1 seule bonne équipe → 50% (arrondi au 0,5 supérieur) ; 0 bonne équipe → 0 pt.

---

## Structure du projet

```
prono-app/
├── server.js              # serveur Express (API + fichiers statiques)
├── lib/
│   ├── scoring.js          # moteur de calcul des points
│   ├── standings.js         # classement des groupes
│   ├── bracket.js            # résolution du tableau final
│   └── liveData.js            # récupération des scores en direct
├── data/
│   ├── matches.json        # calendrier des 104 matchs
│   ├── teams_fr.json        # noms FR + drapeaux des équipes
│   ├── config.json           # barème de points
│   ├── predictions.json     # pronos + codes d'accès de chaque participant
│   └── overrides.json        # corrections manuelles de scores
├── public/                  # frontend PWA (HTML/CSS/JS)
└── scripts/test_scoring.js  # tests du moteur de points
```
