# Veille ParlIA — la séance de la semaine, préparée par le bot

Mise à jour du 18 novembre 2026. Le workflow « Veille ParlIA » (`VeilleParlIAprod`, 39 nœuds) prépare chaque
semaine la séance de veille du projet ParlIA : Louis la tient pour l'épreuve E2 de sa certification (une heure de
veille par semaine, une note datée par séance). Le bot collecte, trie, lit l'original des fiches retenues et
prépare ; Louis lit les originaux, classe chaque point (rien, à surveiller, décision à ouvrir) et écrit la note.
Le code est dans `workflows/src-parlia/`,
assemblé par `workflows/build_parlia.py`. Le workflow a sa propre mémoire : la veille personnelle (v2 en service,
v3) ne change pas.

**État** : en service depuis le 4 novembre 2026 (préparations des semaines 45 à 47). Le 13 novembre, la lecture des
originaux de la semaine 46 a corrigé huit fiches sur dix : une consigne qui croyait ParlIA équipé de modèles de
décision, des lignes de tableau lues sans leurs en-têtes, des dates de collecte prises pour des dates de
publication, une échéance repoussée par sa source et restée à l'ancienne date. La version du 16 novembre 2026
corrige ces défauts, lit l'original des fiches retenues, en propose 8 au plus, suit Mistral Large 4, Kev et Zuse,
montre ce que chaque source a apporté aux séances et contrôle les hypothèses. Vérifiée par `npm test` (182 tests),
par un rejeu de la semaine 46 et par un essai complet dans n8n (section « Les essais du 16 novembre 2026 »), elle est
en service depuis le 16 novembre 2026. Le 18 novembre, la séance 04 a relevé trois erreurs de la semaine 47 : deux
annonces d'octobre présentées comme nouvelles (fiche 3), une hausse de prix qui n'existait pas (fiche 5), la
Decisions API de Google proposée deux fois (fiches 1 et 6). La version du 18 novembre 2026 les corrige, prend la
nature d'une source dans la liste des sources, relit arXiv sur 14 jours et prépare la matière de la synthèse
mensuelle. Vérifiée par `npm test` (200 tests) et rejouée sur la mémoire du bot et sur les vraies pages, elle est
en service depuis le 18 novembre 2026, sur n8n 2.48.5 (section « La mise à jour de n8n, le 18 novembre 2026 »).

Thème : « Étiqueter les questions écrites du Sénat avec un modèle de langage commercial : choisir, mesurer et pouvoir
remplacer le fournisseur, dans le respect du RGPD et du règlement européen sur l'IA. » Quatre axes : fournisseurs et
coûts, qualité de l'étiquetage, conformité, exploitation.

## Ce que fait le circuit

~~~text
Toutes les 30 min, de 7 h 15 à 22 h 45, quand le Mac est allumé
  └─ Que faire ? (planifier-parlia.js) : chaque tâche part au premier passage après son heure, une seule fois
      ├─ Collecte : au plus toutes les 4 h, et juste avant la préparation
      │    18 flux RSS ; une fois par jour, 12 pages sans flux et 4 API (OpenRouter, data.gouv.fr, Hugging Face)
      │    → Normaliser : tout ce qui est paru depuis la dernière collecte réussie, sans doublon, santé des sources
      │    → Tri par Mistral Small 3.2, par lots de 12 → Lire le tri : contrôles, plafonds, tri de secours
      │    → Registre (16 jours)
      │    → Journal officiel (archives de la DILA) → Alertes immédiates → Discord
      ├─ Notes de séance et préparations déjà écrites : relues sans écriture, avant la préparation ou le rappel
      ├─ Préparation : au premier passage à partir du lundi 6 h, 8 fiches au plus, sans minimum
      │    → Originaux : l'original de chaque fiche, lu, puis résumé par le modèle choisi, une demande par fiche
      │    → fichier AAAA-MM-JJ-preparation.md → Discord : ouverture, fiches guidées, réserve
      ├─ Rappel : au premier passage à partir du jeudi 16 h 30, si les notes ne montrent pas la séance de la semaine
      └─ Statut → #status, en silence sauf problème
~~~

Le Mac dort souvent : rien n'a d'heure fixe. Mac éteint le lundi, la préparation part au premier réveil, jusqu'au
dimanche ; la collecte reprend tout ce qui est paru depuis la dernière collecte réussie (14 jours au plus). Pour
arXiv, elle relit toujours les 14 derniers jours : une étude porte la date de son dépôt, et arXiv ne la montre
qu'à son annonce, un à quatre jours plus tard. Avec une fenêtre de 48 heures, le bot avait manqué 32 des 50
dernières études de la requête des modèles de décision, dont « Is Jev a Good Multilingual Judge? » (vérifié le
18 novembre 2026). Un flux en erreur est relu deux fois, 5 secondes plus tard : les trois requêtes d'arXiv se
suivent, et l'API, qui demande trois secondes entre deux demandes, répondait parfois 429.

### Les sources

Les 32 sources « à retenir » de l'étude des sources du 29 octobre 2026 (§4.1), plus un détecteur à l'essai.

| Fichier | Ce qu'il lit |
|---|---|
| `sources-parlia.js` | 18 flux : journal d'OpenRouter ; OpenAI (filtré sur l'API) ; notes de version d'Anthropic ; Mistral ; Google « Developer tools » ; Simon Willison (filtré) ; journal de Workers AI (Cloudflare) ; trois requêtes arXiv ciblées (étiquetage par modèle de langage, modèles de décision et calibration, textes parlementaires ou administratifs) ; Hamel Husain ; Hugging Face (filtré) ; CNIL ; CEPD (son flux en français : l'anglais répond « Sorry » depuis la mise en service) ; Commission européenne (filtrée sur l'IA) ; dossier de la loi DDADUE au Sénat ; data.senat.fr. Les communiqués de l'Élysée ne sont jamais triés : ils servent de détecteur de remaniement de secours |
| `collecte-pages-api.js` | Une fois par jour : 12 pages sans flux (journaux et pages de retraits d'OpenAI, d'Anthropic, de Mistral et de Google ; blog et page des modèles de TypeSafe ; Liquid AI ; service d'assistance et Bureau de l'IA de la Commission ; dossier DDADUE à l'Assemblée), le catalogue d'OpenRouter, la fiche data.gouv.fr des questions du Sénat, les comptes Hugging Face de Cloudflare et de Perplexity |
| `jorf-parlia.js` | Les archives quotidiennes du Journal officiel, deux par jour |
| `lecture-pages.js` | Le découpage d'une page en lignes (paragraphes, éléments de liste, rangées de tableau avec leurs en-têtes), en HTML ou en Markdown ; commun aux nœuds qui lisent des pages, ajouté en tête de leur code par le builder |

Une page sans flux est comparée à celle de la veille : les lignes nouvelles qui se suivent forment un article. Le
premier passage apprend la page sans rien proposer ; une page qui perd plus de 70 % de ses lignes est une panne, une
page dont plus de 40 % des lignes changent a été refaite et n'est pas proposée. Une ligne, c'est un paragraphe, un
élément de liste, ou une rangée de tableau dont chaque cellule est précédée de l'en-tête de sa colonne :
« Shutdown date : Dec 1, 2026 · Affected model : chatgpt-image-latest · Status : Deprecated · Recommended
replacement : gpt-image-2.6-sunburst or gpt-image-2.6-flare · Notice date : Jun 2, 2026 ». Sans les en-têtes, le tri
avait annoncé l'arrêt des remplaçants (fiche 4 de la semaine 46). Le même découpage lit les tableaux Markdown de
Gemini et garde le nom des modèles d'Anthropic, écrit dans un bouton. Depuis ce changement (15 novembre 2026),
chaque page est réapprise une fois, sans rien proposer. Sur la page des retraits d'OpenAI et dans les billets de
retraits du journal de Workers AI (Cloudflare), et depuis le 16 novembre 2026 sur la page des retraits de Gemini, le
bot ne garde que les lignes des modèles de texte : une ligne qui ne nomme que des modèles d'image, de son, de vidéo,
de musique, de plongements, de modération ou de robotique n'entre dans aucun article ni dans aucun original lu, ni
la section entière d'un intertitre qui ne nomme qu'eux (54 lignes sur 133 chez Gemini) ; une ligne qui nomme un modèle
suivi est toujours gardée (`PARLIA.RETRAITS_TEXTE`, `ligneHorsTexte` et `lignesHorsTexte`, dans `outils.js`, depuis le
16 novembre 2026). Un billet de retraits de Cloudflare dont le titre ne nomme que ces modèles-là n'est pas trié.
La documentation de TypeSafe répond en Markdown aux programmes : sa page des modèles est lue dans sa version
Markdown (`models.md`), comme les pages Gemini, et toute réponse sans HTML est lue comme du Markdown (`estHtml`).
Le catalogue d'OpenRouter donne les nouveaux modèles des fournisseurs du thème et, pour la liste de suivi (GPT-6
Luna, Claude Haiku 5.5, Mistral Small 3.2, GPT-4o mini, GPT-6.1 Terra, Gemini 4 Argon et, depuis le 16 novembre
2026, Mistral Large 4), les changements de prix, les retraits annoncés et les disparitions : ces drapeaux sont
calculés par le programme, le tri ne peut pas les oublier. Les prix suivis sont ceux des offres de l'éditeur du
modèle chez OpenRouter (pour GPT-6 Luna, les offres « flex », normale et « fast » d'OpenAI) et celui de l'offre la
moins chère parmi tous ses hébergeurs (API « endpoints » d'OpenRouter) ; pas le prix « par défaut » du catalogue,
qui suit un seul hébergeur : celui de Mistral Small 3.2 était passé de 0,075 $ à 0,10 $ le 10 novembre 2026 avant de
revenir le 18, sans qu'aucun hébergeur change le sien (fiche 5 de la semaine 47, « hausse du prix »). Un nouveau
prix n'est signalé que s'il se voit à deux lectures de suite, un jour d'écart : un hébergeur absent un jour ne fait
pas une hausse, et le prix d'un autre hébergeur, plus cher, ne compte pas. Des offres illisibles sont comptées dans
#status, et la comparaison attend la lecture suivante (depuis le 18 novembre 2026). Les modèles de décision suivis
(Jev, Kev, Clef, Zuse, d1, Decider) sont reconnus par leur nom dans les titres et les extraits (`NOMS_SUIVIS`) ; un nom prolongé en modèle de
voix ou d'image n'est pas celui d'un modèle suivi : le retrait de gpt-4o-mini-tts ne sonne pas comme celui de
gpt-4o-mini (`nomsSuivisDans`, dans `outils.js`, depuis le 16 novembre 2026).

Les dates :

- la date d'un article est celle que donne sa source ; sans elle, l'article n'en reçoit pas (« date inconnue »), et
  le jour où le bot l'a vu est gardé à part. Le billet de TypeSafe du 3 novembre 2026, vu le 5 sur la page du blog,
  portait le 5 (fiche 1 de la semaine 46) ;
- sur une page sans flux, la date d'un bloc est sa première date déjà passée, sinon celle de son intertitre : une
  date à venir est une date d'effet (un arrêt annoncé), et une date collée à un nom de modèle
  (« gpt-image-2-2026-04-21 ») n'est pas une date ;
- sur une page sans flux, un bloc nouveau dont toutes les dates ont plus de 14 jours n'est pas proposé : une page
  remaniée, ou une ancienne annonce remontée. Le 16 novembre 2026, la page de Liquid AI avait fait proposer
  « Introducing LFM3 » et d1-ultra, annoncés les 27 et 15 octobre (fiche 3 de la semaine 47). Un bloc sans date, ou
  avec une date récente ou à venir (un arrêt annoncé), reste ; #status compte les blocs écartés (18 novembre 2026) ;
- un candidat publié avant le premier jour de la période lue est signalé : un article ancien, ou la mise à jour
  d'un avis ancien. Une étude d'arXiv déposée avant la période ne l'est pas : la fiche dit le jour où le bot l'a vue ;
- une étude d'arXiv est reconnue sans son numéro de version : sa version 2 n'est pas un nouvel article (les adresses
  déjà vues avant le 18 novembre 2026 sont réécrites sans lui) ;
- une échéance relevée garde la clé et l'empreinte du texte de son article. Si la source change ce texte, l'article
  est trié de nouveau, même ancien : une autre date remplace l'ancienne, rappelée dans la préparation (« c'était le
  15 novembre »), et l'article revient parmi les candidats. Cloudflare avait repoussé du 15 au 20 novembre l'arrêt
  de la fiche 3 de la semaine 46 sans que la préparation le voie. Une échéance relevée sur une page sans flux dont
  les lignes disparaissent est signalée comme changée ou retirée par la source, à vérifier.

### Le tri

La consigne (`consigne-tri-parlia.js`) est celle de l'étude (§5.2), dans sa version du 16 novembre 2026
(`VERSION` : « sources.md 5.2 du 16 novembre 2026 »). L'état du projet y forme un bloc à part, `ETAT_DU_PROJET`,
écrit sans date : ParlIA n'utilise aucun service du marché, le comparatif n'a pas commencé, et la Decisions API, Jev,
Kev, Clef, Zuse et d1, avec les modèles de langage de la liste de suivi, dont Mistral Large 4, sont des candidats à
l'étude. C'est ce bloc qu'on met à jour quand le projet avance, en changeant
`VERSION` en même temps. Suivent le thème et ses axes, le lien concret avec ParlIA (sans lien : l'axe « hors_theme »
et l'hypothèse « rien »), un barème de pertinence sur 10, des plafonds, la lecture d'une ligne de tableau de retraits
(le modèle arrêté, puis son remplaçant), cinq exemples, la liste de suivi. La version du 29 octobre disait que Louis
comparait des services le 8 novembre : le tri en concluait que ParlIA les utilisait (préparation de la semaine 46).

Pour chaque article, Mistral Small 3.2 propose un axe, une note, une hypothèse au conditionnel (« ce que ça pourrait
changer pour ParlIA »), la nature de la source, un résumé de deux lignes, ce qu'il faut chercher dans l'original,
quatre drapeaux et une date d'effet.

Le programme vérifie ce qu'il vérifie mieux que le modèle (`lire-tri-parlia.js`, §5.3) :

- un axe ou une nature hors des listes, ou une note qui n'est pas un entier de 0 à 10 : la proposition est
  rejetée, et l'article reçoit un tri de secours, marqué comme tel ;
- les plafonds : 6 pour une source non primaire, 8 pour une prépublication arXiv, 2 pour une annonce d'éditeur
  publiée hors de son domaine officiel (un site qui imite TypeSafe, par exemple) ;
- la nature d'une source et son caractère primaire viennent de la liste des sources, pas du modèle : le
  16 novembre 2026, il avait classé le journal de l'API Gemini, écrit par Google, « agrégateur, non primaire »
  (fiche 6 de la semaine 47), ce qui plafonnait sa note à 6 et le marquait « à recouper » ;
- les drapeaux calculés par le programme l'emportent sur ceux du modèle ;
- l'hypothèse : celle qui dit ParlIA équipé d'un service du marché (« les services d'OpenAI utilisés par ParlIA »),
  ou qui prête un retrait à un modèle suivi que le titre et l'extrait ne nomment pas, est écartée, et la fiche dit
  pourquoi (`hypotheseFautive`, dans `outils.js`). Une supposition (« s'il entrait au comparatif », « si ParlIA
  utilisait ») reste, comme un modèle cité en exemple. Sur 291 hypothèses réelles (essais du 16 novembre 2026,
  mémoire du bot), le contrôle en écarte 11, toutes à raison ;
- la réponse brute et la version de la consigne sont gardées avec l'article, pour pouvoir rejouer le tri.

Coût : environ 85 articles par semaine, une dizaine de demandes, moins de 5 centimes de dollar par mois.
Chaque article arrive au tri avec un extrait de 1 200 caractères au plus (600 jusqu'au 15 novembre 2026 : les
résumés d'arXiv étaient coupés au milieu, comme celui de la fiche 9 de la semaine 46).

### La sélection

`selection-parlia.js` applique les règles de l'étude (§6.2) aux articles triés depuis la dernière préparation :

1. toujours un texte de la CNIL ou du CEPD, rappelé sur sa ligne même s'il est noté bas ; il ne devient une fiche
   que s'il est noté 6 ou plus ;
2. toujours les drapeaux vérifiés : retrait ou prix d'un modèle suivi, nouveau modèle de décision annoncé par une
   source primaire, échéance réglementaire avant le 31 janvier 2027 ;
3. les notes de 6 ou plus, par ordre décroissant, 8 fiches au plus et sans minimum : une semaine calme en donne
   moins ;
4. au plus 5 fiches par axe, sans minimum par axe ;
5. au plus 3 prépublications arXiv et 2 articles d'une même source ; une prépublication dont le titre commence par le
   nom d'un modèle suivi, suivi d'un deux-points, présente ce modèle lui-même (« Zuse: A Decision Model for European
   Languages ») et ne compte dans aucun de ces deux plafonds (16 novembre 2026 : au rejeu de la semaine 46, ils
   laissaient Zuse en réserve). Une étude sur un modèle suivi (« Is Jev a Good Multilingual Judge? ») y compte ;
6. un événement, une ligne : la source primaire en tête, « couvert aussi par » ensuite. Deux articles sont un même
   événement s'ils ont la même adresse ou des titres proches ; ou, depuis le 18 novembre 2026, s'ils viennent de deux
   sources d'un même éditeur (le blog de Google, le journal de l'API Gemini, le catalogue d'OpenRouter pour un
   modèle de Google), publiés à un jour près, et nomment le même produit : deux mots du titre de l'un dans le titre
   ou le résumé de l'autre, hors nom de l'éditeur et mots des annonces, un même numéro de version comptant pour un
   mot. La semaine 47 avait proposé deux fois la Decisions API de Google (fiches 1 et 6). Deux numéros de version
   différents (« Gemini Omni 1.1 Flash », « Gemini Omni 1.2 Flash ») restent deux événements. Le drapeau de prix ou
   de retrait d'un événement ne compte pour la règle 2 que sur un article qui nomme lui-même le modèle suivi ;
7. les points « à surveiller » de la dernière séance reviennent en tête, hors quota (lus dans les notes, voir plus
   bas) ;
8. hors thème : jamais.

Le reste, noté 4 ou plus, va dans la réserve. Jusqu'au 16 novembre 2026, la sélection proposait de 10 à 15 fiches :
elle complétait avec des notes de 5 et forçait deux fiches par axe. Les échéances des 90 jours suivants (retraits de
modèles, dates du règlement IA) sont rappelées en pied de préparation, avec l'ancienne date quand la source l'a
changée ; celles que la source a changées ou retirées sans date lisible sont mises à part, à vérifier.

### La lecture des originaux

Avant d'écrire la préparation, le bot lit l'original de chaque fiche retenue, 8 au plus par semaine
(`originaux-parlia.js`), puis un modèle en écrit le résumé (`resumes-parlia.js`). Le tri ne voit que le titre et un
extrait ; la lecture des originaux de la semaine 46 avait corrigé huit fiches sur dix.

- **Ce qui est lu** : pour une prépublication d'arXiv, le résumé de l'étude, par l'API d'arXiv (l'article entier
  est un PDF), toutes les études de la semaine en une seule demande, refaite une fois après une erreur 429 ou 503 ;
  pour une page sans flux, la partie de la page où se trouve le bloc retenu, avec son intertitre et
  les en-têtes du tableau, la ligne retenue marquée ; pour la page d'un blog qui liste ses billets, le billet
  lui-même, retrouvé par le lien qui porte son titre (le blog de TypeSafe ne date pas ses billets, le billet, si) ;
  pour un dépôt Hugging Face, sa fiche (README), sans son en-tête : la page du dépôt n'a pas de texte lisible pour
  un programme ; pour les autres, la page de l'article (`<article>`, sinon `<main>`), 12 000 caractères au plus.
- **Une page qui a changé** depuis la collecte (OpenAI a refait sa page des retraits entre le 6 et le 15 novembre
  2026) : le bloc est cherché par le nom de modèle le plus long de son titre (« gpt-5.5-cyber »), et la fiche le dit.
- **Ce qui n'est pas lu, et pourquoi** : Légifrance et l'aide d'OpenAI refusent les programmes (erreur 403) ; une
  page introuvable ou trop lente ; un original en PDF (un avis, des lignes directrices), que le bot ne sait pas lire ;
  le catalogue d'OpenRouter, dont les chiffres sont relevés par le programme (« sans objet »). La fiche le dit, et
  garde le résumé du tri.
- **Le résumé** : une demande par original, une après l'autre, au modèle choisi (`MODEL_RESUMES` dans
  `build_parlia.py`, Mistral Small 3.2 en secours s'il en est un autre). La demande reprend l'état du projet (le
  même bloc que la consigne du tri : `PARLIA.ETAT_DU_PROJET`, dans `outils.js`), la proposition du tri et le texte
  lu ; le modèle rend le résumé, ce qu'il faut encore chercher, l'hypothèse (« rien » sans lien concret), s'il est
  hors thème, les dates de publication et d'effet, et ce que l'original contredit dans le tri.
- **Les contrôles** : une erreur ou une réponse illisible, et la fiche garde le résumé du tri, avec le motif ; le
  résumé du tri reste à côté de celui de l'original. Une date de publication trouvée date la fiche (et la signale si
  elle précède la période lue) ; une autre date d'effet met à jour l'échéance, qui garde l'ancienne.
  L'hypothèse tirée de l'original passe le même contrôle que celle du tri, contre le texte de l'original.
- **Coût** : 8 demandes par semaine au plus, de 1 200 à 4 500 jetons chacune (21 000 environ pour les dix fiches
  de la semaine 46) : moins d'un centime de dollar par semaine avec Mistral Small 3.2.

### Le fichier de préparation

`preparation-parlia.js` écrit `AAAA-MM-JJ-preparation.md`, à la date du jour, dans le dossier monté sur
`/home/node/.n8n-files/parlia`. Il suit la partie « Préparation » des notes de séance, pour que l'assistant puisse
la reprendre telle quelle :

- en tête, « Depuis la dernière séance » : la dernière séance tenue, celle de la semaine précédente, ses points
  « à surveiller » et la piste notée ;
- « Sources interrogées », « Candidats, par axe » en tableaux, « Ce qui n'a pas pu être vérifié » ;
- les fiches guidées : l'original, lu ou non (et pourquoi) ; deux lignes, d'après l'original quand il a été lu ; ce
  qu'il faut chercher dans l'original ; ce que l'original contredit dans le tri ; deux questions (« Qu'est-ce qui
  sort ? », « Est-ce que ça pourrait servir à ParlIA ? ») ; l'hypothèse ; le lien ;
- la réserve, les échéances des 90 jours, les alertes depuis la dernière préparation.
- avant « Classer en séance », les sources sur quatre semaines : une ligne par source du bot, avec les articles
  proposés aux séances tenues sur ses préparations et ceux qu'un point retenu cite (voir « Les notes de séance »).
  Le bot ne retire aucune source : Louis décide.
- la semaine du dernier mercredi du mois, après « Classer en séance », **la matière de la synthèse du mois** : les
  points classés « à surveiller » ou « décision à ouvrir » dans les notes du mois, séance par séance, avec ce qu'ils
  changent et leurs sources, tels que les notes les écrivent ; puis la régularité, semaine par semaine (la séance
  tenue, ou aucune). C'est tout ce que la synthèse peut reprendre (`GABARIT-SYNTHESE.md`) ; la séance de la
  semaine ajoute les siens, et l'assistant écrit le premier jet. Le relevé se fait sans modèle de langage : une liste
  exacte vaut mieux qu'un résumé qui pourrait inventer. L'ouverture, dans Discord, l'annonce en une ligne.

Le fichier est signé et daté : c'est le travail du bot, pas une lecture. Le bot ne commite jamais : aucun dossier
`.git` n'est monté dans le conteneur. Le fichier entre dans Git avec la note de séance, par le commit de Louis.

### Discord

Tout passe par un webhook, `DISCORD_WEBHOOK_PARLIA`. Sans lui, rien n'est publié : le fichier reste la seule trace.

- **Salon forum** (`DISCORD_PARLIA_FORUM=1`) : le message d'ouverture crée le post de la semaine
  (« Semaine 45 · du 2 au 8 novembre 2026 ») ; les fiches, la réserve et le rappel y vont. Une alerte va dans le post
  de la semaine s'il existe, sinon dans un post à elle.
- **Salon texte** (`DISCORD_PARLIA_FORUM=0`) : les messages se suivent dans le salon.
- L'ouverture notifie, avec la mention de Louis si `PARLIA_DISCORD_MENTION` est réglé : la semaine, par où
  commencer, les fiches par axe, les points « à surveiller », la piste, la CNIL et le CEPD, les échéances. Les fiches
  suivent en silence (Components V2), chacune avec un bouton « Lire l'original » ; puis la réserve, en liste de
  liens.
- Si Discord refuse l'ouverture (réseau absent au réveil, webhook supprimé), rien d'autre ne part : la préparation
  repart au passage suivant, trois fois au plus dans la semaine.
- Le bot ne lit pas Discord : un webhook publie, il ne lit rien. Les réponses de Louis sous le message de la
  semaine (« 2 décision : … », « 5 rien ») servent à la séance ; le classement se recopie dans la note.

### Les notes de séance

Le dossier des notes est monté en lecture seule. `notes-parlia.js` lit les fichiers `AAAA-MM-JJ-seance-NN.md`
et n'en tire que cinq choses.

- **Les séances tenues.** Une séance compte comme tenue quand la ligne « Date » du tableau « Séance » porte une date
  AAAA-MM-JJ déjà passée, sans repère « [À REMPLIR …] », « [À COMPLÉTER …] » ni « [EN COURS …] » : une note
  préparée à l'avance ne compte pas. Elle appartient à la semaine de sa première date : la séance 01, tenue les
  29 octobre et 2 novembre 2026, est celle de la semaine du 26 octobre.
- **Les points « à surveiller »** de la dernière séance tenue : les lignes du tableau « Ce que ça change… » dont le
  classement commence par « à surveiller », avec le titre du point retenu. Pour garder un point au-delà, la séance
  suivante le reclasse « à surveiller » dans sa propre note.
- **La « Prochaine piste »** de cette séance.
- **Les sources sur quatre semaines** (§6.2, règle 10). Pour chaque séance tenue depuis quatre semaines sur une
  préparation du bot : les fiches de cette préparation, avec leur source, et celles que citent ses points retenus
  (« (fiche 7) », « (candidat 2) », « (fiches 6 à 8) », dans la première parenthèse du point ; « séance 02,
  candidat 1 » renvoie à une autre séance et ne compte pas). La préparation est celle dont la note
  donne le lien (`preparations/2026-11-09-preparation.md`), relue dans le dossier où le bot l'a écrite (nœuds « Lire
  les préparations » et « Texte des préparations », une branche au-dessus de celle des notes) ; sans lien, la
  dernière préparation du bot des sept jours d'avant. Une séance préparée à la main n'est pas comptée : ses
  candidats ne viennent pas des sources du bot (séances 01 et 02). Le Journal officiel et l'Élysée, qui ne donnent
  que des alertes, restent hors du tableau.
- **La matière de la synthèse du mois**, la semaine du dernier mercredi du mois (le 25 novembre 2026, le
  30 décembre) : dans les séances de ce mois, les lignes du tableau « Ce que ça change… » classées « à surveiller »
  ou « décision à ouvrir », avec le titre du point retenu, l'effet et les sources : la ligne « Sources : … » du
  paragraphe du point, telle quelle, sinon les adresses qu'il cite. Un point d'une séance précédente, reclassé
  (« Séance 02, point 2 »), prend le titre et les sources du point d'origine. Une séance appartient au mois du
  mercredi de sa semaine : la séance 01, commencée le jeudi 29 octobre, est celle d'octobre.

Le rappel du jeudi ne part pas si une séance de la semaine est notée. Sans notes lisibles (dossier non monté ou
vide), il part quand même, avec « si c'est fait, ignore ce message », et le fichier demande de reprendre les points
à la main.

### Les alertes immédiates

`jorf-parlia.js` lit chaque archive nouvelle du Journal officiel, mais seulement les décrets publiés depuis
l'archive précédente : les archives republient d'anciens textes, et un filtre sur le seul titre aurait sonné 27 fois
en octobre 2026, contre aucune fois avec la date de publication (étude, §6.3).

- **Remaniement** : un décret « relatif à la composition du Gouvernement » ou « portant nomination du Premier
  ministre ». À faire : vérifier la table des ministères de ParlIA, puis attendre les décrets d'attributions.
- **Attributions** : un décret « relatif aux attributions du ministre » (de la ministre, du secrétaire d'État…).
  C'est lui qui fixe les périmètres, donc la table de correspondance de ParlIA ; en 2025, il est paru deux semaines
  après la composition.
- **Secours** : un communiqué de l'Élysée sur la nomination ou la composition du Gouvernement.
- **Retrait d'un modèle suivi** annoncé à moins de 90 jours, par le catalogue d'OpenRouter ou par un texte trié.

Les alertes d'un passage partent dans un seul message, une seule fois (120 jours de mémoire), et restent 60 jours
dans le journal que reprend le fichier de la semaine.

### La surveillance

- **#status** (`DISCORD_WEBHOOK_STATUS`, le même que la veille personnelle) : quelques lignes à chaque passage
  utile, à l'heure de Paris, en silence. Le message sonne s'il y a un problème : une source en échec trois fois de
  suite (une seule alerte, puis « de retour » au premier succès), le fichier non écrit, un envoi refusé par Discord.
  Il compte aussi les hypothèses écartées par le contrôle, au tri et dans les résumés, les blocs de pages de plus de
  14 jours écartés et les offres d'OpenRouter illisibles.
- **Plantage** : le workflow d'erreur déjà en place (`yrUX1IcjTyIwpWqG`) est désigné dans les réglages, sans
  être modifié ; il poste dans #status.
- **Mémoire** : elle n'est enregistrée qu'après une exécution réussie ; une exécution qui échoue ne perd rien, la
  suivante repart de la dernière collecte réussie.

La mémoire du workflow garde : la date de la dernière collecte, les adresses déjà vues (45 jours), la santé des
sources, le registre des articles triés (400 au plus, 16 jours), les échéances (jusqu'à 14 jours après leur date,
avec l'empreinte du texte de leur article), les empreintes des pages sans flux et leur format,
l'état du catalogue d'OpenRouter (pour chaque modèle suivi, le prix des offres suivies et celui qui attend d'être
revu), de data.gouv.fr et de Hugging Face, la dernière archive lue du Journal officiel,
les alertes envoyées et la préparation de la semaine.

## Installer

### 1. Le salon Discord et son webhook

1. Dans le serveur Discord, créer le salon `#veille-parlia` : un **forum** (un post par semaine, recommandé) ou un
   salon texte.
2. Paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL du webhook.
3. Pour la mention : activer le mode développeur (Paramètres utilisateur → Avancés), puis clic droit sur son nom →
   Copier l'identifiant de l'utilisateur.

### 2. Les variables, dans `.env`

| Variable | Valeur | Par défaut |
|---|---|---|
| `DISCORD_WEBHOOK_PARLIA` | l'URL du webhook du salon | vide : rien n'est publié |
| `DISCORD_PARLIA_FORUM` | 1 pour un forum, 0 pour un salon texte | 0 |
| `PARLIA_DISCORD_MENTION` | l'identifiant Discord à mentionner (des chiffres) | vide : aucune mention |
| `PARLIA_EXPORT_DIR` | le dossier du Mac où le bot écrit ses préparations | `./exports/veille-parlia` |
| `PARLIA_NOTES_DIR` | le dossier du Mac où sont les notes de séance | `./exports/veille-parlia-notes`, vide |
| `PARLIA_PREPARATION_JOUR`, `PARLIA_PREPARATION_HEURE` | jour (1 = lundi) et heure de la préparation | 1 et 06:00 |
| `PARLIA_RAPPEL_JOUR`, `PARLIA_RAPPEL_HEURE` | jour et heure du rappel | 4 et 16:30 |
| `PARLIA_COLLECTE_HEURES` | une collecte toutes les N heures au plus | 4 |
| `PARLIA_CANDIDATS_MAX` | le nombre maximal de fiches (aucun minimum) | 8 |

`.env` n'est pas suivi par Git : les chemins du Mac et le webhook n'entrent jamais dans le dépôt public.

### 3. Les dossiers

`docker-compose.yml` monte deux dossiers dans le conteneur, sous `~/.n8n-files`, le seul endroit où n8n 2.x lit
et écrit :

- `PARLIA_EXPORT_DIR` sur `/home/node/.n8n-files/parlia`, en écriture : les préparations ;
- `PARLIA_NOTES_DIR` sur `/home/node/.n8n-files/parlia-notes`, **en lecture seule** : les notes de séance.

Par défaut, ce sont deux dossiers du dépôt, `exports/`, ignorés par Git. Pour que la préparation apparaisse dans
Obsidian, `PARLIA_EXPORT_DIR` peut désigner le dossier `VEILLE/preparations/` du coffre de la certification, et
`PARLIA_NOTES_DIR` son dossier `VEILLE/`. Créer d'abord `preparations/` : Docker crée sans prévenir un dossier
qui manque, et une faute de frappe ferait écrire le bot ailleurs. Ne jamais monter la racine du coffre : le bot ne
doit voir ni les autres dossiers ni `.git`.

### 4. Sauvegarder, puis redémarrer n8n

Les montages et les variables ne comptent qu'après `down` puis `up` (`restart` ne relit pas `.env`). Le
redémarrage arrête quelques minutes les autres workflows, sans les modifier. Un matin de semaine, Mac allumé :

~~~bash
SAUVEGARDE="sauvegardes/$(date +%F)-avant-parlia"
docker exec veille-tech-n8n-n8n-1 n8n export:workflow --backup --output=/home/node/.n8n/export-avant-parlia/
docker compose stop                                   # SQLite : arrêter avant de copier
mkdir -p "$SAUVEGARDE" && cp -Rp n8n-data "$SAUVEGARDE/"   # la base, et le fichier config qui garde la clé des identifiants
docker compose down && docker compose up -d
~~~

### 5. Importer et publier

~~~bash
python3 workflows/build_parlia.py
docker cp workflows/veille-parlia.json veille-tech-n8n-n8n-1:/tmp/parlia.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/parlia.json
docker exec veille-tech-n8n-n8n-1 n8n publish:workflow --id=VeilleParlIAprod
docker compose down && docker compose up -d           # la publication ne compte qu'au redémarrage
docker logs veille-tech-n8n-n8n-1 2>&1 | grep -i "activated workflow"
~~~

Le workflow importé arrive non publié. Il utilise l'identifiant OpenRouter de la veille personnelle (« OpenRouter
account ») : rien à créer. Faire d'abord l'essai ci-dessous.

## Essayer en mode test

Le mode test construit un second workflow, `VeilleParlIAtest`, avec sa propre mémoire : un déclencheur manuel, tout
est dû (collecte, pages, Journal officiel, préparation, rappel), les nœuds Discord sont désactivés, le fichier
s'appelle `essai-AAAA-MM-JJ-preparation.md`. Il demande les montages de l'étape 4 : sans eux, le fichier n'est pas
écrit et les notes ne sont pas lues (le message de #status préparé le dit).

~~~bash
python3 workflows/build_parlia.py --test               # workflows/veille-parlia.test.json, ignoré par Git
docker cp workflows/veille-parlia.test.json veille-tech-n8n-n8n-1:/tmp/parlia-test.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/parlia-test.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 veille-tech-n8n-n8n-1 n8n execute --id VeilleParlIAtest
~~~

Ce qu'il faut regarder :

1. le fichier `essai-…-preparation.md` dans le dossier des préparations : la liste des candidats, les fiches, et
   « Depuis la dernière séance » si les notes sont montées ;
2. dans n8n, l'exécution « Veille ParlIA … [TEST] » : les réponses brutes du modèle (« Lire le tri »), les messages
   Discord préparés (sortie de « Préparation »), le message de #status (sortie de « Statut ») ;
3. le tri, comparé au jeu de contrôle de l'étude (§5.4) : même axe, note à un point près, mêmes drapeaux.

Un essai coûte moins d'un centime (quelques demandes à Mistral Small 3.2) et télécharge une archive du Journal
officiel (de 0,1 à 6 Mo). Il peut être relancé autant de fois que nécessaire : il ne publie rien.

## Revenir en arrière

- **Avant la publication** : rien ne tourne. Le workflow importé se supprime dans l'interface, sans effet sur les
  autres.
- **Après** : le dépublier dans l'interface (effet immédiat), ou en ligne de commande, jamais avec `--all` :

  ~~~bash
  docker exec veille-tech-n8n-n8n-1 n8n unpublish:workflow --id=VeilleParlIAprod
  docker compose down && docker compose up -d
  ~~~

- Les deux montages peuvent rester : sans le workflow, rien ne les lit ni ne les écrit. Pour les retirer, enlever
  leurs deux lignes de `docker-compose.yml`, puis `down` et `up`.
- Les fichiers déjà écrits restent dans le dossier des préparations.
- En dernier recours, la sauvegarde de l'étape 4 remet la base telle qu'elle était.

## Le premier essai dans n8n, le 4 novembre 2026

Deux essais en mode test, sur n8n 2.10.3, avant les montages vers le coffre (le fichier est allé dans `exports/`) :

- **Ce qui a marché** : 34 sources lues, 2 882 éléments, 68 triés par Mistral Small 3.2, dont 16 hors thème, 10 fiches
  et 10 en réserve ; le fichier écrit à travers OrbStack ; l'exécution en moins d'une minute.
- **Les archives du Journal officiel** arrivaient illisibles : à travers le task runner, les octets sont une vue
  d'un autre contexte JavaScript, que `instanceof` ne reconnaît pas. `enOctets` les reconnaît à leur forme, et son
  message d'erreur dit désormais la forme reçue. Au second essai : « lu sans problème ».
- **Les deux pages Gemini** revenaient vides : `ai.google.dev` renvoie vers `aistudio.google.com`, dont les pages se
  construisent dans le navigateur. Le bot lit leur version Markdown (`changelog.md`, `deprecations.md`) ; le lien de
  la fiche reste la page lisible.
- **Le tri** écrivait parfois « null » en toutes lettres, ou une nature « inconnue » pour une source connue : le
  premier devient un champ vide, la seconde reprend la nature de la source.
- **La lecture des notes** a été vérifiée hors de n8n, sur les vraies notes des séances 01 et 02 : la séance de la
  semaine est reconnue, et les points « à surveiller » reviennent avec leur titre.

Restent à voir après la mise en service : la lecture des notes à travers le montage en lecture seule, les messages
publiés dans un post de forum, et la qualité du tri, à rejouer sur le jeu de contrôle de l'étude. Au premier essai,
les hypothèses du tri restaient souvent générales (« pourrait influencer la conformité RGPD »).

## Les essais du 16 novembre 2026

Avant la mise en service de la version du 16 novembre, deux essais dans n8n, avec le vrai Mistral Small 3.2, sans
rien écrire dans le coffre ni publier dans Discord :

- **Le rejeu de la semaine 46** : les 71 articles de la semaine, triés de nouveau avec la nouvelle consigne. La ligne
  de tableau de la fiche 4 tombe à 3 sur 10, et les modèles d'image sont désormais écartés ; la fiche 3 prend le
  20 novembre lu dans l'original ; l'hypothèse de Zuse n'invente plus de poids publiés. Restaient 3 hypothèses
  fautives (« les services d'OpenAI utilisés par ParlIA », deux fois ; un retrait prêté à Clef) : le contrôle des
  hypothèses les écarte. Avec les vraies dates, la sélection aurait proposé 7 fiches, dont 3 des 4 que Louis a
  gardées en séance ; Zuse passe en réserve, à cause du plafond de 3 prépublications arXiv.
- **L'essai complet**, sur les vraies sources : 2 950 éléments reçus, 99 nouveaux, 98 triés dont 40 hors thème,
  8 fiches, 5 originaux lus sur 8, les notes et le bilan des sources lus (la séance 03 y compte). Trois défauts,
  corrigés depuis : les dépôts Hugging Face de Perplexity sans texte lisible (le bot lit leur fiche), la page des
  modèles de TypeSafe réduite à une ligne (lue en Markdown), data.gouv.fr au-delà de 20 secondes (45 désormais).
- **Les essais de la version finale**, l'après-midi, mémoire vierge : 53 articles triés sur 7 jours, les 16 pages et
  API et les 18 flux lus sans échec, dont le CEPD (son flux en français), tous les originaux lus et résumés. Ils ont
  encore fait resserrer deux règles de la sélection (l'exemption arXiv, le prix d'un modèle suivi) et le contrôle des
  hypothèses (« les fournisseurs de modèles utilisés par ParlIA »).

La version est publiée le 16 novembre 2026, avec la mémoire de la précédente : la préparation de la semaine 47, faite
le matin, n'est pas refaite. À la première lecture des pages sans flux, chaque page est réapprise une fois, sans rien
proposer (nouveau format des lignes).

## La mise à jour de n8n, le 18 novembre 2026

De 2.10.3 à 2.48.5, la version « stable » de n8n ce jour-là (sur Docker Hub, `stable` et `latest` désignent 2.48.5 ;
la 3.x est une version majeure). Elle corrige les avis de sécurité du 28 octobre (GHSA-prmc-fg87-r4gh,
GHSA-f2cw-9483-7vcp, GHSA-9p7v-45m2-wxgj) et du 13 novembre (GHSA-c772-hjfp-gfc2, GHSA-h59h-rf6m-7jp5,
GHSA-q8rc-7m84-mfvj, jugé élevé, GHSA-g333-hr44-g82p). La liste des changements incompatibles de n8n
(`BREAKING-CHANGES.md`) ne signale rien qui touche ces workflows.

- **D'abord sur une copie.** La base copiée, les workflows désactivés, dans un second conteneur sur un autre port,
  sans webhooks : 202 migrations sans erreur ; ParlIA en mode test, avec la vraie mémoire, a tout fait (18 flux,
  16 pages et API, 46 nouveaux articles, 4 demandes de tri, 8 fiches, 7 originaux sur 8 lus et résumés, fichier
  écrit). Deux appels à OpenRouter sont d'abord restés sans réponse (« Provider timed out ») : un appel s'arrête
  désormais après 90 secondes, et n'est refait qu'une fois avant que le nœud le relance (`build_parlia.py`).
- **Le planificateur.** Depuis 2.45, n8n planifie par défaut avec un planificateur « durable », qui jette un passage
  en retard de plus d'une minute : le Mac endormi, la veille Stack de 9 h 30 aurait perdu 5 de ses 7 passages du 11
  au 18 novembre. `N8N_SCHEDULER_ENABLED=false` (`docker-compose.yml`) garde l'ancien, qui lance le passage manqué au
  réveil (vérifié sur la copie). n8n le déclare déprécié : avant n8n 3, donner à Stack un passage toutes les
  30 minutes, comme ParlIA et la veille personnelle, puis revenir au planificateur par défaut.
- **Le reste, vérifié** : une pause « Wait » de moins de 65 secondes reste en mémoire ; `retryOnFail` relance bien un
  nœud qui continue en cas d'erreur ; le temps maximal d'un nœud Code reste de 300 secondes
  (`N8N_RUNNERS_TASK_TIMEOUT`), la lecture des pages et des originaux pouvant dépasser la minute.
- **La base ne s'ouvre jamais depuis le Mac pendant que n8n tourne**, même en lecture seule. Le 18 novembre, à
  11 h 32, une lecture faite depuis le Mac a fait tomber n8n (SIGBUS ; l'exécution en cours de la veille personnelle
  notée « crashed », rien de perdu) : les verrous de SQLite ne traversent pas la machine virtuelle d'OrbStack, et le
  sqlite du Mac, se croyant seul, a remis à zéro la mémoire partagée de la base (`-shm`). Lire depuis le conteneur, ou
  une copie faite par le conteneur (`VACUUM INTO`, comme `outils/rendement-sources.py`), ou la base d'un n8n arrêté.
  `n8n export:workflow` et les journaux `n8n-data/n8nEventLog*.log` se lisent sans risque.
- **La sauvegarde** : `sauvegardes/2026-11-18-avant-2.48.5/` (la base et le fichier `config`, copiés n8n arrêté),
  ignorée par Git, à garder deux semaines. Pour revenir en arrière : `docker compose down`, mettre de côté la base
  actuelle, recopier la sauvegarde dans `n8n-data/`, remettre `n8nio/n8n:2.10.3` dans `docker-compose.yml`, puis
  `docker compose up -d`. Ne jamais lancer 2.10.3 sur la base migrée.

## Les décisions qui restent à Louis

1. **Forum ou salon texte.** Avis : forum, un post par semaine, facile à retrouver et à montrer.
2. **Où le bot écrit.** Le dossier d'export du dépôt (par défaut, à recopier), ou `VEILLE/preparations/` du coffre.
   Avis : le coffre ; la préparation apparaît dans Obsidian, et le bot n'y écrit que ses fichiers datés.
3. **Monter les notes en lecture seule.** Avis : oui ; c'est ce qui évite un rappel inutile et ramène les points
   « à surveiller ».
4. **La mention.** Avis : oui ; seuls l'ouverture, le rappel et les alertes notifient.
5. **Les jours et heures** : préparation le lundi dès 6 h, rappel le jeudi dès 16 h 30. Avis : garder, et changer
   par `.env` si le rythme ne tient pas.
6. **Quand mettre en service, et la mise à jour de n8n.** Fait : en service depuis le 4 novembre 2026, sur n8n
   2.10.3 ; n8n mis à jour en 2.48.5 le 18 novembre, après un essai sur une copie de la base (section « La mise à
   jour de n8n, le 18 novembre 2026 »).
7. **Le modèle qui résume les originaux** (`MODEL_RESUMES` dans `build_parlia.py`). Au plus 8 demandes par
   semaine : le coût reste de l'ordre du centime, et le choix porte sur la justesse des résumés. Mistral Small 3.2
   par défaut ; Louis le garde (16 novembre 2026) et en jugera sur la préparation du 23 novembre.

## Ce qui reste à faire

- Rejouer le jeu de contrôle du tri (étude, §5.5) à chaque changement de la consigne ou du modèle.
- La revue des sources (règle 10) : la préparation en donne le bilan sur quatre semaines ; à Louis de décider, en
  séance, des sources à espacer ou à retirer.
- Lire les réponses et les réactions dans Discord : il faudrait un bot Discord et son jeton, un webhook ne lit rien.
- Les sources à l'essai de l'étude (§4.2), hors Élysée.
- Avant n8n 3 : donner à la veille Stack un passage toutes les 30 minutes, puis revenir au planificateur par défaut
  (section « La mise à jour de n8n, le 18 novembre 2026 »).

## Tests

`npm test` lance aussi les tests de ParlIA (`workflows/tests/parlia-*.test.mjs`) : planification, collecte et
normalisation, pages sans flux et API, Journal officiel, tri et registre, sélection, lecture et résumé des
originaux, préparation, notes de séance, envois Discord et #status, outils communs, et le workflow généré (à jour,
connexions et ordre d'exécution, aucun secret ni chemin personnel, mode test). Les cas de la semaine 46 y sont
repris : la ligne de tableau de la fiche 4, la date de la fiche 1, l'échéance repoussée de la fiche 3, une consigne
qui ne dit jamais qu'un modèle est utilisé par ParlIA ; et ceux du 16 novembre : les hypothèses fautives du rejeu,
la page Markdown de TypeSafe, la fiche d'un dépôt Hugging Face de Perplexity ; et ceux de la semaine 47 : les
annonces d'octobre remontées sur la page de Liquid AI, le prix « par défaut » d'OpenRouter et les offres de
l'éditeur (GPT-6 Luna), la Decisions API de Google comptée deux fois, la nature de la source du journal de l'API
Gemini.
