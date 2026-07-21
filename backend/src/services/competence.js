// Mapping préfixe d'action → code programme. Seul SYH → GO_SIYAHA est confirmé ;
// les autres sont des hypothèses à valider terrain (§11).
const ACTION_PREFIX_TO_PROGRAM = {
  SYH: 'GO_SIYAHA_V04',
  PWE: 'POWER_EXPORT_V01',
  SCH: 'SUPPLY_CHAIN_V01',
  PTM: 'PACTE_TPME_V01',
};

const VERDICT_LABEL = {
  FAVORABLE: 'Référencée',
  CONDITIONNEL: 'Conditionnelle',
  DEFAVORABLE: 'Non référencée',
};

function deduceProgramCode(actionAReferencer, _jiraProjectKey) {
  if (!actionAReferencer) return null;
  const m = String(actionAReferencer).match(/^([A-Z]{2,4})[-\s]/);
  return m && ACTION_PREFIX_TO_PROGRAM[m[1]] ? ACTION_PREFIX_TO_PROGRAM[m[1]] : null;
}

function getCategoryCriteria(program, categoryKey) {
  if (!program?.categories || !categoryKey) return null;
  const cat = program.categories[categoryKey];
  if (!cat) return null;
  return { label: cat.label || categoryKey, criteria: Array.isArray(cat.criteria) ? cat.criteria : [] };
}

// Critères effectifs d'une évaluation : la grille personnalisée (customCriteria)
// si elle existe, sinon la grille standard de la catégorie du programme.
// Employé au scoring IA, aux phases théorique/démo et au commentaire de push,
// pour que les critères édités/supprimés côté UI soient réellement honorés.
function resolveCriteria(evaln, program, categoryKey) {
  const custom = evaln?.customCriteria;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return getCategoryCriteria(program, categoryKey || evaln?.categoryKey)?.criteria || [];
}

function classifySource(filename = '') {
  const f = filename.toLowerCase();
  if (/grille|fonctionnel/.test(f)) return 'grille_fonctionnelle';
  if (/attestation|r[ée]f[ée]rence/.test(f)) return 'attestation_reference';
  if (/certificat|certif|editeur|éditeur/.test(f)) return 'certificat_editeur';
  return 'autre';
}

const escapeCell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

// phase = 'THEORIQUE' | 'DEMO'. Commentaire interne (invisible portail).
function buildPushComment({ criteria, scores, justifs, scorePct, verdict, category, solution, phase, userName, sources }) {
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca', dateStyle: 'short', timeStyle: 'short' });
  const rows = criteria.map((c, i) => {
    const note = scores?.[i] ?? scores?.[String(i)];
    const just = justifs?.[i] ?? justifs?.[String(i)] ?? '—';
    return `|${escapeCell(c.n)}|${note ?? '—'}/2|${escapeCell(just)}|`;
  }).join('\n');
  const phaseLabel = phase === 'DEMO' ? 'après démonstration' : 'théorique (sur pièces)';
  return [
    `🤖 *Évaluation compétence — ${escapeCell(category)}${solution ? ' · ' + escapeCell(solution) : ''}*`,
    '',
    `*Phase :* ${phaseLabel}`,
    `*Demandé par :* ${escapeCell(userName)}`,
    `*Date :* ${date}`,
    sources?.length ? `*Sources :* ${sources.map(escapeCell).join(', ')}` : '*Sources :* —',
    '',
    '||Critère||Note||Justification||',
    rows,
    '',
    `*Note globale : ${scorePct}% — ${VERDICT_LABEL[verdict] || verdict}*`,
    '',
    '_Commentaire interne — non visible sur le portail client._'
  ].join('\n');
}

module.exports = { deduceProgramCode, getCategoryCriteria, resolveCriteria, classifySource, buildPushComment, VERDICT_LABEL, ACTION_PREFIX_TO_PROGRAM };
