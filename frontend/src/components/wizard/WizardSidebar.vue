<template>
  <aside class="wiz-sidebar">
    <div class="wiz-sidebar-header">
      <div class="wiz-logo-mark">◈</div>
      <div class="wiz-header-text">
        <div class="wiz-header-title">Nouvelle évaluation</div>
        <div class="wiz-header-sub">Wizard guidé</div>
      </div>
      <button class="wiz-close-btn" @click="$emit('close')" title="Fermer et sauvegarder">✕</button>
    </div>

    <div class="wiz-progress-wrap">
      <div class="wiz-progress-track">
        <div class="wiz-progress-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
      <div class="wiz-progress-label">{{ currentStep + 1 }} / {{ steps.length }}</div>
    </div>

    <nav class="wiz-steps-nav">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="wiz-step-item"
        :class="{
          'is-active': currentStep === i,
          'is-done': completedSteps.includes(i),
          'is-clickable': completedSteps.includes(i) && currentStep !== i
        }"
        @click="completedSteps.includes(i) && currentStep !== i ? $emit('go-step', i) : null"
      >
        <div class="wiz-step-num">
          <span v-if="completedSteps.includes(i)">✓</span>
          <span v-else>{{ i + 1 }}</span>
        </div>
        <div class="wiz-step-info">
          <div class="wiz-step-label">{{ step.label }}</div>
          <div class="wiz-step-sub">{{ step.sub }}</div>
        </div>
      </div>
    </nav>

    <div class="wiz-sidebar-footer">
      <div v-if="savedAt" class="wiz-saved-indicator">
        <span class="wiz-saved-dot"></span>
        Sauvegardé {{ savedAt }}
      </div>
      <div v-else class="wiz-saved-indicator wiz-saved-empty">
        Brouillon en cours
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, required: true },
  currentStep: { type: Number, required: true },
  completedSteps: { type: Array, default: () => [] },
  savedAt: { type: String, default: '' },
})

defineEmits(['go-step', 'close'])

const progressPct = computed(() => Math.round((props.currentStep / (props.steps.length - 1)) * 100))
</script>

<style scoped>
.wiz-sidebar {
  background: var(--wiz-sidebar);
  border-right: 1px solid var(--wiz-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wiz-sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--wiz-border);
}

.wiz-logo-mark { font-size: 20px; color: var(--wiz-accent); flex-shrink: 0; }
.wiz-header-text { flex: 1; min-width: 0; }
.wiz-header-title { font-size: 13px; font-weight: 600; color: var(--wiz-text); }
.wiz-header-sub { font-size: 11px; color: var(--wiz-text3); font-family: var(--mono); margin-top: 2px; }

.wiz-close-btn {
  background: none; border: none; color: var(--wiz-text3); cursor: pointer;
  font-size: 14px; padding: 4px; line-height: 1; flex-shrink: 0; transition: color 0.15s;
}
.wiz-close-btn:hover { color: var(--wiz-text); }

.wiz-progress-wrap {
  padding: 16px 20px 12px; border-bottom: 1px solid var(--wiz-border);
  display: flex; align-items: center; gap: 10px;
}

.wiz-progress-track {
  flex: 1; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;
}
.wiz-progress-fill {
  height: 100%; background: var(--wiz-accent); border-radius: 2px; transition: width 0.4s ease;
}
.wiz-progress-label { font-size: 11px; font-family: var(--mono); color: var(--wiz-text3); flex-shrink: 0; }

.wiz-steps-nav { flex: 1; padding: 12px 0; overflow-y: auto; }

.wiz-step-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 20px;
  border-left: 3px solid transparent; transition: all 0.15s; cursor: default;
}
.wiz-step-item.is-active { border-left-color: var(--wiz-accent); background: rgba(59,130,246,0.1); }
.wiz-step-item.is-done { opacity: 0.7; }
.wiz-step-item.is-clickable { cursor: pointer; opacity: 0.85; }
.wiz-step-item.is-clickable:hover { background: rgba(255,255,255,0.04); opacity: 1; }

.wiz-step-num {
  width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 11px; font-family: var(--mono); font-weight: 600;
  flex-shrink: 0; border: 1.5px solid var(--wiz-border); color: var(--wiz-text3); transition: all 0.15s;
}
.is-active .wiz-step-num { border-color: var(--wiz-accent); color: var(--wiz-accent); background: rgba(59,130,246,0.15); }
.is-done .wiz-step-num { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,0.1); }

.wiz-step-info { min-width: 0; }
.wiz-step-label { font-size: 13px; font-weight: 500; color: var(--wiz-text); }
.wiz-step-sub { font-size: 11px; color: var(--wiz-text3); margin-top: 2px; font-family: var(--mono); }
.is-active .wiz-step-label { color: #fff; }

.wiz-sidebar-footer { padding: 14px 20px; border-top: 1px solid var(--wiz-border); }
.wiz-saved-indicator {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-family: var(--mono); color: var(--wiz-text3);
}
.wiz-saved-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
.wiz-saved-empty { color: rgba(255,255,255,0.2); }
</style>
