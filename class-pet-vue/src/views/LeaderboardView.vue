<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/services/api'
import PetAvatar from '@/components/PetAvatar.vue'

type RankScope = 'students' | 'groups'
type RankPeriod = 'total' | 'week' | 'month'
type SettlementPeriod = 'week' | 'month' | 'semester'

interface StudentRank {
  studentId: number
  name: string
  score: number
  rank?: number
}

interface GroupRank {
  groupId: string
  name: string
  score: number
  studentCount?: number
  rank?: number
}

interface SettlementSummary {
  id: number
  period: SettlementPeriod
  periodKey: string
  periodStart: string
  periodEnd: string
  awardedCount: number
  createdAt: string
  createdByName: string | null
}

interface SettlementDetail extends SettlementSummary {
  students: StudentRank[]
  groups: GroupRank[]
}

interface PeriodOption {
  offset: number
  periodKey: string
  periodStart: string
  periodEnd: string
  settlementId: number | null
}

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()
const scope = ref<RankScope>('students')
const period = ref<RankPeriod>('total')
const periodOffset = ref(0)
const periodOptions = ref<{ weeks: PeriodOption[], months: PeriodOption[] }>({ weeks: [], months: [] })
const studentRanks = ref<StudentRank[]>([])
const groupRanks = ref<GroupRank[]>([])
const settlements = ref<SettlementSummary[]>([])
const settlementDetail = ref<SettlementDetail | null>(null)
const loading = ref(false)
const settlementLoading = ref(false)
const showSettlementModal = ref(false)
const showSnapshotModal = ref(false)
const settlementForm = ref({
  period: 'week' as SettlementPeriod,
  periodStart: '',
  periodEnd: '',
})

const visiblePeriodOptions = computed(() => period.value === 'week' ? periodOptions.value.weeks : periodOptions.value.months)
const selectedPeriodOption = computed(() => visiblePeriodOptions.value.find(option => option.offset === periodOffset.value))
const periodLabel = computed(() => {
  if (period.value === 'total') return '总榜'
  if (!periodOffset.value) return period.value === 'week' ? '本周' : '本月'
  return selectedPeriodOption.value?.periodKey ?? (period.value === 'week' ? '历史周榜' : '历史月榜')
})
const topStudent = computed(() => studentRanks.value[0])
const topGroup = computed(() => groupRanks.value[0])
const studentRanking = computed(() =>
  studentRanks.value
    .map(rank => ({ rank, student: appStore.students.find(student => student.id === rank.studentId) }))
)
const groupRanking = computed(() =>
  groupRanks.value.map(rank => ({
    rank,
    group: appStore.groups.find(group => group.id === rank.groupId),
    students: appStore.currentStudents.filter(student => student.groupId === rank.groupId),
  }))
)

function settlementLabel(value: SettlementPeriod) {
  return ({ week: '周榜', month: '月榜', semester: '学期榜' })[value]
}

let rankingRequestId = 0
let settlementRequestId = 0
let periodOptionRequestId = 0

async function loadRankings() {
  const requestId = ++rankingRequestId
  const classId = appStore.currentClassId
  const selectedPeriod = period.value
  if (!classId) {
    loading.value = false
    studentRanks.value = []
    groupRanks.value = []
    return
  }
  loading.value = true
  try {
    const params = `classId=${classId}&period=${selectedPeriod}&offset=${periodOffset.value}`
    const [students, groups] = await Promise.all([
      api<StudentRank[]>(`/leaderboards/personal?${params}`),
      api<GroupRank[]>(`/leaderboards/groups?${params}`),
    ])
    if (requestId !== rankingRequestId || classId !== appStore.currentClassId || selectedPeriod !== period.value) return
    studentRanks.value = students
    groupRanks.value = groups
  } catch (error) {
    if (requestId !== rankingRequestId) return
    appStore.addToast(error instanceof Error ? error.message : '排行榜加载失败', 'error')
  } finally {
    if (requestId === rankingRequestId) loading.value = false
  }
}

async function loadPeriodOptions() {
  const requestId = ++periodOptionRequestId
  const classId = appStore.currentClassId
  if (!classId) {
    periodOptions.value = { weeks: [], months: [] }
    return
  }
  try {
    const result = await api<{ weeks: PeriodOption[], months: PeriodOption[] }>(`/leaderboards/period-options?classId=${classId}`)
    if (requestId !== periodOptionRequestId || classId !== appStore.currentClassId) return
    periodOptions.value = result
  } catch (error) {
    if (requestId !== periodOptionRequestId) return
    appStore.addToast(error instanceof Error ? error.message : '排行榜周期加载失败', 'error')
  }
}

async function loadSettlements() {
  const requestId = ++settlementRequestId
  const classId = appStore.currentClassId
  if (!classId) {
    settlements.value = []
    return
  }
  try {
    const result = await api<SettlementSummary[]>(`/leaderboards/settlements?classId=${classId}`)
    if (requestId !== settlementRequestId || classId !== appStore.currentClassId) return
    settlements.value = result
  } catch (error) {
    if (requestId !== settlementRequestId) return
    appStore.addToast(error instanceof Error ? error.message : '结算历史加载失败', 'error')
  }
}

function openSettlement() {
  settlementForm.value = {
    period: period.value === 'total' ? 'semester' : period.value,
    periodStart: '',
    periodEnd: '',
  }
  showSettlementModal.value = true
}

async function submitSettlement() {
  if (settlementLoading.value) return
  const form = settlementForm.value
  if (form.period === 'semester' && (!form.periodStart || !form.periodEnd)) {
    appStore.addToast('请选择学期榜统计日期范围', 'warning')
    return
  }
  settlementLoading.value = true
  try {
    const result = await api<SettlementDetail>('/leaderboards/settlements', {
      method: 'POST',
      body: JSON.stringify({
        classId: appStore.currentClassId,
        period: form.period,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
      }),
    })
    showSettlementModal.value = false
    appStore.addToast(`${settlementLabel(result.period)}结算完成，已发放 ${result.awardedCount} 枚荣誉徽章`, 'success')
    await Promise.all([appStore.loadPersistedState(), loadRankings(), loadSettlements(), loadPeriodOptions()])
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '结算失败', 'error')
  } finally {
    settlementLoading.value = false
  }
}

async function openSnapshot(settlement: SettlementSummary) {
  try {
    settlementDetail.value = await api<SettlementDetail>(`/leaderboards/settlements/${settlement.id}`)
    showSnapshotModal.value = true
  } catch (error) {
    appStore.addToast(error instanceof Error ? error.message : '快照加载失败', 'error')
  }
}

watch(() => appStore.currentClassId, () => {
  periodOffset.value = 0
  void loadRankings()
  void loadSettlements()
  void loadPeriodOptions()
})
watch(period, () => {
  periodOffset.value = 0
  void loadRankings()
})
watch(periodOffset, () => void loadRankings())
onMounted(() => {
  void loadRankings()
  void loadSettlements()
  void loadPeriodOptions()
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl">🏆</span>
        <div>
          <h1 class="text-3xl font-bold" :class="theme.titleGradient">排行榜</h1>
          <p class="mt-1 text-xs text-gray-400">查看实时排行，固化周期快照并发放荣誉徽章</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <select v-model="appStore.currentClassId" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
          <option v-for="cls in appStore.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
        </select>
        <button @click="openSettlement" class="rounded-xl bg-[#ff9800] px-4 py-2 text-sm font-semibold text-white shadow-sm">
          🏅 结算榜单
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
        <div class="text-xs text-gray-400">{{ periodLabel }}个人第一</div>
        <div class="mt-1 truncate text-lg font-black text-[#ff6b9d]">{{ topStudent?.name ?? '-' }}</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
        <div class="text-xs text-gray-400">{{ periodLabel }}最高分</div>
        <div class="mt-1 text-2xl font-black text-[#ff9800]">{{ topStudent?.score ?? 0 }}</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
        <div class="text-xs text-gray-400">{{ periodLabel }}小组第一</div>
        <div class="mt-1 truncate text-lg font-black text-[#4ecdc4]">{{ topGroup?.name ?? '-' }}</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
        <div class="text-xs text-gray-400">历史结算</div>
        <div class="mt-1 text-2xl font-black text-[#4ecdc4]">{{ settlements.length }}</div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          v-for="(label, value) in { students: '个人榜', groups: '小组榜' }"
          :key="value"
          @click="scope = value as RankScope"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
          :class="scope === value ? 'bg-white text-[#2a9d8f] shadow-sm' : 'text-gray-500'"
        >{{ label }}</button>
      </div>
      <div class="flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          v-for="(label, value) in { total: '总榜', week: '周榜', month: '月榜' }"
          :key="value"
          @click="period = value as RankPeriod"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
          :class="period === value ? 'bg-white text-[#ff9800] shadow-sm' : 'text-gray-500'"
        >{{ label }}</button>
      </div>
      <select
        v-if="period !== 'total'"
        v-model.number="periodOffset"
        class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
      >
        <option v-for="option in visiblePeriodOptions" :key="option.periodKey" :value="option.offset">
          {{ option.offset === 0 ? (period === 'week' ? '本周' : '本月') : option.periodKey }}
          {{ option.settlementId ? ' · 已固化' : '' }}
        </option>
      </select>
      <span v-if="period !== 'total'" class="text-xs text-gray-400">
        {{ periodOffset ? '历史周期优先读取固化快照' : '当前周期按积分流水实时统计' }}
      </span>
    </div>

    <section v-if="scope === 'students'" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'overflow-hidden shadow-sm']">
      <div v-for="(item, index) in studentRanking" :key="item.rank.studentId" class="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0">
        <span class="w-8 text-center text-lg font-black" :class="index < 3 ? 'text-[#ff9800]' : 'text-gray-300'">
          {{ index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1 }}
        </span>
        <PetAvatar v-if="item.student" :student="item.student" size="sm" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-bold text-gray-700">{{ item.rank.name }}</div>
          <div class="text-xs text-gray-400">{{ item.student ? appStore.getGroupById(item.student.groupId)?.name : '-' }}</div>
        </div>
        <div class="text-right">
          <div class="font-black text-[#4ecdc4]">{{ item.rank.score }} 分</div>
          <div v-if="period !== 'total' && item.student" class="text-xs text-gray-300">累计 {{ item.student.score }}</div>
        </div>
      </div>
      <div v-if="!loading && studentRanking.length === 0" class="py-14 text-center text-sm text-gray-300">暂无排行数据</div>
    </section>

    <section v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="(item, index) in groupRanking" :key="item.rank.groupId" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}` }}</span>
            <span class="font-bold text-gray-700">{{ item.rank.name }}</span>
          </div>
          <span class="h-3 w-3 rounded-full" :style="{ background: item.group?.color ?? '#9ca3af' }"></span>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div><div class="text-lg font-black text-[#4ecdc4]">{{ item.rank.score }}</div><div class="text-xs text-gray-400">积分</div></div>
          <div><div class="text-lg font-black text-[#ff9800]">{{ (item.rank.studentCount ?? item.students.length) ? Math.round(item.rank.score / (item.rank.studentCount ?? item.students.length)) : 0 }}</div><div class="text-xs text-gray-400">人均</div></div>
          <div><div class="text-lg font-black text-[#ff6b9d]">{{ item.rank.studentCount ?? item.students.length }}</div><div class="text-xs text-gray-400">成员</div></div>
        </div>
      </article>
    </section>

    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'overflow-hidden shadow-sm']">
      <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h2 class="text-sm font-bold text-gray-700">历史结算快照</h2>
          <p class="mt-0.5 text-xs text-gray-400">快照固化后不受后续积分变化影响</p>
        </div>
      </div>
      <div v-for="item in settlements" :key="item.id" class="flex flex-wrap items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
        <span class="rounded-full bg-[#ffd93d]/20 px-2 py-1 text-xs font-bold text-[#a16207]">{{ settlementLabel(item.period) }}</span>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-gray-700">{{ item.periodKey }}</div>
          <div class="text-xs text-gray-400">{{ item.periodStart }} 至 {{ item.periodEnd }} · {{ item.createdByName ?? '系统' }}</div>
        </div>
        <span class="text-xs text-gray-400">发放 {{ item.awardedCount }} 枚</span>
        <button @click="openSnapshot(item)" class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200">查看</button>
      </div>
      <div v-if="settlements.length === 0" class="py-10 text-center text-sm text-gray-300">暂无结算快照</div>
    </section>

    <Transition name="modal">
      <div v-if="showSettlementModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showSettlementModal = false">
        <div class="w-full max-w-md p-6 shadow-2xl" :class="[theme.cardBg, theme.cardRounded]">
          <h3 class="text-lg font-bold text-gray-800">🏅 结算排行榜</h3>
          <p class="mt-1 text-xs text-gray-400">前 10 名且周期积分大于 0 的学生将各获得 1 枚荣誉徽章。</p>
          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">结算类型</label>
              <select v-model="settlementForm.period" class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none">
                <option value="week">当前自然周</option>
                <option value="month">当前自然月</option>
                <option value="semester">学期榜</option>
              </select>
            </div>
            <div v-if="settlementForm.period === 'semester'" class="grid grid-cols-2 gap-3">
              <label class="text-sm text-gray-600">开始日期<input v-model="settlementForm.periodStart" type="date" class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" /></label>
              <label class="text-sm text-gray-600">结束日期<input v-model="settlementForm.periodEnd" type="date" class="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none" /></label>
            </div>
          </div>
          <div class="mt-5 flex gap-3">
            <button @click="showSettlementModal = false" class="flex-1 rounded-xl bg-gray-100 py-2 text-sm text-gray-600">取消</button>
            <button @click="submitSettlement" :disabled="settlementLoading" class="flex-1 rounded-xl bg-[#ff9800] py-2 text-sm font-semibold text-white disabled:opacity-50">
              {{ settlementLoading ? '结算中...' : '确认结算' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showSnapshotModal && settlementDetail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showSnapshotModal = false">
        <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 shadow-2xl" :class="[theme.cardBg, theme.cardRounded]">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold text-gray-800">{{ settlementLabel(settlementDetail.period) }}快照 · {{ settlementDetail.periodKey }}</h3>
              <p class="mt-1 text-xs text-gray-400">{{ settlementDetail.periodStart }} 至 {{ settlementDetail.periodEnd }} · 发放 {{ settlementDetail.awardedCount }} 枚荣誉徽章</p>
            </div>
            <button @click="showSnapshotModal = false" class="text-xl text-gray-400">✕</button>
          </div>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 class="mb-2 text-sm font-bold text-gray-600">个人榜</h4>
              <div class="max-h-96 overflow-y-auto rounded-xl border border-gray-100">
                <div v-for="item in settlementDetail.students" :key="item.studentId" class="flex items-center gap-3 border-b border-gray-50 px-3 py-2 text-sm last:border-0">
                  <span class="w-7 text-center font-bold text-[#ff9800]">#{{ item.rank }}</span>
                  <span class="flex-1 text-gray-700">{{ item.name }}</span>
                  <span class="font-bold text-[#4ecdc4]">{{ item.score }}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 class="mb-2 text-sm font-bold text-gray-600">小组榜</h4>
              <div class="rounded-xl border border-gray-100">
                <div v-for="item in settlementDetail.groups" :key="item.groupId" class="flex items-center gap-3 border-b border-gray-50 px-3 py-2 text-sm last:border-0">
                  <span class="w-7 text-center font-bold text-[#ff9800]">#{{ item.rank }}</span>
                  <span class="flex-1 text-gray-700">{{ item.name }}</span>
                  <span class="font-bold text-[#4ecdc4]">{{ item.score }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
