<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-logo">
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
        <RouterLink v-if="auth.isGestionnaire" class="nav-item" to="/intervenants" active-class="active">
          <span class="icon">👤</span> Évaluation intervenant
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
        <button class="btn btn-ghost btn-sm" style="width:100%; margin-top:8px;" @click="showPasswordModal = true">Changer le mot de passe</button>
        <button class="btn btn-ghost btn-sm" style="width:100%; margin-top:4px;" @click="logout">Déconnexion</button>
      </div>

      <!-- Modal changement mot de passe -->
      <Teleport to="body">
        <div v-if="showPasswordModal" class="modal-overlay" @click.self="closePasswordModal">
          <div class="modal">
            <h3 class="modal-title">Changer le mot de passe</h3>
            <form @submit.prevent="submitPasswordChange" style="margin-top:16px;">
              <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;color:var(--text3);margin-bottom:4px;">Mot de passe actuel</label>
                <input v-model="pwForm.current" type="password" required autocomplete="current-password" style="width:100%;" />
              </div>
              <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;color:var(--text3);margin-bottom:4px;">Nouveau mot de passe <span style="color:var(--text3)">(min. 8 caractères)</span></label>
                <input v-model="pwForm.next" type="password" required minlength="8" autocomplete="new-password" style="width:100%;" />
              </div>
              <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--text3);margin-bottom:4px;">Confirmer le nouveau mot de passe</label>
                <input v-model="pwForm.confirm" type="password" required autocomplete="new-password" style="width:100%;" />
              </div>
              <p v-if="pwError" style="color:var(--danger);font-size:12px;margin-bottom:12px;">{{ pwError }}</p>
              <p v-if="pwSuccess" style="color:var(--success,#22c55e);font-size:12px;margin-bottom:12px;">Mot de passe modifié avec succès.</p>
              <div class="modal-footer">
                <button type="button" class="btn btn-ghost btn-sm" @click="closePasswordModal">Annuler</button>
                <button type="submit" class="btn btn-primary btn-sm" :disabled="pwLoading">
                  {{ pwLoading ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Teleport>
    </aside>
    <div class="main">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

const auth = useAuthStore()
const router = useRouter()

const roleLabel = computed(() => ({
  ADMIN: 'Admin', GESTIONNAIRE: 'Gestionnaire', PARTICIPANT: 'Participant'
}[auth.role] || auth.role))

async function logout() {
  await auth.logout()
  router.push('/login')
}

const showPasswordModal = ref(false)
const pwLoading = ref(false)
const pwError = ref('')
const pwSuccess = ref(false)
const pwForm = reactive({ current: '', next: '', confirm: '' })

function closePasswordModal() {
  showPasswordModal.value = false
  pwError.value = ''
  pwSuccess.value = false
  pwForm.current = ''
  pwForm.next = ''
  pwForm.confirm = ''
}

async function submitPasswordChange() {
  pwError.value = ''
  pwSuccess.value = false
  if (pwForm.next !== pwForm.confirm) {
    pwError.value = 'Les nouveaux mots de passe ne correspondent pas.'
    return
  }
  pwLoading.value = true
  try {
    await api.put('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next })
    pwSuccess.value = true
    pwForm.current = ''
    pwForm.next = ''
    pwForm.confirm = ''
  } catch (err) {
    pwError.value = err.response?.data?.error || 'Une erreur est survenue.'
  } finally {
    pwLoading.value = false
  }
}
</script>
