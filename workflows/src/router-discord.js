// Router Discord : cartes CV2 par story, listes compactes, sujets chauds, alertes critiques
const sd = $getWorkflowStaticData('global');
const stats = sd._runStats || {};

const CHANNEL = { ia: 'IA', dev: 'DEV', data: 'DEV', cloud: 'CLOUD', securite: 'SECURITE', tendances: 'TENDANCES', fr: 'TENDANCES' };
const COLOR = { ia: 5793266, dev: 5763719, data: 5763719, cloud: 16705372, securite: 15548997, tendances: 15418782, fr: 15418782 };
const EMOJI = { ia: '🤖', dev: '💻', data: '📊', cloud: '☁️', securite: '🔒', tendances: '📰', fr: '🇫🇷' };
const TYPE_LABEL = { release: 'Release', recherche: 'Recherche', outil: 'Outil', secu: 'Sécurité', actu: 'Actu', analyse: 'Analyse' };
const USERNAME = { IA: 'Veille · IA', DEV: 'Veille · Dev', CLOUD: 'Veille · Cloud', SECURITE: 'Veille · Sécu', TENDANCES: 'Veille · Tendances', CRITIQUE: 'Veille · Alerte', STATUS: 'Veille · Status' };

function mdSafe(s) {
  return String(s || '')
    .replace(/[\[\]]/g, ' ')
    .replace(/@(everyone|here)/gi, '@​$1') // neutralise les mentions injectées via titres RSS
    .replace(/\s+/g, ' ')
    .trim();
}
// encode les caractères qui cassent les liens markdown [label](url)
function mdUrl(u) { return String(u || '').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20'); }
function heatBadge(st) {
  if (st.heat >= 5) return ' · 🔥🔥';
  if (st.heat >= 3) return ' · 🔥';
  return '';
}
function isHot(st) { return st.hot || st.heat >= 3 || (st.signals && (st.signals.hnPoints || 0) >= 300); }

function storyCard(st) {
  const emoji = EMOJI[st.categorie] || '📰';
  const sig = st.signals || {};
  const srcParts = [`via ${mdSafe(st.sources[0].s)}`];
  if (st.sourceCount > 1) srcParts.push(`+${st.sourceCount - 1} source(s)`);
  const head = `## ${emoji} ${mdSafe(st.titre)}\n-# ${TYPE_LABEL[st.type] || 'Actu'} · \`${st.score}/10\`${heatBadge(st)} · ${srcParts.join(' · ')}`;
  let body = (st.resume || '').trim();
  if (st.pourquoi) body += `${body ? '\n' : ''}*${st.pourquoi}*`;
  const comps = [{ type: 10, content: head }];
  // un Text Display avec content vide = 400 Bad Request
  if (body) comps.push({ type: 10, content: body.substring(0, 800) });
  const others = (st.sources || []).slice(1, 4)
    .filter(s => s.u && s.u !== st.url && s.u.length < 400)
    .map(s => `[${mdSafe(s.s)}](${mdUrl(s.u)})`);
  if (others.length) comps.push({ type: 10, content: `-# Aussi couvert par : ${others.join(' · ')}` });
  const buttons = [];
  if (st.url && st.url.length < 500) buttons.push({ type: 2, style: 5, label: 'Lire', url: st.url });
  if (sig.hnUrl && String(sig.hnUrl).length < 500) buttons.push({ type: 2, style: 5, label: `HN · ${sig.hnPoints || '?'} pts`, url: sig.hnUrl });
  else if (sig.lobstersUrl && String(sig.lobstersUrl).length < 500) buttons.push({ type: 2, style: 5, label: `Lobsters · ${sig.lobsters} pts`, url: sig.lobstersUrl });
  if (buttons.length) comps.push({ type: 1, components: buttons });
  return { type: 17, accent_color: COLOR[st.categorie] || 5793266, components: comps };
}
function cardSize(card) {
  let n = 0;
  for (const c of card.components) if (c.type === 10) n += (c.content || '').length;
  return n;
}
function compactLine(st) {
  return `- [**${mdSafe(st.titre).substring(0, 90)}**](${mdUrl(st.url)}) · \`${st.score}/10\`${heatBadge(st)}`;
}

const items = $input.all().map(i => i.json);
const statusOnly = items.every(j => j._statusOnly || j._none);
const messages = [];

if (!statusOnly) {
  const stories = items.filter(j => j.title && !j._statusOnly && !j._none);

  // ---- groupes par canal (les escalades "ça monte" vont uniquement en tendances) ----
  const groups = {};
  for (const st of stories) {
    if (st.isUpdate) continue;
    const ch = CHANNEL[st.categorie] || 'TENDANCES';
    (groups[ch] = groups[ch] || []).push(st);
  }

  const byChannel = {};
  for (const [ch, sts] of Object.entries(groups)) {
    sts.sort((a, b) => b.score - a.score);
    const cards = sts.filter(s => s.score >= 7).slice(0, 4);
    const cardKeys = new Set(cards.map(c => c.id));
    const compact = sts.filter(s => !cardKeys.has(s.id)).slice(0, 8);
    byChannel[ch] = sts.length;

    // cartes riches : max 3 containers / message, budget 3600 chars
    let cur = [], curChars = 0;
    for (const st of cards) {
      const card = storyCard(st);
      const size = cardSize(card);
      if (cur.length >= 3 || (curChars + size > 3400 && cur.length)) {
        messages.push({ channelKey: ch, payload: { username: USERNAME[ch], flags: 36864, allowed_mentions: { parse: [] }, components: cur } });
        cur = []; curChars = 0;
      }
      cur.push(card); curChars += size;
    }
    if (cur.length) messages.push({ channelKey: ch, payload: { username: USERNAME[ch], flags: 36864, allowed_mentions: { parse: [] }, components: cur } });

    // liste compacte
    if (compact.length) {
      let lines = [];
      let chars = 0;
      for (const st of compact) {
        const l = compactLine(st);
        if (chars + l.length > 3500) break;
        lines.push(l); chars += l.length + 1;
      }
      const emoji = EMOJI[Object.keys(CHANNEL).find(c => CHANNEL[c] === ch)] || '📰';
      messages.push({ channelKey: ch, payload: {
        username: USERNAME[ch], flags: 36864, allowed_mentions: { parse: [] },
        components: [{ type: 17, components: [{ type: 10, content: `### ${emoji} Aussi à noter\n${lines.join('\n')}` }] }],
      }});
    }
  }

  // ---- sujets chauds -> #tendances ----
  const hot = stories.filter(st => !st.isUpdate && isHot(st) && (CHANNEL[st.categorie] || 'TENDANCES') !== 'TENDANCES');
  const updates = stories.filter(st => st.isUpdate);
  if (hot.length || updates.length) {
    const lines = [];
    for (const st of hot.slice(0, 8)) {
      const sig = st.signals || {};
      const extra = [`${st.sourceCount} source(s)`];
      if (sig.hnPoints) extra.push(`HN ${sig.hnPoints} pts`);
      lines.push(`- [**${mdSafe(st.titre).substring(0, 90)}**](${mdUrl(st.url)}) — ${extra.join(' · ')} · \`${st.score}/10\``);
    }
    let content = lines.length ? `## 🔥 Sujets chauds\n${lines.join('\n')}` : '';
    if (updates.length) {
      const ul = updates.slice(0, 5).map(st => `- [**${mdSafe(st.titre).substring(0, 90)}**](${mdUrl(st.url)}) — chaleur ${st.heat}, ${st.sourceCount} source(s)`);
      content += `${content ? '\n\n' : ''}### 📈 Ça monte (déjà signalé, le buzz s'amplifie)\n${ul.join('\n')}`;
    }
    messages.push({ channelKey: 'TENDANCES', payload: {
      username: USERNAME.TENDANCES, flags: 36864, allowed_mentions: { parse: [] },
      components: [{ type: 17, accent_color: 15418782, components: [{ type: 10, content: content.substring(0, 3800) }] }],
    }});
    stats.hot = hot.length + updates.length;
  }

  // ---- alertes critiques (score >= 9) : embed classique + notification ----
  const critiques = stories.filter(st => st.score >= 9);
  for (const st of critiques.slice(0, 5)) {
    messages.push({ channelKey: 'CRITIQUE', payload: {
      username: USERNAME.CRITIQUE,
      content: `@here 🚨 **${mdSafe(st.titre)}**`,
      allowed_mentions: { parse: ['everyone'] },
      embeds: [{
        title: mdSafe(st.titre).substring(0, 256),
        url: st.url,
        description: `${st.resume || ''}${st.pourquoi ? `\n\n**Pourquoi c'est important** — ${st.pourquoi}` : ''}`.substring(0, 3000),
        color: 15548997,
        fields: [
          { name: 'Score', value: `\`${st.score}/10\``, inline: true },
          { name: 'Sources', value: String(st.sourceCount), inline: true },
          { name: 'Catégorie', value: st.categorie, inline: true },
        ],
        footer: { text: 'Veille Pro v2 — Alerte' },
        timestamp: new Date().toISOString(),
      }],
      components: st.url && st.url.length < 500 ? [{ type: 1, components: [{ type: 2, style: 5, label: 'Lire', url: st.url }] }] : [],
    }});
  }
  stats.byChannel = byChannel;
  stats.critiques = critiques.length;
}

sd._runStats = stats;
if (!messages.length) {
  messages.push({ channelKey: 'STATUS', payload: {
    username: USERNAME.STATUS, flags: 4096, allowed_mentions: { parse: [] },
    content: 'ℹ️ Run terminé — aucune story à publier ce cycle.',
  }});
}
return messages.map(m => ({ json: m }));
