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
              <template v-for="d in filtered" :key="d.key">
                <tr :class="{ 'row-expanded': expandedKey === d.key }">
                  <td><span class="text-mono">{{ d.key }}</span></td>
                  <td>{{ d.summary }}</td>
                  <td>{{ d.issueType }}</td>
                  <td><span class="badge" :class="statusBadge(d.status)">{{ d.status }}</span></td>
                  <td class="td-action">
                    <button class="btn btn-ghost btn-sm" :class="{ active: expandedKey === d.key }" @click="toggleHierarchy(d.key)">
                      <span v-if="loadingKey === d.key" class="spinner spinner-dark"></span>
                      <span v-else>{{ expandedKey === d.key ? '▲ Fermer' : '⊞ Voir' }}</span>
                    </button>
                    <RouterLink :to="`/evaluation?jiraKey=${d.key}`" class="btn btn-primary btn-sm">+ Évaluer</RouterLink>
                  </td>
                </tr>
                <!-- Ligne expandée : hiérarchie inline -->
                <tr v-if="expandedKey === d.key" class="hierarchy-row">
                  <td colspan="5" style="padding:0;">
                    <div class="hierarchy-panel">
                      <div v-if="loadingKey === d.key" style="padding:16px; color:var(--text3);">Chargement…</div>
                      <div v-else-if="hierarchies[d.key]" class="hierarchy-tree">
                        <template v-for="int in hierarchies[d.key].intervenants" :key="int.key">
                          <div class="hierarchy-level intervenant">
                            <span class="hierarchy-dot dot-int"></span>
                            <div class="hierarchy-info">
                              <span class="text-mono h-key">{{ int.key }}</span>
                              <span class="h-summary">{{ int.summary }}</span>
                              <span v-if="int.attachments?.length" class="h-attach">📎 {{ int.attachments.length }}</span>
                            </div>
                          </div>
                          <div v-for="comp in int.competences" :key="comp.key" class="hierarchy-level competence">
                            <span class="hierarchy-dot dot-comp"></span>
                            <div class="hierarchy-info">
                              <span class="text-mono h-key">{{ comp.key }}</span>
                              <span class="h-summary">{{ comp.summary }}</span>
                              <span v-if="comp.attachments?.length" class="h-attach">📎 {{ comp.attachments.length }}</span>
                            </div>
                          </div>
                        </template>
                        <div v-if="!hierarchies[d.key].intervenants?.length" style="padding:12px 16px; color:var(--text3); font-size:13px;">
                          Aucun intervenant lié à ce prestataire.
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="!filtered.length && !loading">
                <td colspan="5" style="text-align:center; color:var(--text3); padding:32px;">
                  {{ dossiers.length ? 'Aucun résultat' : 'Cliquez sur Sync Jira pour charger les dossiers' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from '@/services/api'

const dossiers = ref([])
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')
const expandedKey = ref(null)
const loadingKey = ref(null)
const hierarchies = ref({})

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
  expandedKey.value = null
  try {
    const { data } = await api.get('/dossiers')
    dossiers.value = data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function toggleHierarchy(key) {
  if (expandedKey.value === key) {
    expandedKey.value = null
    return
  }
  expandedKey.value = key
  if (hierarchies.value[key]) return
  loadingKey.value = key
  try {
    const { data } = await api.get(`/dossiers/${key}/intervenants`)
    hierarchies.value[key] = data
  } catch {
    hierarchies.value[key] = { intervenants: [] }
  } finally {
    loadingKey.value = null
  }
}

function statusBadge(status) {
  if (!status) return 'badge-gray'
  const s = status.toLowerCase()
  if (s.includes('réf') || s.includes('ref')) return 'badge-green'
  if (s.includes('rej') || s.includes('rejet')) return 'badge-red'
  return 'badge-amber'
}
</script>

<style scoped>
.row-expanded td {
  background: var(--surface2);
}

.hierarchy-row > td {
  border-top: none;
}

.hierarchy-panel {
  background: var(--surface);
  border-top: 2px solid var(--accent);
}

.hierarchy-tree {
  padding: 8px 0;
}

.hierarchy-level {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 20px;
  border-bottom: 1px solid var(--border);
}

.hierarchy-level:last-child {
  border-bottom: none;
}

.hierarchy-level.intervenant {
  background: var(--bg);
  padding-left: 24px;
}

.hierarchy-level.competence {
  background: var(--surface);
  padding-left: 52px;
}

.hierarchy-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-int  { background: var(--accent); }
.dot-comp { background: var(--text3); }

.hierarchy-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.h-key {
  font-size: 12px;
  color: var(--accent);
  flex-shrink: 0;
}

.h-summary {
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.h-attach {
  font-size: 11px;
  color: var(--text3);
  flex-shrink: 0;
  margin-left: auto;
}

.btn.active {
  background: var(--surface2);
  color: var(--accent);
}
</style>
