<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref<1 | 2>(1)
const form = ref({
  username: '',
  activationCode: '',
  newPassword: '',
  confirmPassword: '',
})
const showPassword = ref(false)
const showConfirm = ref(false)
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})

async function handleVerify(e: Event) {
  e.preventDefault()
  errors.value = {}
  if (!form.value.username) {
    errors.value.username = '请输入用户名'
    return
  }
  if (!form.value.activationCode) {
    errors.value.activationCode = '请输入激活码'
    return
  }
  isLoading.value = true
  await new Promise(r => setTimeout(r, 800))
  isLoading.value = false
  step.value = 2
}

async function handleReset(e: Event) {
  e.preventDefault()
  errors.value = {}
  if (!form.value.newPassword || form.value.newPassword.length < 8) {
    errors.value.newPassword = '密码不少于8位'
    return
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    errors.value.confirmPassword = '两次密码不一致'
    return
  }
  isLoading.value = true
  await new Promise(r => setTimeout(r, 800))
  isLoading.value = false
  router.push('/')
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
    style="background: linear-gradient(135deg, #ffd93d 0%, #ff6b9d 50%, #4ecdc4 100%)"
  >
    <!-- 浮动装饰 -->
    <div class="absolute top-10 left-10 text-7xl opacity-20 animate-float-slow pointer-events-none select-none">🔑</div>
    <div class="absolute bottom-10 right-10 text-7xl opacity-20 animate-float pointer-events-none select-none">🛡️</div>

    <div class="w-full max-w-md relative z-10" style="animation: fadeInUp 0.8s ease both;">
      <div
        class="p-8 shadow-2xl bg-white border-8 border-[#fff3d0] relative overflow-hidden"
        style="border-radius: 3rem;"
      >
        <!-- 装饰角 -->
        <div class="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-[#ffd93d] to-transparent rounded-br-full opacity-50 pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-[#4ecdc4] to-transparent rounded-tl-full opacity-50 pointer-events-none"></div>

        <div class="space-y-6 relative z-10">
          <!-- 步骤指示 -->
          <div class="flex items-center justify-center gap-4">
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                :class="step >= 1 ? 'bg-[#ffd93d] text-[#4a4a4a] shadow-lg' : 'bg-gray-200 text-gray-400'"
              >1</div>
              <span class="text-xs" :class="step >= 1 ? 'text-[#4a4a4a]' : 'text-gray-400'">验证身份</span>
            </div>
            <div class="w-8 h-0.5" :class="step >= 2 ? 'bg-[#4ecdc4]' : 'bg-gray-200'"></div>
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                :class="step >= 2 ? 'bg-[#4ecdc4] text-white shadow-lg' : 'bg-gray-200 text-gray-400'"
              >2</div>
              <span class="text-xs" :class="step >= 2 ? 'text-[#4a4a4a]' : 'text-gray-400'">重置密码</span>
            </div>
          </div>

          <!-- 标题 -->
          <div class="text-center space-y-2">
            <div class="text-5xl">
              {{ step === 1 ? '🔐' : '✅' }}
            </div>
            <h1 class="text-2xl font-bold text-[#4a4a4a]">
              {{ step === 1 ? '找回密码' : '重置密码' }}
            </h1>
            <p class="text-sm text-[#a0a0a0]">
              {{ step === 1 ? '通过用户名和激活码验证身份' : '请设置你的新密码' }}
            </p>
          </div>

          <!-- 第一步：验证身份 -->
          <form v-if="step === 1" @submit="handleVerify" class="space-y-4">
            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>👤</span> 用户名
              </label>
              <input
                v-model="form.username"
                type="text"
                placeholder="请输入用户名"
                class="w-full h-12 bg-[#fffdf0] border-2 rounded-2xl px-4 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                :class="errors.username ? 'border-[#ff6b6b]' : 'border-[#fff3d0]'"
                @focus="(e) => ((e.target as HTMLElement).style.borderColor = '#ffd93d')"
                @blur="(e) => !errors.username && ((e.target as HTMLElement).style.borderColor = '#fff3d0')"
              />
              <p v-if="errors.username" class="text-xs text-[#ff6b6b]">⚠️ {{ errors.username }}</p>
            </div>

            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>🎫</span> 激活码
              </label>
              <input
                v-model="form.activationCode"
                type="text"
                placeholder="请输入账号绑定的激活码"
                class="w-full h-12 bg-[#fffdf0] border-2 rounded-2xl px-4 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                :class="errors.activationCode ? 'border-[#ff6b6b]' : 'border-[#fff3d0]'"
                @focus="(e) => ((e.target as HTMLElement).style.borderColor = '#ffd93d')"
                @blur="(e) => !errors.activationCode && ((e.target as HTMLElement).style.borderColor = '#fff3d0')"
              />
              <p v-if="errors.activationCode" class="text-xs text-[#ff6b6b]">⚠️ {{ errors.activationCode }}</p>
            </div>

            <button
              type="submit"
              :disabled="isLoading"
              class="w-full h-12 text-[#4a4a4a] rounded-2xl shadow-xl transition-all font-medium flex items-center justify-center gap-2"
              style="background: linear-gradient(90deg, #ffd93d, #ffe66d, #ffd93d); background-size: 200% 100%; animation: gradient 3s ease infinite;"
              @mouseover="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'"
            >
              <span>{{ isLoading ? '⏳' : '✅' }}</span>
              {{ isLoading ? '验证中...' : '验证身份' }}
            </button>
          </form>

          <!-- 第二步：重置密码 -->
          <form v-if="step === 2" @submit="handleReset" class="space-y-4">
            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>🔒</span> 新密码
              </label>
              <div class="relative">
                <input
                  v-model="form.newPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="8-20位，需含大小写字母和数字"
                  class="w-full h-12 bg-[#f0fffe] border-2 rounded-2xl px-4 pr-12 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                  :class="errors.newPassword ? 'border-[#ff6b6b]' : 'border-[#95e1d3]'"
                  @focus="(e) => !errors.newPassword && ((e.target as HTMLElement).style.borderColor = '#4ecdc4')"
                  @blur="(e) => !errors.newPassword && ((e.target as HTMLElement).style.borderColor = '#95e1d3')"
                />
                <button type="button" @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ecdc4] hover:text-[#ff6b9d]">
                  {{ showPassword ? '🙈' : '👁️' }}
                </button>
              </div>
              <p v-if="errors.newPassword" class="text-xs text-[#ff6b6b]">⚠️ {{ errors.newPassword }}</p>
            </div>

            <div class="space-y-1">
              <label class="text-[#4a4a4a] flex items-center gap-2 text-sm font-medium">
                <span>🔑</span> 确认新密码
              </label>
              <div class="relative">
                <input
                  v-model="form.confirmPassword"
                  :type="showConfirm ? 'text' : 'password'"
                  placeholder="再次输入新密码"
                  class="w-full h-12 bg-[#f0fffe] border-2 rounded-2xl px-4 pr-12 text-sm text-[#4a4a4a] placeholder-[#a0a0a0] outline-none transition-all"
                  :class="errors.confirmPassword ? 'border-[#ff6b6b]' : 'border-[#95e1d3]'"
                  @focus="(e) => !errors.confirmPassword && ((e.target as HTMLElement).style.borderColor = '#4ecdc4')"
                  @blur="(e) => !errors.confirmPassword && ((e.target as HTMLElement).style.borderColor = '#95e1d3')"
                />
                <button type="button" @click="showConfirm = !showConfirm"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ecdc4] hover:text-[#ff6b9d]">
                  {{ showConfirm ? '🙈' : '👁️' }}
                </button>
              </div>
              <p v-if="errors.confirmPassword" class="text-xs text-[#ff6b6b]">⚠️ {{ errors.confirmPassword }}</p>
            </div>

            <button
              type="submit"
              :disabled="isLoading"
              class="w-full h-12 text-white rounded-2xl shadow-xl transition-all font-medium flex items-center justify-center gap-2"
              style="background: linear-gradient(90deg, #4ecdc4, #95e1d3, #4ecdc4); background-size: 200% 100%; animation: gradient 3s ease infinite;"
              @mouseover="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'"
            >
              <span>{{ isLoading ? '⏳' : '🎉' }}</span>
              {{ isLoading ? '重置中...' : '重置密码' }}
            </button>
          </form>

          <!-- 返回登录 -->
          <div class="text-center text-sm text-[#a0a0a0] border-t-2 border-[#fff3d0] pt-4">
            <router-link to="/" class="text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors font-medium flex items-center justify-center gap-1">
              <span>←</span> 返回登录
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
