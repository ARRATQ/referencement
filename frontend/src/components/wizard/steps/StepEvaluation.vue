<template>
  <div class="step-eval">
    <div class="wiz-step-header">
      <h2 class="wiz-step-title">Évaluation</h2>
      <p class="wiz-step-desc">Évaluez chaque critère en attribuant une note de 0 à 2.</p>
    </div>

    <!-- Score live -->
    <div v-if="solScore.pct !== null || intScore.pct !== null" class="score-live-bar">
      <div v-if="solScore.pct !== null" class="score-pill" :class="scoreClass(solScore.pct, 60, 45)">
        <span class="score-num">{{ solScore.pct }}%</span>
        <span class="score-lbl">Solution</span>
      </div>
      <div v-if="state.refType === 'SOLUTION' && intScore.pct !== null" class="score-pill" :class="scoreClass(intScore.pct, 55, 40)">
        <span class="score-num">{{ intScore.pct }}%</span>
        <span class="score-lbl">Consultant</span>
      </div>
      <div v-if="globalScore !== null" class="score-pill" :class="scoreClass(globalScore, 60, 48)">
        <span class="score-num">{{ globalScore }}%</span>
        <span class="score-lbl">Global</span>
      </div>
      <div v-if="finalDecision" class="decision-badge" :class="finalDecision.toLowerCase()">
        {{ decisionLabel[finalDecision] }}
      </div>
    </div>

    <!-- ══ Grille fonctionnelle ══ -->
    <div class="wiz-section">
      <div class="grid-header">
        <div class="grid-title">
          {{ state.refType === 'SOLUTION' ? 'Grille fonctionnelle' : 'Critères' }}
          <span v-if="state.customCriteria.length" class="custom-badge">Personnalisée</span>
        </div>
        <div class="grid-actions">
          <button v-if="state.customCriteria.length" class="ga-btn" @click="addSolCrit">+ Critère</button>
          <button v-if="state.customCriteria.length" class="ga-btn warn" @click="resetSolCriteria">↩ Standard</button>
          <button v-if="!state.customCriteria.length" class="ga-btn" @click="customizeSolCriteria">✎ Personnaliser</button>
          <button v-if="!state.customCriteria.length" class="ga-btn ai" :disabled="aiLoading.criteriaGen" @click="generateSolCriteria">
            <span v-if="aiLoading.criteriaGen" class="spinner-sm"></span>
            <span v-else>◈ Générer depuis specs</span>
          </button>
          <button class="ga-btn ai" :disabled="aiLoading.suggestSol || !evalCriteria.length" @click="suggestScoresSol">
            <span v-if="aiLoading.suggestSol" class="spinner-sm"></span>
            <span v-else>◈ Proposer notes IA</span>
          </button>
        </div>
      </div>

      <div class="criteria-list">
        <div v-if="!evalCriteria.length" class="wiz-empty">Aucun critère disponible pour cette catégorie.</div>

        <div v-for="(c, i) in evalCriteria" :key="i" class="criteria-row" :class="{ disabled: state.solEnabled[i] === false }">
          <!-- Edit form inline -->
          <template v-if="state.customCriteria.length && editingSolIdx === i">
            <div class="edit-form">
              <input class="edit-input" v-model="editingSolBuf.n" placeholder="Nom du critère" @keyup.enter="saveSolEdit" @keyup.escape="editingSolIdx = null" />
              <textarea class="edit-textarea" v-model="editingSolBuf.d" placeholder="Description" rows="2"></textarea>
              <div class="edit-row">
                <label class="edit-weight">
                  Poids
                  <select class="weight-input" v-model.number="editingSolBuf.w">
                    <option :value="1">1</option>
                    <option :value="2">2</option>
                    <option :value="3">3</option>
                  </select>
                </label>
                <div class="edit-btns">
                  <button class="eb-cancel" @click="editingSolIdx = null">Annuler</button>
                  <button class="eb-save" @click="saveSolEdit">Enregistrer</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <button class="toggle-crit" @click="toggleCrit(i)">{{ state.solEnabled[i] === false ? '○' : '●' }}</button>
            <div class="criteria-body">
              <div class="criteria-name">
                {{ c.n }}
                <span v-if="c.w && c.w > 1" class="weight-badge">×{{ c.w }}</span>
                <span v-if="c.prio" class="prio-tag">PRIO</span>
              </div>
              <div v-if="c.d" class="criteria-desc">{{ c.d }}</div>
              <textarea class="criteria-obs" v-model="state.solObs[i]" placeholder="Observation…" rows="1"></textarea>
            </div>
            <div class="crit-right">
              <div class="score-btns">
                <button v-for="s in [0,1,2]" :key="s" class="sbtn" :class="[`s${s}`, { sel: state.solScores[i] === s }]" @click="setScore(state.solScores, i, s)">{{ s }}</button>
              </div>
              <div v-if="state.customCriteria.length" class="crit-manage">
                <button class="cm-btn" @click="startSolEdit(i)" title="Modifier">✎</button>
                <button class="cm-btn del" @click="removeSolCrit(i)" title="Supprimer">✕</button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ══ Grille consultant (SOLUTION uniquement) ══ -->
    <div class="wiz-section" v-if="state.refType === 'SOLUTION'">
      <div class="grid-header">
        <div class="grid-title">
          Grille consultant
          <span v-if="state.customIntCriteria.length" class="custom-badge">Personnalisée</span>
        </div>
        <div class="grid-actions">
          <button v-if="state.customIntCriteria.length" class="ga-btn" @click="addIntCrit">+ Critère</button>
          <button v-if="state.customIntCriteria.length" class="ga-btn warn" @click="resetIntCriteria">↩ Standard</button>
          <button v-if="!state.customIntCriteria.length" class="ga-btn ai" @click="customizeIntCriteria">
            ✎ Personnaliser
          </button>
          <button class="ga-btn ai" :disabled="aiLoading.suggestInt || !consultantCriteria.length" @click="suggestScoresInt">
            <span v-if="aiLoading.suggestInt" class="spinner-sm"></span>
            <span v-else>◈ Proposer notes IA</span>
          </button>
        </div>
      </div>

      <div class="criteria-list">
        <div v-if="!consultantCriteria.length" class="wiz-empty">Aucun critère consultant configuré.</div>

        <div v-for="(c, i) in consultantCriteria" :key="i" class="criteria-row" :class="{ disabled: state.intEnabled[i] === false }">
          <!-- Edit form inline -->
          <template v-if="state.customIntCriteria.length && editingIntIdx === i">
            <div class="edit-form">
              <input class="edit-input" v-model="editingIntBuf.n" placeholder="Nom du critère" @keyup.enter="saveIntEdit" @keyup.escape="editingIntIdx = null" />
              <textarea class="edit-textarea" v-model="editingIntBuf.d" placeholder="Description" rows="2"></textarea>
              <div class="edit-row">
                <label class="edit-weight">
                  Poids
                  <select class="weight-input" v-model.number="editingIntBuf.w">
                    <option :value="1">1</option>
                    <option :value="2">2</option>
                    <option :value="3">3</option>
                  </select>
                </label>
                <div class="edit-btns">
                  <button class="eb-cancel" @click="editingIntIdx = null">Annuler</button>
                  <button class="eb-save" @click="saveIntEdit">Enregistrer</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <button class="toggle-crit" @click="toggleIntCrit(i)">{{ state.intEnabled[i] === false ? '○' : '●' }}</button>
            <div class="criteria-body">
              <div class="criteria-name">
                {{ c.n }}
                <span v-if="c.w && c.w > 1" class="weight-badge">×{{ c.w }}</span>
                <span v-if="c.prio" class="prio-tag">PRIO</span>
              </div>
              <div v-if="c.d" class="criteria-desc">{{ c.d }}</div>
              <textarea class="criteria-obs" v-model="state.intObs[i]" placeholder="Observation…" rows="1"></textarea>
            </div>
            <div class="crit-right">
              <div class="score-btns">
                <button v-for="s in [0,1,2]" :key="s" class="sbtn" :class="[`s${s}`, { sel: state.intScores[i] === s }]" @click="setScore(state.intScores, i, s)">{{ s }}</button>
              </div>
              <div v-if="state.customIntCriteria.length" class="crit-manage">
                <button class="cm-btn" @click="startIntEdit(i)" title="Modifier">✎</button>
                <button class="cm-btn del" @click="removeIntCrit(i)" title="Supprimer">✕</button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ══ Analyse IA cohérence ══ -->
    <div class="wiz-section">
      <div class="wiz-ai-panel">
        <div class="wiz-ai-header">
          <span class="wiz-ai-badge">IA</span>
          <span class="wiz-ai-title">Analyse de cohérence</span>
          <span v-if="state.aiTexts.coherence" class="wiz-ai-done">✓ Analysé</span>
        </div>
        <AiText v-if="state.aiTexts.coherence" :text="state.aiTexts.coherence" />
        <div class="wiz-ai-actions">
          <button class="wiz-btn-ai" :disabled="aiLoading.coherence || !evalCriteria.length" @click="checkCoherence">
            <span v-if="aiLoading.coherence" class="spinner-sm"></span>
            <span v-else>◈ Analyser la cohérence</span>
          </button>
          <span v-if="!state.aiTexts.coherence" class="coherence-required">⚠ Requis pour continuer</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import api from '@/services/api'
import AiText from '@/components/AiText.vue'

const { state, evalCriteria, consultantCriteria, solScore, intScore, globalScore, finalDecision } = inject('wizard')

const aiLoading = ref({ coherence: false, criteriaGen: false, suggestSol: false, suggestInt: false })

// ── Edit state ─────────────────────────────────────────────────────────────────
const editingSolIdx = ref(null)
const editingSolBuf = ref({ n: '', d: '', w: 1 })
const editingIntIdx = ref(null)
const editingIntBuf = ref({ n: '', d: '', w: 1 })

const decisionLabel = { REFERENCE: 'Référencé ✓', CONDITIONNEL: 'Conditionnel', REJETE: 'Rejeté ✗' }

function scoreClass(pct, t1, t2) {
  if (pct === null) return ''
  return pct >= t1 ? 'ok' : pct >= t2 ? 'mid' : 'ko'
}

// ── Scoring ────────────────────────────────────────────────────────────────────
function setScore(scores, i, s) {
  if (scores[i] === s) delete scores[i]
  else scores[i] = s
}

function toggleCrit(i) {
  state.solEnabled[i] = state.solEnabled[i] === false ? undefined : false
}

function toggleIntCrit(i) {
  state.intEnabled[i] = state.intEnabled[i] === false ? undefined : false
}

// ── Sol grid editing ───────────────────────────────────────────────────────────
function startSolEdit(i) {
  editingSolIdx.value = i
  editingSolBuf.value = { ...state.customCriteria[i] }
}

function saveSolEdit() {
  if (!editingSolBuf.value.n.trim()) return
  const updated = [...state.customCriteria]
  updated[editingSolIdx.value] = { ...editingSolBuf.value }
  state.customCriteria = updated
  editingSolIdx.value = null
}

function addSolCrit() {
  state.customCriteria = [...state.customCriteria, { n: '', d: '', w: 1 }]
  editingSolIdx.value = state.customCriteria.length - 1
  editingSolBuf.value = { n: '', d: '', w: 1 }
}

function removeSolCrit(i) {
  state.customCriteria = state.customCriteria.filter((_, idx) => idx !== i)
  if (editingSolIdx.value === i) editingSolIdx.value = null
}

function resetSolCriteria() {
  if (confirm('Revenir à la grille standard du programme ?')) {
    state.customCriteria = []
    editingSolIdx.value = null
  }
}

function customizeSolCriteria() {
  state.customCriteria = (evalCriteria.value || []).map(c => ({ ...c }))
}

async function generateSolCriteria() {
  aiLoading.value.criteriaGen = true
  try {
    const { data } = await api.post('/ai/generate-criteria', {
      category: state.selectedCategory,
      programCode: state.programCode,
      solution: state.form.solution,
      modules: state.form.modules,
    })
    if (Array.isArray(data.suggestedCriteria)) state.customCriteria = data.suggestedCriteria
  } catch { /* ignore */ }
  finally { aiLoading.value.criteriaGen = false }
}

// ── Consultant grid editing ────────────────────────────────────────────────────
function startIntEdit(i) {
  editingIntIdx.value = i
  editingIntBuf.value = { ...state.customIntCriteria[i] }
}

function saveIntEdit() {
  if (!editingIntBuf.value.n.trim()) return
  const updated = [...state.customIntCriteria]
  updated[editingIntIdx.value] = { ...editingIntBuf.value }
  state.customIntCriteria = updated
  editingIntIdx.value = null
}

function addIntCrit() {
  state.customIntCriteria = [...state.customIntCriteria, { n: '', d: '', w: 1 }]
  editingIntIdx.value = state.customIntCriteria.length - 1
  editingIntBuf.value = { n: '', d: '', w: 1 }
}

function removeIntCrit(i) {
  state.customIntCriteria = state.customIntCriteria.filter((_, idx) => idx !== i)
  if (editingIntIdx.value === i) editingIntIdx.value = null
}

function resetIntCriteria() {
  if (confirm('Revenir à la grille consultant standard ?')) {
    state.customIntCriteria = []
    editingIntIdx.value = null
  }
}

function customizeIntCriteria() {
  // Copy standard criteria into custom so they can be edited
  state.customIntCriteria = (consultantCriteria.value || []).map(c => ({ ...c }))
}

// ── AI suggest scores ─────────────────────────────────────────────────────────
function buildDossierContext() {
  const parts = []
  if (state.form.prestataire) parts.push(`Prestataire : ${state.form.prestataire}`)
  if (state.form.solution) parts.push(`Solution : ${state.form.solution}`)
  if (state.form.actionLabel) parts.push(`Action : ${state.form.actionLabel}`)
  if (state.cvFields.diplome) parts.push(`Formation : ${state.cvFields.diplome} — ${state.cvFields.exp} ans exp.`)
  if (state.aiTexts.briefing) parts.push(`Briefing :\n${state.aiTexts.briefing.slice(0, 600)}`)
  if (state.aiTexts.cv) parts.push(`Analyse CV :\n${state.aiTexts.cv.slice(0, 800)}`)
  if (state.aiTexts.attestations) parts.push(`Attestations :\n${state.aiTexts.attestations.slice(0, 600)}`)
  return parts.join('\n\n')
}

async function suggestScoresSol() {
  aiLoading.value.suggestSol = true
  try {
    const { data } = await api.post('/ai/suggest-scores', {
      category: state.selectedCategory,
      criteria: evalCriteria.value,
      dossierContext: buildDossierContext(),
    })
    if (data.scores) {
      for (const [k, v] of Object.entries(data.scores)) state.solScores[k] = v
    }
    if (data.observations) {
      for (const [k, v] of Object.entries(data.observations)) state.solObs[k] = v
    }
  } catch (e) { alert('Erreur IA : ' + (e.response?.data?.error || e.message)) }
  finally { aiLoading.value.suggestSol = false }
}

async function suggestScoresInt() {
  aiLoading.value.suggestInt = true
  try {
    const { data } = await api.post('/ai/suggest-scores', {
      category: 'consultant',
      criteria: consultantCriteria.value,
      dossierContext: buildDossierContext(),
    })
    if (data.scores) {
      for (const [k, v] of Object.entries(data.scores)) state.intScores[k] = v
    }
    if (data.observations) {
      for (const [k, v] of Object.entries(data.observations)) state.intObs[k] = v
    }
  } catch (e) { alert('Erreur IA : ' + (e.response?.data?.error || e.message)) }
  finally { aiLoading.value.suggestInt = false }
}

// ── Coherence ─────────────────────────────────────────────────────────────────
async function checkCoherence() {
  aiLoading.value.coherence = true
  try {
    const { data } = await api.post('/ai/check-coherence', {
      category: state.selectedCategory,
      criteria: evalCriteria.value,
      solScores: state.solScores,
      solObs: state.solObs,
    })
    state.aiTexts.coherence = data.text
  } catch (e) {
    state.aiTexts.coherence = 'Erreur IA: ' + (e.response?.data?.error || e.message)
  } finally {
    aiLoading.value.coherence = false
  }
}
</script>

<style scoped>
.step-eval { color: var(--wiz-text); }
.wiz-step-header { margin-bottom: 28px; }
.wiz-step-title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
.wiz-step-desc { color: var(--wiz-text2); font-size: 14px; }
.wiz-section { margin-bottom: 32px; }
.wiz-empty { color: var(--wiz-text3); font-size: 13px; font-family: var(--mono); padding: 16px 0; }

/* Score bar */
.score-live-bar { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: rgba(var(--wiz-overlay-rgb),0.04); border: 1px solid var(--wiz-border); border-radius: 10px; margin-bottom: 28px; flex-wrap: wrap; }
.score-pill { display: flex; flex-direction: column; align-items: center; padding: 8px 16px; background: rgba(var(--wiz-overlay-rgb),0.06); border-radius: 8px; min-width: 80px; }
.score-num { font-size: 22px; font-weight: 700; font-family: var(--mono); line-height: 1; color: var(--wiz-text); }
.score-lbl { font-size: 10px; color: var(--wiz-text3); margin-top: 2px; font-family: var(--mono); }
.score-pill.ok .score-num { color: #4ade80; }
.score-pill.mid .score-num { color: #fbbf24; }
.score-pill.ko .score-num { color: #f87171; }
.decision-badge { margin-left: auto; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-family: var(--mono); font-weight: 600; }
.decision-badge.reference { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
.decision-badge.conditionnel { background: rgba(251,191,36,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }
.decision-badge.rejete { background: rgba(248,113,113,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.3); }

/* Grid header */
.grid-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.grid-title { font-size: 11px; font-family: var(--mono); color: var(--wiz-text3); text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; }
.custom-badge { font-size: 10px; padding: 2px 8px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; border-radius: 10px; text-transform: none; letter-spacing: 0; }
.grid-actions { margin-left: auto; display: flex; gap: 6px; }
.ga-btn { padding: 5px 12px; background: rgba(var(--wiz-overlay-rgb),0.06); border: 1px solid var(--wiz-border); border-radius: 5px; font-size: 11px; color: var(--wiz-text2); cursor: pointer; font-family: var(--sans); transition: all 0.12s; display: flex; align-items: center; gap: 5px; }
.ga-btn:hover { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.ga-btn.warn:hover { border-color: #fbbf24; color: #fbbf24; }
.ga-btn.ai:hover { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.ga-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Criteria list */
.criteria-list { border: 1px solid var(--wiz-border); border-radius: 8px; overflow: hidden; }
.criteria-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--wiz-border); transition: background 0.12s; }
.criteria-row:last-child { border-bottom: none; }
.criteria-row:hover { background: rgba(var(--wiz-overlay-rgb),0.02); }
.criteria-row.disabled { opacity: 0.4; }
.criteria-row.disabled .criteria-body, .criteria-row.disabled .score-btns { pointer-events: none; }
.criteria-row.disabled .toggle-crit { pointer-events: all; opacity: 1; }

.toggle-crit { background: none; border: none; cursor: pointer; color: var(--wiz-accent); font-size: 12px; padding: 4px 0; line-height: 1; flex-shrink: 0; margin-top: 2px; opacity: 0.7; }
.toggle-crit:hover { opacity: 1; }

.criteria-body { flex: 1; min-width: 0; }
.criteria-name { font-size: 13px; font-weight: 500; color: var(--wiz-text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.criteria-desc { font-size: 11px; color: var(--wiz-text3); margin-top: 2px; font-family: var(--mono); }
.criteria-obs { width: 100%; margin-top: 6px; padding: 5px 8px; background: rgba(var(--wiz-overlay-rgb),0.04); border: 1px solid var(--wiz-border); border-radius: 4px; font-size: 11px; color: var(--wiz-text2); font-family: var(--sans); resize: none; outline: none; }
.criteria-obs:focus { border-color: var(--wiz-accent); }

.weight-badge { font-size: 9px; font-family: var(--mono); padding: 1px 5px; background: rgba(var(--wiz-overlay-rgb),0.08); border-radius: 3px; color: var(--wiz-text3); }
.prio-tag { font-size: 9px; font-family: var(--mono); background: rgba(251,191,36,0.15); color: #fbbf24; padding: 1px 6px; border-radius: 3px; }

.crit-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
.score-btns { display: flex; gap: 4px; }
.sbtn { width: 34px; height: 34px; border: 1px solid var(--wiz-border); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: var(--mono); background: rgba(var(--wiz-overlay-rgb),0.04); color: var(--wiz-text3); transition: all 0.12s; }
.sbtn:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); color: var(--wiz-text); }
.sbtn.s0.sel { background: rgba(248,113,113,0.15); border-color: #f87171; color: #f87171; }
.sbtn.s1.sel { background: rgba(251,191,36,0.15); border-color: #fbbf24; color: #fbbf24; }
.sbtn.s2.sel { background: rgba(74,222,128,0.15); border-color: #4ade80; color: #4ade80; }

.crit-manage { display: flex; gap: 4px; }
.cm-btn { width: 24px; height: 24px; background: rgba(var(--wiz-overlay-rgb),0.05); border: 1px solid var(--wiz-border); border-radius: 4px; font-size: 11px; cursor: pointer; color: var(--wiz-text3); display: flex; align-items: center; justify-content: center; transition: all 0.12s; }
.cm-btn:hover { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.cm-btn.del:hover { border-color: #f87171; color: #f87171; }

/* Inline edit form */
.edit-form { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.edit-input { background: rgba(var(--wiz-overlay-rgb),0.06); border: 1px solid var(--wiz-accent); border-radius: 5px; padding: 7px 10px; font-size: 13px; color: var(--wiz-text); font-family: var(--sans); outline: none; width: 100%; }
.edit-textarea { background: rgba(var(--wiz-overlay-rgb),0.04); border: 1px solid var(--wiz-border); border-radius: 5px; padding: 6px 10px; font-size: 12px; color: var(--wiz-text2); font-family: var(--sans); outline: none; resize: none; width: 100%; }
.edit-textarea:focus { border-color: var(--wiz-accent); }
.edit-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.edit-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--wiz-text2); cursor: pointer; }
.edit-check input { accent-color: var(--wiz-accent); cursor: pointer; }
.edit-weight { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--wiz-text2); }
.weight-input { width: 60px; padding: 4px 8px; background: rgba(var(--wiz-overlay-rgb),0.06); border: 1px solid var(--wiz-border); border-radius: 5px; font-size: 12px; color: var(--wiz-text); font-family: var(--mono); outline: none; text-align: center; }
.weight-input:focus { border-color: var(--wiz-accent); }
.edit-btns { display: flex; gap: 6px; }
.eb-cancel { padding: 5px 12px; background: transparent; border: 1px solid var(--wiz-border); border-radius: 5px; font-size: 12px; color: var(--wiz-text2); cursor: pointer; font-family: var(--sans); }
.eb-save { padding: 5px 12px; background: var(--wiz-accent); border: none; border-radius: 5px; font-size: 12px; color: #fff; cursor: pointer; font-family: var(--sans); font-weight: 500; }

/* AI panel */
.wiz-ai-panel { background: rgba(27,58,107,0.06); border: 1px solid rgba(27,58,107,0.2); border-radius: 8px; padding: 18px 20px; }
.wiz-ai-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.wiz-ai-badge { font-size: 10px; font-family: var(--mono); background: rgba(27,58,107,0.15); color: var(--wiz-accent); padding: 2px 8px; border-radius: 3px; letter-spacing: 0.08em; border: 1px solid rgba(27,58,107,0.3); }
.wiz-ai-title { font-size: 13px; font-weight: 500; color: var(--wiz-text); }
.wiz-ai-done { margin-left: auto; font-size: 11px; color: #22c55e; font-family: var(--mono); }
.wiz-ai-content { font-size: 12px; color: var(--wiz-text2); line-height: 1.7; white-space: pre-wrap; margin-bottom: 14px; max-height: 200px; overflow-y: auto; }
.wiz-ai-actions { display: flex; gap: 8px; }
.wiz-btn-ai { padding: 7px 14px; background: rgba(var(--wiz-overlay-rgb),0.06); border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 12px; color: var(--wiz-text2); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; font-family: var(--sans); }
.wiz-btn-ai:hover { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.wiz-btn-ai:disabled { opacity: 0.4; cursor: not-allowed; }
.coherence-required { font-size: 11px; color: #fbbf24; font-family: var(--mono); align-self: center; }

.spinner-sm { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(var(--wiz-overlay-rgb),0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
