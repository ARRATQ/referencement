const { test } = require('node:test');
const assert = require('node:assert');
const { mapIntervenantRow, mapCompetenceRow } = require('../src/services/historique');

test('mapIntervenantRow aplatit les champs et dérive evaluatorName', () => {
  const createdAt = new Date('2026-07-21T10:00:00Z');
  const row = mapIntervenantRow({
    id: 'i1', jiraKey: 'PTC-1', status: 'PUSHED', cvFilename: 'cv.pdf',
    evaluator: { name: 'Alice' }, createdAt, pushedAt: null, extra: 'ignoré'
  });
  assert.deepStrictEqual(row, {
    id: 'i1', jiraKey: 'PTC-1', status: 'PUSHED', cvFilename: 'cv.pdf',
    evaluatorName: 'Alice', createdAt, pushedAt: null
  });
});

test('mapIntervenantRow tolère relation et champs nuls', () => {
  const row = mapIntervenantRow({ id: 'i2', jiraKey: 'PTC-2', status: 'DRAFT', createdAt: null });
  assert.strictEqual(row.evaluatorName, null);
  assert.strictEqual(row.cvFilename, null);
  assert.strictEqual(row.pushedAt, null);
});

test('mapCompetenceRow expose verdicts, score et clés liées', () => {
  const createdAt = new Date('2026-07-21T11:00:00Z');
  const row = mapCompetenceRow({
    id: 'c1', jiraKeyCompetence: 'PTC-33233', jiraKeyIntervenant: 'PTC-100',
    jiraKeyPrestataire: null, status: 'DEMO_DONE', programCode: 'GO_SIYAHA_V04',
    theoVerdict: 'VALIDE', demoVerdict: 'VALIDE', demoScorePct: 88,
    evaluator: { name: 'Bob' }, createdAt, pushedAt: null
  });
  assert.deepStrictEqual(row, {
    id: 'c1', jiraKeyCompetence: 'PTC-33233', jiraKeyIntervenant: 'PTC-100',
    jiraKeyPrestataire: null, status: 'DEMO_DONE', programCode: 'GO_SIYAHA_V04',
    theoVerdict: 'VALIDE', demoVerdict: 'VALIDE', demoScorePct: 88,
    evaluatorName: 'Bob', createdAt, pushedAt: null
  });
});

test('mapCompetenceRow tolère les nuls', () => {
  const row = mapCompetenceRow({ id: 'c2', jiraKeyCompetence: 'PTC-3', status: 'DRAFT', createdAt: null });
  assert.strictEqual(row.evaluatorName, null);
  assert.strictEqual(row.theoVerdict, null);
  assert.strictEqual(row.demoScorePct, null);
  assert.strictEqual(row.jiraKeyIntervenant, null);
});
