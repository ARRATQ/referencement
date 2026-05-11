<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="org">Maroc PME</div>
        <div class="app-name">Commission de Référencement</div>
        <div class="version">v2.0 — Multi-programmes</div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">Navigation</div>
        <RouterLink class="nav-item" to="/" exact-active-class="active">
          <span class="icon">◈</span> Tableau de bord
        </RouterLink>
        <RouterLink v-if="auth.isGestionnaire" class="nav-item" to="/dossiers" active-class="active">
          <span class="icon">⊞</span> Dossiers Jira
        </RouterLink>
        <RouterLink v-if="auth.isGestionnaire" class="nav-item" to="/evaluation" active-class="active">
          <span class="icon">◉</span> Nouvelle évaluation
        </RouterLink>
        <RouterLink class="nav-item" to="/consultation" active-class="active">
          <span class="icon">📋</span> Consultation
        </RouterLink>
        <template v-if="auth.isAdmin">
          <div class="nav-section">Administration</div>
          <RouterLink class="nav-item" to="/admin" active-class="active">
            <span class="icon">⚙</span> Administration
          </RouterLink>
        </template>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <strong>{{ auth.user?.name }}</strong>
          <span class="user-role-badge" :class="`role-${auth.role}`">{{ roleLabel }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%; margin-top:8px;" @click="logout">Déconnexion</button>
      </div>
    </aside>
    <div class="main">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const roleLabel = computed(() => ({
  ADMIN: 'Admin', GESTIONNAIRE: 'Gestionnaire', PARTICIPANT: 'Participant'
}[auth.role] || auth.role))

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>
