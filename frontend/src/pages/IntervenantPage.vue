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

        <div class="att-list mb8">
          <label v-for="a in ticket.attachments" :key="a.id" class="att-item" :class="{ sel: selectedAttachment === a.id }">
            <input type="radio" v-model="selectedAttachment" :value="a.id" />
            <span class="att-name">{{ a.filename }}</span>
            <span class="att-meta">{{ Math.round(a.size / 1024) }} Ko</span>
          </label>
          <div v-if="!ticket.attachments.length" class="text-sm">Aucune pièce jointe sur ce ticket.</div>
          <label class="att-item" :class="{ sel: selectedAttachment === '__upload__' }">
            <input type="radio" v-model="selectedAttachment" value="__upload__" />
            <span class="att-name">Uploader un fichier local</span>
            <input v-if="selectedAttachment === '__upload__'" type="file"
                   accept=".pdf,.png,.jpg,.jpeg" style="width:auto;" @change="onFileChange" @click.stop />
          </label>
        </div>

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
          <textarea v-else v-model="form[f.key]" rows="2"></textarea>
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
import { ref, computed, inject } from 'vue'
import api from '@/services/api'

const showNotif = inject('showNotif')

const query = ref('')
const results = ref([])
const searched = ref(false)
const ticket = ref(null)
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
  selectedAttachment.value && (selectedAttachment.value !== '__upload__' || uploadedFile.value))
const hasValues = computed(() => Object.values(form.value).some(v => v && String(v).trim()))

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
  evaluationId.value = null
  try {
    const { data } = await api.get(`/intervenants/${key}`)
    ticket.value = data
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

function onFileChange(ev) {
  const file = ev.target.files[0]
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

async function extract() {
  loading.value.extract = true
  errors.value.extract = ''
  try {
    const body = selectedAttachment.value === '__upload__'
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
.att-list { display: flex; flex-direction: column; gap: 6px; }
</style>
