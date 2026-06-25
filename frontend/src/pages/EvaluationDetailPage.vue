<template>
  <div>
    <div class="topbar">
      <div>
        <div class="topbar-title">Détail de l'évaluation</div>
        <div class="topbar-sub">{{ ev?.prestataire }} — {{ ev?.program?.name }}</div>
      </div>
      <div class="topbar-actions">
        <RouterLink to="/consultation" class="btn btn-ghost btn-sm">← Retour</RouterLink>
      </div>
    </div>

    <div class="content">
      <div v-if="loading" class="card" style="text-align:center;padding:40px;">
        <span class="spinner spinner-dark"></span>
      </div>
      <div v-else-if="error" class="empty-state">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">{{ error }}</div>
      </div>

      <template v-else-if="ev">
        <!-- Bannière décision -->
        <div v-if="ev.finalDecision" class="decision-banner"
             :class="{ ref: ev.finalDecision === 'REFERENCE', cond: ev.finalDecision === 'CONDITIONNEL', rej: ev.finalDecision === 'REJETE' }">
          <div class="decision-verdict">{{ decisionFullLabel(ev.finalDecision) }}</div>
          <div v-if="ev.decisionDate" style="font-size:12px;opacity:0.7;margin-top:4px;">
            Décision du {{ new Date(ev.decisionDate).toLocaleDateString('fr-MA') }}
          </div>
        </div>

        <!-- SECTION 1 : Informations générales -->
        <div class="card">
          <div class="card-title">1 — Informations générales</div>
          <div class="detail-grid">
            <div class="detail-row"><span class="detail-label">Programme</span><span class="detail-value">{{ ev.program?.name }}</span></div>
            <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">{{ ev.referenceType === 'SOLUTION' ? 'Solution informatique' : 'Action' }}</span></div>
            <div class="detail-row"><span class="detail-label">Prestataire</span><span class="detail-value">{{ ev.prestataire || '—' }}</span></div>
            <div v-if="ev.referenceType === 'SOLUTION'" class="detail-row">
              <span class="detail-label">Solution</span><span class="detail-value">{{ ev.solution || '—' }}</span>
            </div>
            <div v-if="ev.referenceType === 'ACTION'" class="detail-row">
              <span class="detail-label">Action</span><span class="detail-value">{{ ev.actionLabel || '—' }}</span>
            </div>
            <div v-if="ev.dateDemo" class="detail-row">
              <span class="detail-label">Date</span>
              <span class="detail-value">{{ new Date(ev.dateDemo).toLocaleDateString('fr-MA') }}</span>
            </div>
            <div class="detail-row"><span class="detail-label">Rapporteur</span><span class="detail-value">{{ ev.rapporteur || '—' }}</span></div>
            <div v-if="ev.origine" class="detail-row"><span class="detail-label">Origine</span><span class="detail-value">{{ ev.origine }}</span></div>
            <div v-if="ev.nature" class="detail-row"><span class="detail-label">Nature</span><span class="detail-value">{{ ev.nature }}</span></div>
            <div v-if="ev.modeAcquisition" class="detail-row"><span class="detail-label">Mode d'acquisition</span><span class="detail-value">{{ ev.modeAcquisition }}</span></div>
            <div v-if="ev.secteur" class="detail-row"><span class="detail-label">Secteur</span><span class="detail-value">{{ ev.secteur }}</span></div>
            <div v-if="ev.typeIntervenant" class="detail-row"><span class="detail-label">Type d'intervenant</span><span class="detail-value">{{ ev.typeIntervenant }}</span></div>
            <div v-if="ev.jiraKeyIntervenant" class="detail-row"><span class="detail-label">Ticket intervenant</span><span class="detail-value text-mono">{{ ev.jiraKeyIntervenant }}</span></div>
            <div v-if="ev.jiraKeyCompetence" class="detail-row"><span class="detail-label">Ticket compétence</span><span class="detail-value text-mono">{{ ev.jiraKeyCompetence }}</span></div>
            <div v-if="ev.actionDescription" class="detail-row"><span class="detail-label">Description</span><span class="detail-value">{{ ev.actionDescription }}</span></div>
          </div>
          <div v-if="ev.modules?.length" style="margin-top:12px;">
            <div class="detail-label" style="margin-bottom:6px;">Modules</div>
            <div class="module-tags">
              <span v-for="m in ev.modules" :key="m" class="module-tag">{{ m }}</span>
            </div>
          </div>
        </div>

        <!-- Documents soumis -->
        <div v-if="hasDocsMeta" class="card">
          <div class="card-title">Documents soumis</div>
          <div class="docs-grid">
            <div v-if="ev.docsMeta.cv?.length" class="docs-group">
              <div class="docs-group-label">CV &amp; Diplômes</div>
              <div v-for="name in ev.docsMeta.cv" :key="name" class="doc-item">📄 {{ name }}</div>
            </div>
            <div v-if="ev.docsMeta.attestations?.length" class="docs-group">
              <div class="docs-group-label">Attestations de référence</div>
              <div v-for="name in ev.docsMeta.attestations" :key="name" class="doc-item">📎 {{ name }}</div>
            </div>
            <div v-if="ev.docsMeta.certif?.length" class="docs-group">
              <div class="docs-group-label">Certificat éditeur</div>
              <div v-for="name in ev.docsMeta.certif" :key="name" class="doc-item">🏅 {{ name }}</div>
            </div>
            <div v-if="ev.docsMeta.specs?.length" class="docs-group">
              <div class="docs-group-label">Spécifications fonctionnelles</div>
              <div v-for="name in ev.docsMeta.specs" :key="name" class="doc-item">📂 {{ name }}</div>
            </div>
          </div>
        </div>

        <!-- Analyses IA pré-commission -->
        <template v-if="ev.briefingText || ev.specsAnalysis || ev.demoScenario || ev.webInsights">
          <div class="ai-panel">
            <div class="ai-header"><span class="ai-badge">IA — Pré-commission</span></div>
            <div v-if="ev.briefingText" class="ai-block">
              <div class="ai-block-label">Briefing pré-commission</div>
              <AiText class="ai-content" :text="ev.briefingText" />
            </div>
            <div v-if="ev.specsAnalysis" class="ai-block">
              <div class="ai-block-label">Analyse des spécifications fonctionnelles</div>
              <AiText class="ai-content" :text="ev.specsAnalysis" />
            </div>
            <div v-if="ev.demoScenario" class="ai-block">
              <div class="ai-block-label">Scénario de démo</div>
              <AiText class="ai-content" :text="ev.demoScenario" />
            </div>
            <div v-if="ev.webInsights" class="ai-block">
              <div class="ai-block-label">Web insights</div>
              <AiText class="ai-content" :text="ev.webInsights" />
            </div>
          </div>
        </template>

        <!-- SECTION 2 : Grille fonctionnelle -->
        <div class="card">
          <div class="card-title">2 — Grille {{ ev.referenceType === 'ACTION' ? 'action' : 'solution' }}</div>

          <div v-if="ev.solScorePct !== null" class="score-live" style="margin-bottom:16px;">
            <div>
              <div style="font-size:11px;font-family:var(--mono);color:rgba(255,255,255,0.4);margin-bottom:4px;">Score {{ ev.referenceType === 'SOLUTION' ? 'solution' : 'action' }}</div>
              <div class="score-big" :class="scoreClass(ev.solScorePct, 60, 45)">{{ ev.solScorePct + '%' }}</div>
            </div>
            <div style="flex:1;">
              <div class="progress-track"><div class="progress-fill" :style="{ width: (ev.solScorePct || 0) + '%', background: progressColor(ev.solScorePct, 60, 45) }"></div></div>
              <div class="score-detail mt8">Seuil référencement : 60%</div>
            </div>
            <div style="text-align:right;">
              <div class="score-verdict" :class="scoreClass(ev.solScorePct, 60, 45)">{{ verdictLabel[ev.solVerdict] || 'Non évalué' }}</div>
            </div>
          </div>

          <div v-if="!solCriteria.length" class="text-sm" style="color:var(--text3);padding:12px 0;">
            Critères non disponibles pour cette évaluation.
          </div>
          <div v-for="(c, i) in solCriteria" :key="i" class="criteria-item-ro" :class="{ 'criteria-disabled': solEnabled[i] === false }">
            <div class="criteria-score-badge" :class="scoreBadgeClass(solScores[i])">
              {{ solScores[i] !== undefined ? solScores[i] : '—' }}
            </div>
            <div class="criteria-text">
              <div class="criteria-name">
                {{ c.n }}
                <span v-if="c.w === 2" class="prio-tag">prioritaire</span>
                <span v-if="solEnabled[i] === false" class="disabled-tag">désactivé</span>
              </div>
              <div v-if="c.d" class="criteria-desc">{{ c.d }}</div>
              <div v-if="solObs[i]" class="criteria-obs-ro">{{ solObs[i] }}</div>
            </div>
          </div>
        </div>

        <!-- Analyse cohérence IA -->
        <div v-if="ev.coherenceCheck" class="ai-panel">
          <div class="ai-header"><span class="ai-badge">IA — Cohérence</span></div>
          <AiText class="ai-content" :text="ev.coherenceCheck" />
        </div>

        <!-- SECTION 3 : Profil intégrateur/consultant -->
        <div class="card">
          <div class="card-title">3 — Profil {{ ev.referenceType === 'ACTION' ? 'consultant' : 'intégrateur' }}</div>

          <div v-if="ev.intScorePct !== null" class="score-live" style="margin-bottom:16px;">
            <div>
              <div style="font-size:11px;font-family:var(--mono);color:rgba(255,255,255,0.4);margin-bottom:4px;">Score {{ ev.referenceType === 'ACTION' ? 'consultant' : 'intégrateur' }}</div>
              <div class="score-big" :class="scoreClass(ev.intScorePct, 55, 40)">{{ ev.intScorePct + '%' }}</div>
            </div>
            <div style="flex:1;">
              <div class="progress-track"><div class="progress-fill" :style="{ width: (ev.intScorePct || 0) + '%', background: progressColor(ev.intScorePct, 55, 40) }"></div></div>
              <div class="score-detail mt8">Seuil requis : 55%</div>
            </div>
            <div style="text-align:right;">
              <div class="score-verdict" :class="scoreClass(ev.intScorePct, 55, 40)">{{ verdictLabel[ev.intVerdict] || 'Non évalué' }}</div>
            </div>
          </div>

          <div v-if="!intCriteria.length" class="text-sm" style="color:var(--text3);padding:12px 0;">
            Critères non disponibles.
          </div>
          <div v-for="(c, i) in intCriteria" :key="i" class="criteria-item-ro" :class="{ 'criteria-disabled': intEnabled[i] === false }">
            <div class="criteria-score-badge" :class="scoreBadgeClass(intScores[i])">
              {{ intScores[i] !== undefined ? intScores[i] : '—' }}
            </div>
            <div class="criteria-text">
              <div class="criteria-name">
                {{ c.n }}
                <span v-if="intEnabled[i] === false" class="disabled-tag">désactivé</span>
              </div>
              <div v-if="c.d" class="criteria-desc">{{ c.d }}</div>
              <div v-if="intObs[i]" class="criteria-obs-ro">{{ intObs[i] }}</div>
            </div>
          </div>
        </div>

        <!-- Analyses IA intervenant -->
        <template v-if="ev.cvAnalysis || ev.attestationsAnalysis || ev.certifEditeurAnalysis">
          <div class="ai-panel">
            <div class="ai-header"><span class="ai-badge">IA — Intervenant</span></div>
            <div v-if="ev.cvAnalysis" class="ai-block">
              <div class="ai-block-label">Analyse CV</div>
              <AiText class="ai-content" :text="ev.cvAnalysis" />
            </div>
            <div v-if="ev.attestationsAnalysis" class="ai-block">
              <div class="ai-block-label">Attestations intervenant</div>
              <AiText class="ai-content" :text="ev.attestationsAnalysis" />
            </div>
            <div v-if="ev.certifEditeurAnalysis" class="ai-block">
              <div class="ai-block-label">Certificat éditeur</div>
              <AiText class="ai-content" :text="ev.certifEditeurAnalysis" />
            </div>
          </div>
        </template>

        <!-- SECTION 4 : Décision finale -->
        <div class="card">
          <div class="card-title">4 — Décision finale</div>
          <div class="metrics-row" style="margin-bottom:16px;">
            <div class="metric">
              <div class="metric-label">Score solution</div>
              <div class="metric-value">{{ ev.solScorePct !== null ? ev.solScorePct + '%' : '—' }}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Score {{ ev.referenceType === 'ACTION' ? 'consultant' : 'intégrateur' }}</div>
              <div class="metric-value">{{ ev.intScorePct !== null ? ev.intScorePct + '%' : '—' }}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Score global</div>
              <div class="metric-value accent">{{ ev.finalScorePct !== null ? ev.finalScorePct + '%' : '—' }}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Décision</div>
              <div class="metric-value" style="font-size:14px;">
                <span class="badge" :class="decisionBadge(ev.finalDecision)">{{ decisionLabel(ev.finalDecision) }}</span>
              </div>
            </div>
          </div>

          <div v-if="ev.conditions" style="margin-bottom:12px;">
            <div class="detail-label" style="margin-bottom:4px;">Conditions</div>
            <div class="detail-text-block">{{ ev.conditions }}</div>
          </div>
          <div v-if="ev.commissionComments">
            <div class="detail-label" style="margin-bottom:4px;">Observations de la commission</div>
            <div class="detail-text-block">{{ ev.commissionComments }}</div>
          </div>
        </div>

        <!-- SECTION 5 : Procès-verbal -->
        <div v-if="ev.pvText" class="card">
          <div class="card-title">5 — Procès-verbal</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px;font-size:13px;line-height:1.8;white-space:pre-wrap;max-height:500px;overflow-y:auto;">{{ ev.pvText }}</div>
          <div style="margin-top:10px;">
            <button class="btn btn-ghost btn-sm" @click="copyPV">⎘ Copier le PV</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import AiText from '@/components/AiText.vue'

const route = useRoute()
const ev = ref(null)
const program = ref(null)
const loading = ref(true)
const error = ref('')

const verdictLabel = { OK: 'Validé', PARTIEL: 'Partiel', KO: 'Insuffisant' }

const solCriteria = computed(() => {
  if (!ev.value) return []
  if (Array.isArray(ev.value.customCriteria) && ev.value.customCriteria.length > 0) {
    return ev.value.customCriteria
  }
  if (!program.value) return []
  if (ev.value.referenceType === 'SOLUTION' && ev.value.category) {
    return program.value.categories?.[ev.value.category]?.criteria || []
  }
  if (ev.value.referenceType === 'ACTION' && ev.value.actionDomain) {
    return program.value.actionTypes?.[ev.value.actionDomain]?.criteria || []
  }
  return []
})

const hasDocsMeta = computed(() => {
  const d = ev.value?.docsMeta
  return d && (d.cv?.length || d.attestations?.length || d.certif?.length || d.specs?.length)
})
const intCriteria = computed(() => program.value?.intCriteria || [])
const solScores = computed(() => ev.value?.solScores || {})
const solObs = computed(() => ev.value?.solObservations || {})
const solEnabled = computed(() => ev.value?.solEnabled || {})
const intScores = computed(() => ev.value?.intScores || {})
const intObs = computed(() => ev.value?.intObservations || {})
const intEnabled = computed(() => ev.value?.intEnabled || {})

onMounted(async () => {
  try {
    const { data } = await api.get(`/evaluations/${route.params.id}`)
    ev.value = data
    program.value = data.program || null
  } catch (err) {
    error.value = err.response?.data?.error || 'Évaluation introuvable ou accès interdit.'
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
function decisionFullLabel(d) {
  return { REFERENCE: '✓ Référencé', CONDITIONNEL: '⚠ Référencé conditionnel', REJETE: '✗ Rejeté' }[d] || ''
}
function scoreClass(pct, high, mid) {
  if (pct === null || pct === undefined) return ''
  if (pct >= high) return 'ok'
  if (pct >= mid) return 'warn'
  return 'ko'
}
function progressColor(pct, high, mid) {
  if (pct >= high) return 'var(--green, #22c55e)'
  if (pct >= mid) return 'var(--amber, #f59e0b)'
  return 'var(--red, #ef4444)'
}
function scoreBadgeClass(v) {
  if (v === 2) return 'sb-ok'
  if (v === 1) return 'sb-warn'
  if (v === 0) return 'sb-ko'
  return 'sb-none'
}

async function copyPV() {
  if (ev.value?.pvText) await navigator.clipboard.writeText(ev.value.pvText)
}
</script>

<style scoped>
.detail-grid { display: flex; flex-direction: column; gap: 6px; }
.detail-row { display: flex; gap: 12px; font-size: 13px; }
.detail-label { color: var(--text3); font-family: var(--mono); font-size: 11px; min-width: 160px; padding-top: 2px; }
.detail-value { color: var(--text); }
.detail-text-block { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }

.criteria-item-ro { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); align-items: flex-start; }
.criteria-item-ro:last-child { border-bottom: none; }
.criteria-item-ro.criteria-disabled { opacity: 0.45; }

.criteria-score-badge { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; margin-top: 2px; }
.sb-ok { background: rgba(34,197,94,0.15); color: #22c55e; }
.sb-warn { background: rgba(245,158,11,0.15); color: #f59e0b; }
.sb-ko { background: rgba(239,68,68,0.15); color: #ef4444; }
.sb-none { background: var(--surface2); color: var(--text3); font-size: 11px; }

.criteria-obs-ro { margin-top: 6px; font-size: 12px; color: var(--text2); background: var(--bg); border-left: 2px solid var(--accent); padding: 6px 10px; border-radius: 0 var(--radius) var(--radius) 0; white-space: pre-wrap; }

.disabled-tag { font-size: 10px; background: var(--surface2); color: var(--text3); border-radius: 4px; padding: 1px 6px; margin-left: 6px; font-family: var(--mono); }
.prio-tag { font-size: 10px; background: rgba(99,102,241,0.12); color: var(--accent); border-radius: 4px; padding: 1px 6px; margin-left: 6px; }

.decision-banner { padding: 16px 20px; border-radius: var(--radius2); margin-bottom: 16px; text-align: center; }
.decision-banner.ref { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); }
.decision-banner.cond { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); }
.decision-banner.rej { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); }
.decision-verdict { font-size: 18px; font-weight: 700; }
.decision-banner.ref .decision-verdict { color: #22c55e; }
.decision-banner.cond .decision-verdict { color: #f59e0b; }
.decision-banner.rej .decision-verdict { color: #ef4444; }

.ai-block { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07); }
.ai-block:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.ai-block-label { font-size: 11px; font-family: var(--mono); color: rgba(255,255,255,0.4); margin-bottom: 6px; }

.docs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.docs-group { display: flex; flex-direction: column; gap: 6px; }
.docs-group-label { font-size: 11px; font-family: var(--mono); color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.doc-item { font-size: 12px; color: var(--text2); font-family: var(--mono); background: var(--bg); border: 1px solid var(--border); border-radius: 5px; padding: 5px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
