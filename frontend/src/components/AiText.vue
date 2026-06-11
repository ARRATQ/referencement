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
.ai-text-empty {
  color: var(--text3, rgba(255,255,255,0.4));
}

.ai-synth {
  border-left: 3px solid var(--accent, #6c8cff);
  padding-left: 10px;
}

.ai-synth-label {
  font-size: 10px;
  font-family: var(--mono);
  color: var(--accent, #6c8cff);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.ai-detail-toggle {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--border, rgba(255,255,255,0.15));
  border-radius: var(--radius, 6px);
  font-size: 11px;
  font-family: var(--mono);
  color: var(--text2, rgba(255,255,255,0.7));
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.ai-detail-toggle:hover {
  color: var(--accent, #6c8cff);
  border-color: var(--accent, #6c8cff);
}

.ai-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border, rgba(255,255,255,0.15));
}
</style>
