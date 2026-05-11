<template>
  <router-view v-if="isPublicRoute" />
  <AppShell v-else />
  <Teleport to="body">
    <div v-if="notif.show" class="notif" :class="notif.type">{{ notif.message }}</div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, provide, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { setupApi } from '@/services/api'
import AppShell from '@/components/AppShell.vue'

const route = useRoute()
const auth = useAuthStore()
const isPublicRoute = computed(() => route.meta.public)

const notif = ref({ show: false, message: '', type: '' })
let notifTimer = null

function showNotif(message, type = 'ok') {
  if (notifTimer) clearTimeout(notifTimer)
  notif.value = { show: true, message, type }
  notifTimer = setTimeout(() => { notif.value.show = false }, 3500)
}

provide('showNotif', showNotif)

setupApi({
  getToken: () => auth.token,
  onUnauth: () => auth.logout()
})

onMounted(() => auth.fetchMe())
</script>
