<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const style = computed(() => themeStore.style)

const notificationCount = ref(3)
const showNotifications = ref(false)
const showUserMenu = ref(false)

const notifications = ref([
  { id: 1, text: '陈静的熊猫宝宝升级到第3阶段！', time: '5分钟前', emoji: '🐼', read: false },
  { id: 2, text: '郑美的白猫达到满级，继续陪伴成长！', time: '1小时前', emoji: '🐱', read: false },
  { id: 3, text: '作业减免卡库存不足（剩余2件）', time: '2小时前', emoji: '⚠️', read: false },
])

const navigation = [
  { name: '学生墙', path: '/dashboard', emoji: '🏠', exact: true },
  { name: '班级管理', path: '/dashboard/classes', emoji: '📚' },
  { name: '学生管理', path: '/dashboard/students', emoji: '👨‍🎓' },
  { name: '随机点名', path: '/dashboard/random-picker', emoji: '🎲' },
  { name: '幸运抽奖', path: '/dashboard/lucky-draw', emoji: '🎁' },
  { name: '小卖部', path: '/dashboard/rewards', emoji: '🏪' },
  { name: '宠物分配', path: '/dashboard/pets', emoji: '🐾' },
  { name: '徽章墙', path: '/dashboard/badges', emoji: '🏆' },
  { name: '系统设置', path: '/dashboard/settings', emoji: '⚙️' },
]

function isActive(item: { path: string; exact?: boolean }) {
  if (item.exact) {
    return route.path === item.path
  }
  return route.path.startsWith(item.path)
}

function navigate(path: string) {
  router.push(path)
}

function handleLogout() {
  showUserMenu.value = false
  router.push('/')
}

function markAllRead() {
  notifications.value = notifications.value.map(n => ({ ...n, read: true }))
  notificationCount.value = 0
  showNotifications.value = false
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
                班级宠物园
              </h1>
              <p class="text-xs text-[#ff6b6b]">
                {{ theme.enableEmojis ? '✨ 让成长看得见 ✨' : '让成长看得见' }}
              </p>
            </div>
          </div>

          <!-- 桌面端导航菜单 -->
          <nav class="hidden lg:flex items-center gap-1 flex-1 justify-center overflow-x-auto">
            <button
              v-for="item in navigation"
              :key="item.path"
              @click="navigate(item.path)"
              class="relative px-4 py-2.5 text-sm font-medium transition-all duration-200 flex-shrink-0 flex items-center gap-1.5"
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
                @click.stop="showNotifications = !showNotifications; showUserMenu = false"
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
                    <div
                      v-for="n in notifications"
                      :key="n.id"
                      class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b last:border-0"
                      :class="[!n.read ? 'bg-[#fff9f0]' : '', style === 'cartoon' ? 'border-[#ffe5d9]' : 'border-gray-100']"
                    >
                      <span class="text-2xl flex-shrink-0">{{ n.emoji }}</span>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs text-[#4a4a4a] leading-relaxed">{{ n.text }}</p>
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
                  <p class="text-sm font-medium text-[#4a4a4a]">张老师</p>
                  <p class="text-xs text-[#ff6b6b]">三年级(1)班</p>
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
            v-for="item in navigation"
            :key="item.path"
            @click="navigate(item.path)"
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
      <RouterView />
    </main>

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
