// La consigne de tri : le texte de sources.md, section 5.2, dans sa version du 16 novembre 2026 (VERSION). Pour
// chaque article, Mistral Small 3.2 propose l'axe, une pertinence sur 10, une hypothèse, la nature de la source, un
// résumé de deux lignes, ce qu'il faut chercher dans l'original, quatre drapeaux et une date d'effet ; Louis décide
// en séance.
// L'état du projet est un bloc à part, écrit sans date, dans outils.js (PARLIA.ETAT_DU_PROJET) : c'est lui qu'on met
// à jour quand le projet avance (le comparatif commencé, un service choisi…), en changeant VERSION en même temps,
// pour que chaque tri garde la trace de la consigne qui l'a produit. La version du 29 octobre affirmait : « Le
// 8 novembre 2026, Louis compare des services d'étiquetage », dont Jev, Clef, d1 et la Decisions API ; le modèle en
// concluait que ParlIA les utilisait (préparation de la semaine 46).
// Les articles partent par lots de 12, un lot après l'autre (option « Batch Processing » de la chaîne LLM, lots
// d'un élément) : une à trois demandes par collecte, sans appels en parallèle ni nœud « Wait ».
// Rien à trier : la branche du tri s'arrête ici ; celle du Journal officiel continue.
const VERSION = 'sources.md 5.2 du 16 novembre 2026';
const articles = $input.all().map((i) => i.json).filter((a) => a && a.id && !a._rien);
if (!articles.length) return [];
const LISTE_DE_SUIVI = PARLIA.SUIVI.join(', ')
  + " ; et, chez leurs éditeurs : Jev 1.14 de TypeSafe AI (jev-1.14.0 et jev-latest), Kev, une reproduction ouverte de Jev, Clef et Clef-flash de Cloudflare, Zuse de Bineric (Zuse 9B et Zuse 27B), d1 et d1-ultra de Liquid AI, Decider v1.2 de Perplexity, la Decisions API d'OpenAI";
const CONSIGNE = `Tu tries la veille de Louis pour son projet ParlIA. Tu proposes ; Louis décide en séance.

L'ÉTAT DU PROJET
{ETAT_DU_PROJET}
Modèles suivis : {LISTE_DE_SUIVI}. Leurs prix et leurs retraits comptent toujours, même si aucun n'est utilisé.
Nous sommes le {DATE}.

LE THÈME ET SES QUATRE AXES
« Étiqueter les questions écrites du Sénat avec un modèle de langage commercial : choisir, mesurer et pouvoir remplacer le fournisseur, dans le respect du RGPD et du règlement européen sur l'IA. »
- fournisseurs : nouveaux modèles, modèles de décision, prix, retraits de modèles, changements d'API, lieu de traitement des données, offres publiques ;
- qualite : accord avec des étiquettes humaines, annotation assistée, calibration et seuils de confiance, validation humaine, méthodes d'évaluation, dérive ;
- conformite : RGPD (CNIL, CEPD), règlement européen sur l'IA (textes, lignes directrices, autorités, échéances), conservation des données par les fournisseurs, accessibilité ;
- exploitation : changer de fournisseur, versions et reproductibilité, surveillance de la qualité, remaniement, données du Sénat et du Journal officiel.
Tout le reste est « hors_theme ».

LE LIEN AVEC PARLIA
Avant de noter, cherche un lien concret entre l'article et ParlIA. Il y en a quatre sortes :
- un modèle de langage ou de décision qui pourrait entrer au comparatif, parce qu'il sait étiqueter du texte ; ou, chez un fournisseur du thème (OpenAI, Anthropic, Mistral, Google, et les éditeurs des candidats), le prix, le retrait, l'API, la conservation des données ou le lieu de traitement d'un modèle de texte ;
- une méthode pour mesurer l'accord avec des étiquettes humaines, calibrer un score, fixer le seuil de la validation humaine ou suivre la dérive ;
- un texte sur le RGPD ou sur le règlement européen sur l'IA qui pourrait s'appliquer à un service public qui étiquette des textes ;
- les données du Sénat ou du Journal officiel, un remaniement.
Sans aucun de ces liens : axe « hors_theme », pertinence de 0 à 2, hypothese « rien ». Un domaine voisin n'est pas un lien : la sécurité informatique, la santé, les images, la vidéo, la voix, les robots.
Avec un lien, mais rien qui changerait pour ParlIA : hypothese « rien ».
Ne jamais écrire qu'un service ou un modèle est utilisé, choisi ou comparé par ParlIA ou par Louis : aucun ne l'est. Écrire plutôt « s'il entrait au comparatif ».
Ne jamais supposer qu'un modèle est concerné par une annonce s'il n'y est pas nommé.

LE BARÈME (pertinence sur 10 ; sois exigeant)
- 9-10 : change une décision ou la préparation du comparatif maintenant. Par exemple : un nouveau modèle de décision disponible, ou une interface de ce type chez un fournisseur ; le prix ou le retrait d'un modèle suivi ; un texte officiel qui s'applique à ParlIA avant la soutenance ; un changement d'API qui modifie la façon d'étiqueter ou de mesurer.
- 7-8 : utilisable tel quel dans le protocole (mesure de l'accord, calibration, seuil de la validation humaine, dérive), recommandation officielle sur l'IA et les données personnelles, ou changement dans la conservation des données chez un fournisseur.
- 5-6 : contexte utile, à surveiller : nouveau modèle de texte généraliste d'un fournisseur du thème, étude sur un autre domaine, événement annoncé.
- 3-4 : périphérique : autre fournisseur, actualité générale de l'IA, billet d'opinion ou de présentation d'un éditeur.
- 0-2 : hors thème, sans lien concret avec ParlIA : étude de cas client, levée de fonds, produit grand public, partenariat sans contenu technique, domaine voisin.
Plafonds :
- une source non primaire ne dépasse pas 6 tant que l'original n'est pas cité ;
- une prépublication (arXiv) ne dépasse pas 8 ;
- une annonce d'éditeur publiée ailleurs que sur un domaine officiel de l'éditeur (site qui l'imite, annuaire, résumé automatique) : 0 à 2, et le dire dans a_chercher.
Ne jamais inventer un prix, une date, un nom de modèle ou une disponibilité (poids publiés, accès par une API, lieu de traitement). S'ils ne sont pas dans l'extrait, mets null et ajoute-les à a_chercher. « Publié le : date inconnue » veut dire que la source ne date pas l'article : ne devine pas sa date.

LIRE UNE LIGNE D'UN TABLEAU DE RETRAITS
Une ligne de tableau arrive avec ses en-têtes : « En-tête : valeur · En-tête : valeur ». La colonne du modèle (« Model », « Deprecated model », « Modèle ») donne le modèle arrêté ; la colonne du remplaçant (« Recommended replacement », « Replacement », « Remplaçant ») donne le modèle conseillé à sa place, qui, lui, continue. Le résumé nomme le modèle arrêté et sa date d'arrêt, puis son remplaçant. Si l'extrait ne permet pas de savoir quel modèle s'arrête, ne mets pas retrait_modele, et écris dans a_chercher : « quel modèle s'arrête, et lequel le remplace ».

LES CHAMPS
- axe : fournisseurs | qualite | conformite | exploitation | hors_theme
- pertinence : entier de 0 à 10
- hypothese : une phrase au conditionnel, « ce que ça pourrait changer pour ParlIA », à partir d'un lien concret ; « rien » sinon
- source_primaire : true si l'information vient de qui l'a produite (l'éditeur du modèle, l'institution, les auteurs de l'étude), false sinon
- nature : editeur | institution | auteurs | praticien | presse | agregateur | inconnu
- resume : deux lignes au plus, en français simple, sans anglicisme inutile : ce que dit l'article, sans rien y ajouter
- a_chercher : ce qu'il faut vérifier dans l'original (prix, date d'arrêt, modèles concernés, lieu de traitement, texte exact d'un article…)
- drapeaux : changement_prix, retrait_modele, nouveau_modele_decision, echeance_reglementaire (true ou false)
    changement_prix : le prix d'un modèle ou d'un service qui existait déjà change ;
    retrait_modele : un modèle, une version d'API ou un service est arrêté, ou son arrêt est annoncé ;
    nouveau_modele_decision : un éditeur annonce un nouveau modèle de décision, ou une nouvelle version, disponible (il choisit une réponse dans une liste fournie et donne une probabilité, sans écrire de texte), chez n'importe quel fournisseur ; un billet d'opinion, une étude ou un tutoriel sur ces modèles n'en est pas un ;
    echeance_reglementaire : une date d'application, de consultation ou de fin de transition d'un texte (RGPD, règlement IA, loi française)
- date_effet : la date du prix, du retrait ou de l'échéance (AAAA-MM-JJ), sinon null

EXEMPLES
1. OpenAI, 22 octobre 2026, « Build more responsive apps with the Decisions API » → fournisseurs, 10, primaire ; nouveau_modele_decision ; hypothese : « Ce service ferait l'étiquetage de ParlIA, un ministère choisi dans une liste fermée avec sa probabilité : il entrerait au comparatif comme une catégorie à part. »
2. Une étude de cas : « Retell uses OpenAI models to help power 100M monthly calls » → hors_theme, 1, hypothese « rien ».
3. Le CEPD relaie l'amende d'une autorité nationale contre une décision entièrement automatisée sur des chauffeurs → conformite, 5, primaire.
4. Une ligne du tableau des retraits d'un éditeur : « Shutdown date : 2027-03-01 · Model : modele-a-mini · Recommended replacement : modele-b » → retrait_modele, date_effet 2027-03-01 ; resume : « modele-a-mini s'arrêtera le 1er mars 2027 ; l'éditeur conseille modele-b à sa place. » ; fournisseurs, 8 ou plus si modele-a-mini est suivi, 3 ou 4 sinon ; hors_theme, 0 à 2 et « rien » s'il ne traite pas de texte.
5. Un éditeur lance un modèle qui génère des images ou de la vidéo → hors_theme, 1, hypothese « rien » : ParlIA étiquette du texte.

Réponds uniquement par un JSON valide, sans texte autour :
{"articles": [{"id": "<id exact>", "axe": "...", "pertinence": 0, "hypothese": "...", "source_primaire": true, "nature": "...", "resume": "...", "a_chercher": "...", "drapeaux": {"changement_prix": false, "retrait_modele": false, "nouveau_modele_decision": false, "echeance_reglementaire": false}, "date_effet": null}]}
Un objet par article, dans l'ordre reçu.

ARTICLES
{ARTICLES}`;
// Sans date de publication, le tri le sait : « date inconnue », avec le jour où le bot a vu l'article.
const publie = (a) => (a.date ? String(a.date).slice(0, 10)
  : 'date inconnue' + (a.vu ? ' (vu par le bot le ' + String(a.vu).slice(0, 10) + ')' : ''));
const bloc = (a) => [
  '--- ARTICLE id=' + a.id + ' ---',
  'Titre : ' + a.titre,
  'Source : ' + a.source.s + ' (nature attendue : ' + (PARLIA.NOM_NATURE[a.source.nature] || 'inconnue')
    + ' ; domaine officiel : ' + (a.officiel ? 'oui' : 'non') + ')',
  'Publié le : ' + publie(a),
  'Adresse : ' + a.url,
  'Extrait : ' + (a.extrait || 'aucun'),
].join('\n');
const date = dateLongue($now.toISODate());
const TAILLE = 12;
const lots = [];
for (let i = 0; i < articles.length; i += TAILLE) lots.push(articles.slice(i, i + TAILLE));
return lots.map((lot) => ({ json: {
  prompt: CONSIGNE
    .replace('{ETAT_DU_PROJET}', () => PARLIA.ETAT_DU_PROJET)
    .replace('{LISTE_DE_SUIVI}', () => LISTE_DE_SUIVI)
    .replace('{DATE}', () => date)
    .replace('{ARTICLES}', () => lot.map(bloc).join('\n\n')),
  _articles: lot,
  _version: VERSION,
} }));
