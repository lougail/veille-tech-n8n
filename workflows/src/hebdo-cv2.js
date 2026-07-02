// Met en forme le bilan hebdo en message Components V2
const input = $input.first().json;
let text = input.text || input.output || '';
if (!text) return [];

if (text.length > 3500) {
  const cut = text.lastIndexOf('\n', 3500);
  text = text.substring(0, cut > 2000 ? cut : 3500);
}

const end = $now.setLocale('fr');
const start = end.minus({ days: 6 });
const range = `${start.toFormat('d LLLL')} → ${end.toFormat('d LLLL yyyy')}`;
const count = $('Prompt Hebdo').first().json.count || 0;

return [{ json: { payload: {
  username: 'Veille · Hebdo',
  flags: 36864,
  allowed_mentions: { parse: [] },
  components: [{
    type: 17,
    accent_color: 10181046,
    components: [
      { type: 10, content: `# 🗓️ Bilan de la semaine — ${range}\n-# ${count} stories fortes cette semaine` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: text },
    ],
  }],
}}}];
