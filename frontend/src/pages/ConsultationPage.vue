<template>
  <div>
    <div class="topbar">
      <div>
        <div class="topbar-title">Consultation</div>
        <div class="topbar-sub">Évaluations de la commission</div>
      </div>
    </div>
    <div class="content">
      <div class="tabs-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'ancienne' }" @click="setTab('ancienne')">Ancienne évaluation</button>
        <button v-if="auth.isGestionnaire" class="tab-btn" :class="{ active: activeTab === 'intervenant' }" @click="setTab('intervenant')">Intervenant</button>
        <button v-if="auth.isGestionnaire" class="tab-btn" :class="{ active: activeTab === 'competence' }" @click="setTab('competence')">Compétence</button>
      </div>

      <div v-if="activeTab === 'ancienne'">
      <div class="row gap8 mb8">
        <input v-model="search" placeholder="Rechercher prestataire, solution..." style="width:280px;" />
        <select v-model="filterStatus" style="width:180px;">
          <option value="">Tous les statuts</option>
          <option value="DRAFT">En cours</option>
          <option value="SUBMITTED">Soumises</option>
        </select>
        <select v-model="filterDecision" style="width:180px;">
          <option value="">Toutes les décisions</option>
          <option value="REFERENCE">Référencé</option>
          <option value="CONDITIONNEL">Conditionnel</option>
          <option value="REJETE">Rejeté</option>
        </select>
        <select v-model="filterProgram" style="width:200px;">
          <option value="">Tous les programmes</option>
          <option v-for="p in programs" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>

      <div v-if="loading" class="card" style="text-align:center; padding:40px;">
        <span class="spinner spinner-dark"></span>
      </div>

      <div v-else-if="!filtered.length" class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Aucune évaluation</div>
        <div class="text-sm mt8">Les évaluations de la commission apparaîtront ici.</div>
      </div>

      <div v-else class="card" style="padding:0; overflow:hidden;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Programme</th>
                <th>Prestataire</th>
                <th>Solution / Action</th>
                <th>Score solution</th>
                <th>Score intégrateur</th>
                <th>Score global</th>
                <th>Décision</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ev in filtered" :key="ev.id">
                <td><span class="text-mono">{{ ev.program?.code }}</span></td>
                <td>{{ ev.prestataire }}</td>
                <td>{{ ev.solution || ev.actionLabel || '—' }}</td>
                <td>{{ ev.solScorePct !== null ? ev.solScorePct + '%' : '—' }}</td>
                <td>{{ ev.intScorePct !== null ? ev.intScorePct + '%' : '—' }}</td>
                <td><strong>{{ ev.finalScorePct !== null ? ev.finalScorePct + '%' : '—' }}</strong></td>
                <td><span class="badge" :class="decisionBadge(ev.finalDecision)">{{ decisionLabel(ev.finalDecision) }}</span></td>
                <td>
                  <span class="badge" :class="ev.status === 'DRAFT' ? 'badge-amber' : 'badge-green'">
                    {{ ev.status === 'DRAFT' ? 'En cours' : 'Soumise' }}
                  </span>
                </td>
                <td class="text-mono">{{ ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString('fr-MA') : new Date(ev.createdAt).toLocaleDateString('fr-MA') }}</td>
                <td>
                  <RouterLink :to="'/evaluations/' + ev.id" class="btn btn-ghost btn-sm">👁 Voir</RouterLink>
                  <button v-if="ev.pvText" class="btn btn-ghost btn-sm" @click="showPV(ev)">📄 PV</button>
                  <RouterLink v-if="auth.isGestionnaire && ev.status === 'DRAFT'" :to="'/evaluation/' + ev.id" class="btn btn-ghost btn-sm">↩ Reprendre</RouterLink>
                  <button v-if="auth.isAdmin" class="btn btn-ghost btn-sm" style="color:var(--red, #ef4444);" @click="deleteEvaluation(ev)">🗑 Supprimer</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PV Modal -->
      <div v-if="pvModal" class="modal-overlay" @click.self="pvModal = null">
        <div class="modal" style="width:680px;">
          <div class="modal-title">Procès-verbal — {{ pvModal.prestataire }}</div>
          <div class="modal-sub">{{ pvModal.program?.name }} · {{ new Date(pvModal.submittedAt).toLocaleDateString('fr-MA') }}</div>
          <div style="background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:16px; font-size:13px; line-height:1.8; white-space:pre-wrap; max-height:60vh; overflow-y:auto;">{{ pvModal.pvText }}</div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="pvModal = null">Fermer</button>
            <button class="btn btn-secondary" @click="copyPV">⎘ Copier</button>
          </div>
        </div>
      </div>
      </div><!-- /onglet ancienne -->

      <HistoriqueIntervenant v-if="auth.isGestionnaire && activeTab === 'intervenant'" />
      <HistoriqueCompetence v-if="auth.isGestionnaire && activeTab === 'competence'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import HistoriqueIntervenant from '@/components/historique/HistoriqueIntervenant.vue'
import HistoriqueCompetence from '@/components/historique/HistoriqueCompetence.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const VALID_TABS = ['ancienne', 'intervenant', 'competence']
const initialTab = VALID_TABS.includes(route.query.tab) ? route.query.tab : 'ancienne'
// Les onglets historique sont réservés gestionnaire/admin : repli sur « ancienne » sinon.
const activeTab = ref(initialTab !== 'ancienne' && !auth.isGestionnaire ? 'ancienne' : initialTab)

function setTab(tab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}

const evaluations = ref([])
const programs = ref([])
const loading = ref(false)
const search = ref('')
const filterStatus = ref('')
const filterDecision = ref('')
const filterProgram = ref('')
const pvModal = ref(null)

const filtered = computed(() =>
  evaluations.value.filter(ev => {
    const q = search.value.toLowerCase()
    const matchSearch = !q || ev.prestataire?.toLowerCase().includes(q) || ev.solution?.toLowerCase().includes(q) || ev.actionLabel?.toLowerCase().includes(q)
    const matchStatus = !filterStatus.value || ev.status === filterStatus.value
    const matchDec = !filterDecision.value || ev.finalDecision === filterDecision.value
    const matchProg = !filterProgram.value || ev.programId === filterProgram.value
    return matchSearch && matchStatus && matchDec && matchProg
  })
)

onMounted(async () => {
  if (route.query.program) filterProgram.value = route.query.program
  loading.value = true
  try {
    const [evRes, progRes] = await Promise.all([
      api.get('/evaluations'),
      api.get('/programs')
    ])
    evaluations.value = evRes.data
    programs.value = progRes.data
  } finally {
    loading.value = false
  }
})

function decisionBadge(d) {
  return { REFERENCE: 'badge-green', CONDITIONNEL: 'badge-amber', REJETE: 'badge-red' }[d] || 'badge-gray'
}
function decisionLabel(d) {
  return { REFERENCE: 'Référencé', CONDITIONNEL: 'Conditionnel', REJETE: 'Rejeté' }[d] || '—'
}
async function deleteEvaluation(ev) {
  const label = ev.prestataire || ev.solution || ev.actionLabel || ev.id
  if (!confirm(`Supprimer définitivement le référencement "${label}" ?\nCette action est irréversible.`)) return
  try {
    await api.delete(`/evaluations/${ev.id}`)
    evaluations.value = evaluations.value.filter(e => e.id !== ev.id)
  } catch (e) {
    alert(e.response?.data?.error || e.message)
  }
}

function showPV(ev) { pvModal.value = ev }
async function copyPV() {
  if (pvModal.value?.pvText) {
    await navigator.clipboard.writeText(pvModal.value.pvText)
  }
}
</script>

<style scoped>
.tabs-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.tab-btn {
  padding: 8px 16px;
  border: none;
  background: none;
  color: var(--text3);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab-btn:hover { color: var(--text); }
.tab-btn.active {
  color: var(--primary, #2563eb);
  border-bottom-color: var(--primary, #2563eb);
}
</style>
