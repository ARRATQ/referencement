const test = require('node:test');
const assert = require('node:assert');
const { resolveCriteria } = require('../src/services/competence');

const program = {
  categories: {
    PMS: { label: 'PMS', criteria: [{ n: 'Compta CGNC', w: 2 }, { n: 'Stocks', w: 1 }] },
  },
};
const custom = [{ n: 'Critère perso', w: 1, d: 'desc', consistance: 'x' }];

test('resolveCriteria : customCriteria non vide → grille personnalisée', () => {
  const out = resolveCriteria({ customCriteria: custom, categoryKey: 'PMS' }, program);
  assert.deepStrictEqual(out, custom);
});

test('resolveCriteria : customCriteria vide → fallback catégorie du programme', () => {
  const out = resolveCriteria({ customCriteria: [], categoryKey: 'PMS' }, program);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].n, 'Compta CGNC');
});

test('resolveCriteria : customCriteria absent → fallback catégorie du programme', () => {
  const out = resolveCriteria({ categoryKey: 'PMS' }, program);
  assert.strictEqual(out.length, 2);
});

test('resolveCriteria : categoryKey explicite prioritaire sur celui de l\'éval', () => {
  const out = resolveCriteria({ categoryKey: 'AUTRE' }, program, 'PMS');
  assert.strictEqual(out.length, 2);
});

test('resolveCriteria : ni custom ni catégorie connue → tableau vide', () => {
  assert.deepStrictEqual(resolveCriteria({ categoryKey: 'INCONNU' }, program), []);
  assert.deepStrictEqual(resolveCriteria(null, null), []);
});
