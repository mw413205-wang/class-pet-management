<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import PetLevelUpModal from '@/components/PetLevelUpModal.vue'
import { getPetById } from '@/data/petData'
import type { Student, ScoreRule } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Filters ──────────────────────────────────────────────
const searchQuery = ref('')
const selectedGroupId = ref('all')
const sortBy = ref<'score-desc' | 'score-asc' | 'name' | 'level-desc'>('score-desc')
const viewMode = ref<'grid' | 'compact'>('grid')

const filteredStudents = computed(() => {
  let list = appStore.currentStudents
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q))
  }
  if (selectedGroupId.value !== 'all') {
    list = list.filter(s => s.groupId === selectedGroupId.value)
  }
  return [...list].sort((a, b) => {
    if (sortBy.value === 'score-desc') return b.score - a.score
    if (sortBy.value === 'score-asc') return a.score - b.score
    if (sortBy.value === 'level-desc') return appStore.getLevel(b.score) - appStore.getLevel(a.score)
    return a.name.localeCompare(b.name, 'zh')
  })
})

// ─── Stats ────────────────────────────────────────────────
const totalStudents = computed(() => appStore.currentStudents.length)
const avgScore = computed(() => {
  const s = appStore.currentStudents
  return s.length ? Math.round(s.reduce((sum, x) => sum + x.score, 0) / s.length) : 0
})
const totalBadges = computed(() => appStore.currentStudents.reduce((sum, s) => sum + s.badges, 0))
const topStudent = computed(() => {
  const s = appStore.currentStudents
  return s.length ? s.reduce((top, x) => x.score > top.score ? x : top, s[0]) : null
})

// ─── Selected Student & Quick Score ───────────────────────
const selectedStudentId = ref<number | null>(null)
const selectedStudents = ref<Set<number>>(new Set())
const batchMode = ref(false)

const selectedStudent = computed(() =>
  selectedStudentId.value ? appStore.students.find(s => s.id === selectedStudentId.value) : null
)
const currentRules = computed(() => appStore.currentRules.filter(r => r.enabled))

function selectStudent(student: Student) {
  if (batchMode.value) {
    if (selectedStudents.value.has(student.id)) {
      selectedStudents.value.delete(student.id)
    } else {
      selectedStudents.value.add(student.id)
    }
  } else {
    selectedStudentId.value = selectedStudentId.value === student.id ? null : student.id
  }
}

// Score pop animations
const scorePops = ref<{ id: number; text: string; x: number; y: number }[]>()
scorePops.value = []

function applyRule(rule: ScoreRule, event?: MouseEvent) {
  if (batchMode.value) {
    if (selectedStudents.value.size === 0) return
    appStore.batchAddScore(Array.from(selectedStudents.value), rule)
    showPop(rule.value, event)
  } else if (selectedStudentId.value) {
    appStore.addScore(selectedStudentId.value, rule)
    showPop(rule.value, event)
  }
}

function showPop(value: number, event?: MouseEvent) {
  const id = Date.now()
  const x = event ? event.clientX : window.innerWidth / 2
  const y = event ? event.clientY : 200
  scorePops.value!.push({ id, text: (value > 0 ? '+' : '') + value, x, y })
  setTimeout(() => {
    scorePops.value = scorePops.value!.filter(p => p.id !== id)
  }, 900)
}

function toggleBatchMode() {
  batchMode.value = !batchMode.value
  if (!batchMode.value) selectedStudents.value.clear()
  selectedStudentId.value = null
}

function selectAll() {
  filteredStudents.value.forEach(s => selectedStudents.value.add(s.id))
}

// ─── Undo panel ───────────────────────────────────────────
const showUndo = ref(false)

// ─── Level colors ─────────────────────────────────────────
const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']

function getGroupInfo(groupId: string) {
  return appStore.getGroupById(groupId)
}
</script>

<template>
  <!-- Score pop overlay -->
  <Teleport to="body">
    <div v-for="pop in scorePops" :key="pop.id"
      class="fixed pointer-events-none font-black text-2xl animate-score-pop z-[9999]"
      :style="{ left: pop.x + 'px', top: pop.y + 'px', color: pop.text.startsWith('+') ? '#22c55e' : '#ef4444', transform: 'translate(-50%,-50%)' }"
    >{{ pop.text }}</div>
  </Teleport>

  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl animate-bounce-light">⭐</span>
        <h1 class="text-3xl font-bold" :class="theme.titleGradient">学生成长墙</h1>
        <span v-if="theme.enableEmojis" class="text-4xl animate-bounce-light" style="animation-delay:0.5s">🌟</span>
      </div>
      <div class="flex gap-2">
        <button
          @click="showUndo = !showUndo"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'text-gray-600 hover:text-[#4ecdc4]']"
        >↩ 撤回记录</button>
        <button
          @click="toggleBatchMode"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all"
          :class="batchMode
            ? 'bg-[#4ecdc4] text-white rounded-xl shadow-md'
            : [theme.cardBg, theme.cardBorder, theme.cardRounded, 'text-gray-600 hover:text-[#4ecdc4]']"
        >{{ batchMode ? '✓ 批量模式' : '☐ 批量操作' }}</button>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-4 flex items-center gap-3" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']">
        <div class="w-12 h-12 rounded-2xl bg-[#4ecdc4]/20 flex items-center justify-center text-2xl">👥</div>
        <div>
          <div class="text-2xl font-black text-[#4ecdc4]">{{ totalStudents }}</div>
          <div class="text-xs text-gray-500">全班人数</div>
        </div>
      </div>
      <div class="p-4 flex items-center gap-3" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']">
        <div class="w-12 h-12 rounded-2xl bg-[#ffd93d]/20 flex items-center justify-center text-2xl">⭐</div>
        <div>
          <div class="text-2xl font-black text-[#ffd93d]">{{ avgScore }}</div>
          <div class="text-xs text-gray-500">平均积分</div>
        </div>
      </div>
      <div class="p-4 flex items-center gap-3" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']">
        <div class="w-12 h-12 rounded-2xl bg-[#ff9800]/20 flex items-center justify-center text-2xl">🏅</div>
        <div>
          <div class="text-2xl font-black text-[#ff9800]">{{ totalBadges }}</div>
          <div class="text-xs text-gray-500">班级徽章</div>
        </div>
      </div>
      <div class="p-4 flex items-center gap-3" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']">
        <div class="w-12 h-12 rounded-2xl bg-[#ff6b9d]/20 flex items-center justify-center text-2xl">👑</div>
        <div>
          <div class="text-lg font-black text-[#ff6b9d] truncate max-w-[80px]">{{ topStudent?.name ?? '-' }}</div>
          <div class="text-xs text-gray-500">积分第一</div>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-wrap gap-3 items-center" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-3 shadow-sm']">
      <!-- Search -->
      <div class="relative flex-1 min-w-[140px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          v-model="searchQuery"
          placeholder="搜索学生..."
          class="w-full pl-8 pr-3 py-1.5 text-sm outline-none"
          :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
        />
      </div>
      <!-- Group filter -->
      <select
        v-model="selectedGroupId"
        class="px-3 py-1.5 text-sm outline-none"
        :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
      >
        <option value="all">全部小组</option>
        <option v-for="g in appStore.currentGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      <!-- Sort -->
      <select
        v-model="sortBy"
        class="px-3 py-1.5 text-sm outline-none"
        :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
      >
        <option value="score-desc">积分从高到低</option>
        <option value="score-asc">积分从低到高</option>
        <option value="level-desc">等级从高到低</option>
        <option value="name">按姓名</option>
      </select>
      <!-- View toggle -->
      <div class="flex gap-1 ml-auto">
        <button @click="viewMode = 'grid'" :class="viewMode === 'grid' ? 'bg-[#4ecdc4] text-white' : 'bg-gray-100 text-gray-500'" class="px-2.5 py-1.5 rounded-lg text-sm transition-all">⊞</button>
        <button @click="viewMode = 'compact'" :class="viewMode === 'compact' ? 'bg-[#4ecdc4] text-white' : 'bg-gray-100 text-gray-500'" class="px-2.5 py-1.5 rounded-lg text-sm transition-all">≡</button>
      </div>
    </div>

    <!-- Batch mode bar -->
    <Transition name="dropdown">
      <div v-if="batchMode"
        class="flex items-center gap-3 p-3 rounded-2xl bg-[#4ecdc4]/10 border-2 border-[#4ecdc4]"
      >
        <span class="text-sm font-semibold text-[#4ecdc4]">已选 {{ selectedStudents.size }} 人</span>
        <button @click="selectAll" class="text-xs px-2.5 py-1 rounded-lg bg-[#4ecdc4] text-white">全选当前页</button>
        <button @click="selectedStudents.clear()" class="text-xs px-2.5 py-1 rounded-lg bg-gray-200 text-gray-600">清除选择</button>
        <span class="text-xs text-gray-500 ml-1">← 点击规则按钮批量加/扣分</span>
      </div>
    </Transition>

    <div class="flex gap-5 items-start">
      <!-- Student grid/compact -->
      <div class="flex-1 min-w-0">
        <!-- Grid view -->
        <div v-if="viewMode === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <div
            v-for="student in filteredStudents"
            :key="student.id"
            @click="selectStudent(student)"
            class="relative cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95 overflow-hidden shadow-sm hover:shadow-lg"
            :class="[
              theme.cardRounded,
              (selectedStudentId === student.id || selectedStudents.has(student.id)) ? 'ring-2 ring-[#4ecdc4] ring-offset-1' : ''
            ]"
            style="aspect-ratio: 3/4;"
          >
            <!-- 卡片背景渐变（无图时显示） -->
            <div
              class="absolute inset-0"
              :style="{ background: `linear-gradient(160deg, ${(getPetById(student.petId??'')?.baseColor??'#ccc')}33 0%, ${(getPetById(student.petId??'')?.baseColor??'#ccc')}11 100%)` }"
            />

            <!-- 动物展示区：PetAvatar 统一负责真实图片、降级 emoji、装扮、动画和特效 -->
            <div class="absolute inset-0 flex items-center justify-center p-2" style="bottom: 52px;">
              <PetAvatar :student="student" size="xl" />
            </div>

            <!-- Batch checkbox -->
            <div v-if="batchMode" class="absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center z-10"
              :class="selectedStudents.has(student.id) ? 'bg-[#4ecdc4] border-[#4ecdc4]' : 'bg-white/80 border-gray-300'"
            >
              <span v-if="selectedStudents.has(student.id)" class="text-white text-xs font-bold">✓</span>
            </div>

            <!-- 小组色点 -->
            <div
              v-if="getGroupInfo(student.groupId)"
              class="absolute top-2 right-2 w-2.5 h-2.5 rounded-full z-10 shadow"
              :style="{ background: getGroupInfo(student.groupId)!.color }"
            />

            <!-- 底部信息栏：固定高度，渐变背景 -->
            <div
              class="absolute bottom-0 left-0 right-0 z-10 px-2.5 py-2 flex flex-col justify-end gap-2"
              style="height: 62px; background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 65%, transparent 100%);"
            >
              <!-- 第一行：等级 + 阶段名 + 姓名 + 积分 + 徽章 -->
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  class="text-xs font-black px-2 py-0.5 rounded-full leading-none shrink-0"
                  :style="{ background: levelColors[appStore.getLevel(student.score)], color: appStore.getLevel(student.score) === 2 ? '#333' : '#fff' }"
                >Lv.{{ appStore.getLevel(student.score) + 1 }}</span>
                <span class="text-xs text-white/80 shrink-0">{{ getPetById(student.petId??'')?.stages[appStore.getLevel(student.score)] ?? '' }}</span>
                <span class="text-sm font-bold text-white truncate flex-1 min-w-0">{{ student.name }}</span>
                <span class="text-xs font-bold text-yellow-300 shrink-0">{{ student.score }}分</span>
                <span class="text-xs text-orange-300 shrink-0">🏅×{{ student.badges }}</span>
              </div>
              <!-- 第二行：进度条 -->
              <div class="w-full h-2 bg-white/25 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{ width: appStore.getProgress(student.score).percent + '%', background: levelColors[appStore.getLevel(student.score)] }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Compact view -->
        <div v-else class="space-y-1.5">
          <div
            v-for="(student, idx) in filteredStudents"
            :key="student.id"
            @click="selectStudent(student)"
            class="flex items-center gap-3 px-3 py-2 cursor-pointer transition-all hover:shadow-md"
            :class="[
              theme.cardBg, theme.cardBorder, theme.cardRounded,
              (selectedStudentId === student.id || selectedStudents.has(student.id)) ? 'ring-2 ring-[#4ecdc4]' : ''
            ]"
          >
            <!-- Rank -->
            <span class="w-7 text-center text-xs font-bold"
              :class="idx === 0 ? 'text-[#ffd700]' : idx === 1 ? 'text-[#aaa]' : idx === 2 ? 'text-[#cd7f32]' : 'text-gray-400'"
            >{{ idx < 3 ? ['🥇','🥈','🥉'][idx] : (idx+1) }}</span>

            <!-- Avatar small -->
            <PetAvatar :student="student" size="xs" />

            <!-- Name + group -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-gray-700">{{ student.name }}</div>
              <div class="text-xs text-gray-400">{{ getGroupInfo(student.groupId)?.name }}</div>
            </div>

            <!-- Progress bar -->
            <div class="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: appStore.getProgress(student.score).percent + '%', background: levelColors[appStore.getLevel(student.score)] }"></div>
            </div>

            <!-- Score -->
            <div class="text-sm font-bold w-14 text-right" :style="{ color: levelColors[appStore.getLevel(student.score)] }">{{ student.score }}</div>
            <div v-if="student.badges > 0" class="text-xs text-[#ff9800]">🏅×{{ student.badges }}</div>
          </div>
        </div>

        <div v-if="filteredStudents.length === 0" class="text-center py-16 text-gray-400">
          <div class="text-5xl mb-3">🔍</div>
          <div>没有找到匹配的学生</div>
        </div>
      </div>

      <!-- Quick score panel -->
      <Transition name="dropdown">
        <div v-if="selectedStudentId || (batchMode && selectedStudents.size > 0)"
          class="w-64 shrink-0 sticky top-4"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-lg space-y-3']"
        >
          <div class="font-semibold text-gray-700 text-sm">
            {{ batchMode ? `批量操作 (${selectedStudents.size}人)` : `为 ${selectedStudent?.name} 加分` }}
          </div>

          <!-- Selected student preview (single mode) -->
          <div v-if="!batchMode && selectedStudent" class="flex flex-col items-center py-2">
            <PetAvatar :student="selectedStudent" size="lg" :show-level="true" :show-score="true" />
          </div>

          <!-- Rules -->
          <div class="space-y-1.5">
            <button
              v-for="rule in currentRules"
              :key="rule.id"
              @click="(e) => applyRule(rule, e)"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:shadow-md active:scale-95 text-sm font-medium"
              :class="rule.value > 0
                ? 'bg-gradient-to-r from-[#4ecdc4]/10 to-[#95e1d3]/10 hover:from-[#4ecdc4]/20 border border-[#4ecdc4]/30 text-[#2a9d8f]'
                : 'bg-gradient-to-r from-[#ff6b9d]/10 to-[#ff8fab]/10 hover:from-[#ff6b9d]/20 border border-[#ff6b9d]/30 text-[#c44569]'"
            >
              <span>{{ rule.icon }}</span>
              <span class="flex-1 text-left">{{ rule.name }}</span>
              <span class="font-bold">{{ rule.value > 0 ? '+' : '' }}{{ rule.value }}</span>
            </button>
          </div>

          <!-- Recent actions for student -->
          <div v-if="!batchMode && selectedStudentId" class="pt-2 border-t border-gray-100">
            <div class="text-xs text-gray-400 mb-1.5 font-medium">最近操作</div>
            <div v-for="action in appStore.getStudentRecentActions(selectedStudentId!)" :key="action.id"
              class="flex items-center justify-between text-xs py-0.5"
            >
              <span class="text-gray-500">{{ action.ruleName }}</span>
              <span :class="action.value > 0 ? 'text-[#4ecdc4]' : 'text-[#ff6b9d]'" class="font-bold">{{ action.value > 0 ? '+' : '' }}{{ action.value }}</span>
              <button @click="appStore.revertAction(action.id)" class="text-gray-300 hover:text-red-400 transition-colors ml-1">↩</button>
            </div>
            <div v-if="appStore.getStudentRecentActions(selectedStudentId!).length === 0" class="text-xs text-gray-300">暂无操作记录</div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Undo panel modal -->
    <Transition name="modal">
      <div v-if="showUndo" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showUndo = false">
        <div class="w-full max-w-lg animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">↩ 撤回记录</h3>
            <button @click="showUndo = false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>
          <div class="space-y-2 max-h-80 overflow-y-auto">
            <div v-for="action in appStore.recentActions.filter(a => !a.reverted).slice(0, 20)" :key="action.id"
              class="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all"
            >
              <span :class="action.value > 0 ? 'text-[#4ecdc4]' : 'text-[#ff6b9d]'" class="font-bold w-10 text-right text-sm">
                {{ action.value > 0 ? '+' : '' }}{{ action.value }}
              </span>
              <div class="flex-1">
                <span class="text-sm font-medium text-gray-700">{{ action.studentName }}</span>
                <span class="text-xs text-gray-400 ml-1.5">{{ action.ruleName }}</span>
              </div>
              <span class="text-xs text-gray-300">{{ new Date(action.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }) }}</span>
              <button @click="appStore.revertAction(action.id)" class="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-all">撤回</button>
            </div>
            <div v-if="appStore.recentActions.filter(a => !a.reverted).length === 0" class="text-center py-8 text-gray-300">暂无可撤回的操作</div>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <!-- 宠物升级庆典弹窗 -->
  <PetLevelUpModal
    :event="appStore.levelUpEvent"
    @close="appStore.clearLevelUpEvent()"
  />
</template>
