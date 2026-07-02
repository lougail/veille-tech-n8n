// TEMPLATE de configuration de la veille de stack — copier vers config-stack.js et adapter.
// config-stack.js est volontairement NON versionné : il contient les détails internes
// de la plateforme surveillée (contraintes, incidents, dépendances sensibles).
const CONFIG = {
  org: 'mon-org-github', // informatif ; l'org réelle vient de GITHUB_STACK_ORG (.env)

  // Chemins de manifestes tentés à la racine de CHAQUE repo (404 = ignoré)
  defaultPaths: ['requirements.txt', 'package.json', 'pubspec.yaml', 'Dockerfile'],

  // Cas particuliers par repo (monorepos, chemins non standards)
  specialPaths: {
    // 'mon-monorepo': ['apps/mon-app/pubspec.lock', 'apps/mon-app/pubspec.yaml'],
  },

  // Paquets sous contrainte (pins/caps) dont on surveille les nouvelles releases
  constraintWatch: [
    // { eco: 'pypi', name: 'fastapi', why: 'cappé <X.Y à cause de …' },
    // { eco: 'npm', name: 'next', why: 'pinné X.Y.Z sur tous les fronts' },
    // { eco: 'pub', name: 'flutter_webrtc', why: 'pinné X.Y.Z' },
  ],

  // Fondations à suivre sur endoflife.date — utiliser les clés de cycle EXACTES
  // de l'API (vérifier via https://endoflife.date/api/<produit>.json)
  eolWatch: [
    // { product: 'python', cycle: '3.11', where: 'runtime des services' },
    // { product: 'nodejs', cycle: '22', where: 'runtime des fronts' },
  ],

  minCvss: 7.0,           // alerte quotidienne : HIGH et CRITICAL uniquement
  maxDetailsPerRun: 40,   // plafond d'appels de détails OSV par run
  eolWarnDays: 180,       // avertir si EOL < N jours
};
return [{ json: { config: CONFIG } }];
