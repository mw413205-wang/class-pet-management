<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { themeColorOptions, useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import type { ResetMode } from '@/stores/appStore'
import { api, clearAuth, getStoredUser } from '@/services/api'
import type { ScoreRule } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()
const router = useRouter()
const currentUser = getStoredUser()
const isOwner = currentUser?.role === 'owner'

// ─── Basic settings ──────────────────────────────────────
const systemNameDraft = ref(appStore.systemName)

watch(() => appStore.systemName, name => {
  systemNameDraft.value = name
})

async function saveSystemName() {
  const name = systemNameDraft.value.trim()
  if (!name || name.length > 30) {
    appStore.addToast('系统名称需为 1-30 个字符', 'warning')
    return
  }
  await appStore.saveSystemName(name)
}

async function toggleNotificationReminders() {
  if (themeStore.notificationsEnabled) {
    themeStore.setNotificationsEnabled(false)
    appStore.addToast('浏览器通知提醒已关闭', 'info')
    return
  }
  if (!('Notification' in window)) {
    appStore.addToast('当前浏览器不支持系统通知', 'warning')
    return
  }
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission
  if (permission !== 'granted') {
    appStore.addToast('浏览器未授予通知权限', 'warning')
    return
  }
  themeStore.setNotificationsEnabled(true)
  appStore.addToast('浏览器通知提醒已开启', 'success')
}

function toggleAnimationsPreference() {
  themeStore.setAnimationsEnabled(!themeStore.animationsEnabled)
  appStore.addToast('动画偏好已保存；当前版本仍保持静态展示', 'info')
}

// ─── Score Rules ──────────────────────────────────────────
const ruleModalMode = ref<'add' | 'edit' | null>(null)
const targetRule = ref<ScoreRule | null>(null)
const ruleForm = ref({ name: '', icon: '⭐', value: 1, isQuick: false })

const COMMON_ICONS = ['⭐', '✋', '📝', '🤝', '👂', '🎯', '💡', '🏆', '❌', '⚠️', '😴', '🎮', '📚', '🌟', '🎨', '🔥']

function openAddRule() {
  ruleForm.value = { name: '', icon: '⭐', value: 1, isQuick: false }
  targetRule.value = null
  ruleModalMode.value = 'add'
}

function openEditRule(rule: ScoreRule) {
  ruleForm.value = { name: rule.name, icon: rule.icon, value: rule.value, isQuick: rule.isQuick }
  targetRule.value = rule
  ruleModalMode.value = 'edit'
}

function submitRule() {
  if (!ruleForm.value.name.trim()) return
  if (ruleModalMode.value === 'add') {
    appStore.addScoreRule({ ...ruleForm.value })
  } else if (targetRule.value) {
    appStore.updateScoreRule(targetRule.value.id, { ...ruleForm.value })
  }
  ruleModalMode.value = null
}

// ─── Level thresholds ─────────────────────────────────────
const thresholds = computed(() => appStore.levelThresholds)
const thresholdEditing = ref(false)
const thresholdDraft = ref([...appStore.levelThresholds])

function startEditThresholds() {
  thresholdDraft.value = [...appStore.levelThresholds]
  thresholdEditing.value = true
}

function saveThresholds() {
  const values = [...thresholdDraft.value].map(Number)
  if (values.length !== 4 || values.some(v => !Number.isInteger(v) || v <= 0) || values.some((value, index) => index > 0 && value <= values[index - 1])) {
    appStore.addToast('阈值必须为四个递增的正整数', 'warning')
    return
  }
  appStore.saveLevelThresholds(values)
  thresholdEditing.value = false
}

function cancelEditThresholds() {
  thresholdEditing.value = false
}

// ─── Account settings ─────────────────────────────────────
const passwordSubmitting = ref(false)
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })

async function changePassword() {
  if (passwordSubmitting.value) return
  if (!passwordForm.value.currentPassword) {
    appStore.addToast('请输入当前密码', 'warning')
    return
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/.test(passwordForm.value.newPassword)) {
    appStore.addToast('新密码需为 8-20 位，并包含大小写字母和数字', 'warning')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    appStore.addToast('两次输入的新密码不一致', 'warning')
    return
  }
  try {
    passwordSubmitting.value = true
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: passwordForm.value.currentPassword,
        newPassword: passwordForm.value.newPassword,
      }),
    })
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    appStore.addToast('密码已更新，请在下次登录时使用新密码', 'success')
  } catch (error) {
    appStore.addToast(`密码修改失败：${(error as Error).message}`, 'warning')
  } finally {
    passwordSubmitting.value = false
  }
}

const showDeactivateConfirm = ref(false)
const deactivateSubmitting = ref(false)
const deactivateForm = ref({ password: '', confirmation: '' })

function openDeactivateConfirm() {
  deactivateForm.value = { password: '', confirmation: '' }
  showDeactivateConfirm.value = true
}

function closeDeactivateConfirm() {
  if (!deactivateSubmitting.value) showDeactivateConfirm.value = false
}

async function deactivateAccount() {
  if (deactivateSubmitting.value) return
  if (!deactivateForm.value.password) {
    appStore.addToast('请输入当前密码', 'warning')
    return
  }
  if (deactivateForm.value.confirmation !== '注销账号') {
    appStore.addToast('请输入“注销账号”确认操作', 'warning')
    return
  }
  try {
    deactivateSubmitting.value = true
    await api('/auth/deactivate', {
      method: 'POST',
      body: JSON.stringify(deactivateForm.value),
    })
    clearAuth()
    await router.replace('/')
  } catch (error) {
    appStore.addToast(`账号注销失败：${(error as Error).message}`, 'warning')
  } finally {
    deactivateSubmitting.value = false
  }
}

// ─── Danger zone ──────────────────────────────────────────
const showDangerConfirm = ref<'reset-class' | 'reset-rules' | null>(null)
const resetScope = ref<'current' | 'all'>('current')
const resetMode = ref<ResetMode>('score')
const resetConfirmation = ref('')
const resetPassword = ref('')
const resetSubmitting = ref(false)
const expectedResetConfirmation = computed(() => resetScope.value === 'all' ? '重置全部班级' : '重置当前班级')

function openResetConfirm() {
  resetScope.value = 'current'
  resetMode.value = 'score'
  resetConfirmation.value = ''
  resetPassword.value = ''
  showDangerConfirm.value = 'reset-class'
}

async function confirmDanger() {
  if (showDangerConfirm.value === 'reset-class') {
    if (resetConfirmation.value !== expectedResetConfirmation.value) {
      appStore.addToast(`请输入“${expectedResetConfirmation.value}”确认操作`, 'warning')
      return
    }
    if (resetScope.value === 'all' && !resetPassword.value) {
      appStore.addToast('请输入当前密码', 'warning')
      return
    }
    resetSubmitting.value = true
    try {
      if (resetScope.value === 'all') {
        await appStore.resetAllClassProgress(resetMode.value, resetConfirmation.value, resetPassword.value)
      } else {
        await appStore.resetClassProgress(appStore.currentClassId, resetMode.value, resetConfirmation.value)
      }
    } finally {
      resetSubmitting.value = false
    }
  } else if (showDangerConfirm.value === 'reset-rules') {
    // Reset rules to default
    appStore.currentRules.forEach(r => appStore.deleteScoreRule(r.id))
    ;[
      { name: '认真听讲', icon: '👂', value: 2, isQuick: true },
      { name: '积极回答', icon: '✋', value: 3, isQuick: true },
      { name: '作业优秀', icon: '📝', value: 5, isQuick: true },
      { name: '帮助同学', icon: '🤝', value: 3, isQuick: false },
      { name: '课堂表现优秀', icon: '⭐', value: 5, isQuick: false },
      { name: '违反纪律', icon: '⚠️', value: -2, isQuick: false },
      { name: '未完成作业', icon: '❌', value: -3, isQuick: false },
    ].forEach((rule, index) => appStore.addScoreRule({ ...rule, order: index + 1 }))
    appStore.addToast('正在重置积分规则为默认配置', 'info')
  }
  showDangerConfirm.value = null
}

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']
const levelNames = ['入门', '进阶', '高手', '精英', 'MAX']
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl">⚙️</span>
      <h1 class="text-3xl font-bold" :class="theme.titleGradient">设置</h1>
    </div>

    <!-- ─── Basic Settings ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div>
        <h2 class="text-lg font-bold text-gray-800">🧭 基础设置</h2>
        <p class="text-xs text-gray-400 mt-0.5">系统名称为租户级配置，其余选项保存在当前浏览器</p>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="space-y-1.5">
          <span class="block text-xs font-medium text-gray-500">系统名称</span>
          <div class="flex gap-2">
            <input v-model="systemNameDraft" :disabled="!isOwner" maxlength="30" class="min-w-0 flex-1 px-3 py-2 text-sm outline-none disabled:opacity-60" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            <button v-if="isOwner" @click="saveSystemName" class="px-3 py-2 text-sm font-semibold text-white" :class="[theme.buttonPrimary, theme.buttonRounded]">保存</button>
          </div>
        </label>
        <label class="space-y-1.5">
          <span class="block text-xs font-medium text-gray-500">当前班级</span>
          <select v-model="appStore.currentClassId" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
            <option v-for="cls in appStore.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
          </select>
        </label>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-3 py-3">
          <div>
            <p class="text-sm font-medium text-gray-700">浏览器通知提醒</p>
            <p class="text-xs text-gray-400">有新通知时显示浏览器系统提醒</p>
          </div>
          <button @click="toggleNotificationReminders" class="relative h-5 w-10 shrink-0 rounded-full transition-all" :class="themeStore.notificationsEnabled ? 'bg-[#5fb894]' : 'bg-gray-200'">
            <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" :class="themeStore.notificationsEnabled ? 'left-5' : 'left-0.5'"></span>
          </button>
        </div>
        <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-3 py-3">
          <div>
            <p class="text-sm font-medium text-gray-700">动画效果</p>
            <p class="text-xs text-gray-400">预留偏好；当前版本保持静态图片展示</p>
          </div>
          <button @click="toggleAnimationsPreference" class="relative h-5 w-10 shrink-0 rounded-full transition-all" :class="themeStore.animationsEnabled ? 'bg-[#5fb894]' : 'bg-gray-200'">
            <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" :class="themeStore.animationsEnabled ? 'left-5' : 'left-0.5'"></span>
          </button>
        </div>
      </div>
    </section>

    <!-- ─── Score Rules ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800">📋 积分规则</h2>
          <p class="text-xs text-gray-400 mt-0.5">{{ appStore.currentClass?.name }} 的积分规则</p>
        </div>
        <button @click="openAddRule" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white transition-all" :class="theme.buttonPrimary">
          + 新增规则
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="rule in appStore.currentRules"
          :key="rule.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          :class="rule.enabled ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50/50 opacity-60'"
        >
          <!-- Move buttons -->
          <div class="flex flex-col gap-0.5">
            <button @click="appStore.moveRule(rule.id, -1)" class="text-gray-300 hover:text-gray-500 text-xs leading-none">▲</button>
            <button @click="appStore.moveRule(rule.id, 1)" class="text-gray-300 hover:text-gray-500 text-xs leading-none">▼</button>
          </div>

          <!-- Icon -->
          <span class="text-2xl w-8 text-center">{{ rule.icon }}</span>

          <!-- Name -->
          <span class="flex-1 text-sm font-medium text-gray-700">{{ rule.name }}</span>

          <!-- Value -->
          <span
            class="text-sm font-bold px-2 py-0.5 rounded-full"
            :class="rule.value > 0 ? 'bg-[#4ecdc4]/15 text-[#2a9d8f]' : 'bg-[#ff6b9d]/15 text-[#c44569]'"
          >{{ rule.value > 0 ? '+' : '' }}{{ rule.value }}</span>

          <button
            @click="appStore.toggleQuickScoreRule(rule.id)"
            class="rounded-full px-2 py-0.5 text-[10px] font-bold transition-all"
            :class="rule.isQuick ? 'bg-[#ffd93d]/25 text-[#a16207]' : 'bg-gray-100 text-gray-400 hover:text-gray-600'"
            title="是否显示在课堂快捷模式"
          >{{ rule.isQuick ? '课堂常用' : '设为常用' }}</button>

          <!-- Toggle -->
          <button
            @click="appStore.toggleScoreRule(rule.id)"
            class="w-10 h-5 rounded-full transition-all relative shrink-0"
            :class="rule.enabled ? 'bg-[#4ecdc4]' : 'bg-gray-200'"
          >
            <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" :class="rule.enabled ? 'left-5' : 'left-0.5'"></div>
          </button>

          <!-- Edit / Delete -->
          <button @click="openEditRule(rule)" class="p-1.5 rounded-lg hover:bg-[#4ecdc4]/10 text-gray-400 hover:text-[#4ecdc4] transition-all text-sm">✏️</button>
          <button @click="appStore.deleteScoreRule(rule.id)" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400 transition-all text-sm">🗑</button>
        </div>

        <div v-if="appStore.currentRules.length === 0" class="text-center py-8 text-gray-300">
          <div class="text-4xl mb-2">📋</div>
          <div class="text-sm">还没有积分规则，点击上方「新增规则」添加</div>
        </div>
      </div>
    </section>

    <!-- ─── Level Thresholds ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800">🏆 等级阈值</h2>
          <p class="text-xs text-gray-400 mt-0.5">达到对应积分后宠物升级</p>
        </div>
        <button v-if="isOwner && !thresholdEditing" @click="startEditThresholds" class="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">✏️ 编辑</button>
        <div v-else-if="isOwner" class="flex gap-2">
          <button @click="cancelEditThresholds" class="px-3 py-1.5 rounded-xl text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
          <button @click="saveThresholds" class="px-3 py-1.5 rounded-xl text-sm text-white font-semibold transition-all" :class="theme.buttonPrimary">保存</button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="(threshold, idx) in thresholds"
          :key="idx"
          class="p-4 rounded-2xl text-center space-y-2"
          :style="{ background: levelColors[idx + 1] + '15', borderColor: levelColors[idx + 1] + '44', border: '2px solid' }"
        >
          <div class="text-2xl font-black" :style="{ color: levelColors[idx + 1] }">
            Lv.{{ idx + 2 }}
          </div>
          <div class="text-xs text-gray-400 font-medium">{{ levelNames[idx + 1] }}</div>
          <div v-if="!thresholdEditing" class="text-lg font-bold text-gray-700">{{ threshold }} 分</div>
          <input
            v-else
            type="number"
            v-model.number="thresholdDraft[idx]"
            min="1"
            class="w-full text-center py-1 rounded-lg text-sm font-bold outline-none border"
            :style="{ borderColor: levelColors[idx + 1], color: levelColors[idx + 1] }"
          />
        </div>
      </div>

      <!-- Level visualization bar -->
      <div class="relative h-8 rounded-full overflow-hidden flex">
        <div class="h-full flex items-center justify-center text-xs font-bold text-white" :style="{ width: `${(thresholds[0] / thresholds[3]) * 100}%`, background: levelColors[1] }">
          <span v-if="(thresholds[0] / thresholds[3]) > 0.1">0-{{ thresholds[0] }}</span>
        </div>
        <div class="h-full flex items-center justify-center text-xs font-bold text-white" :style="{ width: `${((thresholds[1] - thresholds[0]) / thresholds[3]) * 100}%`, background: levelColors[2] }">
          <span v-if="((thresholds[1] - thresholds[0]) / thresholds[3]) > 0.08">{{ thresholds[0] }}-{{ thresholds[1] }}</span>
        </div>
        <div class="h-full flex items-center justify-center text-xs font-bold text-white" :style="{ width: `${((thresholds[2] - thresholds[1]) / thresholds[3]) * 100}%`, background: levelColors[3] }">
          <span v-if="((thresholds[2] - thresholds[1]) / thresholds[3]) > 0.08">{{ thresholds[1] }}-{{ thresholds[2] }}</span>
        </div>
        <div class="h-full flex-1 flex items-center justify-center text-xs font-bold text-white" :style="{ background: levelColors[4] }">
          {{ thresholds[2] }}-{{ thresholds[3] }}+
        </div>
      </div>
    </section>

    <!-- ─── Theme Settings ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <h2 class="text-lg font-bold text-gray-800">🎨 主题设置</h2>
      <div class="flex gap-4">
        <button
          @click="themeStore.setStyle('cartoon')"
          class="flex-1 p-4 rounded-2xl border-2 transition-all"
          :class="themeStore.style === 'cartoon' ? 'border-[#4ecdc4] bg-[#4ecdc4]/10' : 'border-gray-200 hover:border-gray-300'"
        >
          <div class="text-3xl mb-2">🎠</div>
          <div class="font-semibold text-gray-800 text-sm">卡通模式</div>
          <div class="text-xs text-gray-400 mt-1">柔和色彩、圆角卡片、轻量装饰</div>
          <div v-if="themeStore.style === 'cartoon'" class="mt-2 text-xs text-[#4ecdc4] font-semibold">✓ 当前模式</div>
        </button>
        <button
          @click="themeStore.setStyle('minimal')"
          class="flex-1 p-4 rounded-2xl border-2 transition-all"
          :class="themeStore.style === 'minimal' ? 'border-[#4ecdc4] bg-[#4ecdc4]/10' : 'border-gray-200 hover:border-gray-300'"
        >
          <div class="text-3xl mb-2">📐</div>
          <div class="font-semibold text-gray-800 text-sm">简洁模式</div>
          <div class="text-xs text-gray-400 mt-1">扁平风格、小圆角、无装饰</div>
          <div v-if="themeStore.style === 'minimal'" class="mt-2 text-xs text-[#4ecdc4] font-semibold">✓ 当前模式</div>
        </button>
      </div>
    </section>

    <!-- ─── Pet Settings ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-gray-800">🐾 宠物设置</h2>
          <p class="text-xs text-gray-400 mt-0.5">默认仅允许未分配宠物或积分为 0 的学生更换宠物</p>
        </div>
        <button
          v-if="isOwner"
          @click="appStore.saveAllowPetChange(!appStore.allowPetChange)"
          class="w-10 h-5 rounded-full transition-all relative shrink-0"
          :class="appStore.allowPetChange ? 'bg-[#4ecdc4]' : 'bg-gray-200'"
          title="是否允许有成长积分的学生更换宠物"
        >
          <span class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" :class="appStore.allowPetChange ? 'left-5' : 'left-0.5'"></span>
        </button>
        <span v-else class="text-xs text-gray-400">{{ appStore.allowPetChange ? '已允许' : '未允许' }}</span>
      </div>
      <div>
        <p class="mb-2 text-xs font-medium text-gray-500">主题色</p>
        <div class="flex flex-wrap gap-3">
          <button
            v-for="option in themeColorOptions"
            :key="option.id"
            @click="themeStore.setThemeColor(option.id)"
            class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium text-gray-600 transition-all"
            :class="themeStore.themeColor === option.id ? 'border-gray-500 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'"
          >
            <span class="h-4 w-4 rounded-full border border-black/5" :style="{ background: option.color }"></span>
            {{ option.name }}
          </button>
        </div>
      </div>
    </section>

    <!-- ─── Account Settings ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div>
        <h2 class="text-lg font-bold text-gray-800">🔐 账号设置</h2>
        <p class="text-xs text-gray-400 mt-0.5">当前账号：{{ currentUser?.username || '-' }}</p>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label class="mb-1 block text-xs text-gray-500">当前密码</label>
          <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">新密码</label>
          <input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" placeholder="8-20 位，含大小写字母和数字" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">确认新密码</label>
          <input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
        </div>
      </div>
      <button @click="changePassword" :disabled="passwordSubmitting" class="px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50" :class="[theme.buttonPrimary, theme.buttonRounded]">
        {{ passwordSubmitting ? '保存中...' : '修改密码' }}
      </button>
    </section>

    <!-- ─── Danger Zone ─── -->
    <section class="p-5 rounded-2xl border-2 border-red-200 bg-red-50/50 space-y-4">
      <h2 class="text-lg font-bold text-red-500">⚠️ 危险区域</h2>
      <p class="text-sm text-gray-500">以下操作不可撤销，请谨慎执行。</p>
      <div class="flex flex-wrap gap-3">
        <button
          @click="openResetConfirm"
          class="px-4 py-2 rounded-xl border-2 border-red-200 bg-white text-red-500 text-sm font-semibold hover:bg-red-50 transition-all"
        >🔄 重置当前班级积分</button>
        <button
          @click="showDangerConfirm = 'reset-rules'"
          class="px-4 py-2 rounded-xl border-2 border-orange-200 bg-white text-orange-500 text-sm font-semibold hover:bg-orange-50 transition-all"
        >📋 重置积分规则为默认</button>
        <button
          @click="openDeactivateConfirm"
          class="px-4 py-2 rounded-xl border-2 border-red-300 bg-white text-red-600 text-sm font-semibold hover:bg-red-50 transition-all"
        >注销当前账号</button>
      </div>
    </section>

    <!-- ─── Rule Add/Edit Modal ─── -->
    <Transition name="modal">
      <div v-if="ruleModalMode" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="ruleModalMode = null">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-gray-800 mb-5">{{ ruleModalMode === 'add' ? '➕ 新增规则' : '✏️ 编辑规则' }}</h3>
          <div class="space-y-4">
            <div>
              <label class="text-sm text-gray-600 mb-1 block">规则名称 <span class="text-red-400">*</span></label>
              <input v-model="ruleForm.name" placeholder="例：认真听讲" class="w-full px-3 py-2 outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div>
              <label class="text-sm text-gray-600 mb-2 block">图标</label>
              <div class="grid grid-cols-8 gap-1.5">
                <button
                  v-for="icon in COMMON_ICONS"
                  :key="icon"
                  @click="ruleForm.icon = icon"
                  class="w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all hover:scale-110"
                  :class="ruleForm.icon === icon ? 'bg-[#4ecdc4]/20 ring-2 ring-[#4ecdc4]' : 'bg-gray-50 hover:bg-gray-100'"
                >{{ icon }}</button>
              </div>
              <input v-model="ruleForm.icon" class="mt-2 w-full px-3 py-1.5 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" placeholder="或输入自定义 emoji" maxlength="2" />
            </div>
            <div>
              <label class="text-sm text-gray-600 mb-1 block">分值</label>
              <div class="flex gap-2 items-center">
                <button @click="ruleForm.value = Math.abs(ruleForm.value) * -1" class="px-3 py-2 rounded-xl text-sm font-bold transition-all" :class="ruleForm.value < 0 ? 'bg-[#ff6b9d] text-white' : 'bg-gray-100 text-gray-500'">扣分</button>
                <button @click="ruleForm.value = Math.abs(ruleForm.value)" class="px-3 py-2 rounded-xl text-sm font-bold transition-all" :class="ruleForm.value > 0 ? 'bg-[#4ecdc4] text-white' : 'bg-gray-100 text-gray-500'">加分</button>
                <input
                  type="number"
                  :value="Math.abs(ruleForm.value)"
                  @input="(e: Event) => { const v = parseInt((e.target as HTMLInputElement).value); ruleForm.value = ruleForm.value < 0 ? -Math.abs(v || 1) : Math.abs(v || 1) }"
                  min="1"
                  max="100"
                  class="flex-1 px-3 py-2 outline-none text-center font-bold"
                  :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                />
                <span class="text-sm text-gray-400">分</span>
              </div>
              <div class="text-center mt-2 text-lg font-black" :class="ruleForm.value > 0 ? 'text-[#4ecdc4]' : 'text-[#ff6b9d]'">
                {{ ruleForm.value > 0 ? '+' : '' }}{{ ruleForm.value }}
              </div>
            </div>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input v-model="ruleForm.isQuick" type="checkbox" class="h-4 w-4 accent-[#4ecdc4]" />
              显示在课堂快捷模式
            </label>
            <div class="flex gap-3 pt-2">
              <button @click="ruleModalMode = null" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
              <button @click="submitRule" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">
                {{ ruleModalMode === 'add' ? '创建' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Danger confirm modal -->
    <Transition name="modal">
      <div v-if="showDangerConfirm" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showDangerConfirm = null">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-red-500 mb-2">⚠️ 确认操作</h3>
          <p class="text-sm text-gray-500 mb-4">
            <span v-if="showDangerConfirm === 'reset-class'">将按所选范围清理成长数据。此操作不可撤销。</span>
            <span v-else>将重置当前班级的积分规则为系统默认值。此操作不可撤销。</span>
          </p>
          <div v-if="showDangerConfirm === 'reset-class'" class="space-y-4 mb-4">
            <div>
              <label class="mb-1 block text-xs text-gray-500">重置范围</label>
              <select v-model="resetScope" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
                <option value="current">当前班级：{{ appStore.currentClass?.name }}</option>
                <option v-if="isOwner" value="all">全部班级</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-gray-500">清理内容</label>
              <select v-model="resetMode" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
                <option value="score">仅重置积分</option>
                <option value="score_badges">重置积分和徽章</option>
                <option value="all_growth">重置全部成长数据</option>
              </select>
              <p v-if="resetMode === 'all_growth'" class="mt-1 text-xs text-gray-400">将清空积分、徽章、当前装扮和装扮库存，保留学生、宠物种类与昵称。</p>
            </div>
            <div>
              <label class="mb-1 block text-xs text-gray-500">输入“{{ expectedResetConfirmation }}”确认</label>
              <input v-model="resetConfirmation" type="text" autocomplete="off" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div v-if="resetScope === 'all'">
              <label class="mb-1 block text-xs text-gray-500">当前密码</label>
              <input v-model="resetPassword" type="password" autocomplete="current-password" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
          </div>
          <div class="flex gap-3">
            <button @click="showDangerConfirm = null" :disabled="resetSubmitting" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">取消</button>
            <button @click="confirmDanger" :disabled="resetSubmitting" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50">
              {{ resetSubmitting ? '处理中...' : '确认执行' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Account deactivate modal -->
    <Transition name="modal">
      <div v-if="showDeactivateConfirm" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="closeDeactivateConfirm">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-red-500 mb-2">注销当前账号</h3>
          <p class="text-sm text-gray-500 mb-4">账号注销后将立即退出登录，历史数据仍会保留。请输入当前密码，并填写“注销账号”确认操作。</p>
          <div class="space-y-3">
            <input
              v-model="deactivateForm.password"
              type="password"
              autocomplete="current-password"
              placeholder="当前密码"
              class="w-full px-3 py-2 text-sm outline-none"
              :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
            />
            <input
              v-model="deactivateForm.confirmation"
              type="text"
              autocomplete="off"
              placeholder="输入：注销账号"
              class="w-full px-3 py-2 text-sm outline-none"
              :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
            />
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="closeDeactivateConfirm" :disabled="deactivateSubmitting" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">取消</button>
            <button @click="deactivateAccount" :disabled="deactivateSubmitting" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50">
              {{ deactivateSubmitting ? '处理中...' : '确认注销' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
