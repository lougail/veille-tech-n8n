// Les organisations Hugging Face des labos qui publient des modèles à poids ouverts, avec le seuil
// de « j'aime » à partir duquel une nouvelle famille de modèles est signalée. Noms vérifiés le
// 28 octobre 2026 : le filtre de l'API est sensible à la casse (« Qwen », pas « qwen »), et Meta
// publie ses nouveaux modèles (Muse) dans « meta-models », plus dans « meta-llama ».
// Seuils : 10 pour les labos de modèles, 25 pour les grands groupes de recherche, 50 pour NVIDIA,
// qui publie plus de soixante dépôts par mois. Le nœud suivant interroge l'API une fois par organisation.
const SEUIL_LABO = 10, SEUIL_RECHERCHE = 25;
const ORGANISATIONS = [
  ['meta-models', 'Meta', SEUIL_LABO], ['meta-llama', 'Meta', SEUIL_LABO], ['facebook', 'Meta', SEUIL_RECHERCHE],
  ['mistralai', 'Mistral AI', SEUIL_LABO], ['Qwen', 'Qwen', SEUIL_LABO], ['deepseek-ai', 'DeepSeek', SEUIL_LABO],
  ['google', 'Google', SEUIL_RECHERCHE], ['microsoft', 'Microsoft', SEUIL_RECHERCHE], ['nvidia', 'NVIDIA', 50],
  ['ibm-granite', 'IBM', SEUIL_LABO], ['allenai', 'Ai2', SEUIL_RECHERCHE], ['moonshotai', 'Moonshot AI', SEUIL_LABO],
  ['zai-org', 'Z.ai', SEUIL_LABO], ['MiniMaxAI', 'MiniMax', SEUIL_LABO], ['LiquidAI', 'Liquid AI', SEUIL_LABO],
  ['ByteDance-Seed', 'ByteDance Seed', SEUIL_LABO], ['tencent', 'Tencent', SEUIL_RECHERCHE], ['baidu', 'Baidu', SEUIL_LABO],
  ['stepfun-ai', 'StepFun', SEUIL_LABO], ['openai', 'OpenAI', SEUIL_LABO], ['CohereLabs', 'Cohere', SEUIL_LABO],
  ['HuggingFaceTB', 'Hugging Face', SEUIL_LABO], ['apple', 'Apple', SEUIL_RECHERCHE], ['amazon', 'Amazon', SEUIL_RECHERCHE],
  ['xai-org', 'xAI', SEUIL_LABO],
];
const GROS = new Set(['nvidia', 'LiquidAI', 'facebook', 'google', 'microsoft']);
return ORGANISATIONS.map(([org, labo, seuil]) => ({ json: { org, labo, seuil, limite: GROS.has(org) ? 100 : 50 } }));
