<template>
  <div class="step-ident">
    <div class="wiz-step-header">
      <h2 class="wiz-step-title">Identification du prestataire</h2>
      <p class="wiz-step-desc">Sélectionnez le dossier Jira ou choisissez depuis une liste JQL.</p>
    </div>

    <!-- Mode cards -->
    <div class="wiz-section">
      <div class="wiz-section-label">Source</div>
      <div class="mode-cards">
        <button class="mode-card" :class="{ active: state.identMode === 'jira' }" @click="state.identMode = 'jira'">
          <div class="mode-icon">🎫</div>
          <div class="mode-label">Ticket Jira</div>
          <div class="mode-sub">Saisir une clé REF-xxx</div>
        </button>
        <button class="mode-card" :class="{ active: state.identMode === 'jql' }" @click="selectJqlMode">
          <div class="mode-icon">📋</div>
          <div class="mode-label">Liste JQL</div>
          <div class="mode-sub">Depuis le filtre configuré</div>
        </button>
      </div>
    </div>

    <!-- Chemin Ticket Jira -->
    <div class="wiz-section" v-if="state.identMode === 'jira'">
      <div class="wiz-section-label">Clé prestataire</div>
      <div class="input-row">
        <input class="wiz-input" v-model="state.form.jiraKeyPrestataire" placeholder="ex: REF-0142" @keydown.enter="loadJiraHierarchy" />
        <button class="wiz-btn-secondary" :disabled="!state.form.jiraKeyPrestataire || jiraLoading" @click="loadJiraHierarchy">
          <span v-if="jiraLoading" class="spinner-sm"></span>
          <span v-else>↓ Charger</span>
        </button>
        <a v-if="jiraBaseUrl && state.form.jiraKeyPrestataire"
          :href="jiraBaseUrl.replace(/\/$/, '') + '/browse/' + state.form.jiraKeyPrestataire"
          target="_blank" rel="noopener" class="wiz-btn-ghost">↗ Jira</a>
      </div>
      <div v-if="jiraError" class="wiz-error">{{ jiraError }}</div>

      <!-- Hiérarchie -->
      <div v-if="state.jiraHierarchy" class="hierarchy-box">
        <div class="hier-prest">
          <span class="hier-dot dot-prest"></span>
          <strong>{{ state.jiraHierarchy.key }}</strong> — {{ state.jiraHierarchy.summary }}
        </div>
        <template v-for="int in state.jiraHierarchy.intervenants" :key="int.key">
          <div class="hier-intervenant" :class="{ selected: state.form.jiraKeyIntervenant === int.key }" @click="selectIntervenant(int)">
            <span class="hier-dot dot-int"></span>
            <span>{{ int.key }}</span> — {{ int.summary }}
            <span v-if="int.attachments?.length" class="hier-badge">📎 {{ int.attachments.length }}</span>
            <span v-if="state.form.jiraKeyIntervenant === int.key" class="hier-sel">✓ Sélectionné</span>
          </div>
          <div v-for="comp in int.competences" :key="comp.key"
            class="hier-competence" :class="{ selected: state.form.jiraKeyCompetence === comp.key }"
            @click="selectCompetence(comp)">
            <span class="hier-dot dot-comp"></span>
            <span>{{ comp.key }}</span> — {{ comp.summary }}
            <span v-if="comp.attachments?.length" class="hier-badge">📎 {{ comp.attachments.length }}</span>
            <span v-if="state.form.jiraKeyCompetence === comp.key" class="hier-sel">✓</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Chemin JQL -->
    <div class="wiz-section" v-if="state.identMode === 'jql'">
      <div class="wiz-section-label">Sélectionner dans la liste</div>
      <div class="input-row">
        <select class="wiz-input wiz-select" v-model="jqlSelected" @change="onJqlSelect">
          <option value="">— Sélectionner un ticket —</option>
          <option v-for="t in jqlTickets" :key="t.key" :value="t.key">{{ t.key }} — {{ t.summary }}</option>
        </select>
        <button class="wiz-btn-secondary" :disabled="jqlLoading" @click="loadJqlList">
          <span v-if="jqlLoading" class="spinner-sm"></span>
          <span v-else>↻ Actualiser</span>
        </button>
      </div>
      <div v-if="jqlError" class="wiz-error">{{ jqlError }}</div>
    </div>

    <!-- Prestataire (toujours visible si mode choisi) -->
    <div class="wiz-section" v-if="state.identMode">
      <div class="wiz-section-label">Prestataire / Société</div>
      <input class="wiz-input" v-model="state.form.prestataire" placeholder="Nom de la société" />
    </div>

    <!-- Recap -->
    <div v-if="state.form.prestataire" class="recap-card">
      <div class="recap-label">Prestataire identifié</div>
      <div class="recap-main">{{ state.form.prestataire }}</div>
      <div v-if="state.form.jiraKeyPrestataire" class="recap-sub">{{ state.form.jiraKeyPrestataire }}</div>
      <div class="recap-badges">
        <span v-if="state.form.jiraKeyIntervenant" class="recap-badge">Intervenant : {{ state.form.jiraKeyIntervenant }}</span>
        <span v-if="state.form.jiraKeyCompetence" class="recap-badge">Compétence : {{ state.form.jiraKeyCompetence }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import api from '@/services/api'

const { state, jiraBaseUrl } = inject('wizard')

const jiraLoading = ref(false)
const jiraError = ref('')
const jqlLoading = ref(false)
const jqlTickets = ref([])
const jqlSelected = ref('')
const jqlError = ref('')

async function loadJiraHierarchy() {
  if (!state.form.jiraKeyPrestataire) return
  jiraLoading.value = true
  jiraError.value = ''
  try {
    const { data } = await api.get(`/dossiers/${state.form.jiraKeyPrestataire}/intervenants`)
    state.jiraHierarchy = data
    if (data.summary && !state.form.prestataire) {
      state.form.prestataire = data.summary.split(' — ')[0] || data.summary
    }
  } catch (e) {
    jiraError.value = 'Erreur chargement: ' + (e.response?.data?.error || e.message)
  } finally {
    jiraLoading.value = false
  }
}

async function selectIntervenant(int) {
  state.form.jiraKeyIntervenant = int.key
  try {
    const { data } = await api.get(`/dossiers/${int.key}/extract-intervenant`)
    const p = data.parsed || {}
    state.extractedIntervenant = {
      nom: p.nom || '', prenom: p.prenom || '', cin: p.cin || '',
      gsm: p.gsm || '', email: p.email || '',
      typeFormation: p.typeFormation || '', niveauFormation: p.niveauFormation || '',
      _raw: data.allCustomFields || {}
    }
    if (p.niveauFormation && !state.cvFields.diplome) state.cvFields.diplome = p.niveauFormation
    if (p.typeFormation && !state.cvFields.poste) state.cvFields.poste = p.typeFormation
  } catch { /* partial ok */ }
}

async function selectCompetence(comp) {
  state.form.jiraKeyCompetence = comp.key
  try {
    const { data } = await api.get(`/dossiers/${comp.key}/extract-competence`)
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
    if (p.action && !state.form.actionLabel) state.form.actionLabel = p.action
    if (p.secteurs && !state.form.secteur) state.form.secteur = state.extractedCompetence.secteurs
    if (p.autreSolution && !state.form.solution) state.form.solution = p.autreSolution
  } catch { /* partial ok */ }
}

async function loadJqlList() {
  jqlLoading.value = true
  jqlError.value = ''
  try {
    const { data } = await api.get('/dossiers/jql-filter')
    jqlTickets.value = data
  } catch (e) {
    jqlError.value = 'Erreur JQL: ' + (e.response?.data?.error || e.message)
  } finally {
    jqlLoading.value = false
  }
}

function selectJqlMode() {
  state.identMode = 'jql'
  if (!jqlTickets.value.length) loadJqlList()
}

function onJqlSelect() {
  if (!jqlSelected.value) return
  const ticket = jqlTickets.value.find(t => t.key === jqlSelected.value)
  if (ticket) {
    state.form.jiraKeyPrestataire = ticket.key
    if (!state.form.prestataire) state.form.prestataire = ticket.summary || ticket.key
    loadJiraHierarchy()
  }
}
</script>

<style scoped>
.step-ident { color: var(--wiz-text); }
.wiz-step-header { margin-bottom: 32px; }
.wiz-step-title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
.wiz-step-desc { color: var(--wiz-text2); font-size: 14px; }
.wiz-section { margin-bottom: 28px; }
.wiz-section-label {
  font-size: 11px; font-family: var(--mono); color: var(--wiz-text3);
  text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
}
.wiz-error { color: #f87171; font-size: 12px; font-family: var(--mono); margin-top: 8px; }

.mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 480px; }
.mode-card {
  padding: 22px; background: var(--wiz-card); border: 1px solid var(--wiz-border);
  border-radius: 10px; cursor: pointer; text-align: left; color: var(--wiz-text);
  transition: all 0.15s; display: flex; flex-direction: column; gap: 4px;
}
.mode-card:hover { border-color: rgba(255,255,255,0.2); }
.mode-card.active { border-color: var(--wiz-accent); background: rgba(59,130,246,0.12); }
.mode-icon { font-size: 24px; margin-bottom: 8px; }
.mode-label { font-size: 14px; font-weight: 600; }
.mode-sub { font-size: 12px; color: var(--wiz-text2); }

.input-row { display: flex; gap: 8px; align-items: center; }
.wiz-input {
  background: var(--wiz-card); border: 1px solid var(--wiz-border);
  border-radius: 6px; padding: 9px 12px; font-size: 13px; color: var(--wiz-text);
  font-family: var(--sans); outline: none; transition: border-color 0.15s; flex: 1;
}
.wiz-input:focus { border-color: var(--wiz-accent); }
.wiz-select { cursor: pointer; }
option { background: #1c2333; color: #e2e8f0; }
.wiz-btn-secondary {
  padding: 9px 16px; background: rgba(255,255,255,0.06); border: 1px solid var(--wiz-border);
  border-radius: 6px; font-size: 13px; color: var(--wiz-text2); cursor: pointer;
  transition: all 0.15s; white-space: nowrap; font-family: var(--sans);
}
.wiz-btn-secondary:hover { border-color: rgba(255,255,255,0.2); color: var(--wiz-text); }
.wiz-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
.wiz-btn-ghost {
  padding: 9px 14px; background: transparent; border: 1px solid var(--wiz-border);
  border-radius: 6px; font-size: 12px; color: var(--wiz-text3); cursor: pointer;
  text-decoration: none; white-space: nowrap; transition: all 0.15s;
}
.wiz-btn-ghost:hover { color: var(--wiz-text); border-color: rgba(255,255,255,0.2); }

.hierarchy-box {
  margin-top: 14px; padding: 16px; background: var(--wiz-card);
  border: 1px solid var(--wiz-border); border-radius: 8px;
}
.hier-prest { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
.hier-intervenant, .hier-competence {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; font-size: 12px; cursor: pointer;
  border-radius: 4px; transition: background 0.12s; flex-wrap: wrap;
}
.hier-intervenant { margin-left: 16px; }
.hier-competence { margin-left: 36px; color: var(--wiz-text2); }
.hier-intervenant:hover, .hier-competence:hover { background: rgba(255,255,255,0.04); }
.hier-intervenant.selected { background: rgba(59,130,246,0.1); }
.hier-competence.selected { background: rgba(139,92,246,0.1); }
.hier-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-prest { background: #3b82f6; }
.dot-int { background: #3b82f6; }
.dot-comp { background: #a78bfa; }
.hier-badge { margin-left: auto; font-size: 11px; color: var(--wiz-text3); font-family: var(--mono); }
.hier-sel { font-size: 11px; color: #22c55e; font-family: var(--mono); flex-shrink: 0; }

.recap-card {
  padding: 16px 20px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3);
  border-radius: 8px; margin-bottom: 24px;
}
.recap-label { font-size: 10px; font-family: var(--mono); color: var(--wiz-accent); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
.recap-main { font-size: 16px; font-weight: 600; color: var(--wiz-text); }
.recap-sub { font-size: 12px; color: var(--wiz-text2); font-family: var(--mono); margin-top: 2px; }
.recap-badges { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.recap-badge {
  font-size: 11px; font-family: var(--mono); padding: 3px 10px;
  background: rgba(255,255,255,0.06); border: 1px solid var(--wiz-border); border-radius: 20px; color: var(--wiz-text2);
}

.spinner-sm {
  display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
