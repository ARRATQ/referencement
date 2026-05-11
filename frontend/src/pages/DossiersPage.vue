<template>
  <div>
    <div class="topbar">
      <div>
        <div class="topbar-title">Dossiers Jira</div>
        <div class="topbar-sub">Prestataires en attente d'évaluation</div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-secondary btn-sm" :disabled="loading" @click="loadDossiers">
          <span v-if="loading" class="spinner spinner-dark"></span>
          <span v-else>↻ Sync Jira</span>
        </button>
      </div>
    </div>
    <div class="content">
      <!-- Filtres -->
      <div class="row-between mb8">
        <div class="row gap8">
          <input v-model="search" placeholder="Rechercher..." style="width:240px;" />
          <select v-model="filterStatus" style="width:160px;">
            <option value="">Tous les statuts</option>
            <option value="En cours">En cours</option>
            <option value="Référencé">Référencé</option>
            <option value="Rejeté">Rejeté</option>
          </select>
        </div>
      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Clé</th><th>Résumé</th><th>Type</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="d in filtered" :key="d.key">
                <td><span class="text-mono">{{ d.key }}</span></td>
                <td>{{ d.summary }}</td>
                <td>{{ d.issueType }}</td>
                <td><span class="badge" :class="statusBadge(d.status)">{{ d.status }}</span></td>
                <td class="td-action">
                  <button class="btn btn-ghost btn-sm" @click="loadHierarchy(d.key)">⊞ Voir</button>
                  <RouterLink :to="`/evaluation?jiraKey=${d.key}`" class="btn btn-primary btn-sm">+ Évaluer</RouterLink>
                </td>
              </tr>
              <tr v-if="!filtered.length && !loading">
                <td colspan="5" style="text-align:center; color:var(--text3); padding:32px;">
                  {{ dossiers.length ? 'Aucun résultat' : 'Cliquez sur Sync Jira pour charger les dossiers' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Panneau hiérarchie -->
      <div v-if="hierarchy" ref="hierarchyPanel" class="card">
        <div class="card-title">Hiérarchie — {{ hierarchy.key }}</div>
        <div class="hierarchy-tree">
          <div class="hierarchy-level prestataire">
            <span class="hierarchy-dot dot-prest"></span>
            <strong>{{ hierarchy.key }}</strong> — {{ hierarchy.summary }}
            <span class="badge badge-gray" style="margin-left:auto;">{{ hierarchy.status }}</span>
          </div>
          <template v-for="int in hierarchy.intervenants" :key="int.key">
            <div class="hierarchy-level intervenant">
              <span class="hierarchy-dot dot-int"></span>
              <span>{{ int.key }}</span> — {{ int.summary }}
              <span v-if="int.attachments?.length" class="text-mono" style="margin-left:8px;">📎 {{ int.attachments.length }} fichier(s)</span>
            </div>
            <div v-for="comp in int.competences" :key="comp.key" class="hierarchy-level competence">
              <span class="hierarchy-dot dot-comp"></span>
              <span>{{ comp.key }}</span> — {{ comp.summary }}
              <span v-if="comp.attachments?.length" class="text-mono" style="margin-left:8px;">📎 {{ comp.attachments.length }} fichier(s)</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import api from '@/services/api'

const dossiers = ref([])
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')
const hierarchy = ref(null)
const hierarchyPanel = ref(null)

const filtered = computed(() =>
  dossiers.value.filter(d => {
    const q = search.value.toLowerCase()
    const matchSearch = !q || d.key.toLowerCase().includes(q) || d.summary?.toLowerCase().includes(q)
    const matchStatus = !filterStatus.value || d.status === filterStatus.value
    return matchSearch && matchStatus
  })
)

async function loadDossiers() {
  loading.value = true
  hierarchy.value = null
  try {
    const { data } = await api.get('/dossiers')
    dossiers.value = data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadHierarchy(key) {
  // Fermer si on reclique sur la même clé
  if (hierarchy.value?.key === key) { hierarchy.value = null; return }
  try {
    const { data } = await api.get(`/dossiers/${key}/intervenants`)
    hierarchy.value = data
    await nextTick()
    hierarchyPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {}
}

function statusBadge(status) {
  if (!status) return 'badge-gray'
  const s = status.toLowerCase()
  if (s.includes('réf') || s.includes('ref')) return 'badge-green'
  if (s.includes('rej') || s.includes('rejet')) return 'badge-red'
  return 'badge-amber'
}
</script>
