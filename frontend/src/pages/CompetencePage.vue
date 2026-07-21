<template>
  <div class="page">
    <div class="topbar">
      <div>
        <div class="topbar-title">Évaluation compétence</div>
        <div class="topbar-sub">Chargez un ticket compétence, notez la solution (théorique puis démo) et envoyez vers Jira après la démo</div>
      </div>
    </div>

    <div class="content">
      <!-- Bloc 1 : chargement du ticket -->
      <div class="card">
        <div class="card-title">1. Ticket compétence</div>
        <div class="row gap8 mb8">
          <input v-model="query" placeholder="Clé (REF-123)" style="max-width:360px;"
                 @keyup.enter="loadTicket(query)" :disabled="loading.load" />
          <button class="btn btn-primary btn-sm" @click="loadTicket(query)" :disabled="loading.load || !query.trim()">
            <span v-if="loading.load" class="spinner spinner-dark"></span>
            <span v-else>Charger</span>
          </button>
        </div>
        <p v-if="errors.load" class="text-sm" style="color:var(--danger, #b91c1c);">{{ errors.load }}</p>
      </div>

      <!-- Bloc 2 : contexte -->
      <div v-if="ticket" class="card">
        <div class="card-title">2. Contexte — {{ ticket.key }} · {{ ticket.summary }}</div>

        <div class="att-list mb12">
          <div v-if="ticket.context.competence" class="att-item" style="cursor:default;">
            <span class="text-mono">{{ ticket.context.competence.key }}</span>
            <span class="att-name">{{ ticket.context.competence.summary }}</span>
            <span class="badge badge-blue">{{ ticket.context.competence.status }}</span>
          </div>
          <div v-if="ticket.context.intervenant" class="att-item" style="cursor:default;">
            <span class="text-mono">{{ ticket.context.intervenant.key }}</span>
            <span class="att-name">{{ ticket.context.intervenant.summary }}</span>
            <span class="badge badge-blue">{{ ticket.context.intervenant.status }}</span>
          </div>
          <div v-if="ticket.context.prestataire" class="att-item" style="cursor:default;">
            <span class="text-mono">{{ ticket.context.prestataire.key }}</span>
            <span class="att-name">{{ ticket.context.prestataire.summary }}</span>
            <span class="badge badge-blue">{{ ticket.context.prestataire.status }}</span>
          </div>
        </div>

        <div v-if="ticket.unresolved.length" class="info-hint mb12">
          Champs Jira non résolus : {{ ticket.unresolved.join(', ') }}
        </div>

        <div v-for="f in fieldList" :key="f.key" class="mb8">
          <label>{{ f.jiraName }}</label>
          <input :value="f.value" readonly />
        </div>

        <div class="mb8">
          <label>Programme</label>
          <select v-model="programCode">
            <option value="">— sélectionner —</option>
            <option v-for="p in programs" :key="p.code" :value="p.code">{{ p.name }}</option>
          </select>
        </div>
      </div>

      <!-- Bloc 3 : catégorie -->
      <div v-if="ticket && programCode" class="card">
        <div class="card-title">3. Catégorie</div>
        <div class="row gap8 mb8">
          <select v-model="categoryKey" style="max-width:360px;">
            <option value="">— sélectionner —</option>
            <option v-for="(cat, key) in categories" :key="key" :value="key">{{ cat.label }}</option>
          </select>
          <button class="btn btn-secondary btn-sm" @click="suggestCategory" :disabled="loading.suggest">
            <span v-if="loading.suggest" class="spinner spinner-dark"></span>
            <span v-else>🤖 Suggérer</span>
          </button>
        </div>
        <div v-if="suggestion" class="info-hint">
          Suggestion : <strong>{{ suggestion.key }}</strong>
          <span v-if="suggestion.confidence"> (confiance {{ suggestion.confidence }})</span>
          <div v-if="suggestion.rationale" class="text-sm mt4">{{ suggestion.rationale }}</div>
        </div>
      </div>

      <!-- Bloc 4 : sources -->
      <div v-if="ticket && categoryKey" class="card">
        <div class="card-title">4. Sources</div>
        <div v-for="(items, type) in sourcesByType" :key="type" class="mb12">
          <div class="text-sm text-mono mb4">{{ type }}</div>
          <label v-for="s in items" :key="s.attachmentId" class="att-item">
            <input type="checkbox" class="att-check" :value="s.attachmentId" v-model="selectedSources" />
            <span class="att-icon">📎</span>
            <span class="att-name">{{ s.filename }}</span>
            <span class="text-sm">({{ s.ticketRole }})</span>
          </label>
        </div>
        <div v-if="!ticket.sources.length" class="empty-state">Aucune pièce jointe source disponible.</div>

        <label class="row gap8 mb8" style="align-items:center;">
          <input type="checkbox" v-model="webConsulted" style="width:auto;" />
          Consulter le web
        </label>

        <button class="btn btn-primary" @click="runScore" :disabled="loading.score || !selectedSources.length">
          <span v-if="loading.score" class="spinner spinner-dark"></span>
          <span v-else>Noter avec l'IA</span>
        </button>
        <p v-if="errors.score" class="text-sm" style="color:var(--danger, #b91c1c);">{{ errors.score }}</p>
      </div>

      <!-- Bloc 5 : notation théorique -->
      <div v-if="evaluationId && criteria.length" class="card">
        <div class="card-title">5. Notation théorique</div>

        <div v-for="(c, i) in criteria" :key="i" class="mb12" style="border-bottom:1px solid var(--border); padding-bottom:12px;">
          <label class="row gap8" style="align-items:center;">
            <input type="checkbox" v-model="theoEnabled[i]" style="width:auto;" />
            <strong>{{ c.label }}</strong>
          </label>
          <div class="row gap8 mb8">
            <label v-for="n in [0, 1, 2]" :key="n" class="row gap8" style="align-items:center; width:auto;">
              <input type="radio" :name="`theo-${i}`" :value="n" v-model.number="theoScores[i]" style="width:auto;" />
              {{ n }}
            </label>
          </div>
          <textarea v-model="theoJustifs[i]" rows="2" placeholder="Justification"></textarea>
        </div>

        <div class="info-hint mb12">
          Score : <strong>{{ theoLive.pct !== null ? theoLive.pct + '%' : '—' }}</strong>
          · Verdict : <strong>{{ theoLive.verdict || '—' }}</strong>
        </div>

        <button class="btn btn-primary" @click="saveTheorique" :disabled="loading.theorique">
          <span v-if="loading.theorique" class="spinner spinner-dark"></span>
          <span v-else>Valider la notation théorique</span>
        </button>
        <p v-if="errors.theorique" class="text-sm" style="color:var(--danger, #b91c1c);">{{ errors.theorique }}</p>
      </div>

      <!-- Bloc 6 : briefing -->
      <div v-if="status === 'THEORIQUE_DONE' || status === 'DEMO_DONE'" class="card">
        <div class="card-title">6. Briefing pré-démo (optionnel)</div>
        <button class="btn btn-secondary" @click="generateBriefing" :disabled="loading.briefing">
          <span v-if="loading.briefing" class="spinner spinner-dark"></span>
          <span v-else>Générer un briefing pré-démo</span>
        </button>
        <p v-if="briefingText" class="text-sm mt12" style="white-space:pre-wrap;">{{ briefingText }}</p>
      </div>

      <!-- Bloc 7 : phase démo -->
      <div v-if="status === 'THEORIQUE_DONE' || status === 'DEMO_DONE'" class="card">
        <div class="card-title">7. Phase démo</div>

        <div v-for="(c, i) in criteria" :key="i" class="mb12" style="border-bottom:1px solid var(--border); padding-bottom:12px;">
          <label class="row gap8" style="align-items:center;">
            <strong>{{ c.label }}</strong>
          </label>
          <div class="row gap8 mb8">
            <label v-for="n in [0, 1, 2]" :key="n" class="row gap8" style="align-items:center; width:auto;">
              <input type="radio" :name="`demo-${i}`" :value="n" v-model.number="demoScores[i]" style="width:auto;" />
              {{ n }}
            </label>
          </div>
          <textarea v-model="demoJustifs[i]" rows="2" placeholder="Justification"></textarea>
        </div>

        <div class="info-hint mb12">
          Score : <strong>{{ demoLive.pct !== null ? demoLive.pct + '%' : '—' }}</strong>
          · Verdict : <strong>{{ demoLive.verdict || '—' }}</strong>
        </div>

        <button class="btn btn-primary" @click="saveDemo" :disabled="loading.demo">
          <span v-if="loading.demo" class="spinner spinner-dark"></span>
          <span v-else>Valider la démo</span>
        </button>
        <p v-if="errors.demo" class="text-sm" style="color:var(--danger, #b91c1c);">{{ errors.demo }}</p>

        <button v-if="status === 'DEMO_DONE'" class="btn btn-primary mt12" @click="pushJira" :disabled="loading.push">
          <span v-if="loading.push" class="spinner spinner-dark"></span>
          <span v-else>Envoyer vers Jira</span>
        </button>
        <p v-if="errors.push" class="text-sm" style="color:var(--danger, #b91c1c);">{{ errors.push }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'

const showNotif = inject('showNotif')
const route = useRoute()

const query = ref('')
const ticket = ref(null)
const programs = ref([])
const programCode = ref('')
const categoryKey = ref('')
const suggestion = ref(null)
const selectedSources = ref([])
const webConsulted = ref(false)
const theoScores = ref({})
const theoJustifs = ref({})
const theoEnabled = ref({})
const demoScores = ref({})
const demoJustifs = ref({})
const evaluationId = ref(null)
const status = ref('')
const briefingText = ref('')

const loading = ref({ load: false, suggest: false, score: false, theorique: false, briefing: false, demo: false, push: false })
const errors = ref({ load: '', score: '', theorique: '', demo: '', push: '' })

const fieldList = computed(() => {
  if (!ticket.value) return []
  return Object.entries(ticket.value.fields).map(([key, f]) => ({ key, ...f }))
})

const categories = computed(() => ticket.value?.program?.categories || {})

const criteria = computed(() => {
  const cat = categories.value[categoryKey.value]
  return cat && Array.isArray(cat.criteria) ? cat.criteria : []
})

const sourcesByType = computed(() => {
  const groups = {}
  for (const s of ticket.value?.sources || []) {
    if (!groups[s.type]) groups[s.type] = []
    groups[s.type].push(s)
  }
  return groups
})

function computeLive(scores, crit, enabled) {
  let max = 0, score = 0, answered = 0
  crit.forEach((c, i) => {
    if (enabled[i] === false) return
    max += 2 * (c.w || 1)
    if (scores[i] !== undefined && scores[i] !== null) { score += Number(scores[i]) * (c.w || 1); answered++ }
  })
  if (!answered) return { pct: null, verdict: null }
  const pct = Math.round((score / max) * 100)
  const verdict = pct >= 60 ? 'FAVORABLE' : pct >= 45 ? 'CONDITIONNEL' : 'DEFAVORABLE'
  return { pct, verdict }
}

const theoLive = computed(() => computeLive(theoScores.value, criteria.value, theoEnabled.value))
const demoLive = computed(() => computeLive(demoScores.value, criteria.value, theoEnabled.value))

// Ouverture depuis Jira : /competences?key=REF-123 charge directement le ticket.
onMounted(async () => {
  try {
    const { data } = await api.get('/programs')
    programs.value = data
  } catch (e) {
    showNotif(e.response?.data?.error || 'Erreur de chargement des programmes', 'error')
  }
  const key = String(route.query.key || '').trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key)) return
  query.value = key
  loadTicket(key)
})

async function loadTicket(key) {
  const k = String(key || '').trim().toUpperCase()
  if (!k) return
  loading.value.load = true
  errors.value.load = ''
  ticket.value = null
  programCode.value = ''
  categoryKey.value = ''
  suggestion.value = null
  selectedSources.value = []
  webConsulted.value = false
  theoScores.value = {}
  theoJustifs.value = {}
  theoEnabled.value = {}
  demoScores.value = {}
  demoJustifs.value = {}
  evaluationId.value = null
  status.value = ''
  briefingText.value = ''
  try {
    const { data } = await api.get(`/competences/${k}`)
    ticket.value = data
    programCode.value = data.programCode || ''

    if (data.existing) {
      evaluationId.value = data.existing.id
      status.value = data.existing.status
      categoryKey.value = data.existing.categoryKey || ''
      selectedSources.value = (data.existing.sources || []).map(s => s.attachmentId)
      webConsulted.value = !!data.existing.webConsulted
      theoScores.value = data.existing.theoScores || {}
      theoJustifs.value = data.existing.theoJustifs || {}
      theoEnabled.value = data.existing.theoEnabled || {}
      demoScores.value = data.existing.demoScores && Object.keys(data.existing.demoScores).length
        ? data.existing.demoScores
        : { ...theoScores.value }
      demoJustifs.value = data.existing.demoJustifs && Object.keys(data.existing.demoJustifs).length
        ? data.existing.demoJustifs
        : { ...theoJustifs.value }
      briefingText.value = data.existing.briefingText || ''
    }
  } catch (e) {
    errors.value.load = e.response?.data?.error || 'Ticket introuvable'
  } finally {
    loading.value.load = false
  }
}

async function suggestCategory() {
  loading.value.suggest = true
  try {
    const { data } = await api.post(`/competences/${ticket.value.key}/suggest-category`, {
      programCode: programCode.value, webConsulted: webConsulted.value
    })
    suggestion.value = data.suggestion
    if (data.suggestion?.key) categoryKey.value = data.suggestion.key
  } catch (e) {
    showNotif(e.response?.data?.error || 'Échec de la suggestion IA', 'error')
  } finally {
    loading.value.suggest = false
  }
}

async function runScore() {
  loading.value.score = true
  errors.value.score = ''
  try {
    const sources = (ticket.value.sources || []).filter(s => selectedSources.value.includes(s.attachmentId))
    const { data } = await api.post(`/competences/${ticket.value.key}/score`, {
      categoryKey: categoryKey.value, programCode: programCode.value, sources, webConsulted: webConsulted.value
    })
    theoScores.value = data.scores || {}
    theoJustifs.value = data.justifs || {}
    theoEnabled.value = {}
    evaluationId.value = data.evaluationId
    status.value = 'DRAFT'
    showNotif('Notation IA prête — vérifiez avant validation', 'ok')
  } catch (e) {
    errors.value.score = e.response?.data?.error || 'Échec de la notation IA'
  } finally {
    loading.value.score = false
  }
}

async function saveTheorique() {
  loading.value.theorique = true
  errors.value.theorique = ''
  try {
    const { data } = await api.put(`/competences/${ticket.value.key}/theorique`, {
      evaluationId: evaluationId.value, scores: theoScores.value, justifs: theoJustifs.value, enabled: theoEnabled.value
    })
    status.value = data.status
    demoScores.value = { ...theoScores.value }
    demoJustifs.value = { ...theoJustifs.value }
    showNotif('Notation théorique validée', 'ok')
  } catch (e) {
    errors.value.theorique = e.response?.data?.error || 'Échec de la validation'
  } finally {
    loading.value.theorique = false
  }
}

async function generateBriefing() {
  loading.value.briefing = true
  try {
    const { data } = await api.post(`/competences/${ticket.value.key}/briefing`, { evaluationId: evaluationId.value })
    briefingText.value = data.briefingText
  } catch (e) {
    showNotif(e.response?.data?.error || 'Échec de la génération du briefing', 'error')
  } finally {
    loading.value.briefing = false
  }
}

async function saveDemo() {
  loading.value.demo = true
  errors.value.demo = ''
  try {
    const { data } = await api.put(`/competences/${ticket.value.key}/demo`, {
      evaluationId: evaluationId.value, scores: demoScores.value, justifs: demoJustifs.value, enabled: theoEnabled.value
    })
    status.value = data.status
    showNotif('Notation démo validée', 'ok')
  } catch (e) {
    errors.value.demo = e.response?.data?.error || 'Échec de la validation'
  } finally {
    loading.value.demo = false
  }
}

async function pushJira() {
  if (!window.confirm(`Envoyer la notation démo de ${ticket.value.key} vers Jira ?`)) return
  loading.value.push = true
  errors.value.push = ''
  try {
    const { data } = await api.post(`/competences/${ticket.value.key}/push`, { evaluationId: evaluationId.value })
    if (data.ok === false || data.commentPosted === false) {
      showNotif('Échec de l\'envoi vers Jira — le commentaire n\'a pas été publié, réessayez.', 'error')
    } else {
      status.value = data.status
      showNotif('Notation envoyée vers Jira', 'ok')
    }
  } catch (e) {
    if (e.response?.status === 502 || e.response?.data?.commentPosted === false || e.response?.data?.ok === false) {
      showNotif('Échec de l\'envoi vers Jira — le commentaire n\'a pas été publié, réessayez.', 'error')
    }
    errors.value.push = e.response?.data?.error || 'Échec de l\'envoi vers Jira'
  } finally {
    loading.value.push = false
  }
}
</script>

<style scoped>
.att-list { display: flex; flex-direction: column; gap: 6px; }
.att-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: var(--surface2, rgba(0,0,0,0.02)); border: 1px solid var(--border); border-radius: 6px; transition: background 0.12s, border-color 0.12s; }
.att-item:hover { background: rgba(37,99,235,0.04); }
.att-item.sel { border-color: var(--accent); background: rgba(37,99,235,0.06); }
.att-check { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
.att-icon { font-size: 16px; flex-shrink: 0; }
.att-name { flex: 1; font-size: 12px; color: var(--text); font-family: var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.info-hint { padding: 12px 16px; background: var(--surface2, rgba(0,0,0,0.02)); border: 1px solid var(--border); border-radius: 6px; font-size: 13px; color: var(--text3); font-family: var(--mono); }

.mt4 { margin-top: 4px; }
.mt12 { margin-top: 12px; }
.mb4 { margin-bottom: 4px; }
.mb12 { margin-bottom: 12px; }
</style>
