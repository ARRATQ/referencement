<template>
  <div class="step-contexte">
    <div class="wiz-step-header">
      <h2 class="wiz-step-title">Contexte de l'évaluation</h2>
      <p class="wiz-step-desc">Sélectionnez le programme, le type de référencement et la catégorie.</p>
    </div>

    <!-- Programme -->
    <div class="wiz-section">
      <div class="wiz-section-label">Programme</div>
      <div v-if="programs.length === 0" class="wiz-empty">Chargement des programmes…</div>
      <div class="prog-grid">
        <div
          v-for="p in programs"
          :key="p.code"
          class="prog-card"
          :class="{ active: state.programCode === p.code }"
          @click="selectProgram(p.code)"
        >
          <div class="prog-name">{{ p.name }}</div>
          <div class="prog-meta">{{ p.version }}</div>
        </div>
      </div>
    </div>

    <!-- Type de référencement -->
    <div class="wiz-section" v-if="state.programCode">
      <div class="wiz-section-label">Type de référencement</div>
      <div class="type-grid">
        <button class="type-card" :class="{ active: state.refType === 'SOLUTION' }" @click="selectType('SOLUTION')">
          <div class="type-icon">💻</div>
          <div class="type-label">Solution informatique</div>
          <div class="type-sub">ERP, CRM, GPAO, RH, GED…</div>
        </button>
        <button class="type-card" :class="{ active: state.refType === 'ACTION' }" @click="selectType('ACTION')">
          <div class="type-icon">🎓</div>
          <div class="type-label">Action</div>
          <div class="type-sub">Formation, normalisation, conseil…</div>
        </button>
      </div>
    </div>

    <!-- Catégorie / Domaine -->
    <div class="wiz-section" v-if="state.programCode && state.refType && Object.keys(categoryMap).length">
      <div class="wiz-section-label">
        {{ state.refType === 'SOLUTION' ? 'Catégorie de solution' : "Domaine d'action" }}
      </div>
      <div class="cat-grid">
        <div
          v-for="(cat, key) in categoryMap"
          :key="key"
          class="cat-card"
          :class="{ active: state.selectedCategory === key }"
          @click="state.selectedCategory = key"
        >
          <div class="cat-icon">{{ cat.icon }}</div>
          <div class="cat-name">{{ cat.label }}</div>
          <div v-if="cat.ex" class="cat-ex">{{ cat.ex }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const { state, programs, currentProgram } = inject('wizard')

const categoryMap = computed(() => {
  if (!currentProgram.value) return {}
  return state.refType === 'SOLUTION'
    ? currentProgram.value.categories || {}
    : currentProgram.value.actionTypes || {}
})

function selectProgram(code) {
  state.programCode = code
  state.selectedCategory = null
}

function selectType(type) {
  state.refType = type
  state.selectedCategory = null
}
</script>

<style scoped>
.step-contexte { color: var(--wiz-text); }
.wiz-step-header { margin-bottom: 32px; }
.wiz-step-title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
.wiz-step-desc { color: var(--wiz-text2); font-size: 14px; }
.wiz-section { margin-bottom: 32px; }
.wiz-section-label {
  font-size: 11px; font-family: var(--mono); color: var(--wiz-text3);
  text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px;
}
.wiz-empty { color: var(--wiz-text3); font-size: 13px; font-family: var(--mono); padding: 12px 0; }

.prog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.prog-card {
  padding: 18px 20px; background: var(--wiz-card); border: 1px solid var(--wiz-border);
  border-radius: 8px; cursor: pointer; transition: all 0.15s;
}
.prog-card:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); }
.prog-card.active { border-color: var(--wiz-accent); background: rgba(27,58,107,0.12); }
.prog-name { font-weight: 600; font-size: 14px; color: var(--wiz-text); }
.prog-meta { font-size: 11px; color: var(--wiz-text3); font-family: var(--mono); margin-top: 4px; }

.type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 560px; }
.type-card {
  padding: 24px; background: var(--wiz-card); border: 1px solid var(--wiz-border);
  border-radius: 10px; cursor: pointer; text-align: left; color: var(--wiz-text);
  transition: all 0.15s; display: flex; flex-direction: column; gap: 6px;
}
.type-card:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); }
.type-card.active { border-color: var(--wiz-accent); background: rgba(27,58,107,0.12); }
.type-icon { font-size: 28px; margin-bottom: 6px; }
.type-label { font-size: 15px; font-weight: 600; }
.type-sub { font-size: 12px; color: var(--wiz-text2); }

.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.cat-card {
  padding: 18px 14px; background: var(--wiz-card); border: 1px solid var(--wiz-border);
  border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.15s;
}
.cat-card:hover { border-color: rgba(var(--wiz-overlay-rgb),0.2); }
.cat-card.active { border-color: var(--wiz-accent); background: rgba(27,58,107,0.12); }
.cat-icon { font-size: 26px; margin-bottom: 8px; }
.cat-name { font-size: 13px; font-weight: 500; color: var(--wiz-text); }
.cat-ex { font-size: 11px; color: var(--wiz-text2); margin-top: 4px; }
</style>
