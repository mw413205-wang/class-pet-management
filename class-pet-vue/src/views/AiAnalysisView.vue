<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import { api, getStoredUser } from '@/services/api'

interface AiPromptTemplate {
  id: number
  name: string
  promptText: string
  updatedAt?: string
}

interface AiReportJob {
  id: number
  classId: number
  scope: 'single' | 'batch'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out'
  totalCount: number
  completedCount: number
  failedCount: number
  targetStudentIds: number[]
  errorMessage: string | null
  retryCount: number
  createdByName: string | null
  createdAt: string
}

interface AiStudentReport {
  id: number
  classId: number
  studentId: number
  jobId: number
  studentName: string
  scoreSnapshot: number
  badgeSnapshot: number
  riskLevel: 'low' | 'medium' | 'high'
  strengths: string[]
  suggestions: string[]
  metrics: Record<string, unknown>
  reportText: string
  createdByName: string | null
  createdAt: string
}

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()
const currentUser = getStoredUser()
const isOwner = currentUser?.role === 'owner'

const promptTemplate = ref<AiPromptTemplate | null>(null)
const promptDraft = ref('')
const reports = ref<AiStudentReport[]>([])
const selectedReport = ref<AiStudentReport | null>(null)
const selectedStudentIds = ref<Set<number>>(new Set())
const studentFilter = ref('')
const loading = ref(false)
const generating = ref(false)
const promptSaving = ref(false)
const currentJob = ref<AiReportJob | null>(null)

const filteredStudents = computed(() => {
  const keyword = studentFilter.value.trim().toLowerCase()
  const students = appStore.currentStudents
  if (!keyword) return students
  return students.filter(student => student.name.toLowerCase().includes(keyword))
})

const selectedStudents = computed(() =>
  appStore.currentStudents.filter(student => selectedStudentIds.value.has(student.id)),
)

const riskLabels = {
  low: '稳定',
  medium: '关注',
  high: '高关注',
}

const riskClasses = {
  low: 'bg-[#4ecdc4]/10 text-[#2a9d8f]',
  medium: 'bg-[#ffd93d]/20 text-[#a16207]',
  high: 'bg-red-50 text-red-500',
}

function toggleStudent(studentId: number) {
  const next = new Set(selectedStudentIds.value)
  if (next.has(studentId)) next.delete(studentId)
  else {
    if (next.size >= 100) {
      appStore.addToast('单次最多生成 100 名学生报告', 'warning')
      return
    }
    next.add(studentId)
  }
  selectedStudentIds.value = next
}

function selectVisibleStudents() {
  selectedStudentIds.value = new Set(filteredStudents.value.slice(0, 100).map(student => student.id))
}

function clearSelection() {
  selectedStudentIds.value = new Set()
}

async function loadPromptTemplate() {
  promptTemplate.value = await api<AiPromptTemplate>('/ai/prompt-template')
  promptDraft.value = promptTemplate.value.promptText
}

async function savePromptTemplate() {
  if (!isOwner || promptSaving.value) return
  const text = promptDraft.value.trim()
  if (!text || text.length > 2000) {
    appStore.addToast('Prompt 模板需为 1-2000 个字符', 'warning')
    return
  }
  promptSaving.value = true
  try {
    promptTemplate.value = await api<AiPromptTemplate>('/ai/prompt-template', {
      method: 'PUT',
      body: JSON.stringify({ promptText: text }),
    })
    promptDraft.value = promptTemplate.value.promptText
    appStore.addToast('Prompt 模板已保存', 'success')
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : 'Prompt 保存失败', 'error')
  } finally {
    promptSaving.value = false
  }
}

async function loadReports() {
  const classId = appStore.currentClassId
  if (!classId) return
  loading.value = true
  try {
    reports.value = await api<AiStudentReport[]>(`/ai/reports?classId=${classId}`)
    if (selectedReport.value && !reports.value.some(report => report.id === selectedReport.value?.id)) {
      selectedReport.value = reports.value[0] ?? null
    }
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '报告加载失败', 'error')
  } finally {
    loading.value = false
  }
}

async function generateReports(studentIds: number[]) {
  if (!studentIds.length || generating.value) return
  generating.value = true
  try {
    currentJob.value = await api<AiReportJob>('/ai/report-jobs', {
      method: 'POST',
      body: JSON.stringify({ classId: appStore.currentClassId, studentIds }),
    })
    appStore.addToast(`已生成 ${currentJob.value.completedCount} 份学情报告`, 'success')
    clearSelection()
    await loadReports()
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '报告生成失败', 'error')
  } finally {
    generating.value = false
  }
}

function generateSelectedReports() {
  void generateReports(Array.from(selectedStudentIds.value))
}

function generateSingleReport(studentId: number) {
  void generateReports([studentId])
}

function generateAllReports() {
  void generateReports(appStore.currentStudents.slice(0, 100).map(student => student.id))
}

async function cancelCurrentJob() {
  if (!currentJob.value || !['pending', 'running'].includes(currentJob.value.status)) return
  try {
    await api(`/ai/report-jobs/${currentJob.value.id}/cancel`, { method: 'POST' })
    appStore.addToast('任务已取消', 'info')
    currentJob.value = await api<AiReportJob>(`/ai/report-jobs/${currentJob.value.id}`)
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '任务取消失败', 'error')
  }
}

async function retryCurrentJob() {
  if (!currentJob.value || !['failed', 'cancelled', 'timed_out'].includes(currentJob.value.status)) return
  try {
    currentJob.value = await api<AiReportJob>(`/ai/report-jobs/${currentJob.value.id}/retry`, { method: 'POST' })
    appStore.addToast('任务已重试', 'success')
    await loadReports()
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '任务重试失败', 'error')
  }
}

async function regenerateReport(report: AiStudentReport) {
  try {
    currentJob.value = await api<AiReportJob>(`/ai/reports/${report.id}/regenerate`, { method: 'POST' })
    appStore.addToast('报告已重新生成', 'success')
    await loadReports()
    const freshReport = reports.value.find(item => item.jobId === currentJob.value?.id && item.studentId === report.studentId)
    if (freshReport) selectedReport.value = freshReport
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '重新生成失败', 'error')
  }
}

async function deleteReport(report: AiStudentReport) {
  try {
    await api(`/ai/reports/${report.id}`, { method: 'DELETE' })
    appStore.addToast('报告已删除', 'info')
    if (selectedReport.value?.id === report.id) selectedReport.value = null
    await loadReports()
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '删除失败', 'error')
  }
}

watch(() => appStore.currentClassId, () => {
  clearSelection()
  selectedReport.value = null
  void loadReports()
})

onMounted(async () => {
  await Promise.all([loadPromptTemplate(), loadReports()])
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl">🧠</span>
        <div>
          <h1 class="text-3xl font-bold" :class="theme.titleGradient">学情分析</h1>
          <p class="mt-1 text-xs text-gray-400">生成单人或批量成长报告，沉淀历史记录与后续建议</p>
        </div>
      </div>
      <select v-model="appStore.currentClassId" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
        <option v-for="cls in appStore.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
      </select>
    </div>

    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold text-gray-800">Prompt 模板</h2>
          <p class="mt-1 text-xs text-gray-400">历史报告会保存生成时的模板快照</p>
        </div>
        <button
          v-if="isOwner"
          @click="savePromptTemplate"
          :disabled="promptSaving"
          class="rounded-xl bg-[#4ecdc4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >保存模板</button>
      </div>
      <textarea
        v-model="promptDraft"
        :readonly="!isOwner"
        rows="3"
        class="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none disabled:bg-gray-50"
      />
    </section>

    <div class="grid gap-5 xl:grid-cols-[360px_1fr]">
      <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-bold text-gray-800">生成任务</h2>
          <span class="text-xs text-gray-400">最多 100 人</span>
        </div>
        <input
          v-model="studentFilter"
          placeholder="搜索学生"
          class="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
        />
        <div class="mt-3 flex gap-2">
          <button @click="selectVisibleStudents" class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500">选择当前</button>
          <button @click="clearSelection" class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500">清空</button>
          <button
            @click="generateAllReports"
            :disabled="generating || !appStore.currentStudents.length"
            class="ml-auto rounded-lg bg-[#ff9800] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >全班生成</button>
        </div>
        <div class="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          <div v-for="student in filteredStudents" :key="student.id" class="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <input
              type="checkbox"
              :checked="selectedStudentIds.has(student.id)"
              class="accent-[#4ecdc4]"
              @change="toggleStudent(student.id)"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-gray-700">{{ student.name }}</div>
              <div class="text-xs text-gray-400">{{ student.score }} 分 · {{ student.badges }} 徽章</div>
            </div>
            <button @click="generateSingleReport(student.id)" class="rounded-lg px-2 py-1 text-xs text-[#2a9d8f] hover:bg-[#4ecdc4]/10">生成</button>
          </div>
        </div>
        <button
          @click="generateSelectedReports"
          :disabled="generating || !selectedStudents.length"
          class="mt-4 w-full rounded-xl bg-[#4ecdc4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >生成已选 {{ selectedStudents.length }} 人</button>

        <div v-if="currentJob" class="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
          <div class="flex items-center justify-between">
            <span>任务 #{{ currentJob.id }}</span>
            <span class="font-semibold">{{ currentJob.status }}</span>
          </div>
          <div class="mt-1">完成 {{ currentJob.completedCount }} / {{ currentJob.totalCount }}，失败 {{ currentJob.failedCount }}</div>
          <div v-if="currentJob.errorMessage" class="mt-1 text-red-400">{{ currentJob.errorMessage }}</div>
          <div class="mt-2 flex gap-2">
            <button v-if="['pending', 'running'].includes(currentJob.status)" @click="cancelCurrentJob" class="rounded-lg bg-red-50 px-2 py-1 text-red-400">取消</button>
            <button v-if="['failed', 'cancelled', 'timed_out'].includes(currentJob.status)" @click="retryCurrentJob" class="rounded-lg bg-[#4ecdc4]/10 px-2 py-1 text-[#2a9d8f]">重试</button>
          </div>
        </div>
      </section>

      <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'overflow-hidden shadow-sm']">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 class="text-base font-bold text-gray-800">报告历史</h2>
          <button @click="loadReports" class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500">刷新</button>
        </div>
        <div v-if="loading" class="py-16 text-center text-sm text-gray-300">正在加载...</div>
        <div v-else-if="!reports.length" class="py-16 text-center text-sm text-gray-300">暂无学情报告</div>
        <div v-else class="grid gap-0 lg:grid-cols-[340px_1fr]">
          <div class="max-h-[620px] overflow-y-auto border-r border-gray-100">
            <button
              v-for="report in reports"
              :key="report.id"
              @click="selectedReport = report"
              class="block w-full border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50"
              :class="selectedReport?.id === report.id ? 'bg-[#4ecdc4]/5' : ''"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-semibold text-gray-700">{{ report.studentName }}</span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="riskClasses[report.riskLevel]">{{ riskLabels[report.riskLevel] }}</span>
              </div>
              <div class="mt-1 text-xs text-gray-400">{{ report.createdAt }} · {{ report.scoreSnapshot }} 分</div>
            </button>
          </div>
          <div class="min-h-[520px] p-5">
            <div v-if="!selectedReport" class="flex h-full items-center justify-center text-sm text-gray-300">选择一份报告查看详情</div>
            <div v-else class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-xl font-bold text-gray-800">{{ selectedReport.studentName }}</h3>
                  <p class="mt-1 text-xs text-gray-400">{{ selectedReport.createdAt }} · {{ selectedReport.createdByName ?? '系统' }}</p>
                </div>
                <div class="flex gap-2">
                  <button @click="regenerateReport(selectedReport)" class="rounded-xl bg-[#4ecdc4]/10 px-3 py-2 text-xs font-semibold text-[#2a9d8f]">重新生成</button>
                  <button @click="deleteReport(selectedReport)" class="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-400">删除</button>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-3">
                <div class="rounded-xl bg-gray-50 p-3">
                  <div class="text-xs text-gray-400">积分快照</div>
                  <div class="mt-1 text-xl font-black text-[#ff9800]">{{ selectedReport.scoreSnapshot }}</div>
                </div>
                <div class="rounded-xl bg-gray-50 p-3">
                  <div class="text-xs text-gray-400">徽章快照</div>
                  <div class="mt-1 text-xl font-black text-[#4ecdc4]">{{ selectedReport.badgeSnapshot }}</div>
                </div>
                <div class="rounded-xl bg-gray-50 p-3">
                  <div class="text-xs text-gray-400">关注等级</div>
                  <div class="mt-1 text-xl font-black">{{ riskLabels[selectedReport.riskLevel] }}</div>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="rounded-xl bg-[#4ecdc4]/5 p-3">
                  <div class="mb-2 text-sm font-bold text-gray-700">优势</div>
                  <ul class="space-y-1 text-sm text-gray-500">
                    <li v-for="item in selectedReport.strengths" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div class="rounded-xl bg-[#ffd93d]/10 p-3">
                  <div class="mb-2 text-sm font-bold text-gray-700">建议</div>
                  <ul class="space-y-1 text-sm text-gray-500">
                    <li v-for="item in selectedReport.suggestions" :key="item">{{ item }}</li>
                  </ul>
                </div>
              </div>
              <pre class="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm leading-7 text-gray-600">{{ selectedReport.reportText }}</pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
