<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import type { ScoreRule, Student } from '@/types'

const appStore = useAppStore()
const searchQuery = ref('')
const expandedStudentId = ref<number | null>(null)
const lastFeedback = ref('')
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  void appStore.initializePersistence()
})

const quickRules = computed(() => appStore.currentQuickRules.filter(rule => rule.value > 0).slice(0, 5))
const negativeRules = computed(() => appStore.currentRules.filter(rule => rule.enabled && rule.value < 0))
const filteredStudents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return appStore.currentStudents
  return appStore.currentStudents.filter(student => student.name.toLowerCase().includes(query))
})
const latestActions = computed(() => appStore.recentActions.filter(action => !action.reverted).slice(0, 5))

function applyRule(student: Student, rule: ScoreRule) {
  appStore.addScore(student.id, rule)
  lastFeedback.value = `${student.name} ${rule.value > 0 ? '+' : ''}${rule.value}`
  if (feedbackTimeout) window.clearTimeout(feedbackTimeout)
  feedbackTimeout = window.setTimeout(() => {
    lastFeedback.value = ''
    feedbackTimeout = null
  }, 900)
}

onUnmounted(() => {
  if (feedbackTimeout) window.clearTimeout(feedbackTimeout)
})

function undoLatest() {
  const action = latestActions.value[0]
  if (action) appStore.revertAction(action.id)
}

function closeWindow() {
  window.close()
}
</script>

<template>
  <div class="min-h-screen max-w-[100vw] overflow-x-hidden bg-[#f8fafc] text-gray-800">
    <div v-if="!appStore.persistenceReady" class="fixed inset-0 z-50 flex items-center justify-center bg-white/90 text-sm font-semibold text-gray-500">
      正在加载课堂数据...
    </div>
    <header class="sticky top-0 z-20 max-w-[100vw] border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-base font-bold">课堂快捷加分</h1>
          <p class="text-xs text-gray-400">{{ appStore.currentClass?.name }}</p>
        </div>
        <button @click="closeWindow" class="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100" title="关闭窗口">✕</button>
      </div>
      <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select v-model="appStore.currentClassId" class="min-w-0 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm outline-none">
          <option v-for="cls in appStore.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
        </select>
        <button
          @click="undoLatest"
          :disabled="latestActions.length === 0"
          class="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 disabled:opacity-40"
          title="撤回最近一次操作"
        >↩</button>
      </div>
      <input
        v-model="searchQuery"
        class="mt-2 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#4ecdc4]"
        placeholder="搜索学生"
      />
    </header>

    <main class="max-w-[100vw] space-y-3 p-3">
      <div v-if="lastFeedback" class="rounded-md bg-[#4ecdc4]/10 px-3 py-2 text-center text-sm font-bold text-[#2a9d8f]">
        {{ lastFeedback }}
      </div>

      <section class="rounded-md border border-gray-200 bg-white p-3">
        <div class="mb-2 text-xs font-bold text-gray-500">课堂常用规则</div>
        <div class="flex flex-wrap gap-2">
          <span v-for="rule in quickRules" :key="rule.id" class="rounded-md bg-[#4ecdc4]/10 px-2 py-1 text-xs font-semibold text-[#2a9d8f]">
            {{ rule.icon }} {{ rule.name }} +{{ rule.value }}
          </span>
          <span v-if="quickRules.length === 0" class="text-xs text-gray-300">请先在设置中标记课堂常用规则</span>
        </div>
      </section>

      <section class="space-y-2">
        <article v-for="student in filteredStudents" :key="student.id" class="max-w-full overflow-hidden rounded-md border border-gray-200 bg-white p-3 shadow-sm">
          <div class="flex items-center gap-3">
            <PetAvatar :student="student" size="xs" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-bold">{{ student.name }}</div>
              <div class="text-xs text-gray-400">{{ appStore.getGroupById(student.groupId)?.name }} · {{ student.score }} 分</div>
            </div>
            <button
              @click="expandedStudentId = expandedStudentId === student.id ? null : student.id"
              class="rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-gray-100"
              title="展开扣分规则"
            >•••</button>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <button
              v-for="rule in quickRules.slice(0, 3)"
              :key="rule.id"
              @click="applyRule(student, rule)"
              class="min-w-0 rounded-md bg-[#4ecdc4]/10 px-1 py-2 text-xs font-bold text-[#2a9d8f] hover:bg-[#4ecdc4]/20 active:scale-95"
            >{{ rule.icon }} +{{ rule.value }}</button>
          </div>
          <div v-if="expandedStudentId === student.id" class="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <button
              v-for="rule in negativeRules"
              :key="rule.id"
              @click="applyRule(student, rule)"
              class="rounded-md bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100"
            >{{ rule.icon }} {{ rule.value }}</button>
          </div>
        </article>
        <div v-if="filteredStudents.length === 0" class="py-12 text-center text-sm text-gray-300">没有匹配的学生</div>
      </section>
    </main>

    <footer class="sticky bottom-0 max-w-[100vw] border-t border-gray-200 bg-white px-3 py-2">
      <div class="mb-1 text-xs font-bold text-gray-500">最近操作</div>
      <div class="flex gap-2 overflow-x-auto">
        <span v-for="action in latestActions" :key="action.id" class="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs text-gray-500">
          {{ action.studentName }} {{ action.value > 0 ? '+' : '' }}{{ action.value }}
        </span>
        <span v-if="latestActions.length === 0" class="text-xs text-gray-300">暂无操作</span>
      </div>
    </footer>
  </div>
</template>
