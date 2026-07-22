<template>
  <div>
    <div v-if="loading" class="card" style="text-align:center; padding:40px;">
      <span class="spinner spinner-dark"></span>
    </div>

    <div v-else-if="error" class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-title">Chargement impossible</div>
      <div class="text-sm mt8">{{ error }}</div>
    </div>

    <div v-else-if="!rows.length" class="empty-state">
      <div class="empty-icon">🧩</div>
      <div class="empty-title">Aucune évaluation compétence</div>
      <div class="text-sm mt8">Les évaluations compétence réalisées apparaîtront ici.</div>
    </div>

    <div v-else class="card" style="padding:0; overflow:hidden;">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticket compétence</th>
              <th>Programme</th>
              <th>Verdict théorique</th>
              <th>Verdict démo</th>
              <th>Score démo</th>
              <th>Statut</th>
              <th>Évaluateur</th>
              <th>Créée le</th>
              <th>Poussée le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ev in rows" :key="ev.id">
              <td><span class="text-mono">{{ ev.jiraKeyCompetence }}</span></td>
              <td>{{ ev.programCode || '—' }}</td>
              <td><span class="badge" :class="verdictBadge(ev.theoVerdict)">{{ verdictLabel(ev.theoVerdict) }}</span></td>
              <td><span class="badge" :class="verdictBadge(ev.demoVerdict)">{{ verdictLabel(ev.demoVerdict) }}</span></td>
              <td>{{ ev.demoScorePct !== null && ev.demoScorePct !== undefined ? ev.demoScorePct + '%' : '—' }}</td>
              <td><span class="badge" :class="statusBadge(ev.status)">{{ statusLabel(ev.status) }}</span></td>
              <td>{{ ev.evaluatorName || '—' }}</td>
              <td class="text-mono">{{ fmtDate(ev.createdAt) }}</td>
              <td class="text-mono">{{ fmtDate(ev.pushedAt) }}</td>
              <td>
                <RouterLink :to="{ path: '/competences', query: { key: ev.jiraKeyCompetence } }" class="btn btn-ghost btn-sm">↗ Rouvrir</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const rows = ref([])
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('/competences')
    rows.value = data
  } catch (e) {
    error.value = e.response?.data?.error || e.message
  } finally {
    loading.value = false
  }
})

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-MA') : '—'
}
function statusLabel(s) {
  return { DRAFT: 'En cours', THEORIQUE_DONE: 'Théorique OK', DEMO_DONE: 'Démo OK', PUSHED: 'Envoyée Jira' }[s] || s
}
function statusBadge(s) {
  return { DRAFT: 'badge-amber', THEORIQUE_DONE: 'badge-blue', DEMO_DONE: 'badge-blue', PUSHED: 'badge-green' }[s] || 'badge-gray'
}
function verdictLabel(v) {
  if (!v) return '—'
  return { FAVORABLE: 'Favorable', CONDITIONNEL: 'Conditionnel', DEFAVORABLE: 'Défavorable' }[v] || v
}
function verdictBadge(v) {
  if (!v) return 'badge-gray'
  return { FAVORABLE: 'badge-green', CONDITIONNEL: 'badge-amber', DEFAVORABLE: 'badge-red' }[v] || 'badge-gray'
}
</script>
