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
                    <button class="btn btn-ghost btn-sm" style="color:var(--red);" @click="deleteProgram(p)">Supprimer</button>
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
            <div class="card-title" style="margin:0 0 4px;">Catalogue</div>
            <div style="font-size:12px; color:var(--text3);">Catégories solutions · Domaines actions · Critères d'évaluation</div>
          </div>
          <div class="row gap8">
            <select v-model="catProgramCode" @change="loadCatalogue" style="font-size:13px; padding:6px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg); color:var(--text);">
              <option value="">— Choisir un programme —</option>
              <option v-for="p in programs" :key="p.code" :value="p.code">{{ p.name }} ({{ p.code }})</option>
            </select>
            <button v-if="catProgramCode && catDirty" class="btn btn-primary" @click="saveCatalogue">Enregistrer</button>
          </div>
        </div>

        <div v-if="!catProgramCode" class="card" style="text-align:center; color:var(--text3); padding:40px;">
          Sélectionnez un programme pour éditer son catalogue.
        </div>

        <div v-if="catProgramCode && catLoading" style="padding:24px; text-align:center; color:var(--text3);">Chargement…</div>

        <div v-if="catProgramCode && !catLoading">

          <!-- Onglets solutions / actions -->
          <div style="display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:16px;">
            <div @click="catTab = 'solutions'" style="padding:8px 18px; font-size:13px; cursor:pointer; border-bottom:2px solid transparent; font-weight:500;"
              :style="catTab === 'solutions' ? 'border-color:var(--accent); color:var(--accent)' : 'color:var(--text3)'">
              Solutions informatiques ({{ Object.keys(categories).length }})
            </div>
            <div @click="catTab = 'actions'" style="padding:8px 18px; font-size:13px; cursor:pointer; border-bottom:2px solid transparent; font-weight:500;"
              :style="catTab === 'actions' ? 'border-color:var(--accent); color:var(--accent)' : 'color:var(--text3)'">
              Domaines d'actions ({{ catDomainKeys.length }})
            </div>
          </div>

          <!-- ===== SOLUTIONS ===== -->
          <div v-if="catTab === 'solutions'">
            <div class="row-between mb8">
              <div style="font-size:13px; color:var(--text2);">Catégories affichées à l'étape 1 de l'évaluation pour les solutions informatiques</div>
              <button class="btn btn-primary btn-sm" @click="addCategory">+ Catégorie</button>
            </div>

            <div v-if="!Object.keys(categories).length" class="card" style="text-align:center; color:var(--text3); padding:32px;">
              Aucune catégorie. Cliquez sur "+ Catégorie" pour commencer.
            </div>

            <div v-for="cKey in Object.keys(categories)" :key="cKey" class="card" style="margin-bottom:12px;">
              <div class="row-between" style="margin-bottom:12px;">
                <div class="row gap8" style="align-items:center; flex:1;">
                  <input v-model="categories[cKey].icon" style="width:48px; font-size:20px; text-align:center; padding:4px;" placeholder="💻" />
                  <input v-model="categories[cKey].label" style="flex:1; font-size:15px; font-weight:600;" placeholder="Libellé de la catégorie" @input="catDirty = true" />
                </div>
                <div class="row gap8">
                  <button class="btn btn-ghost btn-sm" @click="toggleCat(cKey)">{{ openCats[cKey] ? '▲ Réduire' : '▼ Développer' }}</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--red);" @click="removeCategory(cKey)">Supprimer</button>
                </div>
              </div>

              <div v-if="openCats[cKey]">
                <div class="field" style="margin-bottom:12px;">
                  <label>Exemples (affichés sous le nom)</label>
                  <input v-model="categories[cKey].ex" placeholder="ex: Odoo, SAP, Sage…" @input="catDirty = true" />
                </div>

                <div style="font-size:12px; font-weight:600; color:var(--text2); margin-bottom:8px;">Critères d'évaluation</div>
                <div v-if="categories[cKey].criteria?.length" style="margin-bottom:10px;">
                  <div v-for="(crit, idx) in categories[cKey].criteria" :key="idx" class="crit-row">
                    <div class="crit-header">
                      <div class="row gap8" style="flex:1; align-items:center;">
                        <span class="crit-num">{{ idx + 1 }}</span>
                        <input v-model="crit.n" placeholder="Intitulé du critère" style="flex:1; font-weight:500;" @input="catDirty = true" />
                      </div>
                      <div class="row gap8" style="align-items:center;">
                        <label style="font-size:11px; color:var(--text3); white-space:nowrap;">Poids</label>
                        <select v-model.number="crit.w" style="width:56px; font-size:13px;" @change="catDirty = true">
                          <option :value="1">1</option>
                          <option :value="2">2</option>
                          <option :value="3">3</option>
                        </select>
                        <button class="btn btn-ghost btn-sm" style="color:var(--red); padding:2px 8px;" @click="removeCatCriteria(cKey, idx)">✕</button>
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
                        <textarea v-model="crit.consistance" rows="3" placeholder="Ce qu'un prestataire doit démontrer pour ce critère…" @input="catDirty = true"></textarea>
                      </div>
                    </div>
                  </div>
                </div>
                <button class="btn btn-secondary btn-sm" @click="addCatCriteria(cKey)">+ Ajouter un critère</button>
              </div>
            </div>
          </div>

          <!-- ===== ACTIONS ===== -->
          <div v-if="catTab === 'actions'">
            <div class="row-between mb8">
              <div class="row gap8">
                <input ref="csvInput" type="file" accept=".csv,text/csv" style="display:none;" @change="importCSV" />
                <button class="btn btn-ghost btn-sm" @click="downloadCSVTemplate" title="Télécharger le modèle CSV">⬇ Modèle CSV</button>
                <button class="btn btn-ghost btn-sm" @click="$refs.csvInput.click()">⬆ Importer CSV</button>
                <button class="btn btn-primary btn-sm" @click="addDomain">+ Domaine</button>
              </div>
            </div>

            <div v-if="!catDomainKeys.length" class="card" style="text-align:center; color:var(--text3); padding:32px;">
              Aucun domaine. Cliquez sur "+ Domaine" pour commencer.
            </div>

            <div v-for="dKey in catDomainKeys" :key="dKey" class="card" style="margin-bottom:12px;">
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
                          placeholder="Décrivez ce qu'un prestataire doit démontrer pour obtenir une bonne note sur ce critère."
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
            <div class="field full">
              <label>JQL de synchronisation</label>
              <textarea v-model="cfg.jira_jql" rows="2" placeholder='issuetype = "Prestataire" AND project = REF ORDER BY created DESC' style="font-family:var(--mono); font-size:13px; resize:vertical;"></textarea>
              <div style="font-size:11px; color:var(--text3); margin-top:4px;">Requête JQL exécutée pour lister les dossiers. Si vide, tous les tickets du projet sont retournés.</div>
            </div>
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
const catTab = ref('solutions')
const catalogue = ref({})    // actionTypes: { domainKey: { label, icon, criteria: [...] } }
const categories = ref({})   // categories:  { catKey:    { label, icon, ex, criteria: [...] } }
const openDomains = ref({})
const openCats = ref({})

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

    // actionTypes → catalogue
    const rawActions = data.actionTypes || {}
    const normalizedActions = {}
    for (const [key, domain] of Object.entries(rawActions)) {
      normalizedActions[key] = {
        label: domain.label || '',
        icon: domain.icon || '',
        criteria: (domain.criteria || []).map(c => ({ n: c.n || '', d: c.d || '', w: c.w ?? 1, consistance: c.consistance || '' }))
      }
    }
    catalogue.value = normalizedActions
    const actionKeys = Object.keys(normalizedActions)
    if (actionKeys.length) openDomains.value = { [actionKeys[0]]: true }

    // categories → categories
    const rawCats = data.categories || {}
    const normalizedCats = {}
    for (const [key, cat] of Object.entries(rawCats)) {
      normalizedCats[key] = {
        label: cat.label || '',
        icon: cat.icon || '',
        ex: cat.ex || '',
        criteria: (cat.criteria || []).map(c => ({ n: c.n || '', d: c.d || '', w: c.w ?? 1, consistance: c.consistance || '' }))
      }
    }
    categories.value = normalizedCats
    const catKeys = Object.keys(normalizedCats)
    if (catKeys.length) openCats.value = { [catKeys[0]]: true }
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
    await api.put(`/programs/${catProgramCode.value}`, { actionTypes: catalogue.value, categories: categories.value })
    catDirty.value = false
    showNotif('Catalogue enregistré', 'ok')
  } catch (e) {
    showNotif(e.response?.data?.error || 'Erreur sauvegarde', 'error')
  }
}

// --- Catégories solutions ---
function addCategory() {
  const key = `cat_${Date.now()}`
  categories.value[key] = { label: 'Nouvelle catégorie', icon: '💻', ex: '', criteria: [] }
  openCats.value[key] = true
  catDirty.value = true
}

function removeCategory(key) {
  if (!confirm(`Supprimer la catégorie "${categories.value[key]?.label}" ?`)) return
  const updated = { ...categories.value }
  delete updated[key]
  categories.value = updated
  catDirty.value = true
}

function toggleCat(key) {
  openCats.value[key] = !openCats.value[key]
}

function addCatCriteria(catKey) {
  categories.value[catKey].criteria.push({ n: '', d: '', w: 1, consistance: '' })
  catDirty.value = true
}

function removeCatCriteria(catKey, idx) {
  categories.value[catKey].criteria.splice(idx, 1)
  catDirty.value = true
}

function downloadCSVTemplate() {
  const header = 'domaine_key,domaine_label,domaine_icon,critere_intitule,critere_description,critere_poids,critere_consistance'
  const examples = [
    'competences_techniques,Compétences techniques,💻,Maîtrise de la solution,Niveau de maîtrise technique de la solution proposée,2,Le consultant doit démontrer une maîtrise approfondie via des certifications ou des projets réalisés',
    'competences_techniques,Compétences techniques,💻,Expérience sectorielle,Connaissance du secteur d\'activité du client,1,Au moins 2 références dans le secteur concerné',
    'references,Références clients,📋,Références vérifiables,Attestations de référence signées et cachetées,2,Minimum 3 attestations avec nom client - solution - dates - signature'
  ]
  const csv = [header, ...examples].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `catalogue_modele_${catProgramCode.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function importCSV(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) { showNotif('CSV vide ou invalide', 'error'); return }
    // Ignorer la ligne d'en-tête
    const rows = lines.slice(1)
    const imported = {}
    let errors = 0
    for (const line of rows) {
      const [dKey, dLabel, dIcon, cName, cDesc, cPoids, cConsistance] = parseCSVLine(line)
      if (!dKey || !cName) { errors++; continue }
      if (!imported[dKey]) {
        imported[dKey] = { label: dLabel || dKey, icon: dIcon || '📌', criteria: [] }
      }
      imported[dKey].criteria.push({
        n: cName,
        d: cDesc || '',
        w: parseInt(cPoids) || 1,
        consistance: cConsistance || ''
      })
    }
    const domainCount = Object.keys(imported).length
    if (!domainCount) { showNotif('Aucune ligne valide dans le CSV', 'error'); return }
    // Fusionner avec le catalogue existant (les clés identiques sont remplacées)
    catalogue.value = { ...catalogue.value, ...imported }
    // Ouvrir les domaines importés
    for (const k of Object.keys(imported)) openDomains.value[k] = true
    catDirty.value = true
    const msg = errors > 0
      ? `${domainCount} domaine(s) importés (${errors} ligne(s) ignorées)`
      : `${domainCount} domaine(s) importés`
    showNotif(msg, 'ok')
  }
  reader.readAsText(file, 'utf-8')
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
  const jiraKeys = ['jira_url', 'jira_project', 'jira_auth', 'jira_pat', 'jira_cf_score_sol', 'jira_cf_score_int', 'jira_jql']
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

async function deleteProgram(p) {
  if (!confirm(`Supprimer définitivement le programme "${p.name}" (${p.code}) ?\n\nCette action est irréversible.`)) return
  try {
    await api.delete(`/programs/${p.code}`)
    programs.value = programs.value.filter(x => x.id !== p.id)
    showNotif('Programme supprimé', 'ok')
  } catch (e) {
    showNotif(e.response?.data?.error || 'Erreur suppression', 'error')
  }
}

// ---- Prompts IA ----
const prompts = ref({})
const promptsDirty = ref(false)

function wrapVar(v) { return '{{' + v + '}}' }

const promptDefs = [
  { key: 'prompt_briefing', label: 'Briefing pré-commission', vars: ['lang', 'ami', 'prestataire', 'solution', 'category', 'modules'] },
  { key: 'prompt_pv', label: 'Procès-verbal (PV)', vars: ['lang', 'programName', 'prestataire', 'solution', 'category', 'modules', 'solScorePct', 'solVerdict', 'intScorePct', 'intVerdict', 'finalScorePct', 'finalDecision', 'decisionMotive', 'conditions', 'commissionComments'] },
  { key: 'prompt_cv', label: 'Analyse CV — Solution informatique', vars: ['lang', 'ami', 'canvas', 'prestataire', 'solution', 'programName'] },
  { key: 'prompt_cv_action', label: 'Analyse CV — Action (formation, normalisation…)', vars: ['lang', 'ami', 'canvas', 'prestataire', 'actionLabel', 'programName'] },
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
