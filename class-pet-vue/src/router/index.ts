import { createRouter, createWebHistory } from 'vue-router'
import { getAuthToken } from '@/services/api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Login',
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/auth/RegisterView.vue'),
    },
    {
      path: '/forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
    },
    {
      path: '/dashboard/quick-score',
      name: 'QuickScore',
      component: () => import('@/views/QuickScoreView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'classes',
          name: 'Classes',
          component: () => import('@/views/ClassesView.vue'),
        },
        {
          path: 'students',
          name: 'Students',
          component: () => import('@/views/StudentsView.vue'),
        },
        {
          path: 'random-picker',
          name: 'RandomPicker',
          component: () => import('@/views/RandomPickerView.vue'),
        },
        {
          path: 'lucky-draw',
          name: 'LuckyDraw',
          component: () => import('@/views/LuckyDrawView.vue'),
        },
        {
          path: 'rewards',
          name: 'Rewards',
          component: () => import('@/views/RewardsView.vue'),
        },
        {
          path: 'pets',
          name: 'Pets',
          component: () => import('@/views/PetsView.vue'),
        },
        {
          path: 'badges',
          name: 'Badges',
          component: () => import('@/views/BadgesView.vue'),
        },
        {
          path: 'leaderboard',
          name: 'Leaderboard',
          component: () => import('@/views/LeaderboardView.vue'),
        },
        {
          path: 'ai-analysis',
          name: 'AiAnalysis',
          component: () => import('@/views/AiAnalysisView.vue'),
        },
        {
          path: 'action-logs',
          name: 'ActionLogs',
          component: () => import('@/views/ActionLogsView.vue'),
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(to => {
  if (to.meta.requiresAuth && !getAuthToken()) {
    return { path: '/', query: { redirect: to.fullPath } }
  }
  if ((to.path === '/' || to.path === '/register') && getAuthToken()) {
    return '/dashboard'
  }
})

export default router
