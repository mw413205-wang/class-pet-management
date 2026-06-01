<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const rememberMe = ref(false)
const isLoading = ref(false)

// 随机星星位置
const stars = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  left: Math.random() * 90 + 5,
  top: Math.random() * 90 + 5,
  delay: Math.random() * 2,
  duration: 3 + Math.random() * 2,
}))

const logoRef = ref<HTMLElement | null>(null)

function onLogoClick() {
  if (logoRef.value) {
    logoRef.value.style.transform = 'rotate(360deg) scale(1.1)'
    window.setTimeout(() => {
      if (logoRef.value) logoRef.value.style.transform = ''
    }, 600)
  }
}

async function handleLogin(e: Event) {
  e.preventDefault()
  if (!username.value || !password.value) return
  isLoading.value = true
  // 模拟登录
  await new Promise(r => setTimeout(r, 800))
  isLoading.value = false
  router.push('/dashboard')
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
    style="background: linear-gradient(135deg, #4ecdc4 0%, #95e1d3 50%, #ffd93d 100%)"
  >
    <!-- 浮动宠物动画 -->
    <div class="absolute top-10 left-10 text-8xl opacity-20 animate-float-slow pointer-events-none select-none">🐱</div>
    <div class="absolute top-20 right-20 text-7xl opacity-20 pointer-events-none select-none"
      style="animation: float 5s ease-in-out infinite; animation-delay: 1s;">🐰</div>
    <div class="absolute bottom-20 left-20 text-9xl opacity-20 animate-float-medium pointer-events-none select-none"
      style="animation-delay: 2s;">🐶</div>
    <div class="absolute bottom-10 right-10 text-8xl opacity-20 pointer-events-none select-none"
      style="animation: float 5.5s ease-in-out infinite; animation-delay: 0.5s;">🦊</div>

    <!-- 浮动星星 -->
    <div
      v-for="star in stars"
      :key="star.id"
      class="absolute text-3xl pointer-events-none select-none animate-pulse-scale"
      :style="{
        left: star.left + '%',
        top: star.top + '%',
        animationDuration: star.duration + 's',
        animationDelay: star.delay + 's',
      }"
    >⭐</div>

    <!-- 主内容区 -->
    <div class="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
      <!-- 左侧插图区 -->
      <div class="hidden lg:flex flex-col items-center justify-center space-y-6"
        style="animation: fadeInLeft 0.8s ease both;">
        <div class="relative w-full max-w-lg group cursor-default"
          style="transition: transform 0.3s ease;"
        >
          <div class="absolute -top-6 -left-6 w-16 h-16 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-2xl z-10">
            <span class="text-3xl">🎨</span>
          </div>
          <div class="absolute -bottom-6 -right-6 w-16 h-16 bg-[#ff6b9d] rounded-full flex items-center justify-center shadow-2xl z-10">
            <span class="text-3xl">📚</span>
          </div>
          <div
            class="rounded-[3rem] shadow-2xl border-8 border-white overflow-hidden transition-transform duration-300 bg-gradient-to-br from-[#4ecdc4] via-[#95e1d3] to-[#ffd9e8] flex items-center justify-center"
            style="height: 340px;"
          >
            <!-- 插图内容 -->
            <div class="text-center space-y-4 p-8">
              <div class="text-9xl">🏫</div>
              <div class="text-4xl">🐾🎓📚</div>
            </div>
          </div>
        </div>
        <div
          class="text-center space-y-3 bg-white/80 backdrop-blur-sm px-8 py-4 rounded-3xl shadow-xl"
          style="animation: fadeInUp 0.8s ease 0.3s both;"
        >
          <div class="flex items-center justify-center gap-2">
            <span class="text-2xl">✨</span>
            <h2 class="text-3xl font-bold text-gradient">让成长看得见</h2>
            <span class="text-2xl">💖</span>
          </div>
          <p class="text-lg text-[#4a4a4a]">用爱陪伴每一位学生的成长旅程 🌈</p>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div style="animation: fadeInRight 0.8s ease both;">
        <div
          class="w-full max-w-md mx-auto p-8 shadow-2xl bg-white border-8 border-[#ffe5d9] relative overflow-hidden"
          style="border-radius: 3rem;"
        >
          <!-- 装饰角 -->
          <div class="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-[#4ecdc4] to-transparent rounded-br-full opacity-50 pointer-events-none"></div>
          <div class="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-[#ff6b9d] to-transparent rounded-tl-full opacity-50 pointer-events-none"></div>

          <div class="space-y-6 relative z-10">
            <!-- Logo和标题 -->
            <div class="text-center space-y-4">
              <div ref="logoRef" class="inline-flex items-center justify-center relative group cursor-pointer"
                style="transition: transform 0.6s ease;"
                @click="onLogoClick"
              >
                <div class="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl"
                  style="background: linear-gradient(135deg, #4ecdc4, #95e1d3, #ffd93d);">
                  <span class="text-5xl">🐾</span>
                </div>
                <div class="absolute -top-2 -right-2 w-10 h-10 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg animate-spin-slow">
                  <span class="text-lg">⭐</span>
                </div>
              </div>
              <div>
                <h1 class="text-4xl font-bold text-gradient mb-2">班级宠物园</h1>
                <div class="inline-flex items-center gap-2 bg-gradient-to-r from-[#ffe5d9] to-[#ffd9e8] px-4 py-2 rounded-full">
                  <span class="text-sm text-[#ff6b6b]">✨ 教师管理平台 ✨</span>
                </div>
              </div>
            </div>

            <!-- 登录表单 -->
            <form @submit="handleLogin" class="space-y-5">
              <!-- 用户名 -->
              <div class="space-y-2">
                <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                  <span class="text-xl">👤</span>
                  用户名
                </label>
                <input
                  v-model="username"
                  type="text"
                  placeholder="请输入用户名"
                  required
                  class="w-full h-14 bg-[#fff9f0] border-2 border-[#ffe5d9] rounded-2xl px-4 text-base text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                  style="focus-outline: none;"
                  @focus="(e) => (e.target as HTMLElement).style.borderColor = '#4ecdc4'"
                  @blur="(e) => (e.target as HTMLElement).style.borderColor = '#ffe5d9'"
                />
              </div>

              <!-- 密码 -->
              <div class="space-y-2">
                <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                  <span class="text-xl">🔒</span>
                  密码
                </label>
                <div class="relative">
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="请输入密码"
                    required
                    class="w-full h-14 bg-[#fff9f0] border-2 border-[#ffe5d9] rounded-2xl px-4 pr-14 text-base text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                    @focus="(e) => (e.target as HTMLElement).style.borderColor = '#4ecdc4'"
                    @blur="(e) => (e.target as HTMLElement).style.borderColor = '#ffe5d9'"
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors text-2xl"
                  >
                    {{ showPassword ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>

              <!-- 记住密码 / 忘记密码 -->
              <div class="flex items-center justify-between text-sm">
                <label class="flex items-center gap-2 text-[#4a4a4a] cursor-pointer group">
                  <input
                    v-model="rememberMe"
                    type="checkbox"
                    class="w-5 h-5 rounded border-2 border-[#4ecdc4] accent-[#4ecdc4]"
                  />
                  <span class="group-hover:text-[#4ecdc4] transition-colors">记住密码</span>
                </label>
                <router-link
                  to="/forgot-password"
                  class="text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors font-medium"
                >
                  忘记密码？
                </router-link>
              </div>

              <!-- 登录按钮 -->
              <button
                type="submit"
                :disabled="isLoading"
                class="w-full h-14 text-white text-lg rounded-2xl shadow-xl transition-all animate-gradient font-medium flex items-center justify-center gap-2"
                style="background: linear-gradient(90deg, #4ecdc4, #95e1d3, #4ecdc4); background-size: 200% 100%;"
                @mouseover="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'"
                @mouseleave="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'"
                @mousedown="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'"
                @mouseup="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'"
              >
                <span v-if="!isLoading" class="text-xl">🚀</span>
                <span v-if="isLoading" class="animate-spin text-xl">⏳</span>
                {{ isLoading ? '登录中...' : '开始精彩旅程' }}
              </button>
            </form>

            <!-- 注册链接 -->
            <div class="text-center text-sm text-[#a0a0a0]">
              还没有账号？
              <router-link to="/register" class="text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors font-medium">
                立即注册
              </router-link>
            </div>

            <!-- 底部 -->
            <div class="text-center pt-4 border-t-2 border-[#ffe5d9]">
              <div class="flex items-center justify-center gap-2 text-sm text-[#a0a0a0]">
                <span class="text-[#ff6b9d]">💖</span>
                <p>© 2026 班级宠物园 · 让教育更有爱</p>
                <span class="text-[#ffd93d]">✨</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(-50px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(50px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
