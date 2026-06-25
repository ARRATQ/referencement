<template>
  <div class="wiz-shell">
    <WizardSidebar
      :steps="STEP_CONFIG"
      :current-step="wizStep"
      :completed-steps="completedSteps"
      :saved-at="savedAt"
      @go-step="goToStep"
      @close="onClose"
    />

    <div class="wiz-main">
      <div v-if="wizStep > 0 && (state.form.prestataire || state.form.jiraKeyPrestataire)" class="wiz-context-bar">
        <div class="ctx-item">
          <span class="ctx-label">Prestataire</span>
          <span class="ctx-val">{{ state.form.prestataire || '—' }}</span>
        </div>
        <div v-if="state.form.jiraKeyPrestataire" class="ctx-item">
          <span class="ctx-label">Dossier</span>
          <span class="ctx-val ctx-mono">{{ state.form.jiraKeyPrestataire }}</span>
        </div>
        <div v-if="state.form.jiraKeyIntervenant" class="ctx-item">
          <span class="ctx-label">Intervenant</span>
          <span class="ctx-val ctx-mono">{{ state.form.jiraKeyIntervenant }}</span>
        </div>
        <div v-if="state.form.jiraKeyCompetence" class="ctx-item">
          <span class="ctx-label">Compétence</span>
          <span class="ctx-val ctx-mono">{{ state.form.jiraKeyCompetence }}</span>
        </div>
      </div>

      <div class="wiz-content">
        <StepContexte v-if="wizStep === 0" />
        <StepIdentification v-else-if="wizStep === 1" />
        <StepDossier v-else-if="wizStep === 2" />
        <StepEvaluation v-else-if="wizStep === 3" />
        <StepSynthese v-else-if="wizStep === 4" @submit="onSubmitRequest" @save-draft="doSaveDraft" />
      </div>

      <div class="wiz-footer">
        <button v-if="wizStep > 0" class="wiz-btn-ghost" @click="prevStep">← Précédent</button>
        <div class="wiz-spacer"></div>
        <div v-if="submitError" class="wiz-footer-error">{{ submitError }}</div>
        <button
          v-if="wizStep < 4"
          class="wiz-btn-primary"
          :disabled="!isStepValid"
          @click="nextStep"
        >
          Suivant →
        </button>
      </div>
    </div>

    <!-- Confirm exit modal -->
    <div v-if="showExitConfirm" class="exit-overlay" @click.self="showExitConfirm = false">
      <div class="exit-modal">
        <div class="exit-title">Quitter l'évaluation ?</div>
        <div class="exit-text">Votre brouillon sera conservé. Vous pourrez le reprendre depuis la liste.</div>
        <div class="exit-btns">
          <button class="wiz-btn-ghost" @click="showExitConfirm = false">Continuer l'évaluation</button>
          <button class="exit-btn-confirm" @click="doClose">Sauvegarder & quitter</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, provide, watch, onMounted, onBeforeUnmount } from 'vue'
import WizardSidebar from './WizardSidebar.vue'
import StepContexte from './steps/StepContexte.vue'
import StepIdentification from './steps/StepIdentification.vue'
import StepDossier from './steps/StepDossier.vue'
import StepEvaluation from './steps/StepEvaluation.vue'
import StepSynthese from './steps/StepSynthese.vue'
import { useEvaluationStore } from '@/stores/evaluation'
import api from '@/services/api'

const props = defineProps({
  initialDraft: { type: Object, default: null },
  evaluationId: { type: String, default: null }
})
const emit = defineEmits(['close', 'submitted'])

const evalStore = useEvaluationStore()

const STEP_CONFIG = [
  { label: 'Contexte', sub: 'Programme & catégorie' },
  { label: 'Identification', sub: 'Prestataire & dossier' },
  { label: 'Dossier', sub: 'Informations & documents' },
  { label: 'Évaluation', sub: 'Grilles de scoring' },
  { label: 'Synthèse', sub: 'Récapitulatif & soumission' },
]

const wizStep = ref(0)
const savedAt = ref('')
const programs = ref([])
const jiraBaseUrl = ref('')
const currentEvalId = ref(props.evaluationId)
const submitError = ref('')
const showExitConfirm = ref(false)

const state = reactive({
  programCode: '',
  refType: 'SOLUTION',
  selectedCategory: null,
  identMode: null,
  form: {
    prestataire: '', solution: '', actionLabel: '',
    jiraKeyPrestataire: '', jiraKeyIntervenant: '', jiraKeyCompetence: '',
    modules: [], origine: '', nature: '', modeAcquisition: '',
    secteur: '', rapporteur: '', dateDemo: '',
    finalDecision: '', conditions: '', commissionComments: '', decisionDate: '',
  },
  solScores: {}, solObs: {}, solEnabled: {},
  intScores: {}, intObs: {}, intEnabled: {},
  cvFields: { diplome: '', etablissement: '', exp: 0, expSol: 0, poste: '', equipe: 1, certif: '', refs: '' },
  aiTexts: { briefing: '', cv: '', attestations: '', certifEditeur: '', coherence: '', pv: '', specsAnalysis: '', demoScenario: '', webInsights: '' },
  customCriteria: [],
  customIntCriteria: [],
  jiraHierarchy: null,
  extractedIntervenant: null,
  extractedCompetence: null,
  docPickers: {
    specsSource: 'upload',   specsAttIds: [],   specsNames: [],
    cvSource: 'intervenant', cvAttIds: [],      cvNames: [],
    attSource: 'competence', attIds: [],        attNames: [],
    certifSource: 'competence', certifAttIds: [], certifNames: [],
  },
})

// ── Computeds ─────────────────────────────────────────────────────────────────

const currentProgram = computed(() =>
  programs.value.find(p => p.code === state.programCode) || null
)

const currentCriteria = computed(() => {
  if (!currentProgram.value || !state.selectedCategory) return null
  if (state.refType === 'SOLUTION') return currentProgram.value.categories?.[state.selectedCategory]
  return currentProgram.value.actionTypes?.[state.selectedCategory]
})

const selectedAction = computed(() => {
  if (!state.form.actionLabel || !currentCriteria.value?.criteria) return null
  return currentCriteria.value.criteria.find(c => c.n === state.form.actionLabel) || null
})

const evalCriteria = computed(() => {
  if (state.customCriteria.length > 0) return state.customCriteria
  if (!currentCriteria.value?.criteria) return []
  if (state.refType === 'ACTION' && selectedAction.value) return [selectedAction.value]
  return currentCriteria.value.criteria
})

const consultantCriteria = computed(() => {
  if (state.customIntCriteria.length > 0) return state.customIntCriteria
  return currentProgram.value?.intCriteria || []
})

const solScore = computed(() => {
  const crit = evalCriteria.value
  let max = 0, score = 0, answered = 0
  crit.forEach((c, i) => {
    if (state.solEnabled[i] === false) return
    max += 2 * (c.w || 1)
    if (state.solScores[i] !== undefined) { score += state.solScores[i] * (c.w || 1); answered++ }
  })
  if (!answered) return { pct: null, verdict: null }
  const pct = Math.round(score / max * 100)
  return { pct, verdict: pct >= 60 ? 'FAVORABLE' : pct >= 45 ? 'CONDITIONNEL' : 'DEFAVORABLE' }
})

const intScore = computed(() => {
  const crit = consultantCriteria.value
  let max = 0, score = 0, answered = 0
  crit.forEach((c, i) => {
    if (state.intEnabled[i] === false) return
    max += 2 * (c.w || 1)
    if (state.intScores[i] !== undefined) { score += state.intScores[i] * (c.w || 1); answered++ }
  })
  if (!answered) return { pct: null, verdict: null }
  const pct = Math.round(score / max * 100)
  return { pct, verdict: pct >= 55 ? 'FAVORABLE' : pct >= 40 ? 'CONDITIONNEL' : 'DEFAVORABLE' }
})

const globalScore = computed(() => {
  if (solScore.value.pct === null || intScore.value.pct === null) return null
  return Math.round(solScore.value.pct * 0.6 + intScore.value.pct * 0.4)
})

const finalDecision = computed(() => {
  if (globalScore.value === null) return null
  const s = solScore.value.pct, i = intScore.value.pct, g = globalScore.value
  if (g >= 60 && s >= 60 && i >= 55) return 'REFERENCE'
  if (g >= 48) return 'CONDITIONNEL'
  return 'REJETE'
})

const isStepValid = computed(() => [
  !!(state.programCode && state.refType && state.selectedCategory),
  !!(state.form.prestataire),
  !!(state.form.rapporteur),
  !!(state.aiTexts.coherence),
  true,
][wizStep.value])

const completedSteps = computed(() => {
  const result = []
  for (let i = 0; i < wizStep.value; i++) result.push(i)
  return result
})

// ── Draft ─────────────────────────────────────────────────────────────────────

let draftTimer = null

function getDraftData() {
  return {
    step: wizStep.value,
    programCode: state.programCode,
    refType: state.refType,
    selectedCategory: state.selectedCategory,
    identMode: state.identMode,
    form: { ...state.form, modules: [...(state.form.modules || [])] },
    solScores: { ...state.solScores },
    solObs: { ...state.solObs },
    intScores: { ...state.intScores },
    intObs: { ...state.intObs },
    cvFields: { ...state.cvFields },
    aiTexts: { ...state.aiTexts },
    customCriteria: [...state.customCriteria],
    customIntCriteria: [...state.customIntCriteria],
    docPickers: { ...state.docPickers,
      specsAttIds: [...state.docPickers.specsAttIds], specsNames: [...state.docPickers.specsNames],
      cvAttIds: [...state.docPickers.cvAttIds],       cvNames: [...state.docPickers.cvNames],
      attIds: [...state.docPickers.attIds],           attNames: [...state.docPickers.attNames],
      certifAttIds: [...state.docPickers.certifAttIds], certifNames: [...state.docPickers.certifNames],
    },
  }
}

function doSaveDraft() {
  evalStore.saveDraft(getDraftData())
  const now = new Date()
  savedAt.value = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function scheduleDraftSave() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(doSaveDraft, 1500)
}

function loadFromDraft(draft) {
  if (!draft) return
  wizStep.value = draft.step || 0
  state.programCode = draft.programCode || ''
  state.refType = draft.refType || 'SOLUTION'
  state.selectedCategory = draft.selectedCategory || null
  state.identMode = draft.identMode || null
  if (draft.form) Object.assign(state.form, draft.form)
  if (draft.solScores) Object.assign(state.solScores, draft.solScores)
  if (draft.solObs) Object.assign(state.solObs, draft.solObs)
  if (draft.intScores) Object.assign(state.intScores, draft.intScores)
  if (draft.intObs) Object.assign(state.intObs, draft.intObs)
  if (draft.cvFields) Object.assign(state.cvFields, draft.cvFields)
  if (draft.aiTexts) Object.assign(state.aiTexts, draft.aiTexts)
  if (draft.customCriteria) state.customCriteria = draft.customCriteria
  if (draft.customIntCriteria) state.customIntCriteria = draft.customIntCriteria
  if (draft.docPickers) Object.assign(state.docPickers, draft.docPickers)
}

// ── Navigation ────────────────────────────────────────────────────────────────

function nextStep() {
  if (!isStepValid.value) return
  doSaveDraft()
  wizStep.value++
}

function prevStep() {
  if (wizStep.value > 0) wizStep.value--
}

function goToStep(i) {
  if (completedSteps.value.includes(i)) {
    doSaveDraft()
    wizStep.value = i
  }
}

function onClose() {
  const hasData = state.programCode || state.form.prestataire
  if (hasData) { showExitConfirm.value = true }
  else { emit('close') }
}

function doClose() {
  doSaveDraft()
  showExitConfirm.value = false
  emit('close')
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function submitEval() {
  submitError.value = ''
  const payload = {
    programId: currentProgram.value?.id,
    referenceType: state.refType,
    category: state.selectedCategory,
    ...state.form,
    solScores: state.solScores,
    solObs: state.solObs,
    solEnabled: state.solEnabled,
    intScores: state.intScores,
    intObs: state.intObs,
    intEnabled: state.intEnabled,
    cvFields: state.cvFields,
    aiTexts: state.aiTexts,
    customCriteria: state.customCriteria,
    docsMeta: {
      specs: [...state.docPickers.specsNames],
      cv: [...state.docPickers.cvNames],
      attestations: [...state.docPickers.attNames],
      certif: [...state.docPickers.certifNames],
    },
  }
  try {
    let result
    if (currentEvalId.value) {
      // Reprise d'un dossier existant : on met à jour le même enregistrement au lieu d'en créer un nouveau
      await api.put(`/evaluations/${currentEvalId.value}`, payload)
      const { data: submitted } = await api.post(`/evaluations/${currentEvalId.value}/submit`)
      result = submitted
    } else {
      const created = await evalStore.create(payload)
      result = await evalStore.submit()
    }
    evalStore.clearDraft()
    emit('submitted', result)
  } catch (e) {
    submitError.value = e.response?.data?.error || e.message
    throw e
  }
}

async function onSubmitRequest() {
  await submitEval()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(state, scheduleDraftSave, { deep: true })

onMounted(async () => {
  try {
    const { data: progs } = await api.get('/programs')
    programs.value = progs.filter(p => p.active)
  } catch { /* ignore */ }

  try {
    const { data: cfg } = await api.get('/admin/config')
    const urlCfg = cfg.find(c => c.key === 'jira_url')
    if (urlCfg?.value) jiraBaseUrl.value = urlCfg.value
  } catch { /* ignore */ }

  if (props.initialDraft) {
    loadFromDraft(props.initialDraft)
    if (state.form.jiraKeyPrestataire) reloadJiraOnResume()
  }
})

async function reloadJiraOnResume() {
  try {
    const { data } = await api.get(`/dossiers/${state.form.jiraKeyPrestataire}/intervenants`)
    state.jiraHierarchy = data
    if (data.reporter && !state.form.rapporteur) state.form.rapporteur = data.reporter
  } catch { return }

  if (state.form.jiraKeyIntervenant) {
    try {
      const { data } = await api.get(`/dossiers/${state.form.jiraKeyIntervenant}/extract-intervenant`)
      const p = data.parsed || {}
      state.extractedIntervenant = {
        nom: p.nom || '', prenom: p.prenom || '', cin: p.cin || '',
        gsm: p.gsm || '', email: p.email || '',
        typeFormation: p.typeFormation || '', niveauFormation: p.niveauFormation || '',
        etablissement: p.etablissement || '', experienceTotale: p.experienceTotale ?? null,
        experienceSolution: p.experienceSolution ?? null, posteOccupe: p.posteOccupe || '',
        tailleEquipe: p.tailleEquipe ?? null, certifications: p.certifications || '',
        references: p.references || '', _raw: data.allCustomFields || {}
      }
    } catch { /* partial ok */ }
  }

  if (state.form.jiraKeyCompetence) {
    try {
      const { data } = await api.get(`/dossiers/${state.form.jiraKeyCompetence}/extract-competence`)
      const p = data.parsed || {}
      const toArr = v => Array.isArray(v) ? v : (v ? String(v).split(/[,;|]/).map(s => s.trim()).filter(Boolean) : [])
      state.extractedCompetence = {
        typeAction: p.typeAction || '', action: p.action || '', profil: p.profil || '',
        secteurs: Array.isArray(p.secteurs) ? p.secteurs.join(', ') : (p.secteurs || ''),
        domaine: p.domaine || '',
        solutionsInformatiques: toArr(p.solutionsInformatiques),
        autreSolution: p.autreSolution || '',
        modulesInformatiques: toArr(p.modulesInformatiques),
        _raw: data.allCustomFields || {}
      }
    } catch { /* partial ok */ }
  }
}

onBeforeUnmount(() => {
  if (draftTimer) clearTimeout(draftTimer)
  const hasData = state.programCode || state.form.prestataire
  if (hasData) doSaveDraft()
})

// ── Provide ───────────────────────────────────────────────────────────────────

provide('wizard', {
  state,
  wizStep,
  programs,
  jiraBaseUrl,
  currentProgram,
  currentCriteria,
  selectedAction,
  evalCriteria,
  consultantCriteria,
  solScore,
  intScore,
  globalScore,
  finalDecision,
  scheduleDraftSave,
  submitEval,
})
</script>

<style scoped>
.wiz-shell {
  /* Navy theme — applies to the sidebar/steps rail. CSS vars inherited by children unless overridden. */
  --wiz-bg: #111827;
  --wiz-sidebar: #0d1628;
  --wiz-card: #1e2d47;
  --wiz-border: rgba(148, 188, 255, 0.13);
  --wiz-text: #e8eeff;
  --wiz-text2: #93b4d8;
  --wiz-text3: #4d6e96;
  --wiz-accent: #3b82f6;
  --wiz-overlay-rgb: 255, 255, 255;
  --wiz-option-bg: #1c2333;
  --wiz-option-text: #e2e8f0;

  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100vh;
  background: var(--wiz-bg);
  color: var(--wiz-text);
  overflow: hidden;
}

.wiz-main {
  /* Light-blue theme for the working area — overrides the navy vars from .wiz-shell */
  --wiz-bg: #eef4fb;
  --wiz-sidebar: #e3edfa;
  --wiz-card: #ffffff;
  --wiz-border: rgba(30, 75, 140, 0.13);
  --wiz-text: #16243f;
  --wiz-text2: #4d6a94;
  --wiz-text3: #8aa2c4;
  --wiz-overlay-rgb: 20, 50, 95;
  --wiz-option-bg: #ffffff;
  --wiz-option-text: #16243f;

  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--wiz-bg);
  color: var(--wiz-text);
}

.wiz-context-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 44px;
  border-bottom: 1px solid var(--wiz-border);
  background: var(--wiz-card);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.ctx-item { display: flex; align-items: center; gap: 8px; }
.ctx-label {
  font-size: 10px; font-family: var(--mono, monospace); color: var(--wiz-text3);
  text-transform: uppercase; letter-spacing: 0.08em;
}
.ctx-val { font-size: 13px; font-weight: 600; color: var(--wiz-text); }
.ctx-val.ctx-mono { font-family: var(--mono, monospace); font-weight: 500; color: var(--wiz-accent); }

.wiz-content {
  flex: 1;
  overflow-y: auto;
  padding: 36px 44px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.wiz-footer {
  display: flex;
  align-items: center;
  padding: 16px 44px;
  border-top: 1px solid var(--wiz-border);
  background: var(--wiz-sidebar);
  gap: 12px;
  flex-shrink: 0;
}

.wiz-spacer { flex: 1; }

.wiz-footer-error {
  font-size: 12px;
  color: #f87171;
  font-family: var(--mono, monospace);
}

.wiz-btn-primary {
  padding: 10px 24px;
  background: var(--wiz-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  font-family: var(--sans, sans-serif);
}
.wiz-btn-primary:hover:not(:disabled) { opacity: 0.85; }
.wiz-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

.wiz-btn-ghost {
  padding: 10px 20px;
  background: transparent;
  color: var(--wiz-text2);
  border: 1px solid var(--wiz-border);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--sans, sans-serif);
}
.wiz-btn-ghost:hover { color: var(--wiz-text); border-color: rgba(255, 255, 255, 0.2); }

/* Exit modal */
.exit-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.exit-modal {
  background: #1c2333;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 28px;
  max-width: 440px;
  width: 90%;
}
.exit-title { font-size: 17px; font-weight: 600; color: #e2e8f0; margin-bottom: 10px; }
.exit-text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 22px; }
.exit-btns { display: flex; gap: 10px; justify-content: flex-end; }
.exit-btn-confirm {
  padding: 8px 20px;
  background: var(--wiz-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--sans, sans-serif);
  transition: opacity 0.15s;
}
.exit-btn-confirm:hover { opacity: 0.85; }
</style>
