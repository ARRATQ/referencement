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
        <div v-if="sourceRoles.length" class="row gap8 mb12">
          <button
            v-for="r in sourceRoles" :key="r"
            class="btn btn-sm" :class="sourceTab === r ? 'btn-primary' : 'btn-secondary'"
            @click="sourceTab = r"
          >{{ roleLabels[r] }}</button>
        </div>
        <div v-for="(items, type) in (sourcesByRoleType[sourceTab] || {})" :key="type" class="mb12">
          <div class="text-sm text-mono mb4">{{ typeLabels[type] || type }}</div>
          <label v-for="s in items" :key="s.attachmentId" class="att-item">
            <input type="checkbox" class="att-check" :value="s.attachmentId" v-model="selectedSources" />
            <span class="att-icon">📎</span>
            <span class="att-name">{{ s.filename }}</span>
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

        <div class="crit-actions mb8">
          <button v-if="!isCustom" type="button" class="btn btn-secondary btn-sm" @click="customizeCriteria">✎ Personnaliser la grille</button>
          <template v-else>
            <span class="crit-custom-badge">Grille personnalisée</span>
            <button type="button" class="btn btn-secondary btn-sm" @click="addCriterion">+ Critère</button>
            <button type="button" class="btn btn-secondary btn-sm" @click="resetCriteria">↩ Standard</button>
          </template>
        </div>

        <div v-for="(c, i) in criteria" :key="i" class="crit-row" :class="{ disabled: theoEnabled[i] === false }">
          <!-- Édition inline (grille personnalisée uniquement) -->
          <template v-if="isCustom && editingIdx === i">
            <div class="crit-edit">
              <input class="crit-edit-input" v-model="editingBuf.n" placeholder="Titre du critère" @keyup.enter="saveEdit" @keyup.escape="editingIdx = null" />
              <textarea class="crit-edit-area" v-model="editingBuf.d" rows="2" placeholder="Description"></textarea>
              <textarea class="crit-edit-area" v-model="editingBuf.consistance" rows="2" placeholder="Consistance attendue (élément de preuve)"></textarea>
              <div class="crit-edit-foot">
                <label class="crit-edit-w">Poids
                  <select v-model.number="editingBuf.w">
                    <option :value="1">1</option>
                    <option :value="2">2</option>
                    <option :value="3">3</option>
                  </select>
                </label>
                <div class="crit-edit-btns">
                  <button type="button" class="btn btn-secondary btn-sm" @click="editingIdx = null">Annuler</button>
                  <button type="button" class="btn btn-primary btn-sm" @click="saveEdit">Enregistrer</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <button type="button" class="crit-toggle" :title="theoEnabled[i] === false ? 'Activer le critère' : 'Désactiver le critère'" @click="toggleEnabled(theoEnabled, i)">
              {{ theoEnabled[i] === false ? '○' : '●' }}
            </button>
            <div class="crit-body">
              <div class="crit-name">
                {{ c.n }}
                <span v-if="c.w && c.w > 1" class="crit-weight">×{{ c.w }}</span>
              </div>
              <div v-if="c.d" class="crit-desc">{{ c.d }}</div>
              <div v-if="c.consistance" class="crit-consist"><span class="crit-consist-lbl">Consistance</span>{{ c.consistance }}</div>
              <textarea class="crit-obs" v-model="theoJustifs[i]" rows="2" placeholder="Justification / observation…"></textarea>
            </div>
            <div class="crit-scores-wrap">
              <div class="crit-scores">
                <button v-for="n in [0, 1, 2]" :key="n" type="button" class="sbtn" :class="[`s${n}`, { sel: theoScores[i] === n }]" @click="theoScores[i] = n">{{ n }}</button>
              </div>
              <div v-if="isCustom" class="crit-manage">
                <button type="button" class="crit-mng" title="Modifier" @click="startEdit(i)">✎</button>
                <button type="button" class="crit-mng del" title="Supprimer" @click="removeCriterion(i)">✕</button>
              </div>
            </div>
          </template>
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

        <div v-for="(c, i) in criteria" :key="i" class="crit-row" :class="{ disabled: theoEnabled[i] === false }">
          <button type="button" class="crit-toggle" :title="theoEnabled[i] === false ? 'Activer le critère' : 'Désactiver le critère'" @click="toggleEnabled(theoEnabled, i)">
            {{ theoEnabled[i] === false ? '○' : '●' }}
          </button>
          <div class="crit-body">
            <div class="crit-name">
              {{ c.n }}
              <span v-if="c.w && c.w > 1" class="crit-weight">×{{ c.w }}</span>
            </div>
            <div v-if="c.d" class="crit-desc">{{ c.d }}</div>
            <div v-if="c.consistance" class="crit-consist"><span class="crit-consist-lbl">Consistance</span>{{ c.consistance }}</div>
            <textarea class="crit-obs" v-model="demoJustifs[i]" rows="2" placeholder="Justification / observation…"></textarea>
          </div>
          <div class="crit-scores">
            <button v-for="n in [0, 1, 2]" :key="n" type="button" class="sbtn" :class="[`s${n}`, { sel: demoScores[i] === n }]" @click="demoScores[i] = n">{{ n }}</button>
          </div>
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

// Les catégories suivent le programme SÉLECTIONNÉ (liste /programs déjà chargée),
// pas seulement le programme déduit au chargement — sinon le select reste vide
// quand la déduction échoue ou quand l'utilisateur change de programme.
const categories = computed(() => {
  const p = programs.value.find(pr => pr.code === programCode.value)
  return p?.categories || ticket.value?.program?.categories || {}
})

// Grille standard de la catégorie choisie (dérivée du programme).
const categoryCriteria = computed(() => {
  const cat = categories.value[categoryKey.value]
  return cat && Array.isArray(cat.criteria) ? cat.criteria : []
})

// Grille personnalisée (fork mutable). Tant qu'elle est vide, on affiche la
// grille standard ; dès que l'utilisateur personnalise, elle prime — et c'est
// elle qui est envoyée au backend pour scoring (persistée dans customCriteria).
const customCriteria = ref([])
const isCustom = computed(() => customCriteria.value.length > 0)
const criteria = computed(() => (isCustom.value ? customCriteria.value : categoryCriteria.value))

// ── Édition inline des critères (calquée sur StepEvaluation) ─────────────────
const editingIdx = ref(null)
const editingBuf = ref({ n: '', d: '', w: 1, consistance: '' })

// Fork : copie la grille standard courante dans customCriteria pour la rendre éditable.
function customizeCriteria() {
  customCriteria.value = criteria.value.map(c => ({
    n: c.n || '', d: c.d || '', w: c.w || 1, consistance: c.consistance || ''
  }))
}

function resetCriteria() {
  if (!window.confirm('Revenir à la grille standard du programme ? Les critères personnalisés seront perdus.')) return
  customCriteria.value = []
  editingIdx.value = null
}

function addCriterion() {
  customCriteria.value = [...customCriteria.value, { n: '', d: '', w: 1, consistance: '' }]
  editingIdx.value = customCriteria.value.length - 1
  editingBuf.value = { n: '', d: '', w: 1, consistance: '' }
}

function startEdit(i) {
  editingIdx.value = i
  editingBuf.value = { ...customCriteria.value[i] }
}

function saveEdit() {
  if (!editingBuf.value.n.trim()) return
  const updated = [...customCriteria.value]
  updated[editingIdx.value] = { ...editingBuf.value, w: Number(editingBuf.value.w) || 1 }
  customCriteria.value = updated
  editingIdx.value = null
}

// Décale les clés d'une map indexée par position après suppression du critère i
// (retourne une nouvelle map — pas de mutation en place).
function reindexAfterRemove(map, removedIdx) {
  const out = {}
  for (const [k, v] of Object.entries(map || {})) {
    const idx = Number(k)
    if (idx < removedIdx) out[idx] = v
    else if (idx > removedIdx) out[idx - 1] = v
  }
  return out
}

function removeCriterion(i) {
  if (!window.confirm('Supprimer ce critère ?')) return
  customCriteria.value = customCriteria.value.filter((_, idx) => idx !== i)
  // Réindexation : les notes/justifs/activation sont indexées par position.
  theoScores.value = reindexAfterRemove(theoScores.value, i)
  theoJustifs.value = reindexAfterRemove(theoJustifs.value, i)
  theoEnabled.value = reindexAfterRemove(theoEnabled.value, i)
  demoScores.value = reindexAfterRemove(demoScores.value, i)
  demoJustifs.value = reindexAfterRemove(demoJustifs.value, i)
  if (editingIdx.value === i) editingIdx.value = null
  else if (editingIdx.value !== null && editingIdx.value > i) editingIdx.value -= 1
}

const sourceTab = ref('')
const roleLabels = { competence: 'Compétence', intervenant: 'Intervenant', prestataire: 'Prestataire' }
const typeLabels = {
  grille_fonctionnelle: 'Grille fonctionnelle',
  attestation_reference: 'Attestation de référence',
  certificat_editeur: 'Certificat éditeur',
  autre: 'Autre',
}

// Rôles ayant au moins une pièce jointe (ordre : compétence → intervenant → prestataire).
const sourceRoles = computed(() =>
  ['competence', 'intervenant', 'prestataire'].filter(
    r => (ticket.value?.sources || []).some(s => s.ticketRole === r),
  ),
)

// Sources groupées par rôle (onglet) puis par type (grille / attestation / autre…).
const sourcesByRoleType = computed(() => {
  const out = {}
  for (const s of ticket.value?.sources || []) {
    if (!out[s.ticketRole]) out[s.ticketRole] = {}
    if (!out[s.ticketRole][s.type]) out[s.ticketRole][s.type] = []
    out[s.ticketRole][s.type].push(s)
  }
  return out
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

// Active/désactive un critère (le critère désactivé est exclu du score, cf. computeLive).
function toggleEnabled(map, i) { map[i] = map[i] === false ? true : false }

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
  customCriteria.value = []
  editingIdx.value = null
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
    sourceTab.value = ['competence', 'intervenant', 'prestataire']
      .find(r => (data.sources || []).some(s => s.ticketRole === r)) || ''

    if (data.existing) {
      evaluationId.value = data.existing.id
      status.value = data.existing.status
      categoryKey.value = data.existing.categoryKey || ''
      customCriteria.value = Array.isArray(data.existing.customCriteria) ? data.existing.customCriteria : []
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
      programCode: programCode.value, webConsulted: webConsulted.value, fields: ticket.value?.fields || {}
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
      evaluationId: evaluationId.value, scores: theoScores.value, justifs: theoJustifs.value, enabled: theoEnabled.value,
      criteria: customCriteria.value
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
      evaluationId: evaluationId.value, scores: demoScores.value, justifs: demoJustifs.value, enabled: theoEnabled.value,
      criteria: customCriteria.value
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

/* Grille de notation par critère (calquée sur l'ancienne grille fonctionnelle) */
.crit-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--border); }
.crit-row:last-of-type { border-bottom: none; }
.crit-row.disabled { opacity: 0.5; }
.crit-toggle { flex-shrink: 0; width: 26px; height: 26px; margin-top: 2px; border: none; background: none; color: var(--accent); font-size: 15px; line-height: 1; cursor: pointer; padding: 0; }
.crit-row.disabled .crit-toggle { color: var(--text3); }
.crit-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.crit-name { font-weight: 600; font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.crit-weight { font-size: 11px; font-weight: 700; color: var(--accent); background: rgba(37,99,235,0.1); border-radius: 4px; padding: 1px 6px; }
.crit-desc { font-size: 12.5px; color: var(--text2, var(--text3)); line-height: 1.45; }
.crit-consist { font-size: 12px; color: var(--text3); line-height: 1.45; background: var(--surface2, rgba(0,0,0,0.02)); border-left: 2px solid var(--accent); padding: 5px 9px; border-radius: 0 4px 4px 0; }
.crit-consist-lbl { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; color: var(--accent); margin-right: 6px; }
.crit-obs { width: 100%; font-size: 12.5px; margin-top: 2px; }
.crit-scores-wrap { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.crit-scores { display: flex; gap: 6px; }
.crit-manage { display: flex; gap: 6px; }
.crit-mng { width: 28px; height: 28px; border: 1px solid var(--border); background: var(--surface, #fff); border-radius: 6px; font-size: 12px; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color 0.12s, color 0.12s; }
.crit-mng:hover { border-color: var(--accent); color: var(--accent); }
.crit-mng.del:hover { border-color: var(--danger, #b91c1c); color: var(--danger, #b91c1c); }

/* Barre d'actions grille (personnaliser / ajouter / réinitialiser) */
.crit-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.crit-custom-badge { font-size: 11px; font-weight: 600; color: var(--accent); background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.25); border-radius: 10px; padding: 2px 10px; }

/* Formulaire d'édition inline d'un critère */
.crit-edit { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.crit-edit-input { width: 100%; font-size: 13px; font-weight: 600; border: 1px solid var(--accent); border-radius: 6px; padding: 7px 10px; }
.crit-edit-area { width: 100%; font-size: 12.5px; resize: vertical; }
.crit-edit-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.crit-edit-w { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text3); }
.crit-edit-w select { width: 64px; text-align: center; }
.crit-edit-btns { display: flex; gap: 6px; }
.sbtn { width: 34px; height: 34px; border: 1px solid var(--border); background: var(--surface, #fff); border-radius: 6px; font-weight: 700; font-size: 14px; color: var(--text3); cursor: pointer; transition: background 0.12s, border-color 0.12s, color 0.12s; }
.sbtn:hover { border-color: var(--accent); }
.sbtn.sel.s0 { background: var(--danger, #b91c1c); border-color: var(--danger, #b91c1c); color: #fff; }
.sbtn.sel.s1 { background: #d97706; border-color: #d97706; color: #fff; }
.sbtn.sel.s2 { background: #059669; border-color: #059669; color: #fff; }
</style>
