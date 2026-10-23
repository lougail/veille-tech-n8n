// Décide si le résumé du jour et le bilan de la semaine partent à cette exécution.
// Le bot ne tourne que Mac allumé : avant, le résumé ne partait qu'à une exécution lancée
// après 17 h, et le bilan qu'un dimanche après 17 h. Le Mac dormant le soir et le week-end,
// le résumé ne partait plus depuis le 9 octobre 2026, et le bilan n'était parti qu'une fois.
// Désormais, un résumé ou un bilan manqué part à l'exécution suivante, même le matin.
// Les dates d'envoi sont posées par Digest CV2 et Hebdo CV2, seulement si le texte existe :
// un modèle indisponible ne fait donc rien perdre, l'envoi est retenté à l'exécution suivante.
const sd = $getWorkflowStaticData('global');
const HEURE_DU_SOIR = 17;

let dernierResume = Number(sd.lastDigestAt) || 0;
if (!dernierResume && sd.lastDigest && sd.lastDigest.d) {
  // ancien format : seule la date du dernier résumé était gardée
  dernierResume = Date.parse(sd.lastDigest.d + 'T18:30:00+02:00') || 0;
}
const dernierBilan = Number(sd.lastHebdoAt) || 0;

// Le résumé est dû s'il n'est pas parti depuis le dernier passage de 17 h.
const soirDuJour = $now.set({ hour: HEURE_DU_SOIR, minute: 0, second: 0, millisecond: 0 });
const dernierSoir = $now >= soirDuJour ? soirDuJour : soirDuJour.minus({ days: 1 });
const resumeDu = dernierResume < dernierSoir.toMillis();

// Le bilan est dû s'il n'est pas parti depuis le dernier dimanche 17 h.
const dimancheSoir = $now.startOf('week').plus({ days: 6, hours: HEURE_DU_SOIR });
const dernierDimanche = $now >= dimancheSoir ? dimancheSoir : dimancheSoir.minus({ weeks: 1 });
const bilanDu = dernierBilan < dernierDimanche.toMillis();

return [{ json: { resumeDu, bilanDu, depuisResume: dernierResume, depuisBilan: dernierBilan } }];
