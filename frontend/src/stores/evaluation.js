import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useEvaluationStore = defineStore('evaluation', () => {
  const current = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const autoSaveTimer = ref(null)

  // Computed scores
  const solScorePct = computed(() => current.value?.solScorePct ?? null)
  const intScorePct = computed(() => current.value?.intScorePct ?? null)
  const finalScorePct = computed(() => current.value?.finalScorePct ?? null)

  async function create(payload) {
    loading.value = true
    try {
      const { data } = await api.post('/evaluations', payload)
      current.value = data
      return data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function load(id) {
    loading.value = true
    try {
      const { data } = await api.get(`/evaluations/${id}`)
      current.value = data
      return data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function save(patch) {
    if (!current.value?.id) return
    const { data } = await api.put(`/evaluations/${current.value.id}`, patch)
    current.value = data
    return data
  }

  function scheduleSave(patch) {
    if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = setTimeout(() => save(patch), 1500)
  }

  async function submit() {
    if (!current.value?.id) return
    loading.value = true
    try {
      const { data } = await api.post(`/evaluations/${current.value.id}/submit`)
      current.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  function reset() {
    if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
    current.value = null
    error.value = null
  }

  return { current, loading, error, solScorePct, intScorePct, finalScorePct, create, load, save, scheduleSave, submit, reset }
})
