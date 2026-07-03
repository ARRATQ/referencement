<template>
  <div class="ai-text">
    <div v-if="!hasText" class="ai-text-empty">{{ placeholder }}</div>

    <template v-else-if="hasSynthesis">
      <div class="ai-synth">
        <div class="ai-synth-label">◈ Synthèse</div>
        <AiBlocks :blocks="synthBlocks" />
      </div>
      <button type="button" class="ai-detail-toggle" @click="showDetail = !showDetail">
        {{ showDetail ? '▴ Masquer le détail' : '▾ Voir le détail complet' }}
      </button>
      <div v-if="showDetail" class="ai-detail">
        <AiBlocks :blocks="detailBlocks" />
      </div>
    </template>

    <AiBlocks v-else :blocks="detailBlocks" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AiBlocks from './AiBlocks.vue'

const props = defineProps({
  text: { type: String, default: '' },
  placeholder: { type: String, default: '' }
})

const showDetail = ref(false)

const hasText = computed(() => !!(props.text || '').trim())

// Les analyses IA sont structurées par le backend avec ===SYNTHESE=== / ===DETAIL===.
// Les textes générés avant cette convention n'ont pas de balises : affichage complet direct.
const parsed = computed(() => {
  const t = (props.text || '').trim()
  const m = t.match(/===\s*SYNTHESE\s*===\s*([\s\S]*?)\s*===\s*DETAIL\s*===\s*([\s\S]*)/i)
  if (m) return { synthesis: m[1].trim(), detail: m[2].trim() }
  return { synthesis: '', detail: t }
})

const hasSynthesis = computed(() => !!parsed.value.synthesis)
const synthBlocks = computed(() => toBlocks(parsed.value.synthesis))
const detailBlocks = computed(() => toBlocks(parsed.value.detail))

function cleanInline(s) {
  return s.replace(/\*\*/g, '').replace(/`/g, '')
}

function cleanTextLine(line) {
  return cleanInline(line.replace(/^#{1,6}\s+/, ''))
}

// Découpe le texte en segments : tableaux markdown (lignes |...|) et blocs de texte.
function toBlocks(text) {
  const blocks = []
  let buf = []
  let table = null
  const flushText = () => {
    const t = buf.join('\n').replace(/^\n+|\n+$/g, '')
    if (t.trim()) blocks.push({ type: 'text', text: t })
    buf = []
  }
  const flushTable = () => {
    if (table && table.rows.length) blocks.push(table)
    table = null
  }
  for (const line of (text || '').split('\n')) {
    const t = line.trim()
    if (t.startsWith('|') && t.endsWith('|') && t.length > 2) {
      if (!table) { flushText(); table = { type: 'table', rows: [] } }
      const cells = t.slice(1, -1).split('|').map(c => cleanInline(c.trim()))
      const isSeparator = cells.every(c => /^:?-{2,}:?$/.test(c) || c === '')
      if (!isSeparator) table.rows.push(cells)
      continue
    }
    flushTable()
    buf.push(cleanTextLine(line))
  }
  flushTable()
  flushText()
  return blocks
}
</script>

<style scoped>
/* --wiz-* pris en priorité (contexte wizard), fallback sur --* (consultation/dark) */
.ai-text-empty {
  color: var(--wiz-text3, var(--text3, rgba(255,255,255,0.4)));
  font-size: 12px;
  font-family: var(--mono);
}

.ai-synth {
  background: rgba(59, 130, 246, 0.07);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-left: 3px solid var(--wiz-accent, var(--accent, #3b82f6));
  border-radius: 6px;
  padding: 12px 14px;
}

.ai-synth-label {
  font-size: 9px;
  font-family: var(--mono);
  color: var(--wiz-accent, var(--accent, #3b82f6));
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin-bottom: 8px;
}

.ai-detail-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 5px 12px;
  background: none;
  border: 1px solid var(--wiz-border, var(--border, rgba(255,255,255,0.15)));
  border-radius: var(--radius, 6px);
  font-size: 11px;
  font-family: var(--mono);
  color: var(--wiz-text3, var(--text3, rgba(255,255,255,0.4)));
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.ai-detail-toggle:hover {
  color: var(--wiz-accent, var(--accent, #3b82f6));
  border-color: var(--wiz-accent, var(--accent, #3b82f6));
}

.ai-detail {
  margin-top: 8px;
  padding: 14px 16px;
  border: 1px solid var(--wiz-border, var(--border, rgba(255,255,255,0.15)));
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
  max-height: 460px;
  overflow-y: auto;
  scrollbar-width: thin;
}
</style>
