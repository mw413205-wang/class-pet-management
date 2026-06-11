<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/services/api'

interface ActionLog {
  id: number
  classId: number | null
  className: string | null
  studentId: number | null
  studentName: string | null
  actionType: string
  detail: Record<string, unknown>
  operatorUsername: string | null
  operatorName: string | null
  createdAt: string
}

interface ActionLogPage {
  items: ActionLog[]
  total: number
  page: number
  pageSize: number
}

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()
const logs = ref<ActionLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const errorMessage = ref('')
const filters = ref({
  classId: '',
  studentId: '',
  actionType: '',
  from: '',
  to: '',
})

const actionTypes = [
  'CHANGE_PASSWORD', 'DEACTIVATE_ACCOUNT',
  'ADD_SCORE', 'DEDUCT_SCORE', 'REVERT', 'IMPORT_STUDENTS',
  'CREATE_STUDENT', 'UPDATE_STUDENT', 'DELETE_STUDENT', 'RESTORE_STUDENT',
  'UPDATE_STUDENT_PET', 'UPDATE_STUDENT_COSMETICS',
  'CREATE_CLASS', 'UPDATE_CLASS', 'DELETE_CLASS', 'RESET_CLASS', 'RESET_ALL_CLASSES',
  'ADD_CLASS_TEACHER', 'UPDATE_CLASS_TEACHER', 'REMOVE_CLASS_TEACHER',
  'CREATE_GROUP', 'UPDATE_GROUP', 'DELETE_GROUP',
  'CREATE_SCORE_RULE', 'UPDATE_SCORE_RULE', 'DELETE_SCORE_RULE',
  'UPDATE_LEVEL_THRESHOLDS', 'UPDATE_ALLOW_PET_CHANGE', 'UPDATE_SYSTEM_NAME',
  'CREATE_SHOP_CATEGORY', 'RESTORE_SHOP_CATEGORY', 'UPDATE_SHOP_CATEGORY', 'DELETE_SHOP_CATEGORY',
  'CREATE_SHOP_ITEM', 'UPDATE_SHOP_ITEM', 'DELETE_SHOP_ITEM',
  'CREATE_LOTTERY_PRIZE', 'UPDATE_LOTTERY_PRIZE', 'DELETE_LOTTERY_PRIZE',
  'GENERATE_AI_REPORTS', 'REGENERATE_AI_REPORT', 'DELETE_AI_REPORT', 'CANCEL_AI_REPORT_JOB', 'RETRY_AI_REPORT_JOB', 'UPDATE_AI_PROMPT_TEMPLATE',
  'SETTLE_LEADERBOARD', 'EXCHANGE', 'LOTTERY_DRAW',
  'CREATE_CUSTOM_BADGE', 'UPDATE_CUSTOM_BADGE', 'DELETE_CUSTOM_BADGE', 'AWARD_BADGE',
  'CREATE_SYSTEM_ANNOUNCEMENT',
]

const actionLabels: Record<string, string> = {
  CHANGE_PASSWORD: '修改密码',
  DEACTIVATE_ACCOUNT: '停用账号',
  ADD_SCORE: '学生加分',
  DEDUCT_SCORE: '学生扣分',
  REVERT: '撤回积分',
  IMPORT_STUDENTS: '批量导入学生',
  CREATE_STUDENT: '添加学生',
  UPDATE_STUDENT: '编辑学生',
  DELETE_STUDENT: '删除学生',
  RESTORE_STUDENT: '恢复学生',
  UPDATE_STUDENT_PET: '更新宠物',
  UPDATE_STUDENT_COSMETICS: '更新装扮',
  CREATE_CLASS: '创建班级',
  UPDATE_CLASS: '编辑班级',
  DELETE_CLASS: '删除班级',
  RESET_CLASS: '重置班级',
  RESET_ALL_CLASSES: '重置全部班级',
  ADD_CLASS_TEACHER: '添加协作教师',
  UPDATE_CLASS_TEACHER: '调整协作权限',
  REMOVE_CLASS_TEACHER: '移除协作教师',
  SETTLE_LEADERBOARD: '结算排行榜',
  CREATE_GROUP: '创建小组',
  UPDATE_GROUP: '编辑小组',
  DELETE_GROUP: '删除小组',
  CREATE_SCORE_RULE: '创建积分规则',
  UPDATE_SCORE_RULE: '编辑积分规则',
  DELETE_SCORE_RULE: '删除积分规则',
  UPDATE_LEVEL_THRESHOLDS: '调整等级阈值',
  UPDATE_ALLOW_PET_CHANGE: '调整宠物更换设置',
  CREATE_SHOP_CATEGORY: '创建商品分类',
  RESTORE_SHOP_CATEGORY: '恢复商品分类',
  UPDATE_SHOP_CATEGORY: '编辑商品分类',
  DELETE_SHOP_CATEGORY: '删除商品分类',
  CREATE_SHOP_ITEM: '创建商品',
  UPDATE_SHOP_ITEM: '编辑商品',
  DELETE_SHOP_ITEM: '删除商品',
  EXCHANGE: '兑换商品',
  CREATE_LOTTERY_PRIZE: '创建抽奖奖品',
  UPDATE_LOTTERY_PRIZE: '编辑抽奖奖品',
  DELETE_LOTTERY_PRIZE: '删除抽奖奖品',
  LOTTERY_DRAW: '幸运抽奖',
  GENERATE_AI_REPORTS: '生成学情报告',
  REGENERATE_AI_REPORT: '重新生成学情报告',
  DELETE_AI_REPORT: '删除学情报告',
  CANCEL_AI_REPORT_JOB: '取消学情任务',
  RETRY_AI_REPORT_JOB: '重试学情任务',
  UPDATE_AI_PROMPT_TEMPLATE: '修改 AI Prompt',
  CREATE_CUSTOM_BADGE: '创建自定义徽章',
  UPDATE_CUSTOM_BADGE: '编辑自定义徽章',
  DELETE_CUSTOM_BADGE: '删除自定义徽章',
  AWARD_BADGE: '手动颁发徽章',
  CREATE_SYSTEM_ANNOUNCEMENT: '发布系统公告',
  UPDATE_SYSTEM_NAME: '修改系统名称',
}

const filteredStudents = computed(() => {
  const classId = Number(filters.value.classId)
  return classId
    ? appStore.students.filter(student => student.classId === classId)
    : appStore.students
})
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

function formatDetail(detail: Record<string, unknown>) {
  const entries = Object.entries(detail)
    .filter(([key]) => !['classId', 'studentId'].includes(key))
    .slice(0, 4)
  if (!entries.length) return '-'
  return entries.map(([key, value]) => `${key}: ${formatDetailValue(value)}`).join('；')
}

function formatDetailValue(value: unknown) {
  if (value == null) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

let logRequestId = 0

async function loadLogs() {
  const requestId = ++logRequestId
  loading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    const result = await api<ActionLogPage>(`/action-logs?${params}`)
    if (requestId !== logRequestId) return
    logs.value = result.items
    total.value = result.total
  } catch (error) {
    if (requestId !== logRequestId) return
    errorMessage.value = error instanceof Error ? error.message : '日志加载失败'
  } finally {
    if (requestId === logRequestId) loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadLogs()
}

function resetFilters() {
  filters.value = { classId: '', studentId: '', actionType: '', from: '', to: '' }
  applyFilters()
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > pageCount.value) return
  page.value = nextPage
  void loadLogs()
}

onMounted(() => void loadLogs())
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl">🧾</span>
      <div>
        <h1 class="text-3xl font-bold" :class="theme.titleGradient">操作日志</h1>
        <p class="mt-1 text-xs text-gray-400">追踪班级关键操作与执行教师</p>
      </div>
    </div>

    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <select v-model="filters.classId" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="">全部班级</option>
          <option v-for="cls in appStore.classes" :key="cls.id" :value="String(cls.id)">{{ cls.name }}</option>
        </select>
        <select v-model="filters.studentId" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="">全部学生</option>
          <option v-for="student in filteredStudents" :key="student.id" :value="String(student.id)">{{ student.name }}</option>
        </select>
        <select v-model="filters.actionType" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="">全部操作</option>
          <option v-for="type in actionTypes" :key="type" :value="type">{{ actionLabels[type] }}</option>
        </select>
        <input v-model="filters.from" type="date" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none" />
        <input v-model="filters.to" type="date" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none" />
        <div class="flex gap-2">
          <button @click="applyFilters" class="flex-1 rounded-xl bg-[#4ecdc4] px-3 py-2 text-sm font-semibold text-white">查询</button>
          <button @click="resetFilters" class="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-500">重置</button>
        </div>
      </div>
    </section>

    <div v-if="errorMessage" class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-500">{{ errorMessage }}</div>

    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'overflow-hidden shadow-sm']">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-sm">
          <thead class="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-400">
            <tr>
              <th class="px-4 py-3">时间</th>
              <th class="px-4 py-3">操作教师</th>
              <th class="px-4 py-3">班级</th>
              <th class="px-4 py-3">学生</th>
              <th class="px-4 py-3">操作类型</th>
              <th class="px-4 py-3">详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="border-b border-gray-50 last:border-0">
              <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{{ log.createdAt }}</td>
              <td class="px-4 py-3">
                <div class="font-semibold text-gray-700">{{ log.operatorName ?? '系统' }}</div>
                <div v-if="log.operatorUsername" class="text-xs text-gray-400">@{{ log.operatorUsername }}</div>
              </td>
              <td class="px-4 py-3 text-gray-600">{{ log.className ?? '-' }}</td>
              <td class="px-4 py-3 text-gray-600">{{ log.studentName ?? '-' }}</td>
              <td class="px-4 py-3">
                <span class="rounded-full bg-[#4ecdc4]/10 px-2 py-1 text-xs font-semibold text-[#2a9d8f]">
                  {{ actionLabels[log.actionType] ?? log.actionType }}
                </span>
              </td>
              <td class="max-w-sm truncate px-4 py-3 text-xs text-gray-400" :title="formatDetail(log.detail)">
                {{ formatDetail(log.detail) }}
              </td>
            </tr>
            <tr v-if="!loading && logs.length === 0">
              <td colspan="6" class="py-16 text-center text-gray-300">暂无操作日志</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
        <span>共 {{ total }} 条记录</span>
        <div class="flex items-center gap-2">
          <button @click="changePage(page - 1)" :disabled="page <= 1" class="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-500 disabled:opacity-40">上一页</button>
          <span>{{ page }} / {{ pageCount }}</span>
          <button @click="changePage(page + 1)" :disabled="page >= pageCount" class="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-500 disabled:opacity-40">下一页</button>
        </div>
      </div>
    </section>
  </div>
</template>
