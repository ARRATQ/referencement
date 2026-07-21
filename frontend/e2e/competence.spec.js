import { test, expect } from '@playwright/test';

test('deep-link compétence charge le contexte', async ({ page }) => {
  await page.route('**/api/competences/PTC-33233', route => route.fulfill({ json: {
    key: 'PTC-33233', summary: 'Compétence PMS', status: 'Ouvert',
    context: { competence: { key: 'PTC-33233', summary: 'Compétence PMS' }, intervenant: { key: 'PTC-2', summary: 'Int' }, prestataire: { key: 'PTC-3', summary: 'Presta' } },
    fields: { solutionReferencee: { value: 'SolX', jiraName: 'Solution Référencée' } },
    unresolved: [], actionAReferencer: 'SYH-…', programCode: 'GO_SIYAHA',
    program: { code: 'GO_SIYAHA', name: 'Go Siyaha', categories: { pms: { label: 'PMS', criteria: [{ n: 'Réservations', w: 2 }] } } },
    sources: [], existing: null, linkedIntervenant: null
  }}));
  await page.goto('/competences?key=PTC-33233');
  await expect(page.getByText('Compétence PMS')).toBeVisible();
  await expect(page.getByText('PTC-3')).toBeVisible();
});
