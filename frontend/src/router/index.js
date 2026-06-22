import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  { path: '/', component: () => import('@/pages/DashboardPage.vue'), meta: { roles: ['ADMIN', 'GESTIONNAIRE', 'PARTICIPANT'] } },
  { path: '/dossiers', component: () => import('@/pages/DossiersPage.vue'), meta: { roles: ['GESTIONNAIRE', 'ADMIN'] } },
  { path: '/evaluation', component: () => import('@/pages/EvaluationPage.vue'), meta: { roles: ['GESTIONNAIRE', 'ADMIN'] } },
  { path: '/evaluation/:id', redirect: to => `/evaluations/${to.params.id}` },
  { path: '/consultation', component: () => import('@/pages/ConsultationPage.vue'), meta: { roles: ['PARTICIPANT', 'GESTIONNAIRE', 'ADMIN'] } },
  { path: '/evaluations/:id', component: () => import('@/pages/EvaluationDetailPage.vue'), meta: { roles: ['PARTICIPANT', 'GESTIONNAIRE', 'ADMIN'] } },
  { path: '/admin', component: () => import('@/pages/AdminPage.vue'), meta: { roles: ['ADMIN'] } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from) => {
  const auth = useAuthStore()

  if (to.meta.public) return true

  if (!auth.isAuthenticated) {
    await auth.fetchMe()
  }

  if (!auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    return auth.isGestionnaire ? { path: '/' } : { path: '/consultation' }
  }

  return true
})

export default router
