<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, storeAuth } from '@/services/api'
import type { AuthResponse } from '@/services/api'

const router = useRouter()
const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  activationCode: '',
})
const showPassword = ref(false)
const showConfirm = ref(false)
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})
const systemName = localStorage.getItem('system-name') || '班级宠物园'

function validate() {
  errors.value = {}
  const { username, password, confirmPassword, activationCode } = form.value

  if (!username) {
    errors.value.username = '请输入用户名'
  } else if (username.length < 4 || username.length > 20) {
    errors.value.username = '用户名需为4-20位'
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.value.username = '仅允许字母、数字、下划线'
  }

  if (!password) {
    errors.value.password = '请输入密码'
  } else if (password.length < 8 || password.length > 20) {
    errors.value.password = '密码需为8-20位'
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.value.password = '密码需包含大小写字母和数字'
  }

  if (!confirmPassword) {
    errors.value.confirmPassword = '请确认密码'
  } else if (confirmPassword !== password) {
    errors.value.confirmPassword = '两次密码不一致'
  }

  if (!activationCode) {
    errors.value.activationCode = '请输入激活码'
  }

  return Object.keys(errors.value).length === 0
}

async function handleRegister(e: Event) {
  e.preventDefault()
  if (!validate()) return
  isLoading.value = true
  try {
    const response = await authApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(form.value),
    })
    storeAuth(response)
    router.push('/dashboard')
  } catch (error) {
    errors.value.general = (error as Error).message
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
    style="background: linear-gradient(135deg, #ff6b9d 0%, #c44569 30%, #4ecdc4 100%)"
  >
    <!-- 浮动装饰 -->
    <div class="absolute top-10 left-10 text-7xl opacity-20 animate-float pointer-events-none select-none">🎓</div>
    <div class="absolute top-20 right-20 text-6xl opacity-20 pointer-events-none select-none animate-float-medium">📚</div>
    <div class="absolute bottom-20 left-20 text-8xl opacity-20 animate-float-slow pointer-events-none select-none">🌟</div>
    <div class="absolute bottom-10 right-10 text-7xl opacity-20 pointer-events-none select-none"
      style="animation: float 5s ease-in-out infinite; animation-delay: 1s;">✏️</div>

    <!-- 浮动星星 -->
    <div
      v-for="i in 6"
      :key="i"
      class="absolute text-2xl pointer-events-none select-none animate-pulse-scale"
      :style="{
        left: (i * 15 + 5) + '%',
        top: (i * 12 + 8) + '%',
        animationDelay: (i * 0.3) + 's',
      }"
    >✨</div>

    <div class="w-full max-w-md relative z-10" style="animation: fadeInUp 0.8s ease both;">
      <!-- 注册卡片 -->
      <div
        class="p-8 shadow-2xl bg-white border-8 border-[#ffd9e8] relative overflow-hidden"
        style="border-radius: 3rem;"
      >
        <!-- 装饰角 -->
        <div class="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-[#ff6b9d] to-transparent rounded-br-full opacity-50 pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-[#4ecdc4] to-transparent rounded-tl-full opacity-50 pointer-events-none"></div>

        <div class="space-y-5 relative z-10">
          <!-- 标题 -->
          <div class="text-center space-y-3">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-2xl"
              style="background: linear-gradient(135deg, #ff6b9d, #c44569, #ffd93d);">
              <span class="text-4xl">🎉</span>
            </div>
            <div>
              <h1 class="text-3xl font-bold mb-1" style="background: linear-gradient(to right, #ff6b9d, #4ecdc4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                加入{{ systemName }}
              </h1>
              <p class="text-sm text-[#a0a0a0]">创建你的专属教师账号</p>
            </div>
          </div>

          <!-- 注册表单 -->
          <form @submit="handleRegister" class="space-y-4">
            <p v-if="errors.general" class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-500">{{ errors.general }}</p>
            <!-- 用户名 -->
            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>👤</span> 用户名
              </label>
              <input
                v-model="form.username"
                type="text"
                placeholder="4-20位，字母/数字/下划线"
                class="w-full h-12 bg-[#fff9f0] border-2 rounded-2xl px-4 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                :class="errors.username ? 'border-[#ff6b6b]' : 'border-[#ffe5d9]'"
                @focus="(e) => !errors.username && ((e.target as HTMLElement).style.borderColor = '#4ecdc4')"
                @blur="(e) => !errors.username && ((e.target as HTMLElement).style.borderColor = '#ffe5d9')"
              />
              <p v-if="errors.username" class="text-xs text-[#ff6b6b] flex items-center gap-1">
                <span>⚠️</span> {{ errors.username }}
              </p>
            </div>

            <!-- 密码 -->
            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>🔒</span> 密码
              </label>
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="8-20位，需含大小写字母和数字"
                  class="w-full h-12 bg-[#fff9f0] border-2 rounded-2xl px-4 pr-12 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                  :class="errors.password ? 'border-[#ff6b6b]' : 'border-[#ffe5d9]'"
                  @focus="(e) => !errors.password && ((e.target as HTMLElement).style.borderColor = '#4ecdc4')"
                  @blur="(e) => !errors.password && ((e.target as HTMLElement).style.borderColor = '#ffe5d9')"
                />
                <button type="button" @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors">
                  {{ showPassword ? '🙈' : '👁️' }}
                </button>
              </div>
              <p v-if="errors.password" class="text-xs text-[#ff6b6b] flex items-center gap-1">
                <span>⚠️</span> {{ errors.password }}
              </p>
            </div>

            <!-- 确认密码 -->
            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>🔑</span> 确认密码
              </label>
              <div class="relative">
                <input
                  v-model="form.confirmPassword"
                  :type="showConfirm ? 'text' : 'password'"
                  placeholder="再次输入密码"
                  class="w-full h-12 bg-[#fff9f0] border-2 rounded-2xl px-4 pr-12 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                  :class="errors.confirmPassword ? 'border-[#ff6b6b]' : 'border-[#ffe5d9]'"
                  @focus="(e) => !errors.confirmPassword && ((e.target as HTMLElement).style.borderColor = '#4ecdc4')"
                  @blur="(e) => !errors.confirmPassword && ((e.target as HTMLElement).style.borderColor = '#ffe5d9')"
                />
                <button type="button" @click="showConfirm = !showConfirm"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors">
                  {{ showConfirm ? '🙈' : '👁️' }}
                </button>
              </div>
              <p v-if="errors.confirmPassword" class="text-xs text-[#ff6b6b] flex items-center gap-1">
                <span>⚠️</span> {{ errors.confirmPassword }}
              </p>
            </div>

            <!-- 激活码 -->
            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>🎫</span> 激活码
              </label>
              <input
                v-model="form.activationCode"
                type="text"
                placeholder="请输入激活码"
                class="w-full h-12 bg-[#fff9f0] border-2 rounded-2xl px-4 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                :class="errors.activationCode ? 'border-[#ff6b6b]' : 'border-[#ffe5d9]'"
                @focus="(e) => !errors.activationCode && ((e.target as HTMLElement).style.borderColor = '#ff6b9d')"
                @blur="(e) => !errors.activationCode && ((e.target as HTMLElement).style.borderColor = '#ffe5d9')"
              />
              <p v-if="errors.activationCode" class="text-xs text-[#ff6b6b] flex items-center gap-1">
                <span>⚠️</span> {{ errors.activationCode }}
              </p>
            </div>

            <!-- 注册按钮 -->
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full h-12 text-white rounded-2xl shadow-xl transition-all font-medium flex items-center justify-center gap-2"
              style="background: linear-gradient(90deg, #ff6b9d, #c44569, #ff6b9d); background-size: 200% 100%; animation: gradient 3s ease infinite;"
              @mouseover="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'"
              @mousedown="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'"
              @mouseup="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'"
            >
              <span v-if="!isLoading">🎉</span>
              <span v-else class="animate-spin">⏳</span>
              {{ isLoading ? '注册中...' : '立即注册' }}
            </button>
          </form>

          <!-- 登录链接 -->
          <div class="text-center text-sm text-[#a0a0a0] border-t-2 border-[#ffe5d9] pt-4">
            已有账号？
            <router-link to="/" class="text-[#ff6b9d] hover:text-[#4ecdc4] transition-colors font-medium">
              立即登录
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
