<template>
  <div class="step-dossier">
    <div class="wiz-step-header">
      <h2 class="wiz-step-title">Dossier</h2>
      <p class="wiz-step-desc">{{ subTabs.find(t => t.id === subStep)?.desc }}</p>
    </div>

    <!-- ── Sous-onglets ── -->
    <div class="sub-nav">
      <button class="sub-arrow" :disabled="subStepIndex === 0" @click="prevSub" title="Précédent">‹</button>
      <div class="sub-tabs">
        <button
          v-for="tab in subTabs" :key="tab.id"
          class="sub-tab"
          :class="{ active: subStep === tab.id, done: isDone(tab.id) }"
          @click="subStep = tab.id"
        >
          <span class="sub-tab-num">{{ isDone(tab.id) ? '✓' : tab.num }}</span>
          <span class="sub-tab-label">{{ tab.label }}</span>
        </button>
      </div>
      <button class="sub-arrow" :disabled="subStepIndex === subTabs.length - 1" @click="nextSub" title="Suivant">›</button>
    </div>

    <!-- ══════════════════════════════════════════ -->
    <!-- SUB-STEP: INFOS                           -->
    <!-- ══════════════════════════════════════════ -->
    <template v-if="subStep === 'infos'">
      <template v-if="state.refType === 'SOLUTION'">
        <div class="wiz-section">
          <div class="wiz-section-label">Informations dossier</div>
          <div class="form-grid">
            <div class="wiz-field">
              <label>Solution présentée</label>
              <div v-if="state.extractedCompetence?.solutionsInformatiques?.length" class="sol-chips">
                <div v-for="sol in state.extractedCompetence.solutionsInformatiques" :key="sol"
                  class="sol-chip" :class="{ active: state.form.solution === sol }"
                  @click="state.form.solution = sol">{{ sol }}</div>
              </div>
              <input class="wiz-input" v-model="state.form.solution" placeholder="ex: Odoo 17, SAP Business One…" />
            </div>
            <div class="wiz-field">
              <label>Date de démo</label>
              <input class="wiz-input" type="date" v-model="state.form.dateDemo" />
            </div>
            <div class="wiz-field">
              <label>Rapporteur <span class="req">*</span></label>
              <input class="wiz-input" v-model="state.form.rapporteur" placeholder="Nom du rapporteur" />
            </div>
            <div class="wiz-field">
              <label>Origine</label>
              <select class="wiz-input" v-model="state.form.origine">
                <option value="">—</option>
                <option>Marocaine</option><option>Étrangère</option>
              </select>
            </div>
            <div class="wiz-field">
              <label>Nature du prestataire</label>
              <select class="wiz-input" v-model="state.form.nature">
                <option value="">—</option>
                <option>Éditeur</option><option>Intégrateur</option>
                <option>Éditeur-Intégrateur</option><option>Consultant</option><option>Formateur</option>
              </select>
            </div>
            <div class="wiz-field">
              <label>Mode d'acquisition</label>
              <select class="wiz-input" v-model="state.form.modeAcquisition">
                <option value="">—</option>
                <option>Propriétaire</option><option>Open Source</option><option>SaaS</option>
              </select>
            </div>
            <div class="wiz-field">
              <label>Secteur cible</label>
              <input class="wiz-input" v-model="state.form.secteur" placeholder="Secteur d'activité" />
            </div>
          </div>
          <div class="modules-section">
            <div class="modules-label">Modules objet du référencement</div>
            <div v-if="state.extractedCompetence?.modulesInformatiques?.length" class="sol-chips">
              <div v-for="mod in state.extractedCompetence.modulesInformatiques" :key="mod"
                class="sol-chip" :class="{ active: state.form.modules?.includes(mod) }"
                @click="toggleModule(mod)">{{ mod }}</div>
            </div>
            <div class="input-row">
              <input class="wiz-input" v-model="moduleInput" placeholder="Ajouter un module (Entrée)" @keydown.enter.prevent="addModule" />
              <button class="wiz-btn-secondary" @click="addModule">+ Ajouter</button>
            </div>
            <div class="module-tags">
              <span v-if="!state.form.modules?.length" class="wiz-empty-sm">Aucun module ajouté</span>
              <span v-for="(m, i) in state.form.modules" :key="i" class="module-tag">
                {{ m }} <button @click="removeModule(i)">×</button>
              </span>
            </div>
          </div>
        </div>

        <!-- Spécifications fonctionnelles -->
        <div class="wiz-section">
          <div class="wiz-section-label">Spécifications fonctionnelles <span class="opt-badge">optionnel</span></div>
          <div class="source-tabs">
            <button v-for="s in DOC_SOURCES" :key="s.id" class="src-tab" :class="{ active: specsSource === s.id }" @click="specsSource = s.id">
              {{ s.icon }} {{ s.label }}
            </button>
          </div>
          <template v-if="specsSource !== 'upload'">
            <div v-if="!getJiraAttachments(specsSource).length" class="info-hint mt12">{{ sourceHint(specsSource) }}</div>
            <div v-else class="att-list mt12">
              <label v-for="att in getJiraAttachments(specsSource)" :key="att.id" class="att-item">
                <input type="checkbox" :value="att.id" v-model="specsAttIds" class="att-check" />
                <span class="att-icon">{{ attIcon(att.filename) }}</span>
                <span class="att-name">{{ att.filename }}</span>
                <span class="att-size" v-if="att.size">{{ formatSize(att.size) }}</span>
              </label>
            </div>
          </template>
          <template v-else>
            <div class="upload-zone mt12" @drop.prevent="e => pushFiles(specsFiles, e.dataTransfer.files)" @dragover.prevent>
              <label class="upload-area">
                <input ref="specsInput" type="file" multiple accept=".pdf,.xlsx,.xls,.csv" style="display:none"
                  @change="e => { pushFiles(specsFiles, e.target.files); e.target.value = '' }" />
                <div class="upload-icon">📂</div>
                <div class="upload-text">Cahier des charges, spécifications… <span class="upload-link" @click.prevent="$refs.specsInput.click()">parcourir</span></div>
                <div class="upload-sub">PDF, Excel, CSV</div>
              </label>
            </div>
            <div v-if="specsFiles.length" class="files-list mt8">
              <div v-for="(f, i) in specsFiles" :key="i" class="file-item">
                <span class="file-name">{{ f.name }}</span>
                <button type="button" class="file-remove" @click="specsFiles.splice(i, 1)">✕</button>
              </div>
            </div>
          </template>
        </div>

        <div class="wiz-ai-panel">
          <div class="wiz-ai-header">
            <span class="wiz-ai-badge">IA</span>
            <span class="wiz-ai-title">Briefing pré-commission</span>
            <span v-if="state.aiTexts.briefing" class="wiz-ai-done">✓ Généré</span>
          </div>
          <div v-if="state.aiTexts.briefing" class="wiz-ai-content">{{ state.aiTexts.briefing }}</div>
          <div class="wiz-ai-actions">
            <button class="wiz-btn-ai" :disabled="aiLoading.briefing || !state.form.prestataire" @click="generateBriefing">
              <span v-if="aiLoading.briefing" class="spinner-sm"></span>
              <span v-else>◈ Générer le briefing</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="wiz-section">
          <div class="wiz-section-label">Action à évaluer</div>
          <select class="wiz-input" v-model="state.form.actionLabel" style="max-width:420px;">
            <option value="">— Sélectionner une action —</option>
            <option v-for="(c, i) in currentCriteria?.criteria" :key="i" :value="c.n">{{ c.n }}</option>
          </select>
          <div v-if="selectedAction?.d" class="action-meta mt12">{{ selectedAction.d }}</div>
          <div v-if="selectedAction?.consistance" class="action-consistance mt8">Consistance : {{ selectedAction.consistance }}</div>
        </div>
        <div class="wiz-section">
          <div class="wiz-section-label">Informations</div>
          <div class="form-grid">
            <div class="wiz-field">
              <label>Date</label>
              <input class="wiz-input" type="date" v-model="state.form.dateDemo" />
            </div>
            <div class="wiz-field">
              <label>Rapporteur <span class="req">*</span></label>
              <input class="wiz-input" v-model="state.form.rapporteur" placeholder="Nom du rapporteur" />
            </div>
            <div class="wiz-field">
              <label>Secteur cible</label>
              <input class="wiz-input" v-model="state.form.secteur" />
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!-- SUB-STEP: PROFIL intégrateur / consultant -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else-if="subStep === 'profil'">
      <div class="wiz-section">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div class="wiz-section-label" style="margin-bottom:0;">
            {{ state.refType === 'SOLUTION' ? "Profil de l'intégrateur" : 'Profil du consultant' }}
          </div>
          <button class="wiz-btn-secondary" :disabled="!state.extractedIntervenant"
            :title="!state.extractedIntervenant ? 'Sélectionnez un intervenant à l\'étape Identification' : ''"
            @click="fillProfilFromJira">↻ Pré-remplir depuis Jira</button>
        </div>
        <div class="form-grid">
          <div class="wiz-field">
            <label>Formation / Diplôme</label>
            <input class="wiz-input" v-model="state.cvFields.diplome" placeholder="ex. Ingénieur informatique, Bac+5…" />
          </div>
          <div class="wiz-field">
            <label>Établissement</label>
            <input class="wiz-input" v-model="state.cvFields.etablissement" />
          </div>
          <div class="wiz-field">
            <label>Expérience totale (années)</label>
            <input class="wiz-input" type="number" min="0" v-model.number="state.cvFields.exp" />
          </div>
          <div class="wiz-field">
            <label>Expérience sur cette solution (années)</label>
            <input class="wiz-input" type="number" min="0" v-model.number="state.cvFields.expSol" />
          </div>
          <div class="wiz-field">
            <label>Poste principal</label>
            <input class="wiz-input" v-model="state.cvFields.poste" />
          </div>
          <div class="wiz-field">
            <label>Taille de l'équipe</label>
            <input class="wiz-input" type="number" min="1" v-model.number="state.cvFields.equipe" />
          </div>
          <div class="wiz-field">
            <label>Certifications</label>
            <input class="wiz-input" v-model="state.cvFields.certif" placeholder="PMP, ITIL, Oracle…" />
          </div>
          <div class="wiz-field full">
            <label>Références clients vérifiables au Maroc</label>
            <textarea class="wiz-input" v-model="state.cvFields.refs" rows="3" placeholder="Nom client, projet, année…"></textarea>
          </div>
        </div>
      </div>

      <div v-if="state.aiTexts.cv" class="wiz-ai-panel">
        <div class="wiz-ai-header">
          <span class="wiz-ai-badge">IA</span>
          <span class="wiz-ai-title">Synthèse CV (issue de l'analyse)</span>
        </div>
        <div class="wiz-ai-content">{{ state.aiTexts.cv }}</div>
        <div class="wiz-ai-actions">
          <button class="wiz-btn-ai" @click="autoFillFromCV" :disabled="aiLoading.autoFill">
            <span v-if="aiLoading.autoFill" class="spinner-sm"></span>
            <span v-else>↙ Pré-remplir depuis l'analyse IA</span>
          </button>
        </div>
      </div>
      <div v-else class="info-hint">Analysez le CV dans l'onglet "CV & Diplômes" pour obtenir une synthèse automatique.</div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!-- SUB-STEP: CV & Diplômes                   -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else-if="subStep === 'cv'">
      <div class="wiz-section">
        <div class="wiz-section-label">Documents CV & Diplômes</div>
        <div class="source-tabs">
          <button v-for="s in DOC_SOURCES" :key="s.id" class="src-tab" :class="{ active: cvSource === s.id }" @click="cvSource = s.id">
            {{ s.icon }} {{ s.label }}
          </button>
        </div>
        <template v-if="cvSource !== 'upload'">
          <div v-if="!getJiraAttachments(cvSource).length" class="info-hint mt12">{{ sourceHint(cvSource) }}</div>
          <div v-else class="att-list mt12">
            <label v-for="att in getJiraAttachments(cvSource)" :key="att.id" class="att-item">
              <input type="checkbox" :value="att.id" v-model="cvAttIds" class="att-check" />
              <span class="att-icon">{{ attIcon(att.filename) }}</span>
              <span class="att-name">{{ att.filename }}</span>
              <span class="att-size" v-if="att.size">{{ formatSize(att.size) }}</span>
            </label>
          </div>
        </template>
        <template v-else>
          <div class="upload-zone mt12" @drop.prevent="e => pushFiles(cvFiles, e.dataTransfer.files)" @dragover.prevent>
            <label class="upload-area">
              <input ref="cvInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" style="display:none"
                @change="e => { pushFiles(cvFiles, e.target.files); e.target.value = '' }" />
              <div class="upload-icon">📄</div>
              <div class="upload-text">CV, diplômes, certificats… <span class="upload-link" @click.prevent="$refs.cvInput.click()">parcourir</span></div>
              <div class="upload-sub">PDF, Images, Word</div>
            </label>
          </div>
          <div v-if="cvFiles.length" class="files-list mt8">
            <div v-for="(f, i) in cvFiles" :key="i" class="file-item">
              <span class="file-name">{{ f.name }}</span>
              <button type="button" class="file-remove" @click="cvFiles.splice(i, 1)">✕</button>
            </div>
          </div>
        </template>
      </div>

      <div class="wiz-ai-panel">
        <div class="wiz-ai-header">
          <span class="wiz-ai-badge">IA</span>
          <span class="wiz-ai-title">Analyse CV & Diplômes</span>
          <span v-if="state.aiTexts.cv" class="wiz-ai-done">✓ Analysé</span>
        </div>
        <div v-if="state.aiTexts.cv" class="wiz-ai-content">{{ state.aiTexts.cv }}</div>
        <div class="wiz-ai-actions">
          <button class="wiz-btn-ai" :disabled="aiLoading.cv || (!cvAttIds.length && !cvFiles.length)" @click="analyzeCV">
            <span v-if="aiLoading.cv" class="spinner-sm"></span>
            <span v-else>◈ Analyser le CV</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!-- SUB-STEP: Attestations de référence       -->
    <!-- ══════════════════════════════════════════ -->
    <template v-else-if="subStep === 'attestations'">
      <div class="wiz-section">
        <div class="wiz-section-label">Attestations de référence</div>
        <div class="source-tabs">
          <button v-for="s in DOC_SOURCES" :key="s.id" class="src-tab" :class="{ active: attSource === s.id }" @click="attSource = s.id">
            {{ s.icon }} {{ s.label }}
          </button>
        </div>
        <template v-if="attSource !== 'upload'">
          <div v-if="!getJiraAttachments(attSource).length" class="info-hint mt12">{{ sourceHint(attSource) }}</div>
          <div v-else class="att-list mt12">
            <label v-for="att in getJiraAttachments(attSource)" :key="att.id" class="att-item">
              <input type="checkbox" :value="att.id" v-model="attIds" class="att-check" />
              <span class="att-icon">{{ attIcon(att.filename) }}</span>
              <span class="att-name">{{ att.filename }}</span>
              <span class="att-size" v-if="att.size">{{ formatSize(att.size) }}</span>
            </label>
          </div>
        </template>
        <template v-else>
          <div class="upload-zone mt12" @drop.prevent="e => pushFiles(attFiles, e.dataTransfer.files)" @dragover.prevent>
            <label class="upload-area">
              <input ref="attInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style="display:none"
                @change="e => { pushFiles(attFiles, e.target.files); e.target.value = '' }" />
              <div class="upload-icon">📎</div>
              <div class="upload-text">Attestations, contrats, lettres… <span class="upload-link" @click.prevent="$refs.attInput.click()">parcourir</span></div>
              <div class="upload-sub">PDF, Images</div>
            </label>
          </div>
          <div v-if="attFiles.length" class="files-list mt8">
            <div v-for="(f, i) in attFiles" :key="i" class="file-item">
              <span class="file-name">{{ f.name }}</span>
              <button type="button" class="file-remove" @click="attFiles.splice(i, 1)">✕</button>
            </div>
          </div>
        </template>
      </div>

      <div class="wiz-ai-panel">
        <div class="wiz-ai-header">
          <span class="wiz-ai-badge">IA</span>
          <span class="wiz-ai-title">Analyse des attestations de référence</span>
          <span v-if="state.aiTexts.attestations" class="wiz-ai-done">✓ Analysé</span>
        </div>
        <div v-if="state.aiTexts.attestations" class="wiz-ai-content">{{ state.aiTexts.attestations }}</div>
        <div class="wiz-ai-actions">
          <button class="wiz-btn-ai"
            :disabled="aiLoading.att || (attSource === 'upload' ? !attFiles.length : !attIds.length)"
            @click="analyzeAttestations">
            <span v-if="aiLoading.att" class="spinner-sm"></span>
            <span v-else>◈ Analyser les attestations</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════ -->
    <!-- SUB-STEP: Certification éditeur (SOLUTION)-->
    <!-- ══════════════════════════════════════════ -->
    <template v-else-if="subStep === 'certif'">
      <div class="wiz-section">
        <div class="wiz-section-label">Certificat éditeur</div>
        <div class="source-tabs">
          <button v-for="s in DOC_SOURCES" :key="s.id" class="src-tab" :class="{ active: certifSource === s.id }" @click="certifSource = s.id">
            {{ s.icon }} {{ s.label }}
          </button>
        </div>
        <template v-if="certifSource !== 'upload'">
          <div v-if="!getJiraAttachments(certifSource).length" class="info-hint mt12">{{ sourceHint(certifSource) }}</div>
          <div v-else class="att-list mt12">
            <label v-for="att in getJiraAttachments(certifSource)" :key="att.id" class="att-item">
              <input type="checkbox" :value="att.id" v-model="certifAttIds" class="att-check" />
              <span class="att-icon">{{ attIcon(att.filename) }}</span>
              <span class="att-name">{{ att.filename }}</span>
              <span class="att-size" v-if="att.size">{{ formatSize(att.size) }}</span>
            </label>
          </div>
        </template>
        <template v-else>
          <div class="upload-zone mt12" @drop.prevent="e => pushFiles(certifFiles, e.dataTransfer.files)" @dragover.prevent>
            <label class="upload-area">
              <input ref="certifInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style="display:none"
                @change="e => { pushFiles(certifFiles, e.target.files); e.target.value = '' }" />
              <div class="upload-icon">🏅</div>
              <div class="upload-text">Certificat éditeur, partenariat… <span class="upload-link" @click.prevent="$refs.certifInput.click()">parcourir</span></div>
              <div class="upload-sub">PDF, Images</div>
            </label>
          </div>
          <div v-if="certifFiles.length" class="files-list mt8">
            <div v-for="(f, i) in certifFiles" :key="i" class="file-item">
              <span class="file-name">{{ f.name }}</span>
              <button type="button" class="file-remove" @click="certifFiles.splice(i, 1)">✕</button>
            </div>
          </div>
        </template>
      </div>

      <div class="wiz-ai-panel">
        <div class="wiz-ai-header">
          <span class="wiz-ai-badge">IA</span>
          <span class="wiz-ai-title">Analyse certification éditeur</span>
          <span v-if="state.aiTexts.certifEditeur" class="wiz-ai-done">✓ Analysé</span>
        </div>
        <div v-if="state.aiTexts.certifEditeur" class="wiz-ai-content">{{ state.aiTexts.certifEditeur }}</div>
        <div class="wiz-ai-actions">
          <button class="wiz-btn-ai"
            :disabled="aiLoading.certif || (certifSource === 'upload' ? !certifFiles.length : !certifAttIds.length)"
            @click="analyzeCertif">
            <span v-if="aiLoading.certif" class="spinner-sm"></span>
            <span v-else>◈ Analyser le certificat</span>
          </button>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import api from '@/services/api'

const { state, currentCriteria, selectedAction } = inject('wizard')

// ── Sources disponibles ────────────────────────────────────────────────────────
const DOC_SOURCES = [
  { id: 'prestataire', icon: '🏢', label: 'Prestataire' },
  { id: 'intervenant', icon: '👤', label: 'Intervenant' },
  { id: 'competence',  icon: '📋', label: 'Compétence' },
  { id: 'upload',      icon: '💻', label: 'Upload local' },
]

// ── Sub-step navigation ────────────────────────────────────────────────────────
const subStep = ref('infos')

const TABS_SOLUTION = [
  { id: 'infos',        num: 1, label: 'Informations',    desc: 'Dossier, modules et briefing pré-commission.' },
  { id: 'profil',       num: 2, label: 'Profil intégrateur', desc: "Compétences et expérience de l'intégrateur." },
  { id: 'cv',           num: 3, label: 'CV & Diplômes',   desc: "Documents CV de l'intervenant et analyse IA." },
  { id: 'attestations', num: 4, label: 'Attestations',    desc: 'Attestations de référence et analyse IA.' },
  { id: 'certif',       num: 5, label: 'Certif. éditeur', desc: 'Certification éditeur de la solution.' },
]
const TABS_ACTION = [
  { id: 'infos',        num: 1, label: 'Informations',    desc: "Action à évaluer et informations générales." },
  { id: 'profil',       num: 2, label: 'Profil consultant', desc: 'Compétences et expérience du consultant.' },
  { id: 'attestations', num: 3, label: 'Attestations',    desc: 'Documents de référence et analyse IA.' },
]

const subTabs = computed(() => state.refType === 'SOLUTION' ? TABS_SOLUTION : TABS_ACTION)
const subStepIndex = computed(() => subTabs.value.findIndex(t => t.id === subStep.value))

function prevSub() {
  const i = subStepIndex.value
  if (i > 0) subStep.value = subTabs.value[i - 1].id
}
function nextSub() {
  const i = subStepIndex.value
  if (i < subTabs.value.length - 1) subStep.value = subTabs.value[i + 1].id
}

function isDone(id) {
  if (id === 'infos')        return !!(state.form.rapporteur)
  if (id === 'profil')       return !!(state.cvFields.diplome || state.cvFields.exp > 0)
  if (id === 'cv')           return !!(state.aiTexts.cv)
  if (id === 'attestations') return !!(state.aiTexts.attestations)
  if (id === 'certif')       return !!(state.aiTexts.certifEditeur)
  return false
}

function fillProfilFromJira() {
  const p = state.extractedIntervenant
  if (!p) return
  if (p.niveauFormation) state.cvFields.diplome = p.niveauFormation
  if (p.etablissement) state.cvFields.etablissement = p.etablissement
  if (p.experienceTotale != null) state.cvFields.exp = Number(p.experienceTotale) || state.cvFields.exp
  if (p.experienceSolution != null) state.cvFields.expSol = Number(p.experienceSolution) || state.cvFields.expSol
  if (p.posteOccupe || p.typeFormation) state.cvFields.poste = p.posteOccupe || p.typeFormation
  if (p.tailleEquipe != null) state.cvFields.equipe = Number(p.tailleEquipe) || state.cvFields.equipe
  if (p.certifications) state.cvFields.certif = p.certifications
  if (p.references) state.cvFields.refs = p.references
}

// ── Jira hierarchy helpers ─────────────────────────────────────────────────────
const selectedIntervenant = computed(() =>
  state.jiraHierarchy?.intervenants?.find(i => i.key === state.form.jiraKeyIntervenant) || null
)
const selectedCompetence = computed(() => {
  for (const int of state.jiraHierarchy?.intervenants || []) {
    const c = int.competences?.find(c => c.key === state.form.jiraKeyCompetence)
    if (c) return c
  }
  return null
})

function getJiraAttachments(source) {
  if (source === 'prestataire') return state.jiraHierarchy?.attachments || []
  if (source === 'intervenant') return selectedIntervenant.value?.attachments || []
  if (source === 'competence')  return selectedCompetence.value?.attachments || []
  return []
}

function jiraKeyForSource(source) {
  if (source === 'prestataire') return state.form.jiraKeyPrestataire || state.jiraHierarchy?.key
  if (source === 'intervenant') return state.form.jiraKeyIntervenant
  if (source === 'competence')  return state.form.jiraKeyCompetence
  return null
}

function sourceHint(source) {
  if (source === 'prestataire') return "Chargez le ticket prestataire dans l'étape Identification."
  if (source === 'intervenant') return "Sélectionnez un intervenant dans l'étape Identification."
  return "Sélectionnez une compétence dans l'étape Identification."
}

// ── Local state ────────────────────────────────────────────────────────────────
const moduleInput = ref('')

const specsSource  = ref('upload');  const specsAttIds  = ref([]);  const specsFiles  = ref([])
const cvSource     = ref('intervenant'); const cvAttIds = ref([]);  const cvFiles     = ref([])
const attSource    = ref('competence');  const attIds   = ref([]);  const attFiles    = ref([])
const certifSource = ref('competence');  const certifAttIds = ref([]); const certifFiles = ref([])

const aiLoading = ref({ briefing: false, cv: false, att: false, certif: false, autoFill: false })

// ── pushFiles : fix bug upload — utilise push() sur l'array réactif plutôt que
//    reassignment (en template Vue 3, le ref est unwrappé donc list.value = ...
//    ne fonctionnerait pas). push() sur l'array réactif déclenche la réactivité.
function pushFiles(reactiveArr, fileList) {
  for (const f of Array.from(fileList || [])) reactiveArr.push(f)
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
function guessMimeType(file) {
  if (file.type) return file.type
  const ext = file.name.split('.').pop().toLowerCase()
  return { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'application/octet-stream'
}

async function jiraAttachmentsToFilesData(source, selectedIds) {
  const key = jiraKeyForSource(source)
  if (!key) return []
  const list = getJiraAttachments(source)
  const filesData = []
  for (const id of selectedIds) {
    const { data: buf } = await api.get(`/dossiers/${key}/attachment/${id}`, { responseType: 'arraybuffer' })
    const att = list.find(a => a.id === id)
    filesData.push({ base64: arrayBufferToBase64(buf), mimeType: att?.mimeType || 'application/pdf', filename: att?.filename || id })
  }
  return filesData
}

// ── Module management ─────────────────────────────────────────────────────────
function addModule() {
  const m = moduleInput.value.trim()
  if (!m) return
  if (!state.form.modules) state.form.modules = []
  state.form.modules = [...state.form.modules, m]
  moduleInput.value = ''
}
function removeModule(i) { state.form.modules = state.form.modules.filter((_, idx) => idx !== i) }
function toggleModule(mod) {
  if (!state.form.modules) state.form.modules = []
  const mods = [...state.form.modules]
  const idx = mods.indexOf(mod)
  if (idx >= 0) mods.splice(idx, 1); else mods.push(mod)
  state.form.modules = mods
}

// ── AI calls ──────────────────────────────────────────────────────────────────
async function generateBriefing() {
  aiLoading.value.briefing = true
  try {
    const { data } = await api.post('/ai/briefing', {
      prestataire: state.form.prestataire, solution: state.form.solution,
      category: state.selectedCategory, modules: state.form.modules, programCode: state.programCode,
    })
    state.aiTexts.briefing = data.text
  } catch (e) { state.aiTexts.briefing = 'Erreur: ' + (e.response?.data?.error || e.message) }
  finally { aiLoading.value.briefing = false }
}

async function analyzeCV() {
  aiLoading.value.cv = true
  try {
    let filesData = []
    if (cvSource.value !== 'upload') {
      filesData = await jiraAttachmentsToFilesData(cvSource.value, cvAttIds.value)
    } else {
      for (const f of cvFiles.value) filesData.push({ base64: await fileToBase64(f), mimeType: guessMimeType(f), filename: f.name })
    }
    const { data } = await api.post('/ai/analyze-cv', { filesData, cvFields: state.cvFields, solution: state.form.solution, programCode: state.programCode })
    state.aiTexts.cv = data.text
  } catch (e) { state.aiTexts.cv = 'Erreur: ' + (e.response?.data?.error || e.message) }
  finally { aiLoading.value.cv = false }
}

async function autoFillFromCV() {
  aiLoading.value.autoFill = true
  try {
    const { data } = await api.post('/ai/auto-fill', { cvAnalysis: state.aiTexts.cv, programCode: state.programCode })
    if (data.cvFields) Object.assign(state.cvFields, data.cvFields)
  } catch { /* silent */ }
  finally { aiLoading.value.autoFill = false }
}

async function analyzeAttestations() {
  aiLoading.value.att = true
  try {
    let filesData = []
    if (attSource.value !== 'upload') {
      filesData = await jiraAttachmentsToFilesData(attSource.value, attIds.value)
    } else {
      for (const f of attFiles.value) filesData.push({ base64: await fileToBase64(f), mimeType: guessMimeType(f), filename: f.name })
    }
    const { data } = await api.post('/ai/analyze-attestations', {
      filesData, solution: state.form.solution, actionLabel: state.form.actionLabel,
      refType: state.refType, cvAnalysis: state.aiTexts.cv || null,
    })
    state.aiTexts.attestations = data.text
  } catch (e) { state.aiTexts.attestations = 'Erreur: ' + (e.response?.data?.error || e.message) }
  finally { aiLoading.value.att = false }
}

async function analyzeCertif() {
  aiLoading.value.certif = true
  try {
    let filesData = []
    if (certifSource.value !== 'upload') {
      filesData = await jiraAttachmentsToFilesData(certifSource.value, certifAttIds.value)
    } else {
      for (const f of certifFiles.value) filesData.push({ base64: await fileToBase64(f), mimeType: guessMimeType(f), filename: f.name })
    }
    const { data } = await api.post('/ai/analyze-certif-editeur', {
      filesData, solution: state.form.solution, prestataire: state.form.prestataire, programCode: state.programCode,
    })
    state.aiTexts.certifEditeur = data.text
  } catch (e) { state.aiTexts.certifEditeur = 'Erreur: ' + (e.response?.data?.error || e.message) }
  finally { aiLoading.value.certif = false }
}
</script>

<style scoped>
.step-dossier { color: var(--wiz-text); }
.wiz-step-header { margin-bottom: 20px; }
.wiz-step-title { font-size: 22px; font-weight: 600; margin-bottom: 6px; }
.wiz-step-desc { color: var(--wiz-text2); font-size: 13px; }

/* Sub-nav */
.sub-nav { display: flex; align-items: center; gap: 6px; margin-bottom: 28px; }
.sub-arrow { width: 30px; height: 30px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--wiz-border); border-radius: 7px; font-size: 18px; line-height: 1; color: var(--wiz-text2); cursor: pointer; transition: all 0.15s; font-family: var(--sans); }
.sub-arrow:hover:not(:disabled) { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.sub-arrow:disabled { opacity: 0.25; cursor: not-allowed; }

/* Sub-tabs */
.sub-tabs { flex: 1; display: flex; gap: 4px; padding: 4px; background: rgba(var(--wiz-overlay-rgb),0.04); border-radius: 10px; border: 1px solid var(--wiz-border); }
.sub-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; background: transparent; border: none; border-radius: 7px; cursor: pointer; transition: all 0.15s; color: var(--wiz-text3); font-family: var(--sans); }
.sub-tab:hover { background: rgba(var(--wiz-overlay-rgb),0.05); color: var(--wiz-text2); }
.sub-tab.active { background: var(--wiz-card); color: var(--wiz-text); box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.sub-tab.done .sub-tab-num { color: #22c55e; }
.sub-tab-num { width: 20px; height: 20px; border-radius: 50%; border: 1px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 10px; font-family: var(--mono); font-weight: 600; }
.sub-tab.active .sub-tab-num { background: var(--wiz-accent); border-color: var(--wiz-accent); color: #fff; }
.sub-tab-label { font-size: 11px; font-weight: 500; text-align: center; line-height: 1.2; }

/* Sections & Forms */
.wiz-section { margin-bottom: 28px; }
.wiz-section-label { font-size: 11px; font-family: var(--mono); color: var(--wiz-text3); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.req { color: var(--wiz-accent); }
.opt-badge { font-size: 9px; padding: 2px 6px; background: rgba(var(--wiz-overlay-rgb),0.05); border: 1px solid var(--wiz-border); border-radius: 10px; color: var(--wiz-text3); text-transform: none; letter-spacing: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wiz-field { display: flex; flex-direction: column; gap: 6px; }
.wiz-field.full { grid-column: 1 / -1; }
.wiz-field label { font-size: 11px; font-family: var(--mono); color: var(--wiz-text2); }
.wiz-input { background: var(--wiz-card); border: 1px solid var(--wiz-border); border-radius: 6px; padding: 9px 12px; font-size: 13px; color: var(--wiz-text); font-family: var(--sans); outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box; }
.wiz-input:focus { border-color: var(--wiz-accent); }
select.wiz-input, textarea.wiz-input { cursor: pointer; }
option { background: var(--wiz-option-bg); color: var(--wiz-option-text); }

/* Chips & modules */
.sol-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.sol-chip { padding: 5px 12px; background: rgba(var(--wiz-overlay-rgb),0.05); border: 1px solid var(--wiz-border); border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 0.12s; color: var(--wiz-text2); }
.sol-chip.active { border-color: var(--wiz-accent); color: var(--wiz-accent); background: rgba(59,130,246,0.1); }
.modules-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--wiz-border); }
.modules-label { font-size: 11px; font-family: var(--mono); color: var(--wiz-text2); display: block; margin-bottom: 10px; }
.input-row { display: flex; gap: 8px; margin-bottom: 8px; }
.wiz-btn-secondary { padding: 9px 16px; background: rgba(var(--wiz-overlay-rgb),0.06); border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 13px; color: var(--wiz-text2); cursor: pointer; transition: all 0.15s; white-space: nowrap; font-family: var(--sans); }
.wiz-btn-secondary:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); color: var(--wiz-text); }
.module-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.module-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: rgba(var(--wiz-overlay-rgb),0.05); border: 1px solid var(--wiz-border); border-radius: 20px; font-size: 12px; color: var(--wiz-text2); }
.module-tag button { background: none; border: none; cursor: pointer; color: var(--wiz-text3); font-size: 12px; padding: 0 2px; }
.module-tag button:hover { color: #f87171; }
.wiz-empty-sm { font-size: 12px; color: var(--wiz-text3); font-family: var(--mono); }

/* Source tabs */
.source-tabs { display: flex; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; }
.src-tab { padding: 7px 14px; background: transparent; border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 12px; color: var(--wiz-text2); cursor: pointer; font-family: var(--sans); transition: all 0.15s; }
.src-tab:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); color: var(--wiz-text); }
.src-tab.active { border-color: var(--wiz-accent); color: var(--wiz-accent); background: rgba(59,130,246,0.1); }

/* Upload */
.upload-zone { border: 2px dashed var(--wiz-border); border-radius: 8px; transition: border-color 0.15s; }
.upload-zone:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); }
.upload-area { display: flex; flex-direction: column; align-items: center; padding: 24px; cursor: pointer; gap: 6px; }
.upload-icon { font-size: 26px; }
.upload-text { font-size: 13px; color: var(--wiz-text2); }
.upload-link { color: var(--wiz-accent); text-decoration: underline; cursor: pointer; }
.upload-sub { font-size: 11px; color: var(--wiz-text3); font-family: var(--mono); }
.files-list { display: flex; flex-wrap: wrap; gap: 6px; }
.file-item { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(var(--wiz-overlay-rgb),0.04); border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 12px; color: var(--wiz-text2); font-family: var(--mono); }
.file-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-remove { background: none; border: none; cursor: pointer; color: var(--wiz-text3); font-size: 11px; padding: 0; }
.file-remove:hover { color: #f87171; }

/* Jira att list */
.att-list { display: flex; flex-direction: column; gap: 6px; }
.att-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: rgba(var(--wiz-overlay-rgb),0.03); border: 1px solid var(--wiz-border); border-radius: 6px; cursor: pointer; transition: background 0.12s; }
.att-item:hover { background: rgba(var(--wiz-overlay-rgb),0.06); }
.att-check { accent-color: var(--wiz-accent); width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
.att-icon { font-size: 16px; flex-shrink: 0; }
.att-name { flex: 1; font-size: 12px; color: var(--wiz-text); font-family: var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-size { font-size: 11px; color: var(--wiz-text3); font-family: var(--mono); white-space: nowrap; }

/* Action blocks */
.action-meta { padding: 10px 14px; background: rgba(var(--wiz-overlay-rgb),0.04); border-radius: 6px; border-left: 3px solid var(--wiz-border); font-size: 13px; color: var(--wiz-text2); }
.action-consistance { padding: 10px 14px; background: rgba(59,130,246,0.08); border-radius: 6px; border-left: 3px solid var(--wiz-accent); font-size: 13px; color: var(--wiz-text); }

/* Info hint */
.info-hint { padding: 12px 16px; background: rgba(var(--wiz-overlay-rgb),0.03); border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 13px; color: var(--wiz-text3); font-family: var(--mono); }

/* AI panels */
.wiz-ai-panel { background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 18px 20px; }
.wiz-ai-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.wiz-ai-badge { font-size: 10px; font-family: var(--mono); background: rgba(59,130,246,0.15); color: var(--wiz-accent); padding: 2px 8px; border-radius: 3px; letter-spacing: 0.08em; border: 1px solid rgba(59,130,246,0.3); }
.wiz-ai-title { font-size: 13px; font-weight: 500; color: var(--wiz-text); }
.wiz-ai-done { margin-left: auto; font-size: 11px; color: #22c55e; font-family: var(--mono); }
.wiz-ai-content { font-size: 12px; color: var(--wiz-text2); line-height: 1.7; white-space: pre-wrap; margin-bottom: 14px; max-height: 180px; overflow-y: auto; }
.wiz-ai-actions { display: flex; gap: 8px; }
.wiz-btn-ai { padding: 7px 14px; background: rgba(var(--wiz-overlay-rgb),0.06); border: 1px solid var(--wiz-border); border-radius: 6px; font-size: 12px; color: var(--wiz-text2); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; font-family: var(--sans); }
.wiz-btn-ai:hover { border-color: var(--wiz-accent); color: var(--wiz-accent); }
.wiz-btn-ai:disabled { opacity: 0.4; cursor: not-allowed; }

.mt8 { margin-top: 8px; }
.mt12 { margin-top: 12px; }

.spinner-sm { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(var(--wiz-overlay-rgb),0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
