<template>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg);">
    <div style="width:400px; padding:40px;">
      <div style="text-align:center; margin-bottom:32px;">
        <div style="font-size:11px; font-family:var(--mono); color:var(--text3); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px;">Maroc PME</div>
        <div style="font-size:20px; font-weight:600; color:var(--text);">Commission de Référencement</div>
        <div style="font-size:12px; color:var(--text3); margin-top:4px; font-family:var(--mono);">v2.0</div>
      </div>
      <div class="card">
        <div class="card-title">Connexion</div>
        <form @submit.prevent="doLogin">
          <div class="field" style="margin-bottom:12px;">
            <label>Email</label>
            <input v-model="email" type="email" placeholder="votre@email.com" autocomplete="email" required />
          </div>
          <div class="field" style="margin-bottom:20px;">
            <label>Mot de passe</label>
            <input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
          </div>
          <div v-if="err" style="color:var(--red); font-size:12px; margin-bottom:12px; font-family:var(--mono);">{{ err }}</div>
          <button class="btn btn-primary" style="width:100%;" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>Se connecter</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const err = ref('')

async function doLogin() {
  err.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (e) {
    err.value = e.response?.data?.error || 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}
</script>
