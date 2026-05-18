function computeSolutionScore(scores, criteria, enabled = {}) {
  let max = 0, score = 0, answered = 0;
  criteria.forEach((c, i) => {
    if (enabled[i] === false) return;
    max += 2 * (c.w || 1);
    if (scores[i] !== undefined && scores[i] !== null) {
      score += Number(scores[i]) * (c.w || 1);
      answered++;
    }
  });
  if (!answered) return { pct: null, verdict: null, answered };
  const pct = Math.round((score / max) * 100);
  const verdict = pct >= 60 ? 'FAVORABLE' : pct >= 45 ? 'CONDITIONNEL' : 'DEFAVORABLE';
  return { pct, verdict, answered };
}

function computeIntegratorScore(scores, criteria, enabled = {}) {
  let max = 0, score = 0, answered = 0;
  criteria.forEach((c, i) => {
    if (enabled[i] === false) return;
    max += 2 * (c.w || 1);
    if (scores[i] !== undefined && scores[i] !== null) {
      score += Number(scores[i]) * (c.w || 1);
      answered++;
    }
  });
  if (!answered) return { pct: null, verdict: null, answered };
  const pct = Math.round((score / max) * 100);
  const verdict = pct >= 55 ? 'FAVORABLE' : pct >= 40 ? 'CONDITIONNEL' : 'DEFAVORABLE';
  return { pct, verdict, answered };
}

function computeFinalDecision(solPct, intPct) {
  if (solPct === null || intPct === null) return { globalPct: null, decision: null };
  const globalPct = Math.round(solPct * 0.6 + intPct * 0.4);
  let decision;
  if (globalPct >= 60 && solPct >= 60 && intPct >= 55) decision = 'REFERENCE';
  else if (globalPct >= 48) decision = 'CONDITIONNEL';
  else decision = 'REJETE';
  return { globalPct, decision };
}

function autoScoreIntegrator(cvFields) {
  const { diplome = '', exp = 0, expSol = 0, equipe = 0 } = cvFields;
  const scores = {};
  const d = diplome.toLowerCase();
  if (d.includes('ingénieur') || d.includes('bac+5') || d.includes('master') || d.includes('doctorat')) scores[0] = 2;
  else if (d.includes('bac+4') || d.includes('licence') || d.includes('bac+3')) scores[0] = 1;
  else if (d.includes('bac+2') || d.includes('dut') || d.includes('bts')) scores[0] = 1;
  else scores[0] = 0;

  const e = Number(exp);
  scores[1] = e >= 10 ? 2 : e >= 5 ? 1 : 0;

  const es = Number(expSol);
  scores[2] = es >= 5 ? 2 : es >= 2 ? 1 : 0;

  const eq = Number(equipe);
  scores[5] = eq >= 5 ? 2 : eq >= 2 ? 1 : 0;

  return scores;
}

module.exports = { computeSolutionScore, computeIntegratorScore, computeFinalDecision, autoScoreIntegrator };
