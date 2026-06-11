<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import type { Student } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Config ───────────────────────────────────────────────
const filterGroupId = ref('all')
const excludeCalled = ref(true)
const calledIds = ref<Set<number>>(new Set())
const pickCount = ref(1)

const pool = computed(() => {
  let list = appStore.currentStudents
  if (filterGroupId.value !== 'all') {
    list = list.filter(s => s.groupId === filterGroupId.value)
  }
  if (excludeCalled.value) {
    list = list.filter(s => !calledIds.value.has(s.id))
  }
  return list
})

// ─── Animation ────────────────────────────────────────────
const rolling = ref(false)
const displayStudents = ref<Student[]>([])
const finalStudents = ref<Student[]>([])
const showResult = ref(false)

let rollInterval: ReturnType<typeof setInterval> | null = null

function stopRoll() {
  if (rollInterval) clearInterval(rollInterval)
  rollInterval = null
  rolling.value = false
}

function shuffleStudents(students: Student[]) {
  const shuffled = [...students]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function startRoll() {
  if (rolling.value) return
  if (pool.value.length === 0) {
    appStore.addToast('没有可选学生了', 'warning')
    return
  }
  const count = Math.min(pickCount.value, pool.value.length)
  showResult.value = false
  rolling.value = true

  let tick = 0
  const maxTicks = 30 + Math.floor(Math.random() * 20)

  rollInterval = setInterval(() => {
    const shuffled = shuffleStudents(pool.value)
    displayStudents.value = shuffled.slice(0, count)
    tick++
    if (tick >= maxTicks) {
      stopRoll()
      // Final pick
      const shuffledFinal = shuffleStudents(pool.value)
      finalStudents.value = shuffledFinal.slice(0, count)
      displayStudents.value = finalStudents.value
      showResult.value = true
      // Mark called
      finalStudents.value.forEach(s => calledIds.value.add(s.id))
    }
  }, 80)
}

function resetCalled() {
  stopRoll()
  calledIds.value.clear()
  showResult.value = false
  displayStudents.value = []
  finalStudents.value = []
}

watch(() => appStore.currentClassId, () => {
  filterGroupId.value = 'all'
  pickCount.value = 1
  resetCalled()
})

onUnmounted(() => {
  stopRoll()
})

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl animate-spin-slow">🎲</span>
      <h1 class="text-3xl font-bold" :class="theme.titleGradient">随机点名</h1>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Control panel -->
      <div class="space-y-4">
        <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm space-y-4']">
          <h3 class="font-semibold text-gray-700">⚙️ 配置</h3>

          <div>
            <label class="text-xs text-gray-500 mb-1.5 block">当前班级</label>
            <select v-model="appStore.currentClassId" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
              <option v-for="cls in appStore.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
            </select>
          </div>

          <!-- Group filter -->
          <div>
            <label class="text-xs text-gray-500 mb-1.5 block">范围筛选</label>
            <select v-model="filterGroupId" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
              <option value="all">全班 ({{ appStore.currentStudents.length }}人)</option>
              <option v-for="g in appStore.currentGroups" :key="g.id" :value="g.id">
                {{ g.name }} ({{ appStore.currentStudents.filter(s => s.groupId === g.id).length }}人)
              </option>
            </select>
          </div>

          <!-- Count -->
          <div>
            <label class="text-xs text-gray-500 mb-1.5 block">选取人数</label>
            <div class="flex gap-2 items-center">
              <button @click="pickCount = Math.max(1, pickCount - 1)" class="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-all">-</button>
              <div class="flex-1 text-center text-2xl font-black text-[#4ecdc4]">{{ pickCount }}</div>
              <button @click="pickCount = Math.min(pool.length || 10, pickCount + 1)" class="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-all">+</button>
            </div>
          </div>

          <!-- Exclude called -->
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <button
              @click="excludeCalled = !excludeCalled"
              class="w-10 h-5 rounded-full transition-all relative"
              :class="excludeCalled ? 'bg-[#4ecdc4]' : 'bg-gray-200'"
            >
              <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" :class="excludeCalled ? 'left-5' : 'left-0.5'"></div>
            </button>
            排除已点名 ({{ calledIds.size }}人)
          </label>

          <!-- Available count -->
          <div class="text-sm text-gray-400 text-center">
            可选 <span class="font-bold text-[#4ecdc4]">{{ pool.length }}</span> 人
          </div>

          <button
            @click="resetCalled"
            class="w-full py-2 rounded-xl bg-gray-100 text-gray-500 text-sm hover:bg-gray-200 transition-all"
          >🔄 重置已点名记录</button>
        </div>

        <!-- Called list -->
        <div v-if="calledIds.size > 0" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
          <div class="text-sm font-semibold text-gray-600 mb-2">已点名 ({{ calledIds.size }})</div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="id in Array.from(calledIds)"
              :key="id"
              class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
            >{{ appStore.students.find(s => s.id === id)?.name }}</span>
          </div>
        </div>
      </div>

      <!-- Roll area -->
      <div class="lg:col-span-2 flex flex-col items-center gap-6">
        <!-- Display area -->
        <div
          class="w-full min-h-[280px] flex flex-col items-center justify-center gap-6 rounded-3xl transition-all"
          :class="[
            theme.cardBg,
            showResult && !rolling
              ? 'border-4 border-[#4ecdc4] bg-[#4ecdc4]/5 shadow-xl'
              : [theme.cardBorder, 'shadow-sm']
          ]"
        >
          <!-- Idle state -->
          <div v-if="!rolling && !showResult" class="text-center space-y-3">
            <div class="text-8xl animate-bounce-light">🎲</div>
            <div class="text-gray-400 text-lg">点击下方按钮开始点名</div>
            <div class="text-sm text-gray-300">当前可选 {{ pool.length }} 名学生</div>
          </div>

          <!-- Rolling animation -->
          <div v-else-if="rolling || showResult"
            class="flex flex-wrap gap-6 justify-center p-6 w-full"
          >
            <div
              v-for="(student, idx) in displayStudents"
              :key="student.id + '-' + idx"
              class="flex flex-col items-center gap-2 transition-all duration-75"
              :class="rolling ? 'opacity-80 scale-95' : 'scale-100 opacity-100'"
            >
              <PetAvatar :student="student" size="xl" :show-level="true" />
              <div class="text-xl font-black text-gray-800">{{ student.name }}</div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-bold" :style="{ color: levelColors[appStore.getLevel(student.score)] }">{{ student.score }}分</span>
                <span v-if="appStore.getGroupById(student.groupId)" class="text-xs px-2 py-0.5 rounded-full" :style="{ background: appStore.getGroupById(student.groupId)!.color + '22', color: appStore.getGroupById(student.groupId)!.color }">
                  {{ appStore.getGroupById(student.groupId)!.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Result announcement -->
          <div v-if="showResult && !rolling" class="text-center">
            <div class="text-2xl font-black text-[#4ecdc4]">🎉 点名结果</div>
          </div>
        </div>

        <!-- Roll button -->
        <button
          @click="startRoll"
          :disabled="rolling || pool.length === 0"
          class="w-full max-w-xs py-5 text-white text-xl font-black rounded-3xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          :class="rolling
            ? 'bg-gradient-to-r from-[#ffd93d] to-[#ff9800] animate-pulse'
            : 'bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#4ecdc4] hover:shadow-2xl'"
        >
          {{ rolling ? '🎲 抽取中...' : pool.length === 0 ? '😅 没有更多学生了' : '🎲 开始点名！' }}
        </button>

        <div v-if="pool.length === 0 && excludeCalled" class="text-sm text-[#ff9800] text-center">
          所有学生已被点名 → <button @click="resetCalled" class="underline font-medium">重置记录</button>
        </div>
      </div>
    </div>
  </div>
</template>
