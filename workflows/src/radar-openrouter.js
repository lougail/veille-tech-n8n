// Radar des nouveaux modèles : le catalogue public d'OpenRouter (sans clé) référence les modèles
// de presque tous les fournisseurs dès leur mise à disposition, avec prix, contexte et date de retrait.
// Mesuré le 28 octobre 2026 : 464 modèles, 67 fournisseurs, environ 1,3 ajout par jour. C'est la seule
// source fraîche pour des labos sans flux, comme Moonshot (Kimi) ou MiniMax.
// - Un nouveau modèle devient un article daté de son ajout au catalogue : la fenêtre de collecte
//   (normalize.js, 7 jours au plus) et le dédoublonnage (7 jours) ne laissent passer que les nouveaux.
// - Un retrait annoncé (champ expiration_date) devient un article la première fois qu'il apparaît.
// Les grands labos passent toujours le pré-classement ; les autres fournisseurs sont jugés comme le reste.
const sd = $getWorkflowStaticData('global');
const LABOS = {
  'openai': 'OpenAI', 'anthropic': 'Anthropic', 'google': 'Google', 'meta': 'Meta', 'meta-llama': 'Meta',
  'mistralai': 'Mistral AI', 'x-ai': 'xAI', 'deepseek': 'DeepSeek', 'qwen': 'Qwen', 'moonshotai': 'Moonshot AI',
  'z-ai': 'Z.ai', 'minimax': 'MiniMax', 'cohere': 'Cohere', 'amazon': 'Amazon', 'microsoft': 'Microsoft',
  'nvidia': 'NVIDIA', 'ibm-granite': 'IBM', 'liquid': 'Liquid AI', 'bytedance-seed': 'ByteDance Seed',
  'tencent': 'Tencent', 'baidu': 'Baidu', 'stepfun': 'StepFun',
};

function parMillion(x) {
  const v = Number(x);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 1e6 * 1000) / 1000 : null;
}
function fournisseur(prefixe) {
  return LABOS[prefixe] || prefixe.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const modeles = [];
for (const it of $input.all()) {
  const j = it.json;
  if (!j || j.error) continue;
  if (Array.isArray(j.data)) modeles.push(...j.data);
  else if (j.id) modeles.push(j);
}

// Une entrée par modèle : l'identifiant sans suffixe (« :free », « :batch »…) ; la version gratuite
// n'est gardée que si le modèle n'existe qu'en gratuit. Les alias (« ~ ») et les routeurs sont écartés.
const parBase = {};
for (const m of modeles) {
  if (!m || !m.id || !m.created) continue;
  const id = String(m.id);
  if (id.startsWith('~') || id.startsWith('openrouter/')) continue;
  const [base, suffixe] = id.split(':');
  if (suffixe && suffixe !== 'free') continue;
  if (!parBase[base] || (parBase[base].suffixe === 'free' && !suffixe)) parBase[base] = { m, suffixe };
}

if (!sd.retraitsOpenRouter) sd.retraitsOpenRouter = {};
const premierPassage = !sd.retraitsAmorces;
const out = [];
for (const [base, { m, suffixe }] of Object.entries(parBase)) {
  const prefixe = base.split('/')[0];
  const labo = fournisseur(prefixe);
  const grandLabo = !!LABOS[prefixe];
  // Le nom affiché par OpenRouter, sans le fournisseur en préfixe (« OpenAI: GPT-6.1 Terra ») ni la
  // mention « (free) » ; sinon l'identifiant sans son suffixe.
  const nom = m.name
    ? String(m.name).replace(/^[^:]{1,40}:\s*/, '').replace(/\s*\(free\)$/i, '')
    : base.split('/')[1];
  const p = m.pricing || {};
  const entree = parMillion(p.prompt);
  const sortie = parMillion(p.completion);
  let prix = '';
  if (suffixe === 'free' || (entree === 0 && sortie === 0)) prix = 'gratuit';
  else if (entree !== null && sortie !== null) prix = entree + ' $ / ' + sortie + ' $ par million de jetons (entrée / sortie)';
  const contexte = m.context_length ? 'contexte de ' + Math.round(m.context_length / 1000) + ' k jetons' : '';
  const entrees = ((m.architecture || {}).input_modalities || []).join(', ');
  const poids = m.hugging_face_id ? 'poids ouverts : huggingface.co/' + m.hugging_face_id : '';
  const description = String(m.description || '').replace(/\s+/g, ' ').trim().substring(0, 280);
  const details = [labo, contexte, prix, entrees ? 'entrées : ' + entrees : '', poids].filter(Boolean).join(' · ');
  const feed = { u: 'openrouter-models', s: 'OpenRouter (nouveaux modèles)', c: 'ia', w: grandLabo ? 1.3 : 1.0, k: 'radar', a: grandLabo };

  out.push({ json: {
    title: 'Nouveau modèle ' + labo + ' : ' + nom,
    link: 'https://openrouter.ai/' + base,
    contentSnippet: details + (description ? '. ' + description : ''),
    isoDate: new Date(m.created * 1000).toISOString(),
    _signals: { nouveauModele: 1 },
    _feed: feed,
  }});

  // Retraits annoncés, pour les grands labos : publiés la première fois que la date apparaît.
  const retrait = m.expiration_date ? String(m.expiration_date).substring(0, 10) : '';
  if (grandLabo && retrait && sd.retraitsOpenRouter[base] !== retrait) {
    sd.retraitsOpenRouter[base] = retrait;
    if (!premierPassage) {
      out.push({ json: {
        title: 'Retrait annoncé : ' + labo + ' ' + nom + ' ne sera plus servi après le ' + retrait,
        link: 'https://openrouter.ai/' + base + '#retrait-' + retrait,
        contentSnippet: 'Date de retrait inscrite au catalogue d\'OpenRouter : ' + retrait + '. ' + details,
        isoDate: new Date().toISOString(),
        _signals: { retraitModele: 1 },
        _feed: Object.assign({}, feed, { w: 1.2, a: true }),
      }});
    }
  }
}
sd.retraitsAmorces = true;
if (!out.length) return [{ json: { _skip: true } }];
return out;
