<template>
  <div v-if="wizardActive" class="wiz-overlay">
    <WizardShell
      :initial-draft="resumeDraft"
      @close="onWizardClose"
      @submitted="onWizardSubmitted"
    />
  </div>

  <div v-else class="page">
    <div class="topbar">
      <div class="topbar-title">Évaluations</div>
      <button class="btn btn-primary" @click="startNew">+ Nouvelle évaluation</button>
    </div>

    <div class="content">
      <!-- Brouillon en cours -->
      <div v-if="draft" class="section">
        <div class="section-label">En cours</div>
        <div class="draft-card" @click="resumeWizard">
          <div class="draft-info">
            <div class="draft-title">{{ draft.form?.prestataire || 'Brouillon sans nom' }}</div>
            <div class="draft-meta">
              Étape {{ (draft.step || 0) + 1 }}/5
              <span v-if="draft.programCode"> · {{ draft.programCode }}</span>
              <span v-if="draft.updatedAt"> · Modifié {{ formatDate(draft.updatedAt) }}</span>
            </div>
          </div>
          <div class="draft-bar-wrap">
            <div class="draft-bar" :style="{ width: progressPct(draft.step) + '%' }"></div>
          </div>
          <div class="draft-actions">
            <button class="btn btn-primary btn-sm" @click.stop="resumeWizard">Reprendre →</button>
            <button class="btn btn-secondary btn-sm" @click.stop="discardDraft">Supprimer</button>
          </div>
        </div>
      </div>

      <!-- Soumises -->
      <div class="section">
        <div class="section-label">Soumises</div>
        <div v-if="loading" class="empty-state">Chargement…</div>
        <div v-else-if="!evaluations.length" class="empty-state">
          <div class="empty-icon">◈</div>
          <div class="empty-title">Aucune évaluation soumise</div>
          <div class="text-sm mt8">Démarrez une nouvelle évaluation pour commencer.</div>
        </div>
        <div v-else class="eval-list">
          <div v-for="ev in evaluations" :key="ev.id" class="eval-card" @click="router.push(`/evaluations/${ev.id}`)" style="cursor:pointer;">
            <div class="eval-main">
              <div class="eval-name">{{ ev.prestataire || ev.form?.prestataire || '—' }}</div>
              <div class="eval-meta">
                <span class="badge-status" :class="ev.status?.toLowerCase()">{{ ev.status }}</span>
                <span>{{ ev.programCode }}</span>
                <span>{{ ev.refType }}</span>
                <span>{{ formatDate(ev.createdAt) }}</span>
              </div>
            </div>
            <div class="eval-decision" v-if="ev.finalDecision">
              <span class="decision-badge" :class="ev.finalDecision?.toLowerCase()">
                {{ { REFERENCE: 'Référencé', CONDITIONNEL: 'Conditionnel', REJETE: 'Rejeté' }[ev.finalDecision] || ev.finalDecision }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watchEffect, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { useEvaluationStore } from '@/stores/evaluation'

const evalStore = useEvaluationStore()
const router = useRouter()

const wizardActive = ref(false)
const resumeDraft = ref(null)
const draft = ref(null)
const evaluations = ref([])
const loading = ref(false)

function progressPct(step = 0) {
  return Math.round(((step + 1) / 5) * 100)
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function startNew() {
  resumeDraft.value = null
  wizardActive.value = true
}

function resumeWizard() {
  resumeDraft.value = draft.value
  wizardActive.value = true
}

function discardDraft() {
  if (confirm('Supprimer ce brouillon ?')) {
    evalStore.clearDraft()
    draft.value = null
  }
}

function onWizardClose() {
  wizardActive.value = false
  resumeDraft.value = null
  draft.value = evalStore.loadDraft()
}

async function onWizardSubmitted() {
  wizardActive.value = false
  resumeDraft.value = null
  draft.value = null
  await loadEvaluations()
}

async function loadEvaluations() {
  loading.value = true
  try {
    evaluations.value = await evalStore.list()
  } catch {
    evaluations.value = []
  } finally {
    loading.value = false
  }
}

watchEffect(() => document.body.classList.toggle('wizard-mode', wizardActive.value))
onUnmounted(() => document.body.classList.remove('wizard-mode'))

onMounted(async () => {
  draft.value = evalStore.loadDraft()
  await loadEvaluations()
})
</script>

<style scoped>
.wiz-overlay { width: 100%; height: 100%; overflow: hidden; }

.page { display: flex; flex-direction: column; height: 100%; }

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 32px; border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.topbar-title { font-size: 18px; font-weight: 700; color: var(--text); }

.content { flex: 1; padding: 32px; overflow-y: auto; max-width: 900px; }

.section { margin-bottom: 40px; }
.section-label {
  font-size: 11px; font-family: var(--mono, monospace); color: var(--text3);
  text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px;
}

.draft-card {
  border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px;
  background: var(--surface); cursor: pointer; transition: border-color 0.15s;
}
.draft-card:hover { border-color: var(--accent); }
.draft-info { margin-bottom: 12px; }
.draft-title { font-size: 16px; font-weight: 600; color: var(--text); }
.draft-meta { font-size: 12px; color: var(--text3); margin-top: 4px; font-family: var(--mono, monospace); }
.draft-bar-wrap { height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 14px; }
.draft-bar { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }
.draft-actions { display: flex; gap: 8px; }

.eval-list { display: flex; flex-direction: column; gap: 10px; }
.eval-card {
  display: flex; align-items: center; gap: 16px;
  border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px;
  background: var(--surface);
}
.eval-main { flex: 1; min-width: 0; }
.eval-name { font-size: 15px; font-weight: 600; color: var(--text); }
.eval-meta {
  display: flex; gap: 12px; margin-top: 4px; font-size: 12px;
  color: var(--text3); flex-wrap: wrap; font-family: var(--mono, monospace);
}

.badge-status {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 10px; font-weight: 600; font-family: var(--mono, monospace);
  background: rgba(255,255,255,0.08); color: var(--text2);
}
.badge-status.submitted { background: rgba(34,197,94,0.1); color: #22c55e; }
.badge-status.draft { background: rgba(251,191,36,0.1); color: #fbbf24; }

.decision-badge {
  padding: 5px 14px; border-radius: 20px; font-size: 12px;
  font-family: var(--mono, monospace); font-weight: 600;
}
.decision-badge.reference { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
.decision-badge.conditionnel { background: rgba(251,191,36,0.12); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }
.decision-badge.rejete { background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.3); }

.empty-state { text-align: center; padding: 48px 0; }
.empty-icon { font-size: 32px; color: var(--text3); margin-bottom: 12px; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--text2); }
.text-sm { font-size: 13px; color: var(--text3); }
.mt8 { margin-top: 8px; }

.btn {
  padding: 9px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid transparent;
  font-family: var(--sans, sans-serif); transition: all 0.15s;
}
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover { opacity: 0.85; }
.btn-secondary { background: transparent; color: var(--text2); border-color: var(--border); }
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
.btn-sm { padding: 6px 14px; font-size: 12px; }
</style>
