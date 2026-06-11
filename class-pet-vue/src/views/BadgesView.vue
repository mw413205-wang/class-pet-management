<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/services/api'
import PetAvatar from '@/components/PetAvatar.vue'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

interface CustomBadge {
  id: number
  classId: number
  name: string
  icon: string
  description: string
  enabled: boolean
}

interface BadgeHistoryRecord {
  id: number
  studentId: number
  studentName: string
  type: 'milestone' | 'exchange' | 'manual' | 'weekly' | 'monthly' | 'semester'
  amount: number
  description: string
  customBadgeId?: number
  customBadgeName?: string
  icon?: string
  operatorName?: string
  time: string
}

const customBadges = ref<CustomBadge[]>([])
const badgeHistory = ref<BadgeHistoryRecord[]>([])
const badgeLoading = ref(false)
const showBadgeEditor = ref(false)
const showAwardModal = ref(false)
const badgeEditor = ref({ id: null as number | null, name: '', icon: '🏅', description: '', enabled: true })
const awardForm = ref({ studentId: '', customBadgeId: '', amount: 1 })
const historyFilters = ref({ from: '', to: '', studentId: '', type: '', customBadgeId: '' })
let badgeRequestId = 0
let customBadgeRequestId = 0

const enabledCustomBadges = computed(() => customBadges.value.filter(badge => badge.enabled))

async function loadCustomBadges() {
  const classId = appStore.currentClassId
  if (!classId) return
  const requestId = ++customBadgeRequestId
  try {
    const badges = await api<CustomBadge[]>(`/badges/custom?classId=${classId}`)
    if (requestId === customBadgeRequestId && classId === appStore.currentClassId) customBadges.value = badges
  } catch (error) {
    if (requestId === customBadgeRequestId) {
      appStore.addToast(`徽章模板加载失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
    }
  }
}

async function loadBadgeHistory() {
  const classId = appStore.currentClassId
  if (!classId) return
  const requestId = ++badgeRequestId
  badgeLoading.value = true
  try {
    const params = new URLSearchParams({ classId: String(classId) })
    Object.entries(historyFilters.value).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    const records = await api<BadgeHistoryRecord[]>(`/badges/records?${params}`)
    if (requestId === badgeRequestId && classId === appStore.currentClassId) badgeHistory.value = records
  } catch (error) {
    if (requestId === badgeRequestId) {
      appStore.addToast(`徽章流水加载失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
    }
  } finally {
    if (requestId === badgeRequestId) badgeLoading.value = false
  }
}

function openBadgeEditor(badge?: CustomBadge) {
  badgeEditor.value = badge
    ? { id: badge.id, name: badge.name, icon: badge.icon, description: badge.description, enabled: badge.enabled }
    : { id: null, name: '', icon: '🏅', description: '', enabled: true }
  showBadgeEditor.value = true
}

async function saveCustomBadge() {
  const payload = {
    classId: appStore.currentClassId,
    name: badgeEditor.value.name,
    icon: badgeEditor.value.icon,
    description: badgeEditor.value.description,
    enabled: badgeEditor.value.enabled,
  }
  try {
    if (badgeEditor.value.id) {
      await api(`/badges/custom/${badgeEditor.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      await api('/badges/custom', { method: 'POST', body: JSON.stringify(payload) })
    }
    showBadgeEditor.value = false
    await loadCustomBadges()
    appStore.addToast('自定义徽章已保存', 'success')
  } catch (error) {
    appStore.addToast(`徽章保存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

async function removeCustomBadge(badge: CustomBadge) {
  if (!window.confirm(`确认删除徽章「${badge.name}」吗？历史颁发记录会保留。`)) return
  try {
    await api(`/badges/custom/${badge.id}`, { method: 'DELETE' })
    await loadCustomBadges()
    appStore.addToast('自定义徽章已删除', 'info')
  } catch (error) {
    appStore.addToast(`徽章删除失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

function openAwardModal() {
  awardForm.value = {
    studentId: String(appStore.currentStudents[0]?.id ?? ''),
    customBadgeId: String(enabledCustomBadges.value[0]?.id ?? ''),
    amount: 1,
  }
  showAwardModal.value = true
}

async function awardBadge() {
  try {
    await api('/badges/awards', {
      method: 'POST',
      body: JSON.stringify({
        classId: appStore.currentClassId,
        studentId: Number(awardForm.value.studentId),
        customBadgeId: Number(awardForm.value.customBadgeId),
        amount: Number(awardForm.value.amount),
      }),
    })
    showAwardModal.value = false
    await Promise.all([appStore.loadPersistedState(), loadBadgeHistory()])
    appStore.addToast('徽章已颁发', 'success')
  } catch (error) {
    appStore.addToast(`徽章颁发失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
  }
}

function resetHistoryFilters() {
  historyFilters.value = { from: '', to: '', studentId: '', type: '', customBadgeId: '' }
  void loadBadgeHistory()
}

// ─── Leaderboard tabs ─────────────────────────────────────
type RankTab = 'score' | 'badges' | 'level'
const activeTab = ref<RankTab>('score')

const rankedStudents = computed(() => {
  const list = [...appStore.currentStudents]
  if (activeTab.value === 'score') return list.sort((a, b) => b.score - a.score)
  if (activeTab.value === 'badges') return list.sort((a, b) => b.badges - a.badges)
  return list.sort((a, b) => appStore.getLevel(b.score) - appStore.getLevel(a.score) || b.score - a.score)
})

const top3 = computed(() => rankedStudents.value.slice(0, 3))
const rest = computed(() => rankedStudents.value.slice(3))

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']

const badgeTypes = [
  { id: 'score_100', icon: '🥉', name: '百分达人', desc: '积分达到100', color: '#cd7f32' },
  { id: 'score_200', icon: '🥈', name: '双百勇士', desc: '积分达到200', color: '#aaa' },
  { id: 'week_top', icon: '🌟', name: '周榜荣誉', desc: '自然周榜前10名', color: '#ff9800' },
  { id: 'month_top', icon: '🏆', name: '月榜荣誉', desc: '自然月榜前10名', color: '#4ecdc4' },
  { id: 'semester_top', icon: '👑', name: '学期荣誉', desc: '学期榜前10名', color: '#ff6b9d' },
]

// Stats
const studentsWithBadges = computed(() => appStore.currentStudents.filter(s => s.badges > 0).length)
const currentStudentIds = computed(() => new Set(appStore.currentStudents.map(student => student.id)))
const currentBadgeRecords = computed(() => appStore.badgeRecords.filter(record => currentStudentIds.value.has(record.studentId)))
const totalBadgeBalance = computed(() => appStore.currentStudents.reduce((sum, student) => sum + student.badges, 0))
const totalBadgesEarned = computed(() => currentBadgeRecords.value.filter(record => record.amount > 0).reduce((sum, record) => sum + record.amount, 0))
const weeklyBadgesEarned = computed(() => {
  const now = new Date()
  const weekday = now.getDay() || 7
  now.setDate(now.getDate() - weekday + 1)
  now.setHours(0, 0, 0, 0)
  return currentBadgeRecords.value
    .filter(record => record.amount > 0 && record.timestamp >= now.getTime())
    .reduce((sum, record) => sum + record.amount, 0)
})
const honorRecords = computed(() =>
  currentBadgeRecords.value
    .filter(record => ['weekly', 'monthly', 'semester'].includes(record.type))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12)
)
const honorTypeInfo = {
  weekly: { icon: '🌟', label: '周榜荣誉', color: '#ff9800' },
  monthly: { icon: '🏆', label: '月榜荣誉', color: '#4ecdc4' },
  semester: { icon: '👑', label: '学期荣誉', color: '#ff6b9d' },
} as const

watch(() => appStore.currentClassId, () => {
  badgeRequestId += 1
  customBadgeRequestId += 1
  historyFilters.value = { from: '', to: '', studentId: '', type: '', customBadgeId: '' }
  void Promise.all([loadCustomBadges(), loadBadgeHistory()])
})

onMounted(() => void Promise.all([loadCustomBadges(), loadBadgeHistory()]))
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl animate-bounce-light">🏆</span>
      <h1 class="text-3xl font-bold" :class="theme.titleGradient">徽章墙</h1>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-3xl font-black text-[#ffd700]">{{ totalBadgeBalance }}</div>
        <div class="text-xs text-gray-400 mt-1">徽章余额</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-3xl font-black text-[#ff9800]">{{ totalBadgesEarned }}</div>
        <div class="text-xs text-gray-400 mt-1">累计获得</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-3xl font-black text-[#ff6b9d]">{{ weeklyBadgesEarned }}</div>
        <div class="text-xs text-gray-400 mt-1">本周新增</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-3xl font-black text-[#4ecdc4]">{{ studentsWithBadges }}</div>
        <div class="text-xs text-gray-400 mt-1">当前持有学生</div>
      </div>
    </div>

    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-700">🎨 自定义徽章</h3>
          <p class="mt-1 text-xs text-gray-400">按班级配置，历史颁发记录保留当时的名称和图标。</p>
        </div>
        <div class="flex gap-2">
          <button
            @click="openAwardModal"
            :disabled="!enabledCustomBadges.length || !appStore.currentStudents.length"
            class="rounded-xl bg-[#ff9800] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >颁发徽章</button>
          <button @click="openBadgeEditor()" class="rounded-xl bg-[#4ecdc4] px-3 py-2 text-sm font-semibold text-white">新建徽章</button>
        </div>
      </div>
      <div v-if="customBadges.length" class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="badge in customBadges" :key="badge.id" class="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <span class="text-2xl">{{ badge.icon }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold text-gray-700">{{ badge.name }}</span>
              <span v-if="!badge.enabled" class="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-500">已停用</span>
            </div>
            <div class="truncate text-xs text-gray-400">{{ badge.description || '暂无说明' }}</div>
          </div>
          <button @click="openBadgeEditor(badge)" class="text-xs font-semibold text-[#2a9d8f]">编辑</button>
          <button @click="removeCustomBadge(badge)" class="text-xs font-semibold text-red-400">删除</button>
        </div>
      </div>
      <div v-else class="py-5 text-center text-xs text-gray-300">尚未配置自定义徽章</div>
    </section>

    <!-- Badge types legend -->
    <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <h3 class="text-sm font-semibold text-gray-600 mb-3">🎖️ 徽章类型</h3>
      <div class="flex gap-3 flex-wrap">
        <div v-for="badge in badgeTypes" :key="badge.id" class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50">
          <span class="text-xl">{{ badge.icon }}</span>
          <div>
            <div class="text-xs font-semibold" :style="{ color: badge.color }">{{ badge.name }}</div>
            <div class="text-[10px] text-gray-400">{{ badge.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="honorRecords.length" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <h3 class="mb-3 text-sm font-semibold text-gray-600">✨ 近期荣誉徽章</h3>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="record in honorRecords" :key="record.id" class="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <span class="text-2xl">{{ honorTypeInfo[record.type as keyof typeof honorTypeInfo].icon }}</span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-gray-700">{{ appStore.students.find(student => student.id === record.studentId)?.name ?? '学生' }}</div>
            <div class="truncate text-xs text-gray-400">{{ record.description }}</div>
          </div>
          <span class="text-[10px] font-bold" :style="{ color: honorTypeInfo[record.type as keyof typeof honorTypeInfo].color }">
            {{ honorTypeInfo[record.type as keyof typeof honorTypeInfo].label }}
          </span>
        </div>
      </div>
    </div>

    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-gray-700">📜 徽章流水</h3>
        <span class="text-xs text-gray-400">最多展示最近 200 条</span>
      </div>
      <div class="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <input v-model="historyFilters.from" type="date" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none" />
        <input v-model="historyFilters.to" type="date" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none" />
        <select v-model="historyFilters.studentId" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="">全部学生</option>
          <option v-for="student in appStore.currentStudents" :key="student.id" :value="String(student.id)">{{ student.name }}</option>
        </select>
        <select v-model="historyFilters.type" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="">全部来源</option>
          <option value="milestone">积分里程碑</option>
          <option value="weekly">周榜荣誉</option>
          <option value="monthly">月榜荣誉</option>
          <option value="semester">学期荣誉</option>
          <option value="manual">教师颁发</option>
          <option value="exchange">兑换消费</option>
        </select>
        <select v-model="historyFilters.customBadgeId" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="">全部自定义徽章</option>
          <option v-for="badge in customBadges" :key="badge.id" :value="String(badge.id)">{{ badge.icon }} {{ badge.name }}</option>
        </select>
        <div class="flex gap-2">
          <button @click="loadBadgeHistory" class="flex-1 rounded-xl bg-[#4ecdc4] px-3 py-2 text-sm font-semibold text-white">查询</button>
          <button @click="resetHistoryFilters" class="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-500">重置</button>
        </div>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead class="border-y border-gray-100 bg-gray-50 text-left text-xs text-gray-400">
            <tr>
              <th class="px-3 py-2.5">时间</th>
              <th class="px-3 py-2.5">学生</th>
              <th class="px-3 py-2.5">徽章</th>
              <th class="px-3 py-2.5">变化</th>
              <th class="px-3 py-2.5">说明</th>
              <th class="px-3 py-2.5">操作教师</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in badgeHistory" :key="record.id" class="border-b border-gray-50">
              <td class="whitespace-nowrap px-3 py-2.5 text-xs text-gray-400">{{ record.time }}</td>
              <td class="px-3 py-2.5 text-gray-600">{{ record.studentName }}</td>
              <td class="px-3 py-2.5 text-gray-600">{{ record.icon || '🏅' }} {{ record.customBadgeName || record.type }}</td>
              <td class="px-3 py-2.5 font-bold" :class="record.amount > 0 ? 'text-[#2a9d8f]' : 'text-red-400'">{{ record.amount > 0 ? '+' : '' }}{{ record.amount }}</td>
              <td class="max-w-xs truncate px-3 py-2.5 text-xs text-gray-400" :title="record.description">{{ record.description }}</td>
              <td class="px-3 py-2.5 text-xs text-gray-400">{{ record.operatorName || '-' }}</td>
            </tr>
            <tr v-if="!badgeLoading && badgeHistory.length === 0">
              <td colspan="6" class="py-8 text-center text-xs text-gray-300">暂无匹配流水</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Rank tabs -->
    <div class="flex gap-1 p-1 rounded-2xl bg-gray-100 w-fit">
      <button
        v-for="(label, key) in { score: '⭐ 积分榜', badges: '🏅 徽章榜', level: '🏆 等级榜' }"
        :key="key"
        @click="activeTab = key as RankTab"
        class="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        :class="activeTab === key ? 'bg-white shadow text-[#4ecdc4]' : 'text-gray-500 hover:text-gray-700'"
      >{{ label }}</button>
    </div>

    <!-- Top 3 podium -->
    <div v-if="top3.length >= 3" class="flex items-end justify-center gap-4 py-4">
      <!-- 2nd place -->
      <div class="flex flex-col items-center gap-2">
        <PetAvatar :student="top3[1]" size="lg" :show-level="true" />
        <div class="text-sm font-bold text-gray-700">{{ top3[1].name }}</div>
        <div class="w-20 flex flex-col items-center justify-end rounded-t-2xl py-4 shadow-lg"
          style="height: 90px; background: linear-gradient(to bottom, #e8e8e8, #c0c0c0)">
          <span class="text-2xl">🥈</span>
          <div class="text-xs font-bold text-gray-600 mt-1">{{ activeTab === 'badges' ? top3[1].badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(top3[1].score)+1) : top3[1].score + '分' }}</div>
        </div>
      </div>
      <!-- 1st place -->
      <div class="flex flex-col items-center gap-2 -translate-y-4">
        <div v-if="theme.enableEmojis" class="text-2xl animate-bounce-light">👑</div>
        <PetAvatar :student="top3[0]" size="xl" :show-level="true" />
        <div class="text-base font-bold text-gray-800">{{ top3[0].name }}</div>
        <div class="w-24 flex flex-col items-center justify-end rounded-t-2xl py-5 shadow-xl"
          style="height: 120px; background: linear-gradient(to bottom, #ffe57a, #ffd700)">
          <span class="text-3xl">🥇</span>
          <div class="text-sm font-black text-[#7d5c00] mt-1">{{ activeTab === 'badges' ? top3[0].badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(top3[0].score)+1) : top3[0].score + '分' }}</div>
        </div>
      </div>
      <!-- 3rd place -->
      <div class="flex flex-col items-center gap-2">
        <PetAvatar :student="top3[2]" size="lg" :show-level="true" />
        <div class="text-sm font-bold text-gray-700">{{ top3[2].name }}</div>
        <div class="w-20 flex flex-col items-center justify-end rounded-t-2xl py-3 shadow-lg"
          style="height: 72px; background: linear-gradient(to bottom, #f0c890, #cd7f32)">
          <span class="text-2xl">🥉</span>
          <div class="text-xs font-bold text-[#7a3e00] mt-1">{{ activeTab === 'badges' ? top3[2].badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(top3[2].score)+1) : top3[2].score + '分' }}</div>
        </div>
      </div>
    </div>

    <!-- Rest of list -->
    <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm overflow-hidden']">
      <div
        v-for="(student, idx) in rest"
        :key="student.id"
        class="flex items-center gap-4 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
      >
        <span class="w-8 text-center text-sm font-bold text-gray-400">{{ idx + 4 }}</span>
        <PetAvatar :student="student" size="sm" />
        <div class="flex-1">
          <div class="text-sm font-semibold text-gray-800">{{ student.name }}</div>
          <div class="text-xs text-gray-400">{{ appStore.getGroupById(student.groupId)?.name }}</div>
        </div>
        <!-- Badges display -->
        <div class="flex gap-1">
          <span v-for="n in Math.min(student.badges, 5)" :key="n" class="text-lg">🏅</span>
          <span v-if="student.badges > 5" class="text-xs text-[#ff9800] font-bold">×{{ student.badges }}</span>
        </div>
        <div class="text-right">
          <div class="text-sm font-black" :style="{ color: levelColors[appStore.getLevel(student.score)] }">
            {{ activeTab === 'badges' ? student.badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(student.score)+1) : student.score + '分' }}
          </div>
        </div>
      </div>
      <div v-if="rankedStudents.length === 0" class="text-center py-10 text-gray-300">暂无数据</div>
    </div>

    <div v-if="showBadgeEditor" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form @submit.prevent="saveCustomBadge" class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 class="text-lg font-bold text-gray-800">{{ badgeEditor.id ? '编辑徽章' : '新建徽章' }}</h3>
        <div class="mt-4 grid gap-3">
          <input v-model="badgeEditor.name" required maxlength="40" placeholder="徽章名称" class="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" />
          <input v-model="badgeEditor.icon" maxlength="32" placeholder="图标，例如 🏅" class="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" />
          <textarea v-model="badgeEditor.description" maxlength="100" rows="3" placeholder="徽章说明" class="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"></textarea>
          <label class="flex items-center gap-2 text-sm text-gray-600">
            <input v-model="badgeEditor.enabled" type="checkbox" />
            启用该徽章
          </label>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" @click="showBadgeEditor = false" class="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-500">取消</button>
          <button type="submit" class="rounded-xl bg-[#4ecdc4] px-4 py-2 text-sm font-semibold text-white">保存</button>
        </div>
      </form>
    </div>

    <div v-if="showAwardModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form @submit.prevent="awardBadge" class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 class="text-lg font-bold text-gray-800">颁发徽章</h3>
        <div class="mt-4 grid gap-3">
          <select v-model="awardForm.studentId" required class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
            <option value="" disabled>选择学生</option>
            <option v-for="student in appStore.currentStudents" :key="student.id" :value="String(student.id)">{{ student.name }}</option>
          </select>
          <select v-model="awardForm.customBadgeId" required class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
            <option value="" disabled>选择徽章</option>
            <option v-for="badge in enabledCustomBadges" :key="badge.id" :value="String(badge.id)">{{ badge.icon }} {{ badge.name }}</option>
          </select>
          <input v-model.number="awardForm.amount" required type="number" min="1" max="1000" class="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" />
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" @click="showAwardModal = false" class="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-500">取消</button>
          <button type="submit" class="rounded-xl bg-[#ff9800] px-4 py-2 text-sm font-semibold text-white">确认颁发</button>
        </div>
      </form>
    </div>
  </div>
</template>
