<template>
  <div>
    <div class="topbar">
      <div><div class="topbar-title">Administration</div><div class="topbar-sub">Gestion utilisateurs, programmes, catalogue, configuration</div></div>
    </div>
    <div class="content">
      <div class="tabs">
        <div class="tab" :class="{ active: tab === 'users' }" @click="tab = 'users'">Utilisateurs</div>
        <div class="tab" :class="{ active: tab === 'programs' }" @click="tab = 'programs'">Programmes</div>
        <div class="tab" :class="{ active: tab === 'catalogue' }" @click="tab = 'catalogue'; initCatalogue()">Catalogue compétences</div>
        <div class="tab" :class="{ active: tab === 'config' }" @click="tab = 'config'; loadConfig()">Configuration</div>
        <div class="tab" :class="{ active: tab === 'prompts' }" @click="tab = 'prompts'; loadPrompts()">Prompts IA</div>
        <div class="tab" :class="{ active: tab === 'audit' }" @click="tab = 'audit'; loadAudit()">Journal d'audit</div>
      </div>

      <!-- USERS -->
      <div v-if="tab === 'users'">
        <div class="row-between mb8">
          <div class="card-title" style="margin:0;">Utilisateurs ({{ users.length }})</div>
          <button class="btn btn-primary btn-sm" @click="openUserForm()">+ Ajouter</button>
        </div>
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="u in users" :key="u.id">
                  <td>{{ u.name }}</td>
                  <td class="text-mono">{{ u.email }}</td>
                  <td><span class="badge" :class="roleBadge(u.role)">{{ u.role }}</span></td>
                  <td><span class="badge" :class="u.active ? 'badge-green' : 'badge-red'">{{ u.active ? 'Actif' : 'Inactif' }}</span></td>
                  <td class="td-action">
                    <button class="btn btn-ghost btn-sm" @click="openUserForm(u)">Modifier</button>
                    <button class="btn btn-ghost btn-sm" @click="toggleActive(u)">{{ u.active ? 'Désactiver' : 'Activer' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- PROGRAMS -->
      <div v-if="tab === 'programs'">
        <div class="row-between mb8">
          <div class="card-title" style="margin:0;">Programmes ({{ programs.length }})</div>
          <button class="btn btn-primary btn-sm" @click="openProgramForm()">+ Ajouter</button>
        </div>
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Nom</th><th>Version</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="p in programs" :key="p.id">
                  <td class="text-mono">{{ p.code }}</td>
                  <td><strong>{{ p.name }}</strong></td>
                  <td>{{ p.version }}</td>
                  <td><span class="badge" :class="p.active ? 'badge-green' : 'badge-gray'">{{ p.active ? 'Actif' : 'Inactif' }}</span></td>
                  <td class="td-action">
                    <button class="btn btn-ghost btn-sm" @click="openProgramForm(p)">Modifier</button>
                    <button class="btn btn-ghost btn-sm" @click="toggleProgramActive(p)">{{ p.active ? 'Désactiver' : 'Activer' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- CATALOGUE COMPÉTENCES -->
      <div v-if="tab === 'catalogue'">
        <div class="row-between mb16">
          <div>
            <div class="card-title" style="margin:0 0 4px;">Catalogue des compétences</div>
            <div style="font-size:12px; color:var(--text3);">Domaines → Actions avec grille d'évaluation et consistance pour l'IA</div>
          </div>
          <div class="row gap8">
            <select v-model="catProgramCode" @change="loadCatalogue" style="font-size:13px; padding:6px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg); color:var(--text);">
              <option value="">— Choisir un programme —</option>
              <option v-for="p in programs" :key="p.code" :value="p.code">{{ p.name }} ({{ p.code }})</option>
            </select>
            <button v-if="catProgramCode" class="btn btn-primary btn-sm" @click="addDomain">+ Domaine</button>
            <button v-if="catProgramCode && catDirty" class="btn btn-primary" @click="saveCatalogue">Enregistrer</button>
          </div>
        </div>

        <div v-if="!catProgramCode" class="card" style="text-align:center; color:var(--text3); padding:40px;">
          Sélectionnez un programme pour éditer son catalogue de compétences.
        </div>

        <div v-if="catProgramCode && catLoading" style="padding:24px; text-align:center; color:var(--text3);">Chargement…</div>

        <div v-if="catProgramCode && !catLoading">
          <div v-if="!catDomainKeys.length" class="card" style="text-align:center; color:var(--text3); padding:32px;">
            Aucun domaine. Cliquez sur "+ Domaine" pour commencer.
          </div>

          <div v-for="dKey in catDomainKeys" :key="dKey" class="card" style="margin-bottom:12px;">
            <!-- En-tête domaine -->
            <div class="row-between" style="margin-bottom:12px;">
              <div class="row gap8" style="align-items:center; flex:1;">
                <input v-model="catalogue[dKey].icon" style="width:48px; font-size:20px; text-align:center; padding:4px;" placeholder="🎓" />
                <input v-model="catalogue[dKey].label" style="flex:1; font-size:15px; font-weight:600;" placeholder="Libellé du domaine" @input="catDirty = true" />
              </div>
              <div class="row gap8">
                <button class="btn btn-ghost btn-sm" @click="toggleDomain(dKey)">{{ openDomains[dKey] ? '▲ Réduire' : '▼ Développer' }}</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red);" @click="removeDomain(dKey)">Supprimer</button>
              </div>
            </div>

            <div v-if="openDomains[dKey]">
              <!-- Tableau des actions/critères -->
              <div v-if="catalogue[dKey].criteria?.length" style="margin-bottom:10px;">
                <div v-for="(crit, idx) in catalogue[dKey].criteria" :key="idx" class="crit-row">
                  <div class="crit-header">
                    <div class="row gap8" style="flex:1; align-items:center;">
                      <span class="crit-num">{{ idx + 1 }}</span>
                      <input v-model="crit.n" placeholder="Intitulé de l'action / critère" style="flex:1; font-weight:500;" @input="catDirty = true" />
                    </div>
                    <div class="row gap8" style="align-items:center;">
                      <label style="font-size:11px; color:var(--text3); white-space:nowrap;">Poids</label>
                      <select v-model.number="crit.w" style="width:56px; font-size:13px;" @change="catDirty = true">
                        <option :value="1">1</option>
                        <option :value="2">2</option>
                        <option :value="3">3</option>
                      </select>
                      <button class="btn btn-ghost btn-sm" style="color:var(--red); padding:2px 8px;" @click="removeCriteria(dKey, idx)">✕</button>
                    </div>
                  </div>
                  <div class="crit-body">
                    <div class="field" style="margin-bottom:8px;">
                      <label>Description courte</label>
                      <input v-model="crit.d" placeholder="Ce que ce critère évalue…" @input="catDirty = true" />
                    </div>
                    <div class="field">
                      <label style="display:flex; align-items:center; gap:6px;">
                        Consistance pour l'IA
                        <span style="font-size:10px; background:var(--accent); color:#fff; padding:1px 6px; border-radius:10px;">IA</span>
                      </label>
                      <textarea v-model="crit.consistance" rows="3"
                        placeholder="Décrivez ce qu'un prestataire doit démontrer pour obtenir une bonne note sur ce critère. Ce texte est injecté dans le prompt d'évaluation automatique. Ex: Le prestataire doit justifier d'au moins 3 références clients vérifiables au Maroc avec attestations signées et cachetées, mentionnant la solution, les modules déployés et les dates d'intervention."
                        @input="catDirty = true">
                      </textarea>
                    </div>
                  </div>
                </div>
              </div>

              <button class="btn btn-secondary btn-sm" @click="addCriteria(dKey)">+ Ajouter une action</button>
            </div>
          </div>
        </div>

        <!-- Barre de sauvegarde flottante -->
        <div v-if="catDirty && catProgramCode" class="save-bar">
          <span style="font-size:13px; color:var(--text2);">Modifications non enregistrées</span>
          <button class="btn btn-primary btn-sm" @click="saveCatalogue">Enregistrer le catalogue</button>
        </div>
      </div>

      <!-- CONFIG -->
      <div v-if="tab === 'config'">
        <div class="card">
          <div class="card-title">Connexion Jira Data Center</div>
          <div class="form-grid">
            <div class="field full"><label>URL Jira</label><input v-model="cfg.jira_url" placeholder="https://your-jira-instance/jira" /></div>
            <div class="field"><label>Clé projet</label><input v-model="cfg.jira_project" placeholder="REF" /></div>
            <div class="field"><label>Type auth</label>
              <select v-model="cfg.jira_auth"><option value="pat">Token PAT</option><option value="basic">Basic</option></select>
            </div>
            <div class="field"><label>Token PAT</label><input v-model="cfg.jira_pat" type="password" placeholder="Token Jira Data Center" /></div>
            <div class="field"><label>Champ score solution (customfield_...)</label><input v-model="cfg.jira_cf_score_sol" placeholder="customfield_10020" /></div>
            <div class="field"><label>Champ score intégrateur (customfield_...)</label><input v-model="cfg.jira_cf_score_int" placeholder="customfield_10021" /></div>
          </div>
          <div class="row gap8 mt16">
            <button class="btn btn-primary" @click="saveConfig('jira')">Enregistrer Jira</button>
            <button class="btn btn-secondary" @click="testJira">Tester connexion</button>
            <span v-if="jiraStatus" class="text-mono" :style="{ color: jiraStatus.ok ? 'var(--green)' : 'var(--red)' }">{{ jiraStatus.msg }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Intelligence Artificielle — OpenRouter</div>
          <div class="form-grid">
            <div class="field full"><label>Clé API OpenRouter</label><input v-model="cfg.ai_key" type="password" placeholder="sk-or-v1-..." /></div>
            <div class="field"><label>Modèle</label><input v-model="cfg.ai_model" placeholder="anthropic/claude-sonnet-4-6" /></div>
            <div class="field"><label>Température</label><input v-model="cfg.ai_temp" type="number" min="0" max="1" step="0.1" /></div>
            <div class="field"><label>Langue IA</label>
              <select v-model="cfg.ai_lang"><option value="fr">Français</option><option value="ar">Arabe</option></select>
            </div>
          </div>
          <div class="row gap8 mt16">
            <button class="btn btn-primary" @click="saveConfig('ai')">Enregistrer IA</button>
          </div>
        </div>
      </div>

      <!-- PROMPTS IA -->
      <div v-if="tab === 'prompts'">
        <div class="row-between mb8">
          <div>
            <div class="card-title" style="margin:0 0 4px;">Prompts IA</div>
            <div style="font-size:12px; color:var(--text3);">
              Personnalisez les instructions envoyées à l'IA. Utilisez <code v-pre style="background:var(--surface2); padding:1px 5px; border-radius:3px;">{{variable}}</code> pour les variables dynamiques.
            </div>
          </div>
          <button class="btn btn-primary" :disabled="!promptsDirty" @click="savePrompts">Enregistrer</button>
        </div>

        <div v-for="p in promptDefs" :key="p.key" class="card" style="margin-bottom:12px;">
          <div class="row-between" style="margin-bottom:6px;">
            <div>
              <div style="font-weight:600; font-size:14px;">{{ p.label }}</div>
              <div style="font-size:11px; font-family:var(--mono); color:var(--text3); margin-top:2px;">{{ p.key }}</div>
            </div>
            <div class="row gap8">
              <span style="font-size:11px; color:var(--text3);">Variables : </span>
              <span v-for="v in p.vars" :key="v" :data-var="v" style="font-size:11px; font-family:var(--mono); background:var(--surface2); padding:1px 6px; border-radius:3px; color:var(--accent);" v-text="wrapVar(v)"></span>
              <button class="btn btn-ghost btn-sm" @click="resetPrompt(p.key)">Réinitialiser</button>
            </div>
          </div>
          <textarea v-model="prompts[p.key]" rows="10" style="width:100%; font-family:var(--mono); font-size:12px; line-height:1.5; resize:vertical;" @input="promptsDirty = true"></textarea>
        </div>

        <div v-if="promptsDirty" class="save-bar">
          <span style="font-size:13px; color:var(--text2);">Modifications non enregistrées</span>
          <button class="btn btn-primary btn-sm" @click="savePrompts">Enregistrer les prompts</button>
        </div>
      </div>

      <!-- AUDIT -->
      <div v-if="tab === 'audit'">
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
              <tbody>
                <tr v-for="log in auditLogs" :key="log.id">
                  <td class="text-mono">{{ new Date(log.createdAt).toLocaleString('fr-MA') }}</td>
                  <td>{{ log.user?.name }}</td>
                  <td><span class="badge badge-blue">{{ log.action }}</span></td>
                  <td class="text-mono" style="font-size:11px;">{{ JSON.stringify(log.details || {}).slice(0, 80) }}</td>
                </tr>
                <tr v-if="!auditLogs.length"><td colspan="4" style="text-align:center; color:var(--text3); padding:24px;">Aucun log</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- PROGRAM FORM MODAL -->
      <div v-if="programForm" class="modal-overlay" @click.self="programForm = null">
        <div class="modal" style="max-width:560px; width:100%;">
          <div class="modal-title">{{ programForm.id ? 'Modifier' : 'Ajouter' }} un programme</div>
          <div class="form-grid">
            <div class="field"><label>Code</label><input v-model="programForm.code" placeholder="GO_SIYAHA_V04" :disabled="!!programForm.id" /></div>
            <div class="field"><label>Version</label><input v-model="programForm.version" placeholder="v1" /></div>
            <div class="field full"><label>Nom</label><input v-model="programForm.name" placeholder="Nom du programme" /></div>
            <div class="field full"><label>Texte AMI (descriptif)</label><textarea v-model="programForm.amiText" rows="4" placeholder="Description de l'appel à manifestation d'intérêt…" style="resize:vertical;"></textarea></div>
            <div class="field full"><label>Template CV prestataire</label><textarea v-model="programForm.cvTemplate" rows="3" placeholder="Modèle de CV attendu…" style="resize:vertical;"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="programForm = null">Annuler</button>
            <button class="btn btn-primary" @click="saveProgram">{{ programForm.id ? 'Modifier' : 'Créer' }}</button>
          </div>
        </div>
      </div>

      <!-- USER FORM MODAL -->
      <div v-if="userForm" class="modal-overlay" @click.self="userForm = null">
        <div class="modal">
          <div class="modal-title">{{ userForm.id ? 'Modifier' : 'Ajouter' }} un utilisateur</div>
          <div class="field" style="margin-bottom:12px;"><label>Nom</label><input v-model="userForm.name" /></div>
          <div class="field" style="margin-bottom:12px;"><label>Email</label><input v-model="userForm.email" type="email" :disabled="!!userForm.id" /></div>
          <div class="field" style="margin-bottom:12px;"><label>{{ userForm.id ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe' }}</label><input v-model="userForm.password" type="password" /></div>
          <div class="field" style="margin-bottom:20px;"><label>Rôle</label>
            <select v-model="userForm.role"><option value="PARTICIPANT">PARTICIPANT</option><option value="GESTIONNAIRE">GESTIONNAIRE</option><option value="ADMIN">ADMIN</option></select>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="userForm = null">Annuler</button>
            <button class="btn btn-primary" @click="saveUser">{{ userForm.id ? 'Modifier' : 'Créer' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import api from '@/services/api'

const showNotif = inject('showNotif')
const tab = ref('users')
const users = ref([])
const programs = ref([])
const auditLogs = ref([])
const cfg = ref({})
const userForm = ref(null)
const programForm = ref(null)
const jiraStatus = ref(null)

// Catalogue
const catProgramCode = ref('')
const catLoading = ref(false)
const catDirty = ref(false)
const catalogue = ref({})   // { domainKey: { label, icon, criteria: [{n,d,w,consistance}] } }
const openDomains = ref({})

const catDomainKeys = computed(() => Object.keys(catalogue.value))

onMounted(async () => {
  const [uRes, pRes] = await Promise.all([api.get('/admin/users'), api.get('/programs')])
  users.value = uRes.data
  programs.value = pRes.data
})

function initCatalogue() {
  if (!catProgramCode.value && programs.value.length) {
    catProgramCode.value = programs.value[0].code
    loadCatalogue()
  }
}

async function loadCatalogue() {
  if (!catProgramCode.value) return
  catLoading.value = true
  catDirty.value = false
  try {
    const { data } = await api.get(`/programs/${catProgramCode.value}`)
    const raw = data.actionTypes || {}
    // Garantir que chaque critère a un champ consistance
    const normalized = {}
    for (const [key, domain] of Object.entries(raw)) {
      normalized[key] = {
        label: domain.label || '',
        icon: domain.icon || '',
        criteria: (domain.criteria || []).map(c => ({
          n: c.n || '',
          d: c.d || '',
          w: c.w ?? 1,
          consistance: c.consistance || ''
        }))
      }
    }
    catalogue.value = normalized
    // Ouvrir le premier domaine par défaut
    const keys = Object.keys(normalized)
    if (keys.length) openDomains.value = { [keys[0]]: true }
  } finally {
    catLoading.value = false
  }
}

function toggleDomain(key) {
  openDomains.value[key] = !openDomains.value[key]
}

function addDomain() {
  const key = `domaine_${Date.now()}`
  catalogue.value[key] = { label: 'Nouveau domaine', icon: '📌', criteria: [] }
  openDomains.value[key] = true
  catDirty.value = true
}

function removeDomain(key) {
  if (!confirm(`Supprimer le domaine "${catalogue.value[key]?.label}" et toutes ses actions ?`)) return
  const updated = { ...catalogue.value }
  delete updated[key]
  catalogue.value = updated
  catDirty.value = true
}

function addCriteria(domainKey) {
  catalogue.value[domainKey].criteria.push({ n: '', d: '', w: 1, consistance: '' })
  catDirty.value = true
}

function removeCriteria(domainKey, idx) {
  catalogue.value[domainKey].criteria.splice(idx, 1)
  catDirty.value = true
}

async function saveCatalogue() {
  try {
    await api.put(`/programs/${catProgramCode.value}`, { actionTypes: catalogue.value })
    catDirty.value = false
    showNotif('Catalogue enregistré', 'ok')
  } catch (e) {
    showNotif(e.response?.data?.error || 'Erreur sauvegarde', 'error')
  }
}

async function loadConfig() {
  const { data } = await api.get('/admin/config')
  cfg.value = Object.fromEntries(data.map(c => [c.key, c.value === '***' ? '' : c.value]))
}

async function loadAudit() {
  const { data } = await api.get('/admin/audit-log')
  auditLogs.value = data
}

async function saveConfig(scope) {
  const jiraKeys = ['jira_url', 'jira_project', 'jira_auth', 'jira_pat', 'jira_cf_score_sol', 'jira_cf_score_int']
  const aiKeys = ['ai_key', 'ai_model', 'ai_temp', 'ai_lang']
  const keys = scope === 'jira' ? jiraKeys : aiKeys
  const updates = Object.fromEntries(keys.filter(k => cfg.value[k] !== '').map(k => [k, cfg.value[k]]))
  await api.put('/admin/config', updates)
  showNotif('Configuration enregistrée', 'ok')
}

async function testJira() {
  try {
    const { data } = await api.get('/dossiers/test-connection')
    jiraStatus.value = { ok: true, msg: `✓ ${data.serverTitle} v${data.version}` }
  } catch (e) {
    jiraStatus.value = { ok: false, msg: '✗ ' + (e.response?.data?.error || e.message) }
  }
}

function openUserForm(u = null) {
  userForm.value = u ? { ...u, password: '' } : { name: '', email: '', password: '', role: 'PARTICIPANT' }
}

async function saveUser() {
  const { id, ...data } = userForm.value
  if (!data.password && id) delete data.password
  if (id) {
    await api.put(`/admin/users/${id}`, data)
    const idx = users.value.findIndex(u => u.id === id)
    if (idx >= 0) users.value[idx] = { ...users.value[idx], ...data }
  } else {
    const { data: created } = await api.post('/admin/users', data)
    users.value.push(created)
  }
  userForm.value = null
  showNotif('Utilisateur enregistré', 'ok')
}

async function toggleActive(u) {
  await api.put(`/admin/users/${u.id}`, { active: !u.active })
  u.active = !u.active
}

function roleBadge(r) {
  return { ADMIN: 'badge-red', GESTIONNAIRE: 'badge-green', PARTICIPANT: 'badge-amber' }[r] || 'badge-gray'
}

function openProgramForm(p = null) {
  programForm.value = p
    ? { id: p.id, code: p.code, name: p.name, version: p.version, amiText: p.amiText || '', cvTemplate: p.cvTemplate || '' }
    : { code: '', name: '', version: 'v1', amiText: '', cvTemplate: '' }
}

async function saveProgram() {
  const { id, code, ...fields } = programForm.value
  try {
    if (id) {
      const { data } = await api.put(`/programs/${code}`, fields)
      const idx = programs.value.findIndex(p => p.id === id)
      if (idx >= 0) programs.value[idx] = { ...programs.value[idx], ...data }
    } else {
      const { data } = await api.post('/programs', { code, ...fields })
      programs.value.push(data)
    }
    programForm.value = null
    showNotif('Programme enregistré', 'ok')
  } catch (e) {
    showNotif(e.response?.data?.error || 'Erreur', 'error')
  }
}

async function toggleProgramActive(p) {
  await api.put(`/programs/${p.code}`, { active: !p.active })
  p.active = !p.active
}

// ---- Prompts IA ----
const prompts = ref({})
const promptsDirty = ref(false)

function wrapVar(v) { return '{{' + v + '}}' }

const promptDefs = [
  { key: 'prompt_briefing', label: 'Briefing pré-commission', vars: ['lang', 'ami', 'prestataire', 'solution', 'category', 'modules'] },
  { key: 'prompt_pv', label: 'Procès-verbal (PV)', vars: ['lang', 'programName', 'prestataire', 'solution', 'category', 'modules', 'solScorePct', 'solVerdict', 'intScorePct', 'intVerdict', 'finalScorePct', 'finalDecision', 'decisionMotive', 'conditions', 'commissionComments'] },
  { key: 'prompt_cv', label: 'Analyse CV / Diplômes', vars: ['lang', 'ami', 'canvas', 'prestataire', 'solution', 'programName'] },
  { key: 'prompt_attestations', label: 'Analyse attestations de référence', vars: ['lang', 'intervenant', 'solution'] },
  { key: 'prompt_coherence', label: 'Contrôle cohérence de la notation', vars: ['lang', 'category', 'noteDetails'] },
  { key: 'prompt_suggest_scores', label: 'Suggestion de scores automatique', vars: ['lang', 'category', 'dossierContext', 'criteriaList'] }
]

async function loadPrompts() {
  const { data } = await api.get('/ai/prompts')
  prompts.value = { ...data }
  promptsDirty.value = false
}

async function savePrompts() {
  await api.put('/admin/prompts', prompts.value)
  promptsDirty.value = false
  showNotif('Prompts enregistrés', 'ok')
}

async function resetPrompt(key) {
  if (!confirm('Réinitialiser ce prompt au texte par défaut ?')) return
  await api.delete(`/admin/prompts/${key}`)
  await loadPrompts()
  showNotif('Prompt réinitialisé', 'ok')
}
</script>

<style scoped>
.mb16 { margin-bottom: 16px; }

.crit-row {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  overflow: hidden;
}

.crit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.crit-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--text3);
  min-width: 18px;
  text-align: center;
}

.crit-body {
  padding: 10px 12px;
  background: var(--surface);
}

.save-bar {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius2);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  z-index: 50;
}
</style>
