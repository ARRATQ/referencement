<template>
  <div class="ai-blocks">
    <template v-for="(b, i) in blocks" :key="i">
      <div v-if="b.type === 'table'" class="ai-md-table-wrap">
        <table class="ai-md-table">
          <thead>
            <tr><th v-for="(h, j) in b.rows[0]" :key="j">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in b.rows.slice(1)" :key="ri">
              <td v-for="(c, ci) in r" :key="ci">{{ c }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="ai-block-text">{{ b.text }}</div>
    </template>
  </div>
</template>

<script setup>
defineProps({ blocks: { type: Array, default: () => [] } })
</script>

<style scoped>
.ai-block-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-md-table-wrap {
  overflow-x: auto;
  margin: 8px 0;
}

.ai-md-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.85em;
}

.ai-md-table th,
.ai-md-table td {
  border: 1px solid var(--border, rgba(255,255,255,0.15));
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}

.ai-md-table th {
  background: rgba(255,255,255,0.06);
  font-family: var(--mono);
  font-size: 0.9em;
}
</style>
