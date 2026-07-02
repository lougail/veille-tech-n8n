// Met en forme le digest quotidien en message Components V2 + mémorise pour la continuité
const sd = $getWorkflowStaticData('global');
const input = $input.first().json;
let text = input.text || input.output || '';
if (!text) return [];

if (text.length > 3500) {
  const cut = text.lastIndexOf('\n', 3500);
  text = text.substring(0, cut > 2000 ? cut : 3500);
}

const today = $now.toISODate();
const dateFr = $now.setLocale('fr').toFormat('cccc d LLLL yyyy');
const count = $('Prompt Digest').first().json.count || 0;

sd.lastDigest = { d: today, text };
sd.digestHistory = (sd.digestHistory || []).filter(d => d.d !== today);
sd.digestHistory.push({ d: today, text: text.substring(0, 1500) });
sd.digestHistory = sd.digestHistory.slice(-7);

return [{ json: { payload: {
  username: 'Veille · Digest',
  flags: 36864,
  allowed_mentions: { parse: [] },
  components: [{
    type: 17,
    accent_color: 15844367,
    components: [
      { type: 10, content: `# 📰 Digest — ${dateFr}\n-# ${count} stories publiées aujourd'hui` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: text },
    ],
  }],
}}}];
