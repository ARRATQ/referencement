<template>
  <div>
    <div class="topbar">
      <div>
        <div class="topbar-title">Tableau de bord</div>
        <div class="topbar-sub">Vue d'ensemble des dossiers</div>
      </div>
      <div class="topbar-actions">
        <RouterLink v-if="auth.isGestionnaire" to="/evaluation" class="btn btn-primary btn-sm">+ Nouvelle évaluation</RouterLink>
      </div>
    </div>
    <div class="content">
      <div class="metrics-row">
        <div class="metric">
          <div class="metric-label">Total évaluations</div>
          <div class="metric-value accent">{{ stats.total ?? '—' }}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Référencés</div>
          <div class="metric-value green">{{ stats.byDecision?.REFERENCE ?? 0 }}</div>
        </div>
        <div class="metric">
          <div class="metric-label">En cours / Conditionnel</div>
          <div class="metric-value amber">{{ (stats.byStatus?.DRAFT ?? 0) + (stats.byDecision?.CONDITIONNEL ?? 0) }}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Rejetés</div>
          <div class="metric-value">{{ stats.byDecision?.REJETE ?? 0 }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Accès rapide</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <RouterLink v-if="auth.isGestionnaire" to="/dossiers" class="btn btn-secondary" style="justify-content:flex-start;">⊞ &nbsp;Parcourir les dossiers Jira</RouterLink>
          <RouterLink v-if="auth.isGestionnaire" to="/evaluation" class="btn btn-secondary" style="justify-content:flex-start;">◉ &nbsp;Démarrer une évaluation</RouterLink>
          <RouterLink to="/consultation" class="btn btn-secondary" style="justify-content:flex-start;">📋 &nbsp;Consulter les évaluations</RouterLink>
          <RouterLink v-if="auth.isAdmin" to="/admin" class="btn btn-secondary" style="justify-content:flex-start;">⚙ &nbsp;Administration</RouterLink>
        </div>
      </div>

      <div v-if="stats.byProgram?.length" class="card">
        <div class="card-title">Répartition par programme</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Programme</th><th>Évaluations</th></tr></thead>
            <tbody>
              <tr v-for="p in stats.byProgram" :key="p.id" style="cursor:pointer;" @click="$router.push('/consultation?program=' + p.id)">
                <td><strong>{{ p.name }}</strong> <span class="text-mono">{{ p.code }}</span></td>
                <td><span class="badge badge-blue">{{ p.count }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="!auth.isAdmin && !stats.total" class="card">
        <div class="empty-state">
          <div class="empty-icon">◈</div>
          <div class="empty-title">Aucune évaluation pour le moment</div>
          <div class="text-sm mt8">Les statistiques apparaîtront ici dès que des évaluations seront créées.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

const auth = useAuthStore()
const stats = ref({})

onMounted(async () => {
  if (auth.isAdmin) {
    try {
      const { data } = await api.get('/admin/stats')
      stats.value = data
    } catch {}
  } else {
    try {
      const { data } = await api.get('/evaluations?status=SUBMITTED')
      stats.value = { total: data.length }
    } catch {}
  }
})
</script>
