<template>
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--paper); padding:24px;">
    <div style="width:100%; max-width:400px;">
      <div style="text-align:center; margin-bottom:24px;">
        <div style="font-family:var(--mono); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink3);">Commission de Référencement</div>
        <div style="font-size:23px; font-weight:600; color:var(--ink); margin-top:8px; letter-spacing:-0.01em;">Maroc PME</div>
        <div style="font-size:13px; color:var(--ink2); margin-top:4px;">Espace de connexion</div>
      </div>
      <div style="background:var(--surface); border:1px solid var(--line); border-radius:var(--r2); box-shadow:var(--shadow); padding:32px;">
        <form @submit.prevent="doLogin">
          <div class="field" style="margin-bottom:16px;">
            <label>Email</label>
            <input v-model="email" type="email" placeholder="votre@email.com" autocomplete="email" required />
          </div>
          <div class="field" style="margin-bottom:24px;">
            <label>Mot de passe</label>
            <input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
          </div>
          <div v-if="err" style="color:var(--red); font-size:12px; margin-bottom:16px; font-family:var(--mono);">{{ err }}</div>
          <button class="btn btn-primary" style="width:100%; justify-content:center;" type="submit" :disabled="loading">
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
