import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('access_token') || null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const role = computed(() => user.value?.role || null)
  const isAdmin = computed(() => role.value === 'ADMIN')
  const isGestionnaire = computed(() => ['ADMIN', 'GESTIONNAIRE'].includes(role.value))
  const isParticipant = computed(() => !!role.value)

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    token.value = data.accessToken
    user.value = data.user
    localStorage.setItem('access_token', data.accessToken)
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {})
    token.value = null
    user.value = null
    localStorage.removeItem('access_token')
  }

  async function fetchMe() {
    // Tente d'abord un refresh silencieux si on a un cookie refresh token
    // même sans access token valide, pour éviter les déconnexions intempestives
    try {
      if (!token.value) {
        // Pas de token en localStorage — tenter un refresh depuis le cookie
        const { data: refreshData } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        setToken(refreshData.accessToken)
      }
      const { data } = await api.get('/auth/me')
      user.value = data
    } catch {
      // Le refresh a échoué → vraie déconnexion
      token.value = null
      user.value = null
      localStorage.removeItem('access_token')
    }
  }

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('access_token', newToken)
  }

  return { user, token, isAuthenticated, role, isAdmin, isGestionnaire, isParticipant, login, logout, fetchMe, setToken }
})
