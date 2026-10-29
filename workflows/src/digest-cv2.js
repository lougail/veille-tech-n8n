// Met en forme le brief du matin, et le garde pour la continuité (le brief suivant le relit).
// C'est le seul message qui notifie avec #critique : il est envoyé sans le drapeau « silencieux ».
const sd = $getWorkflowStaticData('global');
const input = $input.first().json;
let text = String(input.text || input.output || '').trim();
// Certains modèles entourent leur réponse d'un bloc de code (```markdown … ```) : Discord
// l'afficherait tel quel, astérisques comprises. Le bilan du 28 octobre 2026 est arrivé ainsi.
if (text.startsWith('```')) text = text.replace(/^```[\w-]*[ \t]*\n?/, '').replace(/\n?```\s*$/, '').trim();
if (!text) return [];

if (text.length > 3500) {
  const cut = text.lastIndexOf('\n', 3500);
  text = text.substring(0, cut > 2000 ? cut : 3500);
}

const today = $now.toISODate();
const dateFr = $now.setLocale('fr').toFormat('cccc d LLLL yyyy');
const resume = $('Prompt Digest').first().json;
const count = resume.count || 0;
const periode = resume.periode || "aujourd'hui";

sd.lastDigest = { d: today, text };
sd.lastDigestAt = Date.now(); // lu par planifier-resumes.js
sd.digestHistory = (sd.digestHistory || []).filter(d => d.d !== today);
sd.digestHistory.push({ d: today, text: text.substring(0, 1500) });
sd.digestHistory = sd.digestHistory.slice(-7);

return [{ json: { payload: {
  username: 'Veille · Brief',
  flags: 32768,
  allowed_mentions: { parse: [] },
  components: [{
    type: 17,
    accent_color: 15844367,
    components: [
      { type: 10, content: `# ☕ Brief — ${dateFr}\n-# ${count} sujets publiés ${periode}` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: text },
    ],
  }],
}}}];
