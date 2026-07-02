// Construit les messages Discord pour #stack :
// alertes CVE (notifiantes), digest hebdo (silencieux), status quotidien (silencieux)
const sd = $getWorkflowStaticData('global');
const s = sd._stackStats || {};
const input = $input.first().json || {};
const digest = input.digest || null;

let alerts = [];
try { alerts = $('Format Alertes').first().json.alerts || []; } catch (e) { /* branche non exécutée */ }

const messages = [];

if (alerts.length) {
  const shown = alerts.slice(0, 8);
  const lines = shown.map(a => {
    const fix = a.fixed && a.fixed.length ? ` → corrigé en **${a.fixed.join(', ')}**` : '';
    const repoTxt = a.repoCount > 8 ? `${a.repos.slice(0, 5).join(', ')}… (${a.repoCount} repos)` : a.repos.join(', ');
    return `${a.severity === 'CRITICAL' ? '🔴' : '🟠'} **${a.cve}** — \`${a.name}\` ${a.ver || ''} (${a.eco})${fix}\n-# ${a.repoCount} repo(s) : ${repoTxt}\n> ${(a.summary || '').replace(/\n/g, ' ')}`;
  });
  const more = alerts.length > shown.length ? `\n\n_… et ${alerts.length - shown.length} autres (voir le prochain digest)._` : '';
  const head = alerts[0].baseline
    ? '🔍 **Audit initial de la stack (baseline)** — vulnérabilités critiques déjà présentes :'
    : '⚠️ **Nouvelles vulnérabilités touchant la stack Hello-Mira**';
  messages.push({ payload: {
    username: 'Veille · Stack',
    content: `${head}\n\n${lines.join('\n\n')}${more}`.substring(0, 1950),
    allowed_mentions: { parse: [] },
  }});
}

if (digest) {
  const date = $now.setLocale('fr').toFormat('d LLLL yyyy');
  messages.push({ payload: {
    username: 'Veille · Stack',
    content: `# 🗓️ Stack hebdo — ${date}\n${digest}`.substring(0, 1950),
    flags: 4096,
    allowed_mentions: { parse: [] },
  }});
}

const warn = s.tokenLimited ? '\n⚠️ **Token GitHub en attente d\'approbation admin** — seuls les repos publics de l\'org sont scannés pour l\'instant.' : '';
const mode = s.baseline ? 'baseline établie' : `${s.newVulns || 0} nouvelle(s) vuln(s)`;
messages.push({ payload: {
  username: 'Veille · Stack',
  content: `-# 🔧 Scan : ${s.totalRepos || 0} repos (${s.changedRepos || 0} modifiés, ${s.filesFetched || 0} fichiers lus) · ${s.uniqueDeps || 0} deps uniques, ${s.queriedDeps || 0} interrogées · ${s.vulnerablePkgs || 0} paquets avec vulns connues · ${mode}${warn}`.substring(0, 1950),
  flags: 4096,
  allowed_mentions: { parse: [] },
}});

return messages.map(m => ({ json: m }));
