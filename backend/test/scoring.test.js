const test = require('node:test');
const assert = require('node:assert');
const { computeSolutionScore } = require('../src/services/scoring');

test('toutes notes maxi → 100% FAVORABLE', () => {
  const r = computeSolutionScore({ 0: 2, 1: 2 }, [{ n:'a', w:2 }, { n:'b', w:1 }], {});
  assert.strictEqual(r.pct, 100);
  assert.strictEqual(r.verdict, 'FAVORABLE');
});
test('critère désactivé exclu', () => {
  const r = computeSolutionScore({ 0: 2 }, [{ n:'a', w:1 }, { n:'b', w:1 }], { 1: false });
  assert.strictEqual(r.pct, 100);
  assert.strictEqual(r.answered, 1);
});
test('aucune note → pct null', () => {
  assert.strictEqual(computeSolutionScore({}, [{ n:'a', w:1 }], {}).pct, null);
});
