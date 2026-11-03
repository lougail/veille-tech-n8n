// La consigne de tri : le texte de sources.md, section 5.2, mot pour mot. Mistral Small 3.2 propose, pour chaque
// article, l'axe, une pertinence sur 10, une hypothèse, la nature de la source, un résumé de deux lignes, ce qu'il
// faut chercher dans l'original, quatre drapeaux et une date d'effet ; Louis décide en séance.
// Les articles partent par lots de 12, un lot après l'autre (option « Batch Processing » de la chaîne LLM, lots
// d'un élément) : une à trois demandes par collecte, sans appels en parallèle ni nœud « Wait ».
// Rien à trier : la branche du tri s'arrête ici ; celle du Journal officiel continue.
const VERSION = 'sources.md 5.2 du 29 octobre 2026';
const articles = $input.all().map((i) => i.json).filter((a) => a && a.id && !a._rien);
if (!articles.length) return [];
const LISTE_DE_SUIVI = PARLIA.SUIVI.join(', ')
  + ' ; et, chez leurs éditeurs : Jev 1.14 (jev-1.14.0 et jev-latest), Clef et Clef-flash, d1 et d1-ultra, Decider v1.2, la Decisions API';
const CONSIGNE = `Tu tries la veille de Louis pour son projet ParlIA. Tu proposes ; Louis décide en séance.

LE PROJET
ParlIA propose les trois ministères les plus probables pour une question écrite de sénateur, à partir du titre et du texte de la question (données publiques du Sénat). Un service d'IA du marché étiquette, hors ligne, les questions sans réponse publiée : il choisit un ministère dans une liste fermée, avec un score de confiance, et une personne valide chaque proposition. Le protocole : mesurer d'abord l'accord du service avec 3 267 questions dont le ministère est connu ; consigner la version du modèle et la date de chaque appel ; garder la réponse brute ; ne jamais mettre une étiquette du service dans le jeu de test ; garder l'étiquetage assisté seulement s'il améliore le macro-F1.
Le 8 novembre 2026, Louis compare des services d'étiquetage. Le comparatif inclut des modèles de décision : la Decisions API d'OpenAI (GPT-6 Luna), Jev de TypeSafe AI, Clef de Cloudflare, d1 de Liquid AI. Modèles suivis : {LISTE_DE_SUIVI}.
L'épreuve E5 porte sur un remaniement du Gouvernement qui change la liste des ministères. La soutenance a lieu en janvier 2027. Nous sommes le {DATE}.

LE THÈME ET SES QUATRE AXES
« Étiqueter les questions écrites du Sénat avec un modèle de langage commercial : choisir, mesurer et pouvoir remplacer le fournisseur, dans le respect du RGPD et du règlement européen sur l'IA. »
- fournisseurs : nouveaux modèles, modèles de décision, prix, retraits de modèles, changements d'API, lieu de traitement des données, offres publiques ;
- qualite : accord avec des étiquettes humaines, annotation assistée, calibration et seuils de confiance, validation humaine, méthodes d'évaluation, dérive ;
- conformite : RGPD (CNIL, CEPD), règlement européen sur l'IA (textes, lignes directrices, autorités, échéances), conservation des données par les fournisseurs, accessibilité ;
- exploitation : changer de fournisseur, versions et reproductibilité, surveillance de la qualité, remaniement, données du Sénat et du Journal officiel.
Tout le reste est « hors_theme ».

LE BARÈME (pertinence sur 10 ; sois exigeant)
- 9-10 : change une décision ou une étape du comparatif maintenant. Par exemple : un nouveau modèle de décision, ou une interface de ce type chez un fournisseur ; le prix ou le retrait d'un modèle suivi ; un texte officiel qui s'applique à ParlIA avant la soutenance ; un changement d'API qui modifie la façon d'étiqueter ou de mesurer.
- 7-8 : utilisable tel quel dans le protocole (mesure de l'accord, calibration, seuil de la validation humaine, dérive), recommandation officielle sur l'IA et les données personnelles, ou changement dans la conservation des données chez un fournisseur.
- 5-6 : contexte utile, à surveiller : nouveau modèle généraliste d'un des quatre fournisseurs, étude sur un autre domaine, événement annoncé.
- 3-4 : périphérique : autre fournisseur, actualité générale de l'IA.
- 0-2 : hors thème : étude de cas client, levée de fonds, produit grand public, partenariat sans contenu technique.
Plafonds :
- une source non primaire ne dépasse pas 6 tant que l'original n'est pas cité ;
- une prépublication (arXiv) ne dépasse pas 8 ;
- une annonce d'éditeur publiée ailleurs que sur un domaine officiel de l'éditeur (site qui l'imite, annuaire, résumé automatique) : 0 à 2, et le dire dans a_chercher.
Ne jamais inventer un prix, une date ou un nom de modèle. S'ils ne sont pas dans l'extrait, mets null et ajoute-les à a_chercher.

LES CHAMPS
- axe : fournisseurs | qualite | conformite | exploitation | hors_theme
- pertinence : entier de 0 à 10
- hypothese : une phrase au conditionnel, « ce que ça pourrait changer pour ParlIA » ; « rien » si rien
- source_primaire : true si l'information vient de qui l'a produite (l'éditeur du modèle, l'institution, les auteurs de l'étude), false sinon
- nature : editeur | institution | auteurs | praticien | presse | agregateur | inconnu
- resume : deux lignes au plus, en français simple, sans anglicisme inutile
- a_chercher : ce qu'il faut vérifier dans l'original (prix, date d'arrêt, modèles concernés, lieu de traitement, texte exact d'un article…)
- drapeaux : changement_prix, retrait_modele, nouveau_modele_decision, echeance_reglementaire (true ou false)
    changement_prix : le prix d'un modèle ou d'un service qui existait déjà change ;
    retrait_modele : un modèle, une version d'API ou un service est arrêté, ou son arrêt est annoncé ;
    nouveau_modele_decision : un nouveau modèle de décision, ou une nouvelle version (il choisit une réponse dans une liste fournie et donne une probabilité, sans écrire de texte), chez n'importe quel fournisseur ;
    echeance_reglementaire : une date d'application, de consultation ou de fin de transition d'un texte (RGPD, règlement IA, loi française)
- date_effet : la date du prix, du retrait ou de l'échéance (AAAA-MM-JJ), sinon null

EXEMPLES
1. OpenAI, 22 octobre 2026, « Build more responsive apps with the Decisions API » → fournisseurs, 10, primaire ; nouveau_modele_decision.
2. Une étude de cas : « Retell uses OpenAI models to help power 100M monthly calls » → hors_theme, 1.
3. Le CEPD relaie l'amende d'une autorité nationale contre une décision entièrement automatisée sur des chauffeurs → conformite, 5, primaire.

Réponds uniquement par un JSON valide, sans texte autour :
{"articles": [{"id": "<id exact>", "axe": "...", "pertinence": 0, "hypothese": "...", "source_primaire": true, "nature": "...", "resume": "...", "a_chercher": "...", "drapeaux": {"changement_prix": false, "retrait_modele": false, "nouveau_modele_decision": false, "echeance_reglementaire": false}, "date_effet": null}]}
Un objet par article, dans l'ordre reçu.

ARTICLES
{ARTICLES}`;
const bloc = (a) => [
  '--- ARTICLE id=' + a.id + ' ---',
  'Titre : ' + a.titre,
  'Source : ' + a.source.s + ' (nature attendue : ' + (PARLIA.NOM_NATURE[a.source.nature] || 'inconnue')
    + ' ; domaine officiel : ' + (a.officiel ? 'oui' : 'non') + ')',
  'Publié le : ' + String(a.date || '').slice(0, 10),
  'Adresse : ' + a.url,
  'Extrait : ' + (a.extrait || 'aucun'),
].join('\n');
const date = dateLongue($now.toISODate());
const TAILLE = 12;
const lots = [];
for (let i = 0; i < articles.length; i += TAILLE) lots.push(articles.slice(i, i + TAILLE));
return lots.map((lot) => ({ json: {
  prompt: CONSIGNE
    .replace('{LISTE_DE_SUIVI}', () => LISTE_DE_SUIVI)
    .replace('{DATE}', () => date)
    .replace('{ARTICLES}', () => lot.map(bloc).join('\n\n')),
  _articles: lot,
  _version: VERSION,
} }));
