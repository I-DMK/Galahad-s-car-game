---
description: Revue croisée Codex (et Grok si installé), code-review et security-review du travail en cours, puis tableau de tri des remarques
argument-hint: [référence git | numéro de tâche] [--full] [--fort] [--sans-debat] [focus libre]
allowed-tools: Read, Grep, Glob, Skill, Bash(node:*), Bash(git rev-parse:*), Bash(git rev-list:*), Bash(git log:*), Bash(git show:*), Bash(git diff:*), Bash(git status:*), Bash(git show-ref:*)
---

Tu organises une revue croisée du travail en cours, puis tu tries les retours. Tu n'appliques aucune correction dans cette commande : tu produis un tableau de tri et tu t'arrêtes.

Arguments bruts : `$ARGUMENTS`

## 1. Arguments

- `--full`, où qu'il soit, ajoute la revue standard (étape 3). Retire-le avant de lire le reste.
- `--fort`, où qu'il soit, lance les revues Codex avec le modèle supérieur indiqué dans `~/.claude/CLAUDE.md`, section « Revue croisée Codex ». S'il n'y figure pas, dis-le et arrête-toi. Retire-le avant de lire le reste.
- `--sans-debat`, où qu'il soit, saute le débat (étape 5). Retire-le avant de lire le reste.
- `--base <ref>` (ancienne syntaxe) vaut `<ref>` en premier argument.
- Premier argument restant :
  1. si `git rev-parse --verify --quiet "<arg>^{commit}"` réussit, c'est la base ;
  2. sinon, s'il ressemble à un numéro de tâche (nombres séparés par des points : `1.1`, `2.3`, `1.2.4`), résous-le (étape 2) ;
  3. sinon, il fait partie du focus.
- Le reste est le focus libre.

## 2. Périmètre

**Numéro de tâche**
- Lis le `CLAUDE.md` à la racine du dépôt (`git rev-parse --show-toplevel`), section `## Revue croisée`, sous-section « Résolution des tâches ». Applique la convention telle qu'elle est écrite : c'est elle qui dit quel commit sert de base.
- Affiche le commit trouvé (hash court et message) avant de lancer quoi que ce soit.
- Si la section manque, si aucun commit ne correspond, si plusieurs correspondent sans que la convention dise lequel retenir, ou si elle laisse un doute : arrête-toi et demande la base à l'utilisateur. Ne devine pas.
- Passe ensuite le hash à `--base`, jamais le numéro de tâche.

**Sans référence ni numéro**
- Branche principale : `main`, ou `master` si `main` n'existe pas.
- Si la branche courante a des commits absents de la branche principale (`git rev-list --count <principale>..HEAD` supérieur à 0) : base = branche principale.
- Sinon : changements non commités (`--scope working-tree`). S'il n'y en a aucun, dis-le et arrête-toi.

Avec une base, Codex revoit `<base>...HEAD` : les changements non commités n'en font pas partie. S'il y en a, signale-le.

**Focus** : s'il est vide, déduis-le du diff : repère le choix de conception le plus risqué (gestion d'erreurs, concurrence, modèle de données, sécurité, dépendances) et formule une question qui le remet en cause.

Résume en deux lignes le périmètre retenu (base ou non commités, commits et fichiers couverts, focus) avant de lancer quoi que ce soit.

## 3. Revues

Si des résultats de revue Codex ou Grok portant sur ce même périmètre (même base sans commit ajouté depuis, ou mêmes changements non commités) et obtenus avec le même modèle (avec ou sans `--fort`) figurent déjà dans la conversation, saute cette étape et passe directement au tri. Des résultats sur un autre périmètre ou avec un autre modèle ne comptent pas : lance les revues.

`/codex:adversarial-review` et `/codex:review` ne peuvent pas être invoquées depuis une commande (`disable-model-invocation`). Exécute directement le script qu'elles appellent :
- script : `<installPath>/scripts/codex-companion.mjs`, où `installPath` est lu dans `~/.claude/plugins/installed_plugins.json`, entrée `codex@openai-codex` (écris le chemin avec des `/`). Si l'entrée manque, dis en une ligne que le plugin Codex n'est pas installé, saute les revues Codex et le débat (étape 5), et continue avec les sièges par défaut ci-dessous ;
- outil Bash, pas PowerShell : seul Bash reçoit les variables de session du plugin, ce qui garde les tâches visibles dans `/codex:status` et `/codex:result` ;
- lance chaque revue en arrière-plan (`run_in_background`) et attends la notification de fin avant l'étape suivante : aucune limite de durée. Ne lis pas la sortie avant la notification ; ignore les lignes `DeprecationWarning` de Node.

Dans cet ordre, `<cible>` valant `--base <ref>` ou `--scope working-tree`, et `<modèle>` valant `--model <modèle supérieur>` avec `--fort`, rien sinon (l'effort vient de `~/.codex/config.toml`) :
1. Toujours : `node "<script>" adversarial-review --wait <modèle> <cible> "<focus>"` (focus entre guillemets doubles, sans `"`, `$` ni accent grave à l'intérieur).
2. Avec `--full` seulement : `node "<script>" review --wait <modèle> <cible>` (sans focus : la revue standard n'en accepte pas).
3. Si une entrée `grok-build@…` figure dans `installed_plugins.json` et que `/grok-build:check` répond prêt : `/grok-build:critique` avec la même base et le même focus. Sinon, passe sans commentaire.

**Sièges par défaut** (toujours, Codex installé ou non ; seuls sièges dans un conteneur cloud sans Codex), sur le même périmètre :
4. Skill `code-review`, niveau `high` (`max` avec `--fort`), en lui donnant la base (`<base>..HEAD`) ou les changements non commités, et le focus.
5. Skill `security-review` sur le même périmètre.

Leurs remarques entrent au tri (étape 4) avec la source `code-review` ou `security-review`.

Si une revue échoue (quota, authentification, commande non invocable), dis-le en une ligne avec l'erreur la plus parlante et continue avec les résultats disponibles. Authentification ou installation manquante : renvoie vers `/codex:setup`. Ne relance rien automatiquement.

## 4. Tri

Établis d'abord un projet de tri, que tu ne montres pas encore : il passe d'abord par le débat (étape 5).

Lis les faux positifs connus listés dans la section `## Revue croisée` du `CLAUDE.md` du projet. Une remarque qui correspond à l'un d'eux est écartée du tableau ; sous le tableau, indique seulement combien ont été écartées, à quel faux positif connu chacune renvoie et, après le débat, si Codex a confirmé la correspondance.

Regroupe les remarques de toutes les revues. Une remarque signalée par deux outils compte une fois, avec les deux sources mentionnées. Classe chacune dans ce tableau :

| # | Remarque | Source(s) | Fichier:ligne | Catégorie | Avis | Consensus |

Catégories :
- `bug` : comportement incorrect démontrable
- `risque` : choix discutable, dette, cas limite non géré
- `style` : préférence sans impact fonctionnel
- `faux positif` : le reviewer s'est trompé

Consensus, rempli par le débat (un accord exige la même catégorie et le même correctif) :
- `d'emblée` : accord dès le premier tour ;
- `tour N (Codex a cédé)`, `tour N (Claude a cédé)` ou `tour N (les deux)` : accord obtenu au tour N ;
- `désaccord` : pas d'accord après le dernier tour ; la colonne Avis donne les deux positions ;
- `interrompu` : le débat s'est arrêté sur un échec avant de trancher ce point.

Avec `--sans-debat`, ou sans Codex, retire la colonne.

Règles :
- Pour un `faux positif`, cite l'élément concret du code qui contredit la remarque. Pas de rejet sans preuve.
- Les remarques qui visent un choix que tu as toi-même fait plus tôt dans la session reçoivent la même rigueur : tu justifies ou tu reconnais.
- Pour `bug` et `risque`, indique en une ligne ce que tu ferais, sans le faire.

## 5. Débat

Sauf avec `--sans-debat` ou sans Codex, soumets le projet de tri à Codex et itère jusqu'au consensus avant de répondre. Saute le débat s'il n'y a ni remarque dans le tableau ni faux positif connu écarté, ou si un débat a déjà abouti dans la conversation sur ce périmètre et avec ce modèle : reprends alors ses résultats.

Message à Codex : écris-le dans un fichier temporaire hors du dépôt (le dossier scratchpad de la session, chemin écrit avec des `/`), en blocs XML :
- `<task>` : le périmètre avec la base, pour que Codex relise le diff lui-même ; chaque remarque du tableau (`#n`) avec sa source, ta catégorie, ton correctif en une ligne et ta preuve `fichier:ligne` ; chaque remarque écartée (`FPn`) avec le faux positif connu invoqué, dont Codex juge seulement la correspondance, pas la règle ;
- `<grounding_rules>` : ne s'appuyer que sur le code et le diff ; maintenir sa position est acceptable ; ne céder que devant une preuve ;
- `<structured_output_contract>` : une ligne par point, sans autre texte :
  - `#n | accord | justification`
  - `#n | désaccord | catégorie et/ou correctif proposés | preuve fichier:ligne`
  - `FPn | correspond` ou `FPn | ne correspond pas | preuve fichier:ligne`
  - `nouveau | remarque | fichier:ligne | preuve`, seulement pour un bug grave.

Lancement :
- premier tour : `node "<script>" task <modèle> --prompt-file "<fichier>"`, `<script>` et `<modèle>` valant la même chose qu'aux revues ;
- tours suivants : la même commande avec `--resume-last`, avec un nouveau fichier qui ne contient que les points encore ouverts et tes nouveaux arguments. Repasse `<modèle>` à chaque tour : une reprise sans `--model` ne garde pas forcément le modèle ;
- jamais `--write` (le débat reste en lecture seule), `--wait` (`task` ne le reconnaît pas) ni `--effort` (la config s'applique) ;
- comme les revues : outil Bash, arrière-plan, attente de la notification avant de lire la sortie.

Entre deux tours :
- Revérifie chaque point contesté dans le code. Tu changes d'avis devant une preuve, jamais parce que Codex insiste. Un consensus de complaisance est pire qu'un désaccord assumé.
- Un `FPn` contesté : si tu admets qu'il ne correspond pas, la remarque entre au tableau et suit le débat ; sinon il reste ouvert. À la fin, un `FPn` toujours contesté figure au tableau en `désaccord`.
- Une remarque `nouveau` entre au tableau avec la source « Codex (débat) » ; vérifie-la comme les autres. Si tu la contestes, elle suit le débat.

Arrête dès que tous les points sont en accord, ou après le troisième tour de Codex ; tu peux encore céder après ce dernier tour. Ce qui reste est un désaccord persistant.

Une ligne de suivi par tour (« Tour 1 : Codex conteste 2 points sur 5 »), rien d'autre avant la réponse finale. Si un tour échoue, donne le tri tel qu'il est, avec « débat interrompu au tour N » sous le tableau.

## 6. Fin

Termine par les trois remarques que tu traiterais en priorité et demande à l'utilisateur lesquelles appliquer. N'applique rien avant sa réponse.

Si les revues ont tourné sans `--fort`, recommande en une ligne, avec sa raison, une contre-revue critique avec `--fort` dans trois cas seulement : une remarque reste incertaine (ni le code ni le diff ne permettent de la confirmer ou de l'écarter), le diff touche une zone sensible (sécurité, perte de données, concurrence, migration) et la revue n'y a rien trouvé, ou un désaccord persiste après le débat. Ne la lance pas sans accord : elle consomme davantage de quota.
