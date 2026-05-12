<template>
  <div>
    <div class="topbar">
      <div>
        <div class="topbar-title">Évaluation</div>
        <div class="topbar-sub">{{ currentProgram?.name || 'Sélectionner un programme' }}</div>
      </div>
      <div class="topbar-actions">
        <select v-if="programs.length" v-model="selectedProgramCode" style="width:220px;" @change="onProgramChange">
          <option value="">— Programme —</option>
          <option v-for="p in programs" :key="p.code" :value="p.code">{{ p.name }} {{ p.version }}</option>
        </select>
      </div>
    </div>
    <div class="content">
      <!-- Sélection programme -->
      <div v-if="!currentProgram" class="empty-state">
        <div class="empty-icon">◈</div>
        <div class="empty-title">Sélectionner un programme</div>
        <div class="text-sm mt8">Choisissez le programme dans le menu en haut à droite pour démarrer une évaluation.</div>
      </div>

      <template v-else>
        <!-- BARRE D'ÉTAPES -->
        <div class="steps-bar">
          <template v-for="(s, i) in steps" :key="i">
            <div class="step-item">
              <div class="step-num" :class="{ done: step > i, active: step === i }">{{ step > i ? '✓' : i + 1 }}</div>
              <div class="step-label" :class="{ active: step === i }">{{ s }}</div>
            </div>
            <div v-if="i < steps.length - 1" class="step-sep"></div>
          </template>
        </div>

        <!-- ÉTAPE 0 : Type + Catégorie -->
        <div v-if="step === 0">
          <div class="card">
            <div class="card-title">Type de référencement</div>
            <div class="row gap8 mb8">
              <button class="btn" :class="refType === 'SOLUTION' ? 'btn-primary' : 'btn-secondary'" @click="refType = 'SOLUTION'; selectedCategory = null">Solutions informatiques</button>
              <button class="btn" :class="refType === 'ACTION' ? 'btn-primary' : 'btn-secondary'" @click="refType = 'ACTION'; selectedCategory = null">Actions (formation, normalisation…)</button>
            </div>
          </div>

          <div class="card" v-if="refType === 'SOLUTION'">
            <div class="card-title">Catégorie de la solution</div>
            <div class="cat-grid">
              <div v-for="(cat, key) in currentProgram.categories" :key="key" class="cat-card" :class="{ sel: selectedCategory === key }" @click="selectedCategory = key">
                <div class="cat-icon">{{ cat.icon }}</div>
                <div class="cat-name">{{ cat.label }}</div>
                <div class="cat-ex">{{ cat.ex }}</div>
              </div>
            </div>
          </div>

          <div class="card" v-if="refType === 'ACTION'">
            <div class="card-title">Domaine d'action</div>
            <div class="cat-grid">
              <div v-for="(act, key) in currentProgram.actionTypes" :key="key" class="cat-card" :class="{ sel: selectedCategory === key }" @click="selectedCategory = key">
                <div class="cat-icon">{{ act.icon }}</div>
                <div class="cat-name">{{ act.label }}</div>
              </div>
            </div>
          </div>

          <div class="row-between mt16">
            <div></div>
            <button class="btn btn-primary" :disabled="!selectedCategory" @click="goStep(1)">Suivant →</button>
          </div>
        </div>

        <!-- ÉTAPE 1 : Informations dossier -->
        <div v-if="step === 1">
          <div class="card">
            <div class="card-title">Informations du dossier</div>
            <div class="form-grid">
              <div class="field"><label>Ticket Prestataire (Jira)</label>
                <div class="row gap8">
                  <input v-model="form.jiraKeyPrestataire" placeholder="ex: REF-001" @blur="loadJiraHierarchy" />
                  <button class="btn btn-ghost btn-sm" @click="loadJiraHierarchy">↓ Charger</button>
                </div>
              </div>
              <div class="field"><label>Prestataire / Société</label><input v-model="form.prestataire" /></div>
              <div class="field" v-if="refType === 'SOLUTION'"><label>Solution présentée</label><input v-model="form.solution" placeholder="ex. Odoo 17, SAP Business One..." /></div>
              <div class="field" v-if="refType === 'ACTION'"><label>Intitulé de l'action</label><input v-model="form.actionLabel" /></div>
              <div class="field"><label>Date</label><input v-model="form.dateDemo" type="date" /></div>
              <div class="field"><label>Rapporteur</label><input v-model="form.rapporteur" /></div>
              <div class="field"><label>Origine</label>
                <select v-model="form.origine"><option value="">—</option><option>Marocaine</option><option>Étrangère</option></select>
              </div>
              <div class="field"><label>Nature du prestataire</label>
                <select v-model="form.nature"><option value="">—</option><option>Éditeur</option><option>Intégrateur</option><option>Éditeur-Intégrateur</option><option>Consultant</option><option>Formateur</option></select>
              </div>
              <div class="field" v-if="refType === 'SOLUTION'"><label>Mode d'acquisition</label>
                <select v-model="form.modeAcquisition"><option value="">—</option><option>Propriétaire</option><option>Open Source</option><option>SaaS</option></select>
              </div>
              <div class="field"><label>Secteur cible</label><input v-model="form.secteur" /></div>
            </div>

            <!-- Modules (solutions IT uniquement) -->
            <div v-if="refType === 'SOLUTION'" style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
              <label>Modules objet du référencement</label>
              <div class="row gap8 mt8">
                <input v-model="moduleInput" placeholder="Ex: Comptabilité — Entrée pour ajouter" @keydown.enter.prevent="addModule" style="flex:1;" />
                <button class="btn btn-secondary btn-sm" @click="addModule">+ Ajouter</button>
              </div>
              <div class="module-tags mt8">
                <span v-if="!form.modules?.length" class="text-mono">Aucun module</span>
                <span v-for="(m, i) in form.modules" :key="i" class="module-tag">
                  {{ m }} <span class="tag-del" @click="removeModule(i)">×</span>
                </span>
              </div>
            </div>

            <!-- Hiérarchie Jira -->
            <div v-if="jiraHierarchy" style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
              <label>Hiérarchie Jira — Intervenants & Compétences</label>
              <div class="hierarchy-tree mt8">
                <div class="hierarchy-level prestataire">
                  <span class="hierarchy-dot dot-prest"></span>
                  <strong>{{ jiraHierarchy.key }}</strong> — {{ jiraHierarchy.summary }}
                </div>
                <template v-for="int in jiraHierarchy.intervenants" :key="int.key">
                  <div class="hierarchy-level intervenant" :class="{ sel: form.jiraKeyIntervenant === int.key }" style="cursor:pointer;" @click="selectIntervenant(int)">
                    <span class="hierarchy-dot dot-int"></span>
                    <span>{{ int.key }}</span> — {{ int.summary }}
                    <span v-if="int.attachments?.length" class="text-mono" style="margin-left:auto;">📎 {{ int.attachments.length }}</span>
                    <span v-if="extractLoading.intervenant && form.jiraKeyIntervenant === int.key" class="spinner spinner-dark" style="margin-left:8px;"></span>
                    <span v-else-if="form.jiraKeyIntervenant === int.key" class="badge badge-green" style="margin-left:8px;">✓ Sélectionné</span>
                  </div>
                  <div v-for="comp in int.competences" :key="comp.key" class="hierarchy-level competence" :class="{ sel: form.jiraKeyCompetence === comp.key }" style="cursor:pointer;" @click="selectCompetence(comp)">
                    <span class="hierarchy-dot dot-comp"></span>
                    <span>{{ comp.key }}</span> — {{ comp.summary }}
                    <span v-if="comp.attachments?.length" class="text-mono" style="margin-left:auto;">📎 {{ comp.attachments.length }}</span>
                    <span v-if="extractLoading.competence && form.jiraKeyCompetence === comp.key" class="spinner spinner-dark" style="margin-left:8px;"></span>
                    <span v-else-if="form.jiraKeyCompetence === comp.key" class="badge badge-green" style="margin-left:8px;">✓</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Panneau données extraites Intervenant -->
          <div v-if="extractedIntervenant" class="extract-panel">
            <div class="extract-header">
              <span class="extract-badge">Intervenant</span>
              <span class="extract-title">{{ form.jiraKeyIntervenant }} — Données extraites du ticket</span>
              <span class="extract-hint">Modifiables si besoin</span>
            </div>
            <div class="form-grid">
              <div class="field"><label>Nom</label><input v-model="extractedIntervenant.nom" @input="syncIntervenantToForm" /></div>
              <div class="field"><label>Prénom</label><input v-model="extractedIntervenant.prenom" @input="syncIntervenantToForm" /></div>
              <div class="field"><label>N° CIN / Passeport</label><input v-model="extractedIntervenant.cin" /></div>
              <div class="field"><label>GSM</label><input v-model="extractedIntervenant.gsm" /></div>
              <div class="field"><label>E-Mail</label><input v-model="extractedIntervenant.email" /></div>
              <div class="field"><label>Type de formation</label><input v-model="extractedIntervenant.typeFormation" @input="syncIntervenantToForm" /></div>
              <div class="field"><label>Niveau de formation</label><input v-model="extractedIntervenant.niveauFormation" @input="syncIntervenantToForm" /></div>
              <div class="field"><label>Permanent</label><input v-model="extractedIntervenant.permanent" /></div>
            </div>
            <div v-if="Object.keys(extractedIntervenant._raw || {}).length" style="margin-top:8px;">
              <div @click="showRawIntervenant = !showRawIntervenant" style="cursor:pointer; font-size:11px; font-family:var(--mono); color:var(--text3);">
                {{ showRawIntervenant ? '▲' : '▼' }} Tous les champs Jira bruts ({{ Object.keys(extractedIntervenant._raw).length }})
              </div>
              <div v-if="showRawIntervenant" class="raw-fields">
                <div v-for="(v, k) in extractedIntervenant._raw" :key="k" class="raw-field-row">
                  <span class="raw-key">{{ k }}</span><span class="raw-val">{{ JSON.stringify(v) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Panneau données extraites Compétence -->
          <div v-if="extractedCompetence" class="extract-panel">
            <div class="extract-header">
              <span class="extract-badge" style="background:rgba(139,92,246,0.2); color:#a78bfa; border-color:rgba(139,92,246,0.3);">Compétence</span>
              <span class="extract-title">{{ form.jiraKeyCompetence }} — Données extraites du ticket</span>
              <span class="extract-hint">Sélectionnez la solution et les modules à évaluer</span>
            </div>

            <div class="form-grid">
              <div class="field"><label>Type d'action référencé</label><input v-model="extractedCompetence.typeAction" /></div>
              <div class="field"><label>Action à référencer</label><input v-model="extractedCompetence.action" @input="syncCompetenceToForm" /></div>
              <div class="field"><label>Profil</label><input v-model="extractedCompetence.profil" /></div>
              <div class="field"><label>Secteur(s)</label><input v-model="extractedCompetence.secteurs" @input="syncCompetenceToForm" /></div>
              <div class="field"><label>Domaine d'accompagnement</label><input v-model="extractedCompetence.domaine" /></div>
              <div class="field"><label>Autre solution informatique</label><input v-model="extractedCompetence.autreSolution" @input="syncCompetenceToForm" /></div>
            </div>

            <!-- Sélection Solution Informatique -->
            <div v-if="extractedCompetence.solutionsInformatiques?.length" style="margin-top:14px; border-top:1px solid var(--border); padding-top:14px;">
              <label style="display:block; margin-bottom:8px;">Solution(s) informatique(s) — sélectionner celle à évaluer</label>
              <div class="solution-chips">
                <div v-for="sol in extractedCompetence.solutionsInformatiques" :key="sol"
                  class="sol-chip" :class="{ active: form.solution === sol }"
                  @click="selectSolution(sol)">
                  {{ sol }}
                  <span v-if="form.solution === sol" style="margin-left:4px;">✓</span>
                </div>
              </div>
              <div v-if="extractedCompetence.autreSolution" style="margin-top:8px;">
                <div class="sol-chip" :class="{ active: form.solution === extractedCompetence.autreSolution }"
                  @click="selectSolution(extractedCompetence.autreSolution)">
                  Autre : {{ extractedCompetence.autreSolution }}
                  <span v-if="form.solution === extractedCompetence.autreSolution" style="margin-left:4px;">✓</span>
                </div>
              </div>
            </div>

            <!-- Sélection Modules Informatiques -->
            <div v-if="extractedCompetence.modulesInformatiques?.length" style="margin-top:14px; border-top:1px solid var(--border); padding-top:14px;">
              <label style="display:block; margin-bottom:8px;">Modules informatiques — cocher ceux à évaluer</label>
              <div class="solution-chips">
                <div v-for="mod in extractedCompetence.modulesInformatiques" :key="mod"
                  class="sol-chip" :class="{ active: form.modules?.includes(mod) }"
                  @click="toggleModule(mod)">
                  {{ mod }}
                  <span v-if="form.modules?.includes(mod)" style="margin-left:4px;">✓</span>
                </div>
              </div>
              <div class="text-mono mt8">{{ form.modules?.length || 0 }} module(s) sélectionné(s)</div>
            </div>

            <div v-if="Object.keys(extractedCompetence._raw || {}).length" style="margin-top:8px;">
              <div @click="showRawCompetence = !showRawCompetence" style="cursor:pointer; font-size:11px; font-family:var(--mono); color:var(--text3);">
                {{ showRawCompetence ? '▲' : '▼' }} Tous les champs Jira bruts ({{ Object.keys(extractedCompetence._raw).length }})
              </div>
              <div v-if="showRawCompetence" class="raw-fields">
                <div v-for="(v, k) in extractedCompetence._raw" :key="k" class="raw-field-row">
                  <span class="raw-key">{{ k }}</span><span class="raw-val">{{ JSON.stringify(v) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel IA Briefing -->
          <div class="ai-panel">
            <div class="ai-header">
              <span class="ai-badge">IA — OpenRouter</span>
              <span class="ai-title">Briefing pré-commission</span>
            </div>
            <div class="ai-content" :class="{ loading: aiLoading.briefing }">{{ aiTexts.briefing || 'Renseignez le prestataire et la solution, puis lancez le briefing IA.' }}</div>
            <div class="ai-actions">
              <button class="ai-btn" :disabled="aiLoading.briefing || !form.prestataire" @click="generateBriefing">
                <span v-if="aiLoading.briefing" class="spinner"></span>
                <span v-else>◈ Générer le briefing</span>
              </button>
            </div>
          </div>

          <!-- Panel CV -->
          <div class="ai-panel">
            <div class="ai-header">
              <span class="ai-badge">IA — Analyse CV</span>
              <span class="ai-title">Analyse CV / Diplômes — ticket Intervenant</span>
            </div>
            <div style="font-size:11px; font-family:var(--mono); color:rgba(255,255,255,0.35); margin-bottom:10px;">Pièces jointes du ticket intervenant sélectionné (CV + diplômes)</div>
            <div class="ai-content">{{ aiTexts.cv || 'Sélectionnez un intervenant dans la hiérarchie Jira, puis choisissez le CV.' }}</div>
            <div class="ai-actions">
              <button class="ai-btn" @click="showCVPicker = true">↓ Sélectionner les fichiers CV</button>
              <button v-if="aiTexts.cv" class="ai-btn" @click="autoFill">◈ Pré-remplir le dossier</button>
            </div>
          </div>

          <!-- Panel Attestations -->
          <div class="ai-panel">
            <div class="ai-header">
              <span class="ai-badge">IA — Attestations</span>
              <span class="ai-title">Attestations de référence — ticket Compétence</span>
            </div>
            <div class="ai-content">{{ aiTexts.attestations || 'Sélectionnez une compétence dans la hiérarchie Jira, puis choisissez les attestations.' }}</div>
            <div class="ai-actions">
              <button class="ai-btn" :disabled="!selectedCompetence?.attachments?.length" @click="showAttPicker = true">↓ Sélectionner les attestations</button>
            </div>
          </div>

          <div class="row-between mt16">
            <button class="btn btn-ghost" @click="goStep(0)">← Retour</button>
            <button class="btn btn-primary" :disabled="!form.prestataire" @click="saveAndGo(2)">Suivant → Évaluation</button>
          </div>
        </div>

        <!-- ÉTAPE 2 : Grille fonctionnelle -->
        <div v-if="step === 2">
          <div class="score-live">
            <div>
              <div style="font-size:11px; font-family:var(--mono); color:rgba(255,255,255,0.4); margin-bottom:4px;">Score {{ refType === 'SOLUTION' ? 'solution' : 'action' }}</div>
              <div class="score-big" :class="scoreClass(solScore.pct, 60, 45)">{{ solScore.pct !== null ? solScore.pct + '%' : '—' }}</div>
            </div>
            <div style="flex:1;">
              <div class="progress-track"><div class="progress-fill" :style="{ width: (solScore.pct || 0) + '%', background: progressColor(solScore.pct, 60, 45) }"></div></div>
              <div class="score-detail mt8">Seuil référencement: 60% &nbsp;|&nbsp; {{ Object.keys(solScores).length }} critère(s) évalué(s)</div>
            </div>
            <div style="text-align:right;">
              <div class="score-verdict" :class="scoreClass(solScore.pct, 60, 45)">{{ solScore.verdict ? verdictLabel[solScore.verdict] : 'En attente' }}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Grille fonctionnelle — {{ currentCriteria?.label }}</div>
            <div v-for="(c, i) in currentCriteria?.criteria" :key="i" class="criteria-item">
              <div class="criteria-text">
                <div class="criteria-name">{{ c.n }} <span v-if="c.w === 2" class="prio-tag">prioritaire</span></div>
                <div class="criteria-desc">{{ c.d }}</div>
                <textarea class="criteria-obs" :placeholder="'Observation...'" v-model="solObs[i]" @input="scheduleSolSave"></textarea>
              </div>
              <div class="score-btns">
                <button v-for="v in [0,1,2]" :key="v" class="sbtn" :class="[`s${v}`, solScores[i] === v ? 'sel' : '']" @click="setSolScore(i, v)">{{ v }}</button>
              </div>
            </div>
          </div>
          <!-- Panel cohérence IA -->
          <div v-if="aiTexts.coherence" class="ai-panel">
            <div class="ai-header"><span class="ai-badge">IA — Cohérence</span><span class="ai-title">Analyse de la notation</span></div>
            <div class="ai-content">{{ aiTexts.coherence }}</div>
          </div>
          <div class="row-between mt16">
            <button class="btn btn-ghost" @click="goStep(1)">← Retour</button>
            <div class="row gap8">
              <button class="ai-btn" style="background:var(--surface2); color:var(--text); border:1px solid var(--border); padding:9px 14px; border-radius:var(--radius);" :disabled="aiLoading.coherence" @click="checkCoherence">
                <span v-if="aiLoading.coherence" class="spinner spinner-dark"></span>
                <span v-else>◈ Vérifier cohérence</span>
              </button>
              <button class="btn btn-primary" @click="saveAndGo(3)">Suivant → Intégrateur</button>
            </div>
          </div>
        </div>

        <!-- ÉTAPE 3 : Profil intégrateur/intervenant -->
        <div v-if="step === 3">
          <div class="score-live">
            <div>
              <div style="font-size:11px; font-family:var(--mono); color:rgba(255,255,255,0.4); margin-bottom:4px;">Score intégrateur</div>
              <div class="score-big" :class="scoreClass(intScore.pct, 55, 40)">{{ intScore.pct !== null ? intScore.pct + '%' : '—' }}</div>
            </div>
            <div style="flex:1;">
              <div class="progress-track"><div class="progress-fill" :style="{ width: (intScore.pct || 0) + '%', background: progressColor(intScore.pct, 55, 40) }"></div></div>
              <div class="score-detail mt8">Seuil requis: 55%</div>
            </div>
            <div style="text-align:right;">
              <div class="score-verdict" :class="scoreClass(intScore.pct, 55, 40)">{{ intScore.verdict ? verdictLabel[intScore.verdict] : 'En attente' }}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Profil & compétences de l'intervenant</div>
            <div class="form-grid mb8" style="margin-bottom:16px;">
              <div class="field"><label>Formation / Diplôme</label><input v-model="cvFields.diplome" @input="autoScore" placeholder="ex. Ingénieur informatique, Bac+5..." /></div>
              <div class="field"><label>Établissement</label><input v-model="cvFields.etablissement" /></div>
              <div class="field"><label>Expérience totale (années)</label><input v-model.number="cvFields.exp" type="number" min="0" @input="autoScore" /></div>
              <div class="field"><label>Expérience sur cette solution (années)</label><input v-model.number="cvFields.expSol" type="number" min="0" @input="autoScore" /></div>
              <div class="field"><label>Poste principal occupé</label><input v-model="cvFields.poste" /></div>
              <div class="field"><label>Taille de l'équipe</label><input v-model.number="cvFields.equipe" type="number" min="1" @input="autoScore" /></div>
              <div class="field"><label>Certifications</label><input v-model="cvFields.certif" /></div>
              <div class="field full"><label>Références clients vérifiables au Maroc</label><textarea v-model="cvFields.refs" style="height:60px;"></textarea></div>
            </div>
            <hr class="divider">
            <div class="card-title">Critères d'évaluation</div>
            <div v-for="(c, i) in currentProgram.intCriteria" :key="i" class="criteria-item">
              <div class="criteria-text">
                <div class="criteria-name">{{ c.n }}</div>
                <div class="criteria-desc">{{ c.d }}</div>
                <textarea class="criteria-obs" v-model="intObs[i]" @input="scheduleIntSave"></textarea>
              </div>
              <div class="score-btns">
                <button v-for="v in [0,1,2]" :key="v" class="sbtn" :class="[`s${v}`, intScores[i] === v ? 'sel' : '']" @click="setIntScore(i, v)">{{ v }}</button>
              </div>
            </div>
          </div>
          <div v-if="aiTexts.cv" class="ai-panel">
            <div class="ai-header"><span class="ai-badge">IA — Référence CV</span><span class="ai-title">Analyse CV (effectuée à l'étape précédente)</span></div>
            <div class="ai-content" style="font-size:12px;">{{ aiTexts.cv }}</div>
          </div>
          <div class="row-between mt16">
            <button class="btn btn-ghost" @click="goStep(2)">← Retour</button>
            <button class="btn btn-primary" @click="saveAndGo(4)">Suivant → Décision finale</button>
          </div>
        </div>

        <!-- ÉTAPE 4 : Décision finale -->
        <div v-if="step === 4">
          <!-- Bannière décision -->
          <div v-if="finalDecision" class="decision-banner" :class="{ ref: finalDecision === 'REFERENCE', cond: finalDecision === 'CONDITIONNEL', rej: finalDecision === 'REJETE' }">
            <div class="decision-verdict">{{ { REFERENCE: '✓ Référencé', CONDITIONNEL: '⚠ Référencé conditionnel', REJETE: '✗ Rejeté' }[finalDecision] }}</div>
          </div>
          <div class="card">
            <div class="card-title">Scores consolidés</div>
            <div class="metrics-row">
              <div class="metric"><div class="metric-label">Score solution</div><div class="metric-value">{{ solScore.pct !== null ? solScore.pct + '%' : '—' }}</div></div>
              <div class="metric"><div class="metric-label">Score intégrateur</div><div class="metric-value">{{ intScore.pct !== null ? intScore.pct + '%' : '—' }}</div></div>
              <div class="metric"><div class="metric-label">Score global pondéré</div><div class="metric-value accent">{{ globalScore !== null ? globalScore + '%' : '—' }}</div></div>
              <div class="metric"><div class="metric-label">Décision</div><div class="metric-value" style="font-size:14px;">{{ { REFERENCE: 'Référencé', CONDITIONNEL: 'Conditionnel', REJETE: 'Rejeté' }[finalDecision] || '—' }}</div></div>
            </div>
          </div>
          <!-- PV IA -->
          <div class="ai-panel">
            <div class="ai-header"><span class="ai-badge">IA — Rédaction</span><span class="ai-title">Procès-verbal de commission</span></div>
            <div class="ai-content" :class="{ loading: aiLoading.pv }">{{ aiTexts.pv || 'Cliquez sur "Générer le PV" pour rédiger le procès-verbal officiel.' }}</div>
            <div class="ai-actions">
              <button class="ai-btn" :disabled="aiLoading.pv" @click="generatePV">
                <span v-if="aiLoading.pv" class="spinner"></span>
                <span v-else>◈ Générer le PV</span>
              </button>
              <button v-if="aiTexts.pv" class="ai-btn" @click="copyPV">⎘ Copier le PV</button>
            </div>
          </div>
          <!-- Décision officielle -->
          <div class="card">
            <div class="card-title">Décision finale de la commission</div>
            <div class="form-grid">
              <div class="field"><label>Décision officielle</label>
                <select v-model="form.finalDecision">
                  <option value="REFERENCE">Référencé</option>
                  <option value="CONDITIONNEL">Référencé conditionnel</option>
                  <option value="REJETE">Rejeté</option>
                </select>
              </div>
              <div class="field"><label>Date de décision</label><input v-model="form.decisionDate" type="date" /></div>
              <div class="field full"><label>Observations complémentaires</label><textarea v-model="form.commissionComments"></textarea></div>
              <div class="field full"><label>Conditions (si conditionnel)</label><textarea v-model="form.conditions" style="height:60px;"></textarea></div>
            </div>
          </div>
          <div class="row-between mt16">
            <button class="btn btn-ghost" @click="goStep(3)">← Retour</button>
            <div class="row gap8">
              <button class="btn btn-secondary" @click="exportPDF">↓ Exporter PDF</button>
              <button class="btn btn-green" :disabled="submitting" @click="submitEval">
                <span v-if="submitting" class="spinner"></span>
                <span v-else>↑ Soumettre à Jira</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- CV PICKER MODAL -->
    <div v-if="showCVPicker" class="modal-overlay" @click.self="showCVPicker = false">
      <div class="modal" style="width:600px;">
        <div class="modal-title">Sélectionner les fichiers CV / Diplômes</div>

        <!-- Onglets source -->
        <div style="display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:12px;">
          <div @click="cvSource = 'jira'" style="padding:7px 16px; font-size:12px; font-family:var(--mono); cursor:pointer; border-bottom:2px solid transparent;"
            :style="cvSource === 'jira' ? 'border-color:var(--accent); color:var(--accent)' : 'color:var(--text3)'">
            Depuis Jira ({{ selectedIntervenant?.attachments?.length || 0 }})
          </div>
          <div @click="cvSource = 'upload'" style="padding:7px 16px; font-size:12px; font-family:var(--mono); cursor:pointer; border-bottom:2px solid transparent;"
            :style="cvSource === 'upload' ? 'border-color:var(--accent); color:var(--accent)' : 'color:var(--text3)'">
            Depuis l'ordinateur
          </div>
        </div>

        <!-- Source Jira -->
        <div v-if="cvSource === 'jira'">
          <div class="modal-sub" style="margin-bottom:8px;">Pièces jointes de {{ form.jiraKeyIntervenant }} — sélection multiple</div>
          <div v-if="!selectedIntervenant?.attachments?.length" style="padding:16px; text-align:center; color:var(--text3); font-size:12px;">
            Aucune pièce jointe. Sélectionnez un intervenant dans la hiérarchie Jira.
          </div>
          <div class="att-list">
            <div v-for="att in selectedIntervenant?.attachments" :key="att.id"
              class="att-item" :class="{ sel: selectedCVAttIds.includes(att.id) }"
              @click="toggleCVAtt(att)">
              <div class="att-icon">{{ attIcon(att.mimeType) }}</div>
              <div class="att-info">
                <div class="att-name">{{ att.filename }}</div>
                <div class="att-meta">{{ (att.size / 1024).toFixed(0) }} Ko · {{ att.mimeType }}</div>
              </div>
              <span v-if="selectedCVAttIds.includes(att.id)" style="margin-left:auto; color:var(--green); font-size:14px;">✓</span>
            </div>
          </div>
          <div class="text-mono mt8">{{ selectedCVAttIds.length }} fichier(s) sélectionné(s)</div>
        </div>

        <!-- Source upload local -->
        <div v-if="cvSource === 'upload'">
          <div style="border:2px dashed var(--border); border-radius:var(--radius); padding:24px; text-align:center; cursor:pointer; position:relative;"
            @click="$refs.cvFileInput.click()" @dragover.prevent @drop.prevent="onCVDrop">
            <div style="font-size:28px; margin-bottom:8px;">📂</div>
            <div style="font-size:13px; color:var(--text2);">Cliquez ou glissez vos fichiers ici</div>
            <div style="font-size:11px; color:var(--text3); margin-top:4px; font-family:var(--mono);">PDF, images (PNG, JPG), Word — plusieurs fichiers acceptés</div>
            <input ref="cvFileInput" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,image/*,application/pdf"
              style="display:none" @change="onCVFileChange" />
          </div>
          <div v-if="uploadedCVFiles.length" style="margin-top:10px;">
            <div v-for="(f, i) in uploadedCVFiles" :key="i" class="att-item" style="cursor:default;">
              <div class="att-icon">{{ attIcon(f.type) }}</div>
              <div class="att-info">
                <div class="att-name">{{ f.name }}</div>
                <div class="att-meta">{{ (f.size / 1024).toFixed(0) }} Ko · {{ f.type }}</div>
              </div>
              <button style="margin-left:auto; background:none; border:none; color:var(--red); cursor:pointer; font-size:16px;" @click.stop="removeUploadedCV(i)">×</button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showCVPicker = false">Annuler</button>
          <button class="btn btn-primary"
            :disabled="(cvSource === 'jira' ? !selectedCVAttIds.length : !uploadedCVFiles.length) || aiLoading.cv"
            @click="analyzeCV">
            <span v-if="aiLoading.cv" class="spinner"></span>
            <span v-else>◈ Analyser avec l'IA</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ATTESTATION PICKER MODAL -->
    <div v-if="showAttPicker" class="modal-overlay" @click.self="showAttPicker = false">
      <div class="modal" style="width:600px;">
        <div class="modal-title">Sélectionner les attestations de référence</div>
        <div class="modal-sub">Pièces jointes de {{ form.jiraKeyCompetence }}</div>
        <div class="att-list">
          <div v-for="att in selectedCompetence?.attachments" :key="att.id" class="att-item" :class="{ sel: selectedAttIds.includes(att.id) }" @click="toggleAtt(att)">
            <div class="att-icon">{{ attIcon(att.mimeType) }}</div>
            <div class="att-info">
              <div class="att-name">{{ att.filename }}</div>
              <div class="att-meta">{{ (att.size / 1024).toFixed(0) }} Ko · {{ att.mimeType }}</div>
            </div>
          </div>
        </div>
        <div class="text-mono mt8">{{ selectedAttIds.length }} attestation(s) sélectionnée(s)</div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showAttPicker = false">Annuler</button>
          <button class="btn btn-primary" :disabled="!selectedAttIds.length || aiLoading.att" @click="analyzeAttestations">
            <span v-if="aiLoading.att" class="spinner"></span>
            <span v-else>◈ Analyser</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'

const showNotif = inject('showNotif')
const route = useRoute()
const router = useRouter()

const programs = ref([])
const selectedProgramCode = ref('')
const currentProgram = ref(null)
const step = ref(0)
const refType = ref('SOLUTION')
const selectedCategory = ref(null)
const evalId = ref(null)

const form = ref({ prestataire: '', solution: '', actionLabel: '', jiraKeyPrestataire: '', jiraKeyIntervenant: '', jiraKeyCompetence: '', modules: [], origine: '', nature: '', modeAcquisition: '', secteur: '', rapporteur: '', dateDemo: '', finalDecision: '', conditions: '', commissionComments: '', decisionDate: '' })
const cvFields = ref({ diplome: '', etablissement: '', exp: 0, expSol: 0, poste: '', equipe: 1, certif: '', refs: '' })
const solScores = ref({})
const solObs = ref({})
const intScores = ref({})
const intObs = ref({})
const aiTexts = ref({ briefing: '', cv: '', attestations: '', coherence: '', pv: '' })
const aiLoading = ref({ briefing: false, cv: false, att: false, coherence: false, pv: false })
const moduleInput = ref('')
const jiraHierarchy = ref(null)
const selectedIntervenant = ref(null)
const selectedCompetence = ref(null)
const showCVPicker = ref(false)
const showAttPicker = ref(false)
const cvSource = ref('jira')
const selectedCVAttIds = ref([])
const uploadedCVFiles = ref([])
const selectedAttIds = ref([])
const submitting = ref(false)
const extractedIntervenant = ref(null)
const extractedCompetence = ref(null)
const extractLoading = ref({ intervenant: false, competence: false })
const showRawIntervenant = ref(false)
const showRawCompetence = ref(false)

const verdictLabel = { FAVORABLE: 'Favorable ✓', CONDITIONNEL: 'Conditionnel', DEFAVORABLE: 'Défavorable ✗' }
const steps = ['Type & Catégorie', 'Dossier', 'Grille évaluation', 'Intégrateur', 'Décision']

const currentCriteria = computed(() => {
  if (!currentProgram.value || !selectedCategory.value) return null
  if (refType.value === 'SOLUTION') return currentProgram.value.categories?.[selectedCategory.value]
  return currentProgram.value.actionTypes?.[selectedCategory.value]
})

const solScore = computed(() => {
  const crit = currentCriteria.value?.criteria || []
  let max = 0, score = 0, answered = 0
  crit.forEach((c, i) => {
    max += 2 * (c.w || 1)
    if (solScores.value[i] !== undefined) { score += solScores.value[i] * (c.w || 1); answered++ }
  })
  if (!answered) return { pct: null, verdict: null }
  const pct = Math.round(score / max * 100)
  return { pct, verdict: pct >= 60 ? 'FAVORABLE' : pct >= 45 ? 'CONDITIONNEL' : 'DEFAVORABLE' }
})

const intScore = computed(() => {
  const crit = currentProgram.value?.intCriteria || []
  let max = 0, score = 0, answered = 0
  crit.forEach((c, i) => {
    max += 2 * (c.w || 1)
    if (intScores.value[i] !== undefined) { score += intScores.value[i] * (c.w || 1); answered++ }
  })
  if (!answered) return { pct: null, verdict: null }
  const pct = Math.round(score / max * 100)
  return { pct, verdict: pct >= 55 ? 'FAVORABLE' : pct >= 40 ? 'CONDITIONNEL' : 'DEFAVORABLE' }
})

const globalScore = computed(() => {
  if (solScore.value.pct === null || intScore.value.pct === null) return null
  return Math.round(solScore.value.pct * 0.6 + intScore.value.pct * 0.4)
})

const finalDecision = computed(() => {
  if (globalScore.value === null) return null
  const s = solScore.value.pct, i = intScore.value.pct, g = globalScore.value
  if (g >= 60 && s >= 60 && i >= 55) return 'REFERENCE'
  if (g >= 48) return 'CONDITIONNEL'
  return 'REJETE'
})

onMounted(async () => {
  const { data } = await api.get('/programs')
  programs.value = data.filter(p => p.active)
  if (route.query.jiraKey) {
    form.value.jiraKeyPrestataire = route.query.jiraKey
    await loadJiraHierarchy()
  }
  if (route.params.id) loadEval(route.params.id)
})

async function onProgramChange() {
  if (!selectedProgramCode.value) { currentProgram.value = null; return }
  const { data } = await api.get(`/programs/${selectedProgramCode.value}`)
  currentProgram.value = data
}

async function loadEval(id) {
  const { data } = await api.get(`/evaluations/${id}`)
  evalId.value = id
  form.value = { ...form.value, ...data }
  solScores.value = data.solScores || {}
  solObs.value = data.solObservations || {}
  intScores.value = data.intScores || {}
  intObs.value = data.intObservations || {}
  aiTexts.value.pv = data.pvText || ''
  aiTexts.value.cv = data.cvAnalysis || ''
  aiTexts.value.attestations = data.attestationsAnalysis || ''
  selectedProgramCode.value = data.program?.code
  await onProgramChange()
  refType.value = data.referenceType
  selectedCategory.value = data.category || data.actionDomain
  step.value = 4
}

function goStep(n) { step.value = n; window.scrollTo(0, 0) }

async function saveAndGo(n) {
  await saveEval()
  goStep(n)
}

async function saveEval() {
  const payload = {
    programId: currentProgram.value?.id,
    referenceType: refType.value,
    category: refType.value === 'SOLUTION' ? selectedCategory.value : null,
    actionDomain: refType.value === 'ACTION' ? selectedCategory.value : null,
    ...form.value,
    solScores: solScores.value,
    solObservations: solObs.value,
    intScores: intScores.value,
    intObservations: intObs.value,
    cvAnalysis: aiTexts.value.cv,
    attestationsAnalysis: aiTexts.value.attestations,
    briefingText: aiTexts.value.briefing,
    coherenceCheck: aiTexts.value.coherence,
    pvText: aiTexts.value.pv,
    finalDecision: finalDecision.value
  }
  if (evalId.value) {
    await api.put(`/evaluations/${evalId.value}`, payload)
  } else {
    const { data } = await api.post('/evaluations', payload)
    evalId.value = data.id
  }
}

let solSaveTimer = null
function scheduleSolSave() { if (solSaveTimer) clearTimeout(solSaveTimer); solSaveTimer = setTimeout(saveEval, 2000) }
let intSaveTimer = null
function scheduleIntSave() { if (intSaveTimer) clearTimeout(intSaveTimer); intSaveTimer = setTimeout(saveEval, 2000) }

function setSolScore(i, v) { solScores.value = { ...solScores.value, [i]: v }; saveEval() }
function setIntScore(i, v) { intScores.value = { ...intScores.value, [i]: v }; saveEval() }

function autoScore() {
  const d = (cvFields.value.diplome || '').toLowerCase()
  const e = Number(cvFields.value.exp || 0)
  const es = Number(cvFields.value.expSol || 0)
  const eq = Number(cvFields.value.equipe || 0)
  const s = {}
  s[0] = (d.includes('ingénieur') || d.includes('bac+5') || d.includes('master')) ? 2 : (d.includes('bac+3') || d.includes('bac+4') || d.includes('licence')) ? 1 : 0
  s[1] = e >= 10 ? 2 : e >= 5 ? 1 : 0
  s[2] = es >= 5 ? 2 : es >= 2 ? 1 : 0
  s[5] = eq >= 5 ? 2 : eq >= 2 ? 1 : 0
  intScores.value = { ...intScores.value, ...s }
}

function addModule() { if (moduleInput.value.trim()) { form.value.modules = [...(form.value.modules || []), moduleInput.value.trim()]; moduleInput.value = '' } }
function removeModule(i) { form.value.modules = form.value.modules.filter((_, idx) => idx !== i) }

async function loadJiraHierarchy() {
  if (!form.value.jiraKeyPrestataire) return
  try {
    const { data } = await api.get(`/dossiers/${form.value.jiraKeyPrestataire}/intervenants`)
    jiraHierarchy.value = data
    form.value.prestataire = form.value.prestataire || data.summary
  } catch {}
}

async function selectIntervenant(int) {
  form.value.jiraKeyIntervenant = int.key
  selectedIntervenant.value = int
  selectedCVAttIds.value = []
  extractedIntervenant.value = null
  extractLoading.value.intervenant = true
  try {
    const { data } = await api.get(`/dossiers/${int.key}/extract-intervenant`)
    const p = data.parsed
    extractedIntervenant.value = {
      nom: p.nom || '',
      prenom: p.prenom || '',
      cin: p.cin || '',
      gsm: p.gsm || '',
      email: p.email || '',
      typeFormation: p.typeFormation || '',
      niveauFormation: p.niveauFormation || '',
      permanent: p.permanent || '',
      _raw: data.allCustomFields
    }
    syncIntervenantToForm()
  } catch (e) {
    showNotif('Extraction intervenant partielle: ' + (e.response?.data?.error || e.message), 'warn')
    extractedIntervenant.value = { nom: '', prenom: '', cin: '', gsm: '', email: '', typeFormation: '', niveauFormation: '', permanent: '', _raw: {} }
  } finally {
    extractLoading.value.intervenant = false
  }
}

async function selectCompetence(comp) {
  form.value.jiraKeyCompetence = comp.key
  selectedCompetence.value = comp
  selectedAttIds.value = []
  extractedCompetence.value = null
  extractLoading.value.competence = true
  try {
    const { data } = await api.get(`/dossiers/${comp.key}/extract-competence`)
    const p = data.parsed
    extractedCompetence.value = {
      typeAction: p.typeAction || '',
      action: p.action || '',
      profil: p.profil || '',
      secteurs: toStringList(p.secteurs),
      domaine: p.domaine || '',
      solutionsInformatiques: toArray(p.solutionsInformatiques),
      autreSolution: p.autreSolution || '',
      modulesInformatiques: toArray(p.modulesInformatiques),
      _raw: data.allCustomFields
    }
    syncCompetenceToForm()
  } catch (e) {
    showNotif('Extraction compétence partielle: ' + (e.response?.data?.error || e.message), 'warn')
    extractedCompetence.value = { typeAction: '', action: '', profil: '', secteurs: '', domaine: '', solutionsInformatiques: [], autreSolution: '', modulesInformatiques: [], _raw: {} }
  } finally {
    extractLoading.value.competence = false
  }
}

function toArray(v) {
  if (!v) return []
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  if (typeof v === 'string') return v.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
  return [String(v)]
}

function toStringList(v) {
  if (!v) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function syncIntervenantToForm() {
  if (!extractedIntervenant.value) return
  const iv = extractedIntervenant.value
  if (iv.niveauFormation && !cvFields.value.diplome) cvFields.value.diplome = iv.niveauFormation
  if (iv.typeFormation && !cvFields.value.poste) cvFields.value.poste = iv.typeFormation
}

function syncCompetenceToForm() {
  if (!extractedCompetence.value) return
  const cv = extractedCompetence.value
  if (cv.action && !form.value.actionLabel) form.value.actionLabel = cv.action
  if (cv.secteurs && !form.value.secteur) form.value.secteur = cv.secteurs
  if (cv.autreSolution && !form.value.solution) form.value.solution = cv.autreSolution
}

function selectSolution(sol) {
  form.value.solution = sol
}

function toggleModule(mod) {
  const mods = [...(form.value.modules || [])]
  const idx = mods.indexOf(mod)
  if (idx >= 0) mods.splice(idx, 1)
  else mods.push(mod)
  form.value.modules = mods
}

function toggleAtt(att) {
  const idx = selectedAttIds.value.indexOf(att.id)
  if (idx >= 0) selectedAttIds.value.splice(idx, 1)
  else selectedAttIds.value.push(att.id)
}

async function generateBriefing() {
  aiLoading.value.briefing = true
  try {
    const { data } = await api.post('/ai/briefing', { prestataire: form.value.prestataire, solution: form.value.solution || form.value.actionLabel, category: selectedCategory.value, modules: form.value.modules, programCode: selectedProgramCode.value })
    aiTexts.value.briefing = data.text
    await saveEval()
  } catch (e) { showNotif(e.response?.data?.error || 'Erreur IA', 'err') }
  finally { aiLoading.value.briefing = false }
}

function toggleCVAtt(att) {
  const idx = selectedCVAttIds.value.indexOf(att.id)
  if (idx >= 0) selectedCVAttIds.value.splice(idx, 1)
  else selectedCVAttIds.value.push(att.id)
}

function onCVFileChange(e) {
  for (const f of e.target.files) uploadedCVFiles.value.push(f)
  e.target.value = ''
}

function onCVDrop(e) {
  for (const f of e.dataTransfer.files) uploadedCVFiles.value.push(f)
}

function removeUploadedCV(i) {
  uploadedCVFiles.value.splice(i, 1)
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function analyzeCV() {
  aiLoading.value.cv = true
  showCVPicker.value = false
  try {
    let filesData = []
    if (cvSource.value === 'jira') {
      const atts = (selectedIntervenant.value?.attachments || []).filter(a => selectedCVAttIds.value.includes(a.id))
      filesData = await Promise.all(atts.map(async att => {
        const { data: buf } = await api.get(`/dossiers/${form.value.jiraKeyIntervenant}/attachment/${att.id}`, { responseType: 'arraybuffer' })
        return { base64: arrayBufferToBase64(buf), mimeType: att.mimeType, filename: att.filename }
      }))
    } else {
      filesData = await Promise.all(uploadedCVFiles.value.map(async f => ({
        base64: await fileToBase64(f),
        mimeType: f.type || 'application/octet-stream',
        filename: f.name
      })))
    }
    const { data } = await api.post('/ai/analyze-cv', { filesData, prestataire: form.value.prestataire, solution: form.value.solution, programCode: selectedProgramCode.value })
    aiTexts.value.cv = data.text
    await saveEval()
    showNotif('CV analysé', 'ok')
  } catch (e) { showNotif('Erreur analyse CV: ' + (e.response?.data?.error || e.message), 'err') }
  finally { aiLoading.value.cv = false }
}

async function analyzeAttestations() {
  aiLoading.value.att = true
  showAttPicker.value = false
  try {
    const atts = selectedCompetence.value.attachments.filter(a => selectedAttIds.value.includes(a.id))
    const images = await Promise.all(atts.map(async att => {
      const { data: buf } = await api.get(`/dossiers/${form.value.jiraKeyCompetence}/attachment/${att.id}`, { responseType: 'arraybuffer' })
      return arrayBufferToBase64(buf)
    }))
    const { data } = await api.post('/ai/analyze-attestations', { imageBase64List: images, solution: form.value.solution, intervenant: form.value.jiraKeyIntervenant })
    aiTexts.value.attestations = data.text
    await saveEval()
    showNotif('Attestations analysées', 'ok')
  } catch (e) { showNotif('Erreur: ' + (e.response?.data?.error || e.message), 'err') }
  finally { aiLoading.value.att = false }
}

async function autoFill() {
  try {
    const { data } = await api.post('/ai/auto-fill', { cvAnalysis: aiTexts.value.cv, programCode: selectedProgramCode.value })
    if (data) {
      if (data.diplome) cvFields.value.diplome = data.diplome
      if (data.etablissement) cvFields.value.etablissement = data.etablissement
      if (data.exp) cvFields.value.exp = data.exp
      if (data.expSol) cvFields.value.expSol = data.expSol
      if (data.poste) cvFields.value.poste = data.poste
      if (data.certif) cvFields.value.certif = data.certif
      if (data.intScores) intScores.value = { ...intScores.value, ...data.intScores }
      showNotif('Dossier pré-rempli depuis le CV', 'ok')
    }
  } catch (e) { showNotif('Erreur auto-fill', 'err') }
}

async function checkCoherence() {
  aiLoading.value.coherence = true
  try {
    const { data } = await api.post('/ai/check-coherence', { category: selectedCategory.value, criteria: currentCriteria.value?.criteria || [], solScores: solScores.value, solObs: solObs.value })
    aiTexts.value.coherence = data.text
  } catch (e) { showNotif('Erreur: ' + (e.response?.data?.error || e.message), 'err') }
  finally { aiLoading.value.coherence = false }
}

async function generatePV() {
  aiLoading.value.pv = true
  try {
    const { data } = await api.post('/ai/generate-pv', { prestataire: form.value.prestataire, solution: form.value.solution || form.value.actionLabel, category: selectedCategory.value, solScorePct: solScore.value.pct, intScorePct: intScore.value.pct, finalScorePct: globalScore.value, finalDecision: finalDecision.value, solVerdict: solScore.value.verdict, intVerdict: intScore.value.verdict, decisionMotive: form.value.commissionComments, conditions: form.value.conditions, modules: form.value.modules, programName: currentProgram.value?.name })
    aiTexts.value.pv = data.text
    await saveEval()
  } catch (e) { showNotif('Erreur génération PV', 'err') }
  finally { aiLoading.value.pv = false }
}

async function copyPV() { await navigator.clipboard.writeText(aiTexts.value.pv); showNotif('PV copié', 'ok') }

async function submitEval() {
  submitting.value = true
  try {
    await saveEval()
    await api.post(`/evaluations/${evalId.value}/submit`)
    showNotif('Évaluation soumise avec succès', 'ok')
    setTimeout(() => router.push('/consultation'), 1500)
  } catch (e) { showNotif('Erreur soumission: ' + (e.response?.data?.error || e.message), 'err') }
  finally { submitting.value = false }
}

function exportPDF() {
  const content = `PROCÈS-VERBAL DE COMMISSION DE RÉFÉRENCEMENT\n${currentProgram.value?.name}\n\nPrestataire : ${form.value.prestataire}\nSolution : ${form.value.solution || form.value.actionLabel || '—'}\nScore solution : ${solScore.value.pct ?? '—'}%\nScore intégrateur : ${intScore.value.pct ?? '—'}%\nScore global : ${globalScore.value ?? '—'}%\nDécision : ${{ REFERENCE: 'Référencé', CONDITIONNEL: 'Conditionnel', REJETE: 'Rejeté' }[finalDecision.value] || '—'}\n\n${aiTexts.value.pv || ''}`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `PV_${form.value.prestataire}_${new Date().toISOString().slice(0, 10)}.txt`
  a.click(); URL.revokeObjectURL(url)
}

function scoreClass(pct, t1, t2) { if (pct === null) return ''; return pct >= t1 ? 'ok' : pct >= t2 ? 'mid' : 'ko' }
function progressColor(pct, t1, t2) { if (!pct) return '#666'; return pct >= t1 ? '#4ADE80' : pct >= t2 ? '#FBB424' : '#F87171' }
function attIcon(mime) { if (!mime) return '📎'; if (mime.includes('pdf')) return '📄'; if (mime.includes('image')) return '🖼️'; if (mime.includes('word')) return '📝'; return '📎' }
</script>
