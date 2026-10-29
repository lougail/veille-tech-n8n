// Toutes les 30 minutes, n8n demande si une collecte est due. Le bot ne tourne que Mac allumé :
// avec des heures fixes (8 h, 13 h, 18 h 30), il ratait souvent des journées entières. Désormais il
// collecte dès que le Mac est allumé, au plus une fois toutes les trois heures, de 7 h à 23 h ;
// et à partir de 8 h 30, tant que le brief du matin n'est pas parti, une collecte fraîche le prépare.
// Rien n'est enregistré ici : la date de la dernière collecte est posée par normalize.js,
// celle du dernier brief par digest-cv2.js.
const sd = $getWorkflowStaticData('global');
const INTERVALLE_MS = (3 * 60 - 10) * 60 * 1000; // 2 h 50 : une marge pour le pas de 30 minutes
const AVANT_BRIEF_MS = 25 * 60 * 1000;
const heure = $now.hour;
if (heure < 7 || heure >= 23) return [];
const derniere = Number(sd.lastCollectAt) || 0;
const depuis = $now.toMillis() - derniere;
const heureBrief = $now.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
const briefDu = $now >= heureBrief && (Number(sd.lastDigestAt) || 0) < heureBrief.toMillis();
if (depuis < INTERVALLE_MS && !(briefDu && depuis >= AVANT_BRIEF_MS)) return [];
return [{ json: { due: true, derniereCollecte: derniere, briefDu } }];
