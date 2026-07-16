<template>
  <div class="page">
    <div class="topbar">
      <div>
        <div class="topbar-title">Évaluation intervenant</div>
        <div class="topbar-sub">Sélectionnez un ticket, choisissez le CV source, validez les propositions puis envoyez vers Jira</div>
      </div>
    </div>

    <div class="content">
      <!-- Bloc 1 : sélection du ticket -->
      <div class="card">
        <div class="card-title">1. Ticket intervenant</div>
        <div class="row gap8 mb8">
          <input v-model="query" placeholder="Clé (REF-123) ou nom de l'intervenant" style="max-width:360px;"
                 @keyup.enter="search" :disabled="loading.search" />
          <button class="btn btn-primary btn-sm" @click="search" :disabled="loading.search || !query.trim()">
            <span v-if="loading.search" class="spinner spinner-dark"></span>
            <span v-else>Rechercher</span>
          </button>
        </div>
        <div v-if="results.length" class="att-list">
          <button v-for="r in results" :key="r.key" class="att-item" style="width:100%; text-align:left; border:1px solid var(--border);"
                  @click="selectTicket(r.key)">
            <span class="text-mono">{{ r.key }}</span>
            <span class="att-name">{{ r.summary }}</span>
            <span class="badge badge-blue">{{ r.status }}</span>
          </button>
        </div>
        <div v-else-if="searched && !loading.search" class="empty-state">Aucun résultat.</div>
      </div>

      <!-- Bloc 2 : ticket + choix CV -->
      <div v-if="ticket" class="card">
        <div class="card-title">2. CV source — {{ ticket.key }} · {{ ticket.summary }}</div>

        <div v-if="ticket.existing && ticket.existing.status === 'PUSHED'" class="extract-panel">
          Cet intervenant a déjà été évalué le {{ formatDate(ticket.existing.pushedAt) }}
          par {{ ticket.existing.evaluator?.name || '—' }}. Vous pouvez relancer une extraction si besoin.
        </div>
        <div v-if="ticket.unresolved.length" class="extract-panel">
          Champs Jira non résolus (ils seront exclus de l'envoi) : {{ ticket.unresolved.join(', ') }}
        </div>

        <div class="source-tabs">
          <button v-for="s in DOC_SOURCES" :key="s.id" class="src-tab"
                  :class="{ active: docSource === s.id }" @click="docSource = s.id">
            {{ s.icon }} {{ s.label }}
          </button>
        </div>

        <template v-if="docSource === 'jira'">
          <div v-if="!ticket.attachments.length" class="info-hint mt12 mb8">
            Aucune pièce jointe sur ce ticket — utilisez l'upload local.
          </div>
          <div v-else class="att-list mt12 mb8">
            <label v-for="a in ticket.attachments" :key="a.id" class="att-item" :class="{ sel: selectedAttachment === a.id }">
              <input type="radio" class="att-check" v-model="selectedAttachment" :value="a.id" />
              <span class="att-icon">{{ attIcon(a.filename) }}</span>
              <span class="att-name">{{ a.filename }}</span>
              <span class="att-size" v-if="a.size">{{ formatSize(a.size) }}</span>
            </label>
          </div>
        </template>
        <template v-else>
          <div class="upload-zone mt12 mb8" @drop.prevent="onFileDrop" @dragover.prevent>
            <label class="upload-area">
              <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style="display:none" @change="onFileChange" />
              <div class="upload-icon">📂</div>
              <div class="upload-text">Glissez le CV de l'intervenant ici, ou <span class="upload-link">parcourir</span></div>
              <div class="upload-sub">PDF, DOCX, PNG, JPG</div>
            </label>
          </div>
          <div v-if="uploadedFile" class="files-list mb8">
            <div class="file-item">
              <span class="att-icon">{{ attIcon(uploadedFile.filename) }}</span>
              <span class="file-name">{{ uploadedFile.filename }}</span>
              <button type="button" class="file-remove" @click="uploadedFile = null">✕</button>
            </div>
          </div>
        </template>

        <button class="btn btn-primary" @click="extract" :disabled="loading.extract || !canExtract">
          <span v-if="loading.extract" class="spinner spinner-dark"></span>
          <span v-else>Extraire les informations du CV</span>
        </button>
        <p v-if="errors.extract" class="text-sm" style="color:var(--danger, #b91c1c);">
          {{ errors.extract }} — vous pouvez renseigner les champs manuellement ci-dessous.
        </p>
      </div>

      <!-- Bloc 3 : revue et validation -->
      <div v-if="ticket && (extracted || errors.extract)" class="card">
        <div class="card-title">3. Revue et validation</div>
        <div v-for="f in fieldList" :key="f.key" class="mb8">
          <label>{{ f.jiraName }}</label>
          <select v-if="f.type === 'radio'" v-model="form[f.key]">
            <option value="">— non renseigné —</option>
            <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
          </select>
          <template v-else>
            <textarea v-model="form[f.key]" rows="2" :maxlength="TEXT_MAX"></textarea>
            <div class="char-count" :class="{ warn: (form[f.key] || '').length >= TEXT_MAX }">
              {{ (form[f.key] || '').length }}/{{ TEXT_MAX }}
            </div>
          </template>
          <div v-if="justifications[f.key]" class="text-sm">IA : {{ justifications[f.key] }}</div>
        </div>

        <button class="btn btn-primary" @click="confirmPush" :disabled="loading.push || !hasValues">
          <span v-if="loading.push" class="spinner spinner-dark"></span>
          <span v-else>Valider et envoyer vers Jira</span>
        </button>
        <p v-if="errors.push" class="text-sm" style="color:var(--danger, #b91c1c);">{{ errors.push }}</p>
        <p v-if="pushResult" class="text-sm" style="color:var(--green, #15803d);">
          Envoyé : {{ pushResult.pushedFields.length }} champ(s).
          <span v-if="pushResult.skipped.length">Ignorés (vides ou non résolus) : {{ pushResult.skipped.join(', ') }}.</span>
        </p>
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

// Limite Jira des champs « Text Field (single line) » : 255 caractères.
const TEXT_MAX = 255

const DOC_SOURCES = [
  { id: 'jira',   icon: '📎', label: 'Pièces jointes Jira' },
  { id: 'upload', icon: '💻', label: 'Upload local' },
]

const query = ref('')
const results = ref([])
const searched = ref(false)
const ticket = ref(null)
const docSource = ref('jira')
const selectedAttachment = ref(null)
const uploadedFile = ref(null)
const extracted = ref(false)
const form = ref({})
const justifications = ref({})
const evaluationId = ref(null)
const pushResult = ref(null)
const loading = ref({ search: false, extract: false, push: false })
const errors = ref({ extract: '', push: '' })

const fieldList = computed(() => {
  if (!ticket.value) return []
  return Object.entries(ticket.value.fields).map(([key, f]) => ({ key, ...f }))
})
const canExtract = computed(() =>
  docSource.value === 'jira' ? !!selectedAttachment.value : !!uploadedFile.value)
const hasValues = computed(() => Object.values(form.value).some(v => v && String(v).trim()))

// Ouverture depuis Jira : /intervenants?key=PTC-123 charge directement le ticket.
onMounted(() => {
  const key = String(route.query.key || '').trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key)) return
  query.value = key
  selectTicket(key)
})

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

async function search() {
  loading.value.search = true
  searched.value = true
  ticket.value = null
  try {
    const { data } = await api.get('/intervenants/search', { params: { q: query.value.trim() } })
    results.value = data
    if (data.length === 1) await selectTicket(data[0].key)
  } catch (e) {
    showNotif(e.response?.data?.error || 'Erreur de recherche Jira', 'error')
  } finally {
    loading.value.search = false
  }
}

async function selectTicket(key) {
  loading.value.search = true
  extracted.value = false
  pushResult.value = null
  errors.value = { extract: '', push: '' }
  form.value = {}
  justifications.value = {}
  selectedAttachment.value = null
  uploadedFile.value = null
  evaluationId.value = null
  try {
    const { data } = await api.get(`/intervenants/${key}`)
    ticket.value = data
    docSource.value = data.attachments.length ? 'jira' : 'upload'
    // Reprise : pré-remplir depuis une évaluation existante déjà validée.
    const prev = data.existing?.validated && Object.keys(data.existing.validated).length
      ? data.existing.validated
      : null
    if (prev) {
      for (const k of Object.keys(data.fields)) form.value[k] = prev[k] || ''
      evaluationId.value = data.existing.id
      extracted.value = true
    }
  } catch (e) {
    showNotif(e.response?.data?.error || 'Ticket introuvable', 'error')
  } finally {
    loading.value.search = false
  }
}

function attIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['png', 'jpg', 'jpeg'].includes(ext)) return '🖼'
  if (['doc', 'docx'].includes(ext)) return '📝'
  return '📎'
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'o'
  if (bytes < 1048576) return Math.round(bytes / 1024) + 'ko'
  return (bytes / 1048576).toFixed(1) + 'Mo'
}

function readUpload(file) {
  if (!file) { uploadedFile.value = null; return }
  const reader = new FileReader()
  reader.onload = () => {
    uploadedFile.value = {
      base64: reader.result.split(',')[1],
      mimeType: file.type,
      filename: file.name
    }
  }
  reader.readAsDataURL(file)
}

function onFileChange(ev) {
  readUpload(ev.target.files[0])
  ev.target.value = ''
}

function onFileDrop(ev) {
  readUpload(ev.dataTransfer.files[0])
}

async function extract() {
  loading.value.extract = true
  errors.value.extract = ''
  try {
    const body = docSource.value === 'upload'
      ? { fileData: uploadedFile.value }
      : { attachmentId: selectedAttachment.value }
    const { data } = await api.post(`/intervenants/${ticket.value.key}/extract`, body)
    evaluationId.value = data.evaluationId
    for (const [k, p] of Object.entries(data.propositions)) {
      form.value[k] = p.value
      justifications.value[k] = p.justification
    }
    extracted.value = true
    showNotif('Propositions IA prêtes — vérifiez avant envoi', 'ok')
  } catch (e) {
    errors.value.extract = e.response?.data?.error || 'Échec de l\'extraction IA'
    extracted.value = false
    // Saisie manuelle possible : initialiser les clés pour afficher le bloc 3.
    for (const k of Object.keys(ticket.value.fields)) {
      if (form.value[k] === undefined) form.value[k] = ''
    }
  } finally {
    loading.value.extract = false
  }
}

async function confirmPush() {
  const filled = Object.entries(form.value).filter(([, v]) => v && String(v).trim())
  const recap = filled.map(([k, v]) => `• ${ticket.value.fields[k]?.jiraName || k} : ${String(v).slice(0, 80)}`).join('\n')
  if (!window.confirm(`Envoyer ces ${filled.length} champ(s) vers ${ticket.value.key} ?\n\n${recap}`)) return

  loading.value.push = true
  errors.value.push = ''
  try {
    const values = Object.fromEntries(filled)
    const { data } = await api.post(`/intervenants/${ticket.value.key}/push`, {
      values, evaluationId: evaluationId.value
    })
    pushResult.value = data
    showNotif('Champs envoyés vers Jira', 'ok')
  } catch (e) {
    errors.value.push = e.response?.data?.error || 'Échec de l\'envoi vers Jira'
  } finally {
    loading.value.push = false
  }
}
</script>

<style scoped>
/* Sélecteur de document — même design que le picker du wizard (StepDossier) */
.source-tabs { display: flex; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
.src-tab { padding: 7px 14px; background: transparent; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text2); cursor: pointer; font-family: var(--sans); transition: all 0.15s; width: auto; }
.src-tab:hover { border-color: var(--text3); color: var(--text); }
.src-tab.active { border-color: var(--accent); color: var(--accent); background: rgba(37,99,235,0.08); }

.att-list { display: flex; flex-direction: column; gap: 6px; }
.att-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: var(--surface2, rgba(0,0,0,0.02)); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; transition: background 0.12s, border-color 0.12s; }
.att-item:hover { background: rgba(37,99,235,0.04); }
.att-item.sel { border-color: var(--accent); background: rgba(37,99,235,0.06); }
.att-check { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
.att-icon { font-size: 16px; flex-shrink: 0; }
.att-name { flex: 1; font-size: 12px; color: var(--text); font-family: var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-size { font-size: 11px; color: var(--text3); font-family: var(--mono); white-space: nowrap; }

.upload-zone { border: 2px dashed var(--border); border-radius: 8px; transition: border-color 0.15s; }
.upload-zone:hover { border-color: var(--text3); }
.upload-area { display: flex; flex-direction: column; align-items: center; padding: 24px; cursor: pointer; gap: 6px; }
.upload-icon { font-size: 26px; }
.upload-text { font-size: 13px; color: var(--text2); }
.upload-link { color: var(--accent); text-decoration: underline; cursor: pointer; }
.upload-sub { font-size: 11px; color: var(--text3); font-family: var(--mono); }
.files-list { display: flex; flex-wrap: wrap; gap: 6px; }
.file-item { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--surface2, rgba(0,0,0,0.02)); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text2); font-family: var(--mono); }
.file-name { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-remove { background: none; border: none; cursor: pointer; color: var(--text3); font-size: 11px; padding: 0; width: auto; }
.file-remove:hover { color: #f87171; }

.info-hint { padding: 12px 16px; background: var(--surface2, rgba(0,0,0,0.02)); border: 1px solid var(--border); border-radius: 6px; font-size: 13px; color: var(--text3); font-family: var(--mono); }

/* Compteur — limite Jira Text Field (single line) */
.char-count { font-size: 11px; color: var(--text3); font-family: var(--mono); text-align: right; }
.char-count.warn { color: #f87171; }

.mt12 { margin-top: 12px; }
</style>
