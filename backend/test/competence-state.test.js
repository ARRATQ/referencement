const test = require('node:test');
const assert = require('node:assert');
const { computeSolutionScore } = require('../src/services/scoring');

test('note hors 0/1/2 rejetée par la garde', () => {
  for (const v of [3, -1, 1.5]) assert.ok(![0,1,2].includes(Number(v)));
});
test('verdict cohérent au seuil max', () => {
  assert.strictEqual(computeSolutionScore({0:2}, [{n:'a',w:1}], {}).verdict, 'FAVORABLE');
});
