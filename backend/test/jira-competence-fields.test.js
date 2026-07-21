const test = require('node:test');
const assert = require('node:assert');
const { COMPETENCE_FIELDS } = require('../src/services/jira');

test('COMPETENCE_FIELDS couvre les 7 champs contexte', () => {
  const keys = COMPETENCE_FIELDS.map(f => f.key);
  assert.deepStrictEqual(new Set(keys), new Set([
    'solutionReferencee', 'modules', 'secteur',
    'modeAcquisition', 'origine', 'natureParticipant', 'typeIntervenant'
  ]));
});
