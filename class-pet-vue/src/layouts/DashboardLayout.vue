<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import { api, getStoredUser, logout } from '@/services/api'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const appStore = useAppStore()
const theme = computed(() => themeStore.theme)
const style = computed(() => themeStore.style)
const authUser = getStoredUser()

const showNotifications = ref(false)
const showUserMenu = ref(false)

interface NotificationItem {
  id: number
  type: 'pet_level_up' | 'pet_max_level' | 'badge_awarded' | 'stock_warning' | 'collaboration' | 'system'
  title: string
  message: string
  targetPath: string
  time: string
  read: boolean
}

const notifications = ref<NotificationItem[]>([])
const notificationCount = ref(0)
let notificationTimer: number | undefined
let unreadCountInitialized = false

const notificationEmoji: Record<NotificationItem['type'], string> = {
  pet_level_up: '🐾',
  pet_max_level: '🏆',
  badge_awarded: '🏅',
  stock_warning: '⚠️',
  collaboration: '👩‍🏫',
  system: '📢',
}

type NavigationPermission = 'score' | 'students' | 'config'
const navigation: Array<{ name: string; path: string; emoji: string; exact?: boolean; newWindow?: boolean; permission?: NavigationPermission }> = [
  { name: '学生墙', path: '/dashboard', emoji: '🏠', exact: true },
  { name: '班级管理', path: '/dashboard/classes', emoji: '📚' },
  { name: '学生管理', path: '/dashboard/students', emoji: '👨‍🎓', permission: 'students' },
  { name: '课堂模式', path: '/dashboard/quick-score', emoji: '⚡', newWindow: true, permission: 'score' },
  { name: '随机点名', path: '/dashboard/random-picker', emoji: '🎲' },
  { name: '幸运抽奖', path: '/dashboard/lucky-draw', emoji: '🎁' },
  { name: '排行榜', path: '/dashboard/leaderboard', emoji: '📊' },
  { name: '学情分析', path: '/dashboard/ai-analysis', emoji: '🧠' },
  { name: '小卖部', path: '/dashboard/rewards', emoji: '🏪', permission: 'score' },
  { name: '宠物分配', path: '/dashboard/pets', emoji: '🐾', permission: 'students' },
  { name: '徽章墙', path: '/dashboard/badges', emoji: '🏆' },
  { name: '操作日志', path: '/dashboard/action-logs', emoji: '🧾' },
  { name: '系统设置', path: '/dashboard/settings', emoji: '⚙️' },
]
const visibleNavigation = computed(() => navigation.filter(item => {
  if (!item.permission) return true
  if (authUser?.role === 'owner') return true
  if (item.permission === 'score') return appStore.currentClassPermissions.canScore
  if (item.permission === 'students') return appStore.currentClassPermissions.canManageStudents
  if (item.permission === 'config') return appStore.currentClassPermissions.canManageConfig
  return true
}))

function isActive(item: { path: string; exact?: boolean }) {
  if (item.exact) {
    return route.path === item.path
  }
  return route.path.startsWith(item.path)
}

function navigate(path: string) {
  router.push(path)
}

function openQuickScore() {
  window.open('/dashboard/quick-score', 'quick-score', 'width=420,height=700,resizable=yes,scrollbars=yes')
}

function handleNavigation(item: { path: string; newWindow?: boolean }) {
  if (item.newWindow) {
    openQuickScore()
  } else {
    navigate(item.path)
  }
}

function handleShortcut(event: KeyboardEvent) {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'q') {
    event.preventDefault()
    openQuickScore()
  }
}

async function loadNotifications() {
  try {
    notifications.value = await api<NotificationItem[]>('/notifications')
    notificationCount.value = notifications.value.filter(notification => !notification.read).length
  } catch (error) {
    appStore.addToast(`通知加载失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

async function loadUnreadCount() {
  try {
    const previousCount = notificationCount.value
    const nextCount = (await api<{ count: number }>('/notifications/unread-count')).count
    notificationCount.value = nextCount
    if (
      unreadCountInitialized
      && themeStore.notificationsEnabled
      && nextCount > previousCount
      && 'Notification' in window
      && Notification.permission === 'granted'
    ) {
      const notification = new Notification(appStore.systemName, {
        body: `有 ${nextCount - previousCount} 条新通知待查看`,
      })
      notification.onclick = () => {
        window.focus()
        showNotifications.value = true
        void loadNotifications()
        notification.close()
      }
    }
    unreadCountInitialized = true
  } catch {
    // 后台轮询失败不打断主要操作，用户打开面板时会再次加载。
  }
}

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  showUserMenu.value = false
  if (showNotifications.value) void loadNotifications()
}

onMounted(() => {
  void appStore.initializePersistence()
  void loadUnreadCount()
  notificationTimer = window.setInterval(() => void loadUnreadCount(), 30_000)
  window.addEventListener('keydown', handleShortcut)
})
watch(() => themeStore.notificationsEnabled, enabled => {
  if (enabled) void loadUnreadCount()
})
onUnmounted(() => {
  if (notificationTimer) window.clearInterval(notificationTimer)
  window.removeEventListener('keydown', handleShortcut)
})

async function handleLogout() {
  showUserMenu.value = false
  await logout()
  router.push('/')
}

async function markAllRead() {
  try {
    await api('/notifications/read-all', { method: 'PUT' })
    notifications.value = notifications.value.map(n => ({ ...n, read: true }))
    notificationCount.value = 0
  } catch (error) {
    appStore.addToast(`通知更新失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

async function openNotification(notification: NotificationItem) {
  try {
    if (!notification.read) {
      await api(`/notifications/${notification.id}/read`, { method: 'PUT' })
      notification.read = true
      notificationCount.value = Math.max(0, notificationCount.value - 1)
    }
    showNotifications.value = false
    if (notification.targetPath) await router.push(notification.targetPath)
  } catch (error) {
    appStore.addToast(`通知更新失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

function closeDropdowns(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.notification-area')) {
    showNotifications.value = false
  }
  if (!target.closest('.user-menu-area')) {
    showUserMenu.value = false
  }
}
</script>

<template>
  <div
    :class="theme.background"
    class="min-h-screen"
    @click="closeDropdowns"
  >
    <div v-if="!appStore.persistenceReady" class="fixed inset-0 z-[100] flex items-center justify-center bg-white/90">
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm font-semibold text-gray-500 shadow-lg">
        正在加载班级数据...
      </div>
    </div>

    <!-- 背景装饰（仅卡通模式） -->
    <template v-if="theme.enableDecorations">
      <div class="fixed top-10 left-10 text-6xl opacity-20 pointer-events-none select-none animate-bounce-light" style="animation-duration: 3s;">⭐</div>
      <div class="fixed top-20 right-20 text-5xl opacity-20 pointer-events-none select-none animate-bounce-light" style="animation-duration: 4s; animation-delay: 1s;">🌈</div>
      <div class="fixed bottom-20 left-20 text-5xl opacity-20 pointer-events-none select-none animate-bounce-light" style="animation-duration: 5s; animation-delay: 2s;">🎈</div>
      <div class="fixed bottom-10 right-10 text-6xl opacity-20 pointer-events-none select-none animate-bounce-light" style="animation-duration: 3.5s; animation-delay: 0.5s;">✨</div>
    </template>

    <!-- 顶部导航栏 -->
    <header
      class="sticky top-0 z-50 backdrop-blur-lg"
      :class="[theme.cardBg, theme.headerShadow, theme.headerBorder]"
    >
      <div class="max-w-[1800px] mx-auto px-4 py-3">
        <div class="flex items-center justify-between gap-4">

          <!-- Logo区域 -->
          <div
            class="flex items-center gap-3 cursor-pointer flex-shrink-0 transition-transform duration-200 hover:scale-105"
            @click="navigate('/dashboard')"
          >
            <div class="relative">
              <div
                class="w-14 h-14 flex items-center justify-center shadow-lg"
                :class="[theme.buttonRounded, theme.buttonPrimary, style === 'cartoon' ? 'transform rotate-12' : '']"
              >
                <span
                  class="text-3xl"
                  :class="style === 'cartoon' ? 'transform -rotate-12' : ''"
                >🐾</span>
              </div>
              <div v-if="theme.enableDecorations"
                class="absolute -top-1 -right-1 w-6 h-6 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg">
                <span class="text-xs animate-spin-slow">⭐</span>
              </div>
            </div>
            <div>
              <h1 class="text-2xl font-bold" :class="theme.titleGradient">
                {{ appStore.systemName }}
              </h1>
              <p class="text-xs text-[#ff6b6b]">
                {{ theme.enableEmojis ? '✨ 让成长看得见 ✨' : '让成长看得见' }}
              </p>
            </div>
          </div>

          <!-- 桌面端导航菜单 -->
          <nav class="hidden lg:flex items-center gap-1 flex-1 justify-start overflow-x-auto">
            <button
              v-for="item in visibleNavigation"
              :key="item.path"
              @click="handleNavigation(item)"
              class="relative px-3 py-2.5 text-sm font-medium transition-all duration-200 flex-shrink-0 flex items-center gap-1.5"
              :class="[
                theme.buttonRounded,
                isActive(item) ? [theme.buttonPrimary, 'text-white', theme.buttonShadow, style === 'cartoon' ? 'scale-105' : ''] : 'text-[#4a4a4a] hover:bg-gray-100'
              ]"
            >
              <span v-if="theme.enableEmojis" class="text-base">{{ item.emoji }}</span>
              <span>{{ item.name }}</span>
              <!-- 激活装饰 -->
              <div
                v-if="isActive(item) && theme.enableDecorations"
                class="absolute -top-1 -right-1 w-5 h-5 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg"
              >
                <span class="text-xs animate-spin-slow">✨</span>
              </div>
            </button>
          </nav>

          <!-- 右侧操作区 -->
          <div class="flex items-center gap-2 flex-shrink-0">

            <!-- 主题切换 -->
            <button
              @click.stop="themeStore.toggleStyle()"
              class="relative w-12 h-12 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl"
              :class="[theme.buttonRounded, style === 'cartoon' ? 'bg-gradient-to-br from-[#ffd93d] to-[#ffe66d]' : 'bg-gray-100']"
              :title="style === 'cartoon' ? '切换到简洁模式' : '切换到卡通模式'"
            >
              <span class="text-xl">{{ style === 'cartoon' ? '🎨' : '📐' }}</span>
            </button>

            <!-- 通知铃铛 -->
            <div class="relative notification-area">
              <button
                @click.stop="toggleNotifications"
                class="relative w-12 h-12 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-xl"
                :class="[theme.buttonRounded, style === 'cartoon' ? 'bg-gradient-to-br from-[#ffe5d9] to-[#ffd9e8]' : 'bg-gray-100']"
              >
                <span class="text-xl">🔔</span>
                <span
                  v-if="notificationCount > 0"
                  class="absolute -top-1 -right-1 w-6 h-6 bg-[#ff6b6b] flex items-center justify-center text-white text-xs shadow-lg font-bold"
                  :class="theme.badgeRounded"
                >{{ notificationCount }}</span>
              </button>

              <!-- 通知面板 -->
              <Transition name="dropdown">
                <div
                  v-if="showNotifications"
                  class="absolute right-0 top-14 w-80 bg-white shadow-2xl overflow-hidden z-50"
                  :class="[theme.cardRounded, style === 'cartoon' ? 'border-4 border-[#ffe5d9]' : 'border border-gray-200']"
                >
                  <div class="flex items-center justify-between px-4 py-3 border-b"
                    :class="style === 'cartoon' ? 'border-[#ffe5d9]' : 'border-gray-100'">
                    <span class="font-bold text-[#4a4a4a]">
                      {{ theme.enableEmojis ? '🔔' : '' }} 通知中心
                    </span>
                    <button
                      @click="markAllRead"
                      class="text-xs text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors font-medium"
                    >全部已读</button>
                  </div>
                  <div class="max-h-72 overflow-y-auto">
                    <div v-if="notifications.length === 0" class="px-4 py-8 text-center text-xs text-gray-400">
                      暂无通知
                    </div>
                    <div
                      v-for="n in notifications"
                      :key="n.id"
                      @click="openNotification(n)"
                      class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b last:border-0"
                      :class="[!n.read ? 'bg-[#fff9f0]' : '', style === 'cartoon' ? 'border-[#ffe5d9]' : 'border-gray-100']"
                    >
                      <span class="text-2xl flex-shrink-0">{{ notificationEmoji[n.type] }}</span>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-[#4a4a4a]">{{ n.title }}</p>
                        <p class="mt-0.5 text-xs text-[#4a4a4a] leading-relaxed">{{ n.message }}</p>
                        <p class="text-xs text-[#a0a0a0] mt-1">{{ n.time }}</p>
                      </div>
                      <div v-if="!n.read" class="w-2 h-2 bg-[#ff6b6b] rounded-full flex-shrink-0 mt-1"></div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- 用户菜单 -->
            <div class="relative user-menu-area">
              <button
                @click.stop="showUserMenu = !showUserMenu; showNotifications = false"
                class="flex items-center gap-3 px-4 py-2 transition-all duration-200 hover:scale-105 hover:shadow-xl"
                :class="[theme.buttonRounded, style === 'cartoon' ? 'bg-gradient-to-r from-[#ffd93d] to-[#ffd93d]/80' : 'bg-[#ffd93d]']"
              >
                <div class="relative">
                  <div
                    class="w-10 h-10 flex items-center justify-center text-white shadow-lg"
                    :class="[
                      style === 'cartoon' ? 'rounded-full bg-gradient-to-br from-[#ff6b9d] to-[#c44569]' : 'rounded-lg bg-[#ff6b9d]'
                    ]"
                  >
                    <span class="text-lg">👩‍🏫</span>
                  </div>
                  <div v-if="theme.enableDecorations"
                    class="absolute -bottom-1 -right-1 w-5 h-5 bg-[#4ecdc4] rounded-full flex items-center justify-center shadow-md">
                    <span class="text-xs">💖</span>
                  </div>
                </div>
                <div class="hidden md:block text-left">
                  <p class="text-sm font-medium text-[#4a4a4a]">{{ authUser?.displayName ?? '教师' }}</p>
                  <p class="text-xs text-[#ff6b6b]">{{ appStore.currentClass?.name ?? '暂无班级' }}</p>
                </div>
                <span class="text-xs text-[#4a4a4a]">▾</span>
              </button>

              <!-- 用户下拉菜单 -->
              <Transition name="dropdown">
                <div
                  v-if="showUserMenu"
                  class="absolute right-0 top-14 w-48 bg-white shadow-2xl overflow-hidden z-50"
                  :class="[theme.cardRounded, style === 'cartoon' ? 'border-4 border-[#ffe5d9]' : 'border border-gray-200']"
                >
                  <button
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4a4a4a] hover:bg-gray-50 transition-colors text-left"
                    @click="showUserMenu = false; navigate('/dashboard/settings')"
                  >
                    <span class="text-base">⚙️</span>
                    个人设置
                  </button>
                  <div class="border-t" :class="style === 'cartoon' ? 'border-[#ffe5d9]' : 'border-gray-100'"></div>
                  <button
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#ff6b6b] hover:bg-red-50 transition-colors text-left"
                    @click="handleLogout"
                  >
                    <span class="text-base">🚪</span>
                    退出登录
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>

      <!-- 移动端导航 -->
      <div class="lg:hidden border-t px-2 pb-2 overflow-x-auto"
        :class="style === 'cartoon' ? 'border-[#ffe5d9]' : 'border-gray-200'">
        <div class="flex gap-1.5 min-w-max py-2">
          <button
          v-for="item in visibleNavigation"
            :key="item.path"
            @click="handleNavigation(item)"
            class="flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-all min-w-[72px]"
            :class="[
              theme.buttonRounded,
              isActive(item) ? [theme.buttonPrimary, 'text-white', theme.buttonShadow] : 'text-[#4a4a4a] hover:bg-gray-100'
            ]"
          >
            <span class="text-xl" v-if="theme.enableEmojis">{{ item.emoji }}</span>
            <span>{{ item.name }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- 页面内容 -->
    <main class="max-w-[1800px] mx-auto p-4 md:p-6 lg:p-8 relative z-10">
      <RouterView v-if="appStore.persistenceReady" />
    </main>

    <div class="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
      <TransitionGroup name="dropdown">
        <div
          v-for="toast in appStore.toasts"
          :key="toast.id"
          class="min-w-60 rounded-lg px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
          :class="toast.type === 'warning'
            ? 'bg-[#ff9800]'
            : toast.type === 'error'
              ? 'bg-red-500'
              : toast.type === 'success'
                ? 'bg-[#2a9d8f]'
                : 'bg-gray-800'"
        >{{ toast.message }}</div>
      </TransitionGroup>
    </div>

    <!-- 浮动装饰（仅卡通模式） -->
    <div v-if="theme.enableDecorations" class="fixed bottom-5 right-5 pointer-events-none z-0">
      <div class="text-8xl opacity-30 animate-float" style="animation-duration: 4s;">🎨</div>
    </div>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
