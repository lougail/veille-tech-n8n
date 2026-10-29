// Décide si le brief du jour et le bilan de la semaine partent à cette exécution.
// Le brief part chaque matin, à la première exécution après 8 h 30 : c'est le rendez-vous quotidien,
// le seul message qui notifie avec #critique. Le Mac dort souvent le soir et le week-end : un brief
// ou un bilan manqué part à l'exécution suivante, et couvre tout ce qui a été publié depuis le précédent.
// Les dates d'envoi sont posées par Digest CV2 et Hebdo CV2, seulement si le texte existe :
// un modèle indisponible ne fait donc rien perdre, l'envoi est retenté à l'exécution suivante.
const sd = $getWorkflowStaticData('global');

let dernierResume = Number(sd.lastDigestAt) || 0;
if (!dernierResume && sd.lastDigest && sd.lastDigest.d) {
  // ancien format : seule la date du dernier résumé était gardée
  dernierResume = Date.parse(sd.lastDigest.d + 'T18:30:00+02:00') || 0;
}
const dernierBilan = Number(sd.lastHebdoAt) || 0;

// Le brief est dû s'il n'est pas parti depuis le dernier passage de 8 h 30.
const matin = $now.set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
const dernierMatin = $now >= matin ? matin : matin.minus({ days: 1 });
const resumeDu = dernierResume < dernierMatin.toMillis();

// Le bilan est dû s'il n'est pas parti depuis le dernier dimanche 17 h.
const dimancheSoir = $now.startOf('week').plus({ days: 6, hours: 17 });
const dernierDimanche = $now >= dimancheSoir ? dimancheSoir : dimancheSoir.minus({ weeks: 1 });
const bilanDu = dernierBilan < dernierDimanche.toMillis();

return [{ json: { resumeDu, bilanDu, depuisResume: dernierResume, depuisBilan: dernierBilan } }];
