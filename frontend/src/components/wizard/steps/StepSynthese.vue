<template>
  <div class="step-synthese">
    <div class="wiz-step-header">
      <h2 class="wiz-step-title">Synthèse & Soumission</h2>
      <p class="wiz-step-desc">Vérifiez le récapitulatif avant de soumettre l'évaluation.</p>
    </div>

    <!-- Récapitulatif -->
    <div class="recap-sections">
      <div class="recap-block">
        <div class="recap-block-title">Contexte</div>
        <div class="recap-grid">
          <div class="recap-item"><span class="recap-key">Programme</span><span class="recap-val">{{ currentProgram?.name || '—' }}</span></div>
          <div class="recap-item"><span class="recap-key">Type</span><span class="recap-val">{{ state.refType === 'SOLUTION' ? 'Solution informatique' : 'Action' }}</span></div>
          <div class="recap-item"><span class="recap-key">Catégorie</span><span class="recap-val">{{ categoryLabel }}</span></div>
        </div>
      </div>

      <div class="recap-block">
        <div class="recap-block-title">Prestataire</div>
        <div class="recap-grid">
          <div class="recap-item"><span class="recap-key">Société</span><span class="recap-val">{{ state.form.prestataire || '—' }}</span></div>
          <div v-if="state.form.jiraKeyPrestataire" class="recap-item"><span class="recap-key">Ticket</span><span class="recap-val">{{ state.form.jiraKeyPrestataire }}</span></div>
          <div v-if="state.form.jiraKeyIntervenant" class="recap-item"><span class="recap-key">Intervenant</span><span class="recap-val">{{ state.form.jiraKeyIntervenant }}</span></div>
        </div>
      </div>

      <div class="recap-block">
        <div class="recap-block-title">Dossier</div>
        <div class="recap-grid">
          <div v-if="state.form.solution" class="recap-item"><span class="recap-key">Solution</span><span class="recap-val">{{ state.form.solution }}</span></div>
          <div v-if="state.form.actionLabel" class="recap-item"><span class="recap-key">Action</span><span class="recap-val">{{ state.form.actionLabel }}</span></div>
          <div v-if="state.form.dateDemo" class="recap-item"><span class="recap-key">Date</span><span class="recap-val">{{ state.form.dateDemo }}</span></div>
          <div v-if="state.form.rapporteur" class="recap-item"><span class="recap-key">Rapporteur</span><span class="recap-val">{{ state.form.rapporteur }}</span></div>
          <div v-if="state.form.origine" class="recap-item"><span class="recap-key">Origine</span><span class="recap-val">{{ state.form.origine }}</span></div>
          <div v-if="state.form.secteur" class="recap-item"><span class="recap-key">Secteur</span><span class="recap-val">{{ state.form.secteur }}</span></div>
          <div v-if="state.form.modules?.length" class="recap-item full">
            <span class="recap-key">Modules</span>
            <span class="recap-val">{{ state.form.modules.join(', ') }}</span>
          </div>
        </div>
      </div>

      <div class="recap-block" v-if="solScore.pct !== null || intScore.pct !== null">
        <div class="recap-block-title">Scores</div>
        <div class="scores-row">
          <div v-if="solScore.pct !== null" class="score-cell" :class="scoreClass(solScore.pct, 60, 45)">
            <div class="score-big">{{ solScore.pct }}%</div>
            <div class="score-lbl">Solution</div>
            <div class="score-verd">{{ verdictLabel[solScore.verdict] }}</div>
          </div>
          <div v-if="state.refType === 'SOLUTION' && intScore.pct !== null" class="score-cell" :class="scoreClass(intScore.pct, 55, 40)">
            <div class="score-big">{{ intScore.pct }}%</div>
            <div class="score-lbl">Intégrateur</div>
            <div class="score-verd">{{ verdictLabel[intScore.verdict] }}</div>
          </div>
          <div v-if="globalScore !== null" class="score-cell global-cell" :class="scoreClass(globalScore, 60, 48)">
            <div class="score-big">{{ globalScore }}%</div>
            <div class="score-lbl">Global</div>
            <div v-if="finalDecision" class="score-verd decision">
              {{ { REFERENCE: 'Référencé ✓', CONDITIONNEL: 'Conditionnel', REJETE: 'Rejeté ✗' }[finalDecision] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PV IA -->
    <div class="wiz-section">
      <div class="wiz-ai-panel">
        <div class="wiz-ai-header">
          <span class="wiz-ai-badge">IA</span>
          <span class="wiz-ai-title">Procès-verbal de commission</span>
          <span v-if="state.aiTexts.pv" class="wiz-ai-done">✓ Généré</span>
        </div>
        <div v-if="state.aiTexts.pv" class="wiz-ai-content">{{ state.aiTexts.pv }}</div>
        <div class="wiz-ai-actions">
          <button class="wiz-btn-ai" :disabled="pvLoading || !state.form.prestataire" @click="generatePV">
            <span v-if="pvLoading" class="spinner-sm"></span>
            <span v-else>◈ Générer le PV</span>
          </button>
          <button v-if="state.aiTexts.pv" class="wiz-btn-ai" @click="copyPV">📋 Copier</button>
        </div>
      </div>
    </div>

    <!-- Soumission -->
    <div class="submit-zone">
      <div v-if="submitError" class="submit-error">{{ submitError }}</div>
      <div class="submit-btns">
        <button class="wiz-btn-draft" @click="$emit('save-draft')">💾 Enregistrer brouillon</button>
        <button class="wiz-btn-submit" :disabled="submitting" @click="showConfirm = true">
          <span v-if="submitting" class="spinner-sm"></span>
          <span v-else>✓ Soumettre l'évaluation</span>
        </button>
      </div>
    </div>

    <!-- Modal confirmation -->
    <div v-if="showConfirm" class="confirm-overlay" @click.self="showConfirm = false">
      <div class="confirm-modal">
        <div class="confirm-title">Confirmer la soumission</div>
        <div class="confirm-text">
          L'évaluation de <strong>{{ state.form.prestataire }}</strong> sera soumise et ne pourra plus être modifiée.
        </div>
        <div class="confirm-btns">
          <button class="wiz-btn-ghost-sm" @click="showConfirm = false">Annuler</button>
          <button class="wiz-btn-submit-sm" :disabled="submitting" @click="doSubmit">
            <span v-if="submitting" class="spinner-sm"></span>
            <span v-else>Confirmer</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import api from '@/services/api'

defineEmits(['submit', 'save-draft'])
const { state, currentProgram, currentCriteria, solScore, intScore, globalScore, finalDecision, submitEval } = inject('wizard')

const pvLoading = ref(false)
const submitting = ref(false)
const submitError = ref('')
const showConfirm = ref(false)

const verdictLabel = { FAVORABLE: 'Favorable ✓', CONDITIONNEL: 'Conditionnel', DEFAVORABLE: 'Défavorable ✗' }

const categoryLabel = computed(() => currentCriteria.value?.label || state.selectedCategory || '—')

function scoreClass(pct, t1, t2) {
  return pct >= t1 ? 'ok' : pct >= t2 ? 'mid' : 'ko'
}

async function generatePV() {
  pvLoading.value = true
  try {
    const { data } = await api.post('/ai/generate-pv', {
      prestataire: state.form.prestataire,
      solution: state.form.solution || state.form.actionLabel,
      category: state.selectedCategory,
      solScorePct: solScore.value.pct,
      intScorePct: intScore.value.pct,
      finalScorePct: globalScore.value,
      finalDecision: finalDecision.value,
      programName: currentProgram.value?.name,
    })
    state.aiTexts.pv = data.text
  } catch (e) {
    state.aiTexts.pv = 'Erreur IA: ' + (e.response?.data?.error || e.message)
  } finally {
    pvLoading.value = false
  }
}

async function copyPV() {
  await navigator.clipboard.writeText(state.aiTexts.pv)
}

async function doSubmit() {
  submitting.value = true
  submitError.value = ''
  try {
    showConfirm.value = false
    await submitEval()
  } catch (e) {
    submitError.value = e.response?.data?.error || e.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.step-synthese { color: var(--wiz-text); }
.wiz-step-header { margin-bottom: 28px; }
.wiz-step-title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
.wiz-step-desc { color: var(--wiz-text2); font-size: 14px; }
.wiz-section { margin-bottom: 28px; }

.recap-sections { display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; }
.recap-block { background: var(--wiz-card); border: 1px solid var(--wiz-border); border-radius: 8px; padding: 16px 20px; }
.recap-block-title { font-size: 10px; font-family: var(--mono); color: var(--wiz-text3); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
.recap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.recap-item { display: flex; flex-direction: column; gap: 2px; }
.recap-item.full { grid-column: 1 / -1; }
.recap-key { font-size: 10px; font-family: var(--mono); color: var(--wiz-text3); }
.recap-val { font-size: 13px; color: var(--wiz-text); }

.scores-row { display: flex; gap: 12px; flex-wrap: wrap; }
.score-cell { flex: 1; min-width: 100px; padding: 14px 16px; background: rgba(255,255,255,0.04); border: 1px solid var(--wiz-border); border-radius: 8px; text-align: center; }
.score-cell.global-cell { border-color: rgba(255,255,255,0.15); }
.score-big { font-size: 28px; font-weight: 700; font-family: var(--mono); line-height: 1; color: var(--wiz-text); }
.score-lbl { font-size: 10px; color: var(--wiz-text3); font-family: var(--mono); margin-top: 4px; }
.score-verd { font-size: 11px; margin-top: 4px; color: var(--wiz-text2); font-family: var(--mono); }
.score-cell.ok .score-big { color: #4ade80; }
.score-cell.mid .score-big { color: #fbbf24; }
.score-cell.ko .score-big { color: #f87171; }

.wiz-ai-panel { background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 18px 20px; }
.wiz-ai-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.wiz-ai-badge { font-size: 10px; font-family: var(--mono); background: rgba(59,130,246,0.15); color: var(--wiz-accent); padding: 2px 8px; border-radius: 3px; letter-spacing: 0.08em; border: 1px solid rgba(59,130,246,0.3); }
.wiz-ai-title { font-size: 13px; font-weight: 500; color: var(--wiz-text); }
.wiz-ai-done { margin-left: auto; font-size: 11px; color: #22c55e; font-family: var(--mono); }
.wiz-ai-content { font-size: 12px; color: var(--wiz-text2); line-height: 1.7; white-space: pre-wrap; margin-bottom: 14px; max-height: 280px; overflow-y: auto; }
.wiz-ai-actions { display: flex; gap: 8px; }
.wiz-btn-ai { padding: 7px 14px; background: rgba(255,255,255,0.06); border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 12px; color: var(--wiz-text2); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; font-family: var(--sans); }
.wiz-btn-ai:hover { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.wiz-btn-ai:disabled { opacity: 0.4; cursor: not-allowed; }

.submit-zone { padding: 20px 24px; background: rgba(255,255,255,0.03); border: 1px solid var(--wiz-border); border-radius: 10px; }
.submit-error { color: #f87171; font-size: 12px; font-family: var(--mono); margin-bottom: 12px; }
.submit-btns { display: flex; gap: 12px; justify-content: flex-end; }
.wiz-btn-draft { padding: 10px 20px; background: transparent; border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 13px; color: var(--wiz-text2); cursor: pointer; transition: all 0.15s; font-family: var(--sans); }
.wiz-btn-draft:hover { border-color: rgba(255,255,255,0.2); color: var(--wiz-text); }
.wiz-btn-submit { padding: 10px 28px; background: #16a34a; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; font-family: var(--sans); display: flex; align-items: center; gap: 8px; }
.wiz-btn-submit:hover { background: #15803d; }
.wiz-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.confirm-modal { background: #1c2333; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 28px; max-width: 420px; width: 90%; }
.confirm-title { font-size: 17px; font-weight: 600; color: #e2e8f0; margin-bottom: 12px; }
.confirm-text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 22px; }
.confirm-text strong { color: #e2e8f0; }
.confirm-btns { display: flex; gap: 10px; justify-content: flex-end; }
.wiz-btn-ghost-sm { padding: 8px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px; color: #94a3b8; cursor: pointer; font-family: var(--sans); transition: all 0.15s; }
.wiz-btn-ghost-sm:hover { color: #e2e8f0; }
.wiz-btn-submit-sm { padding: 8px 20px; background: #16a34a; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--sans); display: flex; align-items: center; gap: 8px; }
.wiz-btn-submit-sm:hover { background: #15803d; }
.wiz-btn-submit-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner-sm { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
