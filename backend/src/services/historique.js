// Mappers purs des lignes d'historique (évaluations intervenant / compétence).
// Isolés ici pour rester testables sans base ni serveur HTTP.

// Ligne d'historique « évaluation intervenant ».
function mapIntervenantRow(ev) {
  return {
    id: ev.id,
    jiraKey: ev.jiraKey,
    status: ev.status,
    cvFilename: ev.cvFilename ?? null,
    evaluatorName: ev.evaluator?.name ?? null,
    createdAt: ev.createdAt,
    pushedAt: ev.pushedAt ?? null
  };
}

// Ligne d'historique « évaluation compétence ».
function mapCompetenceRow(ev) {
  return {
    id: ev.id,
    jiraKeyCompetence: ev.jiraKeyCompetence,
    jiraKeyIntervenant: ev.jiraKeyIntervenant ?? null,
    jiraKeyPrestataire: ev.jiraKeyPrestataire ?? null,
    status: ev.status,
    programCode: ev.programCode ?? null,
    theoVerdict: ev.theoVerdict ?? null,
    demoVerdict: ev.demoVerdict ?? null,
    demoScorePct: ev.demoScorePct ?? null,
    evaluatorName: ev.evaluator?.name ?? null,
    createdAt: ev.createdAt,
    pushedAt: ev.pushedAt ?? null
  };
}

module.exports = { mapIntervenantRow, mapCompetenceRow };
