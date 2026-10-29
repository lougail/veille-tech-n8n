// Nouveaux modèles à poids ouverts publiés par les labos, d'après Hugging Face.
// Règles établies sur les publications réelles de septembre et octobre 2026 :
// - les dérivés sont écartés (versions quantifiées, conversions de format, adaptateurs, dépôts de test) ;
// - les tailles et variantes d'un même modèle forment une « famille », signalée une seule fois ;
// - une famille n'est signalée qu'à partir d'un seuil de « j'aime », propre à chaque organisation ;
// - la date de création d'un dépôt n'est pas sa date de publication (Muse-Spark-Open : créé le 15 septembre,
//   rendu public vers le 15 octobre). On ne filtre donc pas sur l'âge : une famille est nouvelle tant
//   qu'elle n'a jamais été vue. La mémoire est gardée 120 jours.
// Premier passage : tout ce qui existe est mémorisé sans rien publier.
const sd = $getWorkflowStaticData('global');
const now = Date.now();
const JOUR = 24 * 3600 * 1000;
if (!sd.hfFamilles) sd.hfFamilles = {};
for (const [cle, ts] of Object.entries(sd.hfFamilles)) if (now - ts > 120 * JOUR) delete sd.hfFamilles[cle];
const premierPassage = !sd.hfAmorce;

const DERIVE = /(gguf|awq|gptq|fp8|nvfp4|mxfp4|fp4|int4|int8|w4a16|w8a8|bnb|[48]-?bit|quantized|exl2|mlx|onnx|openvino|coreml|litert|executorch|eagle|draft|speculator|dflash|(^|[-_.])lora([-_.]|$)|(^|[-_.])(test|dummy|debug|tiny-random)([-_.]|$))/i;
const BIBLIO_DERIVEES = new Set(['gguf', 'mlx', 'onnx']);
function estDerive(m) {
  const nom = String(m.id).split('/')[1] || '';
  if (DERIVE.test(nom)) return true;
  if (BIBLIO_DERIVEES.has(String(m.library_name || '').toLowerCase())) return true;
  return (m.tags || []).some(t => /^base_model:(quantized|adapter):/.test(String(t)));
}
function famille(nom) {
  let f = nom.toLowerCase();
  // On coupe au premier marqueur de taille ou de dérivé : « qwen3.5-397b-a17b-instruct-fp8 » donne « qwen3.5 »,
  // et « nemotron-3.5-bolt-74b-a9b » comme « nemotron-3.5-bolt-e4b-4gb » donnent « nemotron-3.5-bolt ».
  const coupe = f.search(/[-_.](gguf|awq|gptq|fp8|fp4|nvfp4|mxfp4|int4|int8|w4a16|w8a8|bnb|mlx|onnx|exl2|\d-?bit|e?\d+(\.\d+)?[bm](-a\d+(\.\d+)?[bm])?)(?=$|[-_.])/);
  if (coupe > 0) f = f.slice(0, coupe);
  // puis on retire les variantes et les dates : « deepseek-v4.1-flash-1017 » donne « deepseek-v4.1-flash »
  f = f.replace(/[-_.](instruct|base|it|chat|thinking|reasoning|preview|turbo|bf16|fp16|\d{4,8})(?=$|[-_.])/g, '');
  return f.replace(/[-_.]+$/, '') || nom.toLowerCase();
}

const groupes = {};
const reglages = {};
for (const x of $('Labos HF').all()) reglages[x.json.org] = x.json;
for (const it of $input.all()) {
  const m = it.json;
  if (!m || m.error || !m.id) continue;
  const org = String(m.id).split('/')[0];
  const reglage = reglages[org];
  if (!reglage) continue;
  const nom = String(m.id).split('/')[1] || '';
  const cle = org + '/' + famille(nom);
  const g = groupes[cle] = groupes[cle] || { cle, org, labo: reglage.labo, seuil: reglage.seuil, membres: [] };
  g.membres.push({ id: String(m.id), likes: Number(m.likes) || 0, derive: estDerive(m), tache: m.pipeline_tag || '', cree: Date.parse(m.createdAt || '') || now });
}

const out = [];
for (const g of Object.values(groupes)) {
  if (sd.hfFamilles[g.cle]) continue;
  const likes = Math.max(...g.membres.map(x => x.likes));
  if (premierPassage) { sd.hfFamilles[g.cle] = now; continue; }
  // Une famille dont le dépôt le plus récent a plus de 60 jours n'est pas une nouveauté, même si elle
  // franchit le seuil tardivement. 60 jours couvrent l'écart entre création et publication observé.
  if (Math.max(...g.membres.map(x => x.cree)) < now - 60 * JOUR) { sd.hfFamilles[g.cle] = now; continue; }
  if (likes < g.seuil) continue; // revérifié à chaque passage : publiée le jour où elle franchit le seuil
  sd.hfFamilles[g.cle] = now;
  const originaux = g.membres.filter(x => !x.derive);
  const choix = (originaux.length ? originaux : g.membres).sort((a, b) => b.likes - a.likes);
  const tete = choix[0];
  const variantes = choix.slice(0, 5).map(x => x.id.split('/')[1]).join(', ');
  // Une famille faite seulement de versions optimisées (quantifiées, converties) n'est pas un nouveau
  // modèle du labo : elle est signalée, mais jugée comme un article ordinaire.
  const optimisee = !originaux.length;
  out.push({ json: {
    title: g.labo + (optimisee ? ' publie une version optimisée : ' : ' publie un nouveau modèle ouvert : ') + tete.id.split('/')[1].replace(/[-_]/g, ' '),
    link: 'https://huggingface.co/' + tete.id,
    contentSnippet: 'Sur Hugging Face' + (tete.tache ? ' (' + tete.tache + ')' : '') + ' : ' + variantes
      + (choix.length > 5 ? '…' : '') + '. ' + likes + ' « j\'aime ».',
    isoDate: new Date(now).toISOString(),
    _signals: { nouveauModele: 1, likes },
    _feed: optimisee
      ? { u: 'hf-labos', s: 'Hugging Face (' + g.labo + ')', c: 'ia', w: 1.0, k: 'blog', a: false }
      : { u: 'hf-labos', s: 'Hugging Face (' + g.labo + ')', c: 'ia', w: 1.3, k: 'radar', a: true },
  }});
}
sd.hfAmorce = true;
if (!out.length) return [{ json: { _skip: true } }];
return out;
