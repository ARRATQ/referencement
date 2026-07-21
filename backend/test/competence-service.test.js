const test = require('node:test');
const assert = require('node:assert');
const { deduceProgramCode, classifySource, buildPushComment } = require('../src/services/competence');

test('deduceProgramCode : préfixe SYH → GO_SIYAHA', () => {
  assert.strictEqual(deduceProgramCode('SYH-Acquisition et intégration…', 'PTC'), 'GO_SIYAHA_V04');
});
test('deduceProgramCode : inconnu → null', () => {
  assert.strictEqual(deduceProgramCode('XXX-autre', 'PTC'), null);
});
test('classifySource', () => {
  assert.strictEqual(classifySource('Grille_fonctionnelle_PMS.xlsx'), 'grille_fonctionnelle');
  assert.strictEqual(classifySource('attestation-reference-client.pdf'), 'attestation_reference');
  assert.strictEqual(classifySource('certificat editeur Oracle.pdf'), 'certificat_editeur');
  assert.strictEqual(classifySource('divers.txt'), 'autre');
});
test('buildPushComment : tableau + note globale + marqueur interne', () => {
  const out = buildPushComment({
    criteria: [{ n: 'Compta CGNC', w: 2 }, { n: 'Stocks', w: 1 }],
    scores: { 0: 2, 1: 1 }, justifs: { 0: 'conforme', 1: 'partiel' },
    scorePct: 78, verdict: 'FAVORABLE', category: 'PMS', solution: 'SolX',
    phase: 'DEMO', userName: 'Jean', sources: ['Grille_fonctionnelle_PMS.xlsx']
  });
  assert.match(out, /\|\|Critère\|\|Note\|\|Justification\|\|/);
  assert.match(out, /Compta CGNC/);
  assert.match(out, /78\s*%/);
  assert.match(out, /Référencée/);
  assert.match(out, /Commentaire interne/);
});
