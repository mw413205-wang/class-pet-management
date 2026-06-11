<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { readSheet } from 'read-excel-file/browser'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import { PETS } from '@/data/petData'
import type { Student, StudentImportResult, StudentImportRow } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Filters ─────────────────────────────────────────────
const searchQuery = ref('')
const selectedGroupId = ref('all')
type StudentSortMode = 'name' | 'score' | 'progress' | 'group_name' | 'group_score'
const sortMode = ref<StudentSortMode>('name')

const groupSummaries = computed(() => {
  const summaries = new Map<string, { name: string, color: string, score: number, count: number }>()
  appStore.currentGroups.forEach(group => {
    summaries.set(group.id, { name: group.name, color: group.color, score: 0, count: 0 })
  })
  appStore.currentStudents.forEach(student => {
    const summary = summaries.get(student.groupId)
    if (!summary) return
    summary.score += student.score
    summary.count += 1
  })
  return summaries
})

const showGroupSummaries = computed(() => sortMode.value === 'group_name' || sortMode.value === 'group_score')

function compareNames(left: string, right: string) {
  return left.localeCompare(right, 'zh-CN')
}

function getGrowthProgressValue(score: number) {
  const progress = appStore.getProgress(score)
  return appStore.getLevel(score) * 100 + (progress.isMax ? 100 : progress.percent)
}

const filteredStudents = computed(() => {
  let list = [...appStore.currentStudents]
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q))
  }
  if (selectedGroupId.value !== 'all') {
    list = list.filter(s => s.groupId === selectedGroupId.value)
  }
  list.sort((left, right) => {
    if (sortMode.value === 'score') {
      return right.score - left.score || compareNames(left.name, right.name)
    }
    if (sortMode.value === 'progress') {
      return getGrowthProgressValue(right.score) - getGrowthProgressValue(left.score)
        || right.score - left.score
        || compareNames(left.name, right.name)
    }
    if (sortMode.value === 'group_name') {
      const leftGroup = groupSummaries.value.get(left.groupId)
      const rightGroup = groupSummaries.value.get(right.groupId)
      return compareNames(leftGroup?.name || '', rightGroup?.name || '') || compareNames(left.name, right.name)
    }
    if (sortMode.value === 'group_score') {
      const leftGroup = groupSummaries.value.get(left.groupId)
      const rightGroup = groupSummaries.value.get(right.groupId)
      return (rightGroup?.score || 0) - (leftGroup?.score || 0)
        || compareNames(leftGroup?.name || '', rightGroup?.name || '')
        || right.score - left.score
        || compareNames(left.name, right.name)
    }
    return compareNames(left.name, right.name)
  })
  return list
})

function shouldShowGroupSummary(index: number) {
  return showGroupSummaries.value && (index === 0 || filteredStudents.value[index - 1].groupId !== filteredStudents.value[index].groupId)
}

// ─── Modal ────────────────────────────────────────────────
type ModalMode = 'add' | 'edit' | 'delete' | null
const modalMode = ref<ModalMode>(null)
const targetStudent = ref<Student | null>(null)

const form = ref({
  name: '',
  groupId: '',
  petId: null as string | null,
  petNickname: '',
})
const canEditStudentPet = computed(() => modalMode.value === 'add' || !targetStudent.value || appStore.canChangeStudentPet(targetStudent.value))

function openAdd() {
  form.value = {
    name: '',
    groupId: appStore.getUngroupedGroup()?.id ?? '',
    petId: null,
    petNickname: '',
  }
  targetStudent.value = null
  modalMode.value = 'add'
}

function openEdit(s: Student) {
  form.value = {
    name: s.name,
    groupId: s.groupId,
    petId: s.petId,
    petNickname: s.petNickname,
  }
  targetStudent.value = s
  modalMode.value = 'edit'
}

function openDelete(s: Student) {
  targetStudent.value = s
  modalMode.value = 'delete'
}

function closeModal() {
  modalMode.value = null
  targetStudent.value = null
}

function submitAdd() {
  if (!form.value.name.trim()) return
  appStore.addStudent({
    name: form.value.name.trim(),
    groupId: form.value.groupId,
    petId: form.value.petId,
    petNickname: form.value.petNickname,
  })
  closeModal()
}

function submitEdit() {
  if (!targetStudent.value || !form.value.name.trim()) return
  appStore.updateStudent(targetStudent.value.id, {
    name: form.value.name.trim(),
    groupId: form.value.groupId,
    petId: form.value.petId,
    petNickname: form.value.petNickname,
  })
  closeModal()
}

function submitDelete() {
  if (!targetStudent.value) return
  const deleted = appStore.deleteStudent(targetStudent.value.id)
  if (deleted) {
    deletedStudent.value = deleted
    selectedIds.value.delete(deleted.id)
    if (undoDeleteTimer) clearTimeout(undoDeleteTimer)
    undoDeleteTimer = setTimeout(() => {
      deletedStudent.value = null
      undoDeleteTimer = null
    }, 5000)
  }
  closeModal()
}

const deletedStudent = ref<Student | null>(null)
let undoDeleteTimer: ReturnType<typeof setTimeout> | null = null

function undoDelete() {
  if (!deletedStudent.value) return
  appStore.restoreStudent(deletedStudent.value)
  deletedStudent.value = null
  if (undoDeleteTimer) clearTimeout(undoDeleteTimer)
  undoDeleteTimer = null
}

onUnmounted(() => {
  if (undoDeleteTimer) clearTimeout(undoDeleteTimer)
})

// Group management
const groupForm = ref({ name: '', color: '#4ecdc4' })
const showGroupModal = ref(false)
const editingGroupId = ref<string | null>(null)
const editingGroupName = ref('')

function submitAddGroup() {
  if (!groupForm.value.name.trim()) return
  appStore.addGroup(groupForm.value.name.trim(), groupForm.value.color)
  groupForm.value = { name: '', color: '#4ecdc4' }
}

function closeGroupModal() {
  showGroupModal.value = false
  cancelRenameGroup()
}

function deleteGroup(groupId: string) {
  if (appStore.currentGroups.length <= 1) {
    appStore.addToast('至少需要保留一个小组', 'warning')
    return
  }
  appStore.deleteGroup(groupId)
}

function startRenameGroup(groupId: string, name: string) {
  editingGroupId.value = groupId
  editingGroupName.value = name
}

function cancelRenameGroup() {
  editingGroupId.value = null
  editingGroupName.value = ''
}

function submitRenameGroup() {
  const name = editingGroupName.value.trim()
  if (!editingGroupId.value || !name) return
  void appStore.renameGroup(editingGroupId.value, name)
  cancelRenameGroup()
}

// Batch
const selectedIds = ref<Set<number>>(new Set())
const showBatchGroupSelect = ref(false)
const batchTargetGroupId = ref('')

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

function batchMoveGroup() {
  if (!batchTargetGroupId.value || selectedIds.value.size === 0) return
  selectedIds.value.forEach(id => {
    appStore.updateStudent(id, { groupId: batchTargetGroupId.value })
  })
  appStore.addToast(`正在将 ${selectedIds.value.size} 人移至新小组`, 'info')
  selectedIds.value.clear()
  showBatchGroupSelect.value = false
  batchTargetGroupId.value = ''
}

function getGroupInfo(groupId: string) {
  return appStore.getGroupById(groupId)
}

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']

// Batch import
interface ImportPreviewRow extends StudentImportRow {
  groupName: string
  petName: string
  status: 'ready' | 'skipped' | 'error'
  reason?: string
}

watch(() => appStore.currentClassId, () => {
  selectedGroupId.value = 'all'
  selectedIds.value.clear()
  showBatchGroupSelect.value = false
  batchTargetGroupId.value = ''
})

const showImportModal = ref(false)
const importText = ref('')
const importPreview = ref<ImportPreviewRow[]>([])
const importResult = ref<StudentImportResult | null>(null)
const importError = ref('')
const importSubmitting = ref(false)
const importFileName = ref('')

const importSummary = computed(() => ({
  ready: importPreview.value.filter(row => row.status === 'ready').length,
  skipped: importPreview.value.filter(row => row.status === 'skipped').length,
  error: importPreview.value.filter(row => row.status === 'error').length,
}))

function resetImport() {
  importText.value = ''
  importPreview.value = []
  importResult.value = null
  importError.value = ''
  importFileName.value = ''
}

function openImport() {
  resetImport()
  showImportModal.value = true
}

function closeImport() {
  showImportModal.value = false
  resetImport()
}

function buildImportPreview(rows: { name: string; groupName?: string; petName?: string }[]) {
  const ungrouped = appStore.getUngroupedGroup()
  if (!ungrouped) {
    importError.value = '当前班级缺少未分组小组'
    return
  }
  const groupByName = new Map(appStore.currentGroups.map(group => [group.name.trim(), group]))
  const petByName = new Map(PETS.map(pet => [pet.name.trim(), pet]))
  const names = new Set(appStore.currentStudents.map(student => student.name.trim()))
  importPreview.value = rows.slice(0, 200).map((source, position) => {
    const name = source.name.trim()
    const groupName = source.groupName?.trim() || '未分组'
    const petName = source.petName?.trim() || ''
    const group = groupByName.get(groupName)
    const pet = petName ? petByName.get(petName) : undefined
    let status: ImportPreviewRow['status'] = 'ready'
    let reason = ''
    if (!name || name.length > 20) {
      status = 'error'
      reason = '姓名不能为空且最多 20 个字符'
    } else if (!group) {
      status = 'error'
      reason = `未找到小组「${groupName}」`
    } else if (petName && !pet) {
      status = 'error'
      reason = `未找到宠物「${petName}」`
    } else if (names.has(name)) {
      status = 'skipped'
      reason = '当前班级已存在同名学生'
    }
    if (name) names.add(name)
    return {
      index: position + 1,
      name,
      groupId: group?.id ?? ungrouped.id,
      groupName,
      petId: pet?.id ?? null,
      petName,
      status,
      reason,
    }
  })
  importResult.value = null
  importError.value = rows.length > 200 ? '单次最多导入 200 人，已仅保留前 200 行' : ''
}

function previewTextImport() {
  const rows = importText.value
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ name }))
  if (!rows.length) {
    importError.value = '请先粘贴学生姓名，每行一人'
    return
  }
  importFileName.value = ''
  buildImportPreview(rows)
}

async function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  importError.value = ''
  importResult.value = null
  importPreview.value = []
  importFileName.value = file.name
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    importError.value = '请选择 .xlsx 或 .xls 格式的 Excel 文件'
    return
  }
  try {
    const rows = fileName.endsWith('.xls')
      ? await readLegacyExcel(file)
      : await readSheet(file)
    if (rows.length < 2) {
      importError.value = '表格中没有可导入的数据'
      return
    }
    const headers = rows[0].map(cell => String(cell ?? '').trim())
    const nameIndex = headers.indexOf('姓名')
    const groupIndex = headers.indexOf('小组')
    const petIndex = headers.indexOf('宠物名称')
    if (nameIndex < 0) {
      importError.value = 'Excel 第一行必须包含“姓名”列'
      return
    }
    buildImportPreview(rows.slice(1).map(row => ({
      name: String(row[nameIndex] ?? ''),
      groupName: groupIndex >= 0 ? String(row[groupIndex] ?? '') : '',
      petName: petIndex >= 0 ? String(row[petIndex] ?? '') : '',
    })).filter(row => row.name.trim()))
  } catch {
    importPreview.value = []
    importError.value = 'Excel 解析失败，请确认文件为有效的 .xlsx 或 .xls 表格'
  }
}

async function readLegacyExcel(file: File) {
  const { read, utils } = await import('xlsx')
  const workbook = read(await file.arrayBuffer(), { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  return utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    defval: '',
  })
}

async function submitImport() {
  if (importSubmitting.value) return
  const rows = importPreview.value.filter(row => row.status === 'ready')
  if (!rows.length) {
    importError.value = '没有可提交的学生数据'
    return
  }
  importSubmitting.value = true
  importError.value = ''
  try {
    importResult.value = await appStore.importStudents(rows.map(row => ({
      index: row.index,
      name: row.name,
      groupId: row.groupId,
      petId: row.petId,
    }))) ?? null
  } finally {
    importSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl">🎒</span>
        <h1 class="text-3xl font-bold" :class="theme.titleGradient">学生管理</h1>
      </div>
      <div class="flex gap-2">
        <button
          @click="openImport"
          class="px-3 py-2 text-sm font-medium transition-all"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'text-gray-600 hover:text-[#4ecdc4]']"
        >⇧ 批量导入</button>
        <button
          @click="showGroupModal = true"
          class="px-3 py-2 text-sm font-medium transition-all"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'text-gray-600 hover:text-[#4ecdc4]']"
        >⊞ 管理小组</button>
        <button
          @click="openAdd"
          class="flex items-center gap-2 px-4 py-2 text-white font-semibold transition-all active:scale-95"
          :class="[theme.buttonPrimary, theme.buttonRounded, theme.buttonShadow]"
        >+ 添加学生</button>
      </div>
    </div>

    <!-- Group tabs -->
    <div class="flex gap-2 flex-wrap">
      <button
        @click="selectedGroupId = 'all'"
        class="px-3 py-1.5 text-sm font-medium rounded-xl transition-all"
        :class="selectedGroupId === 'all' ? 'bg-[#4ecdc4] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >全部 ({{ appStore.currentStudents.length }})</button>
      <button
        v-for="g in appStore.currentGroups"
        :key="g.id"
        @click="selectedGroupId = g.id"
        class="px-3 py-1.5 text-sm font-medium rounded-xl transition-all"
        :style="selectedGroupId === g.id ? { background: g.color, color: '#fff' } : { background: g.color + '22', color: g.color }"
      >
        {{ g.name }} ({{ appStore.currentStudents.filter(s => s.groupId === g.id).length }})
      </button>
    </div>

    <!-- Search & batch bar -->
    <div class="flex gap-3 items-center flex-wrap">
      <div class="relative flex-1 min-w-[160px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          v-model="searchQuery"
          placeholder="搜索学生姓名..."
          class="w-full pl-8 pr-3 py-2 text-sm outline-none"
          :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
        />
      </div>
      <select v-model="sortMode" class="px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
        <option value="name">按姓名排序</option>
        <option value="score">按积分排序</option>
        <option value="progress">按成长进度排序</option>
        <option value="group_name">按小组名称排序</option>
        <option value="group_score">按小组积分和排序</option>
      </select>
      <template v-if="selectedIds.size > 0">
        <span class="text-sm text-[#4ecdc4] font-semibold">已选 {{ selectedIds.size }} 人</span>
        <button @click="showBatchGroupSelect = true" class="px-3 py-1.5 text-sm rounded-xl bg-[#4ecdc4]/10 text-[#4ecdc4] border border-[#4ecdc4]/30 hover:bg-[#4ecdc4]/20 transition-all">批量换组</button>
        <button @click="selectedIds.clear()" class="px-3 py-1.5 text-sm rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">取消选择</button>
      </template>
    </div>

    <!-- Student table -->
    <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm overflow-hidden']">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-gray-500 text-xs">
            <th class="w-8 py-3 pl-4">
              <input type="checkbox" class="accent-[#4ecdc4]"
                :checked="filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.has(s.id))"
                @change="(e: Event) => {
                  if ((e.target as HTMLInputElement).checked) filteredStudents.forEach(s => selectedIds.add(s.id))
                  else filteredStudents.forEach(s => selectedIds.delete(s.id))
                }"
              />
            </th>
            <th class="py-3 px-4 text-left">学生</th>
            <th class="py-3 px-2 text-left">宠物</th>
            <th class="py-3 px-2 text-center">小组</th>
            <th class="py-3 px-2 text-center">积分</th>
            <th class="py-3 px-2 text-center">等级</th>
            <th class="py-3 px-2 text-center">徽章</th>
            <th class="py-3 pr-4 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(student, index) in filteredStudents" :key="student.id">
            <tr v-if="shouldShowGroupSummary(index)" class="border-b border-gray-100 bg-gray-50/80">
              <td colspan="8" class="px-4 py-2">
                <div class="flex items-center gap-2 text-xs">
                  <span class="h-2.5 w-2.5 rounded-full" :style="{ background: groupSummaries.get(student.groupId)?.color || '#9ca3af' }"></span>
                  <span class="font-bold text-gray-700">{{ groupSummaries.get(student.groupId)?.name || '未知小组' }}</span>
                  <span class="text-gray-400">{{ groupSummaries.get(student.groupId)?.count || 0 }} 人</span>
                  <span class="text-[#ff9800]">总积分 {{ groupSummaries.get(student.groupId)?.score || 0 }}</span>
                </div>
              </td>
            </tr>
            <tr
              class="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
              :class="selectedIds.has(student.id) ? 'bg-[#4ecdc4]/5' : ''"
            >
            <td class="py-2 pl-4">
              <input type="checkbox" class="accent-[#4ecdc4]"
                :checked="selectedIds.has(student.id)"
                @change="toggleSelect(student.id)"
              />
            </td>
            <td class="py-2 px-4">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-gray-300 w-6 text-right">
                  {{ index + 1 }}
                </span>
                <div class="font-semibold text-gray-800">{{ student.name }}</div>
                <div v-if="student.petNickname" class="text-xs text-gray-400">({{ student.petNickname }})</div>
              </div>
            </td>
            <td class="py-2 px-2">
              <PetAvatar :student="student" size="xs" />
            </td>
            <td class="py-2 px-2 text-center">
              <span
                v-if="getGroupInfo(student.groupId)"
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :style="{ background: getGroupInfo(student.groupId)!.color + '22', color: getGroupInfo(student.groupId)!.color }"
              >{{ getGroupInfo(student.groupId)!.name }}</span>
            </td>
            <td class="py-2 px-2 text-center font-bold" :style="{ color: levelColors[appStore.getLevel(student.score)] }">
              {{ student.score }}
            </td>
            <td class="py-2 px-2 text-center">
              <span class="text-xs px-1.5 py-0.5 rounded-full font-bold"
                :style="{ background: levelColors[appStore.getLevel(student.score)] + '22', color: levelColors[appStore.getLevel(student.score)] }">
                Lv.{{ appStore.getLevel(student.score) + 1 }}
              </span>
            </td>
            <td class="py-2 px-2 text-center text-[#ff9800]">
              {{ student.badges > 0 ? `🏅×${student.badges}` : '-' }}
            </td>
            <td class="py-2 pr-4 text-center">
              <div class="flex gap-1 justify-center">
                <button @click="openEdit(student)" class="p-1.5 rounded-lg hover:bg-[#4ecdc4]/10 text-gray-400 hover:text-[#4ecdc4] transition-all">✏️</button>
                <button @click="openDelete(student)" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400 transition-all">🗑</button>
              </div>
            </td>
            </tr>
          </template>
          <tr v-if="filteredStudents.length === 0">
            <td colspan="8" class="py-16 text-center text-gray-300">
              <div class="text-5xl mb-3">🔍</div>
              <div>暂无学生数据</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Student Modal -->
    <Transition name="modal">
      <div v-if="modalMode === 'add' || modalMode === 'edit'"
        class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="closeModal">
        <div class="w-full max-w-md animate-modal-in max-h-[90vh] overflow-y-auto" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-gray-800 mb-5">{{ modalMode === 'add' ? '➕ 添加学生' : '✏️ 编辑学生' }}</h3>
          <div class="space-y-4">
            <div>
              <label class="text-sm text-gray-600 mb-1 block">姓名 <span class="text-red-400">*</span></label>
              <input v-model="form.name" placeholder="学生姓名" class="w-full px-3 py-2 outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div>
              <label class="text-sm text-gray-600 mb-1 block">所在小组</label>
              <select v-model="form.groupId" class="w-full px-3 py-2 outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
                <option v-for="g in appStore.currentGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-sm text-gray-600 mb-2 block">选择宠物</label>
              <p v-if="!canEditStudentPet" class="mb-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-600">该学生已有成长积分，请先重置积分或在系统设置中允许更换宠物。仍可修改宠物昵称。</p>
              <div class="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto pr-1">
                <button
                  @click="form.petId = null"
                  :disabled="!canEditStudentPet"
                  class="flex flex-col items-center p-1.5 rounded-xl text-xl transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  :class="form.petId === null ? 'bg-gray-200 ring-2 ring-gray-400' : 'bg-gray-50 hover:bg-gray-100'"
                >
                  🐾
                  <span class="text-[10px] text-gray-400 leading-none mt-0.5">无</span>
                </button>
                <button
                  v-for="pet in PETS"
                  :key="pet.id"
                  @click="form.petId = form.petId === pet.id ? null : pet.id"
                  :disabled="!canEditStudentPet"
                  class="flex flex-col items-center p-1.5 rounded-xl text-xl transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  :class="form.petId === pet.id ? 'bg-[#4ecdc4]/20 ring-2 ring-[#4ecdc4]' : 'bg-gray-50 hover:bg-gray-100'"
                  :title="pet.name"
                >
                  {{ pet.emoji }}
                  <span class="text-[10px] text-gray-400 leading-none mt-0.5 truncate w-full text-center">{{ pet.name.slice(0,3) }}</span>
                </button>
              </div>
            </div>
            <div v-if="form.petId">
              <label class="text-sm text-gray-600 mb-1 block">宠物昵称（选填）</label>
              <input v-model="form.petNickname" placeholder="给宠物起个名字..." class="w-full px-3 py-2 outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div class="flex gap-3 pt-2">
              <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
              <button @click="modalMode === 'add' ? submitAdd() : submitEdit()" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">
                {{ modalMode === 'add' ? '添加' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Modal -->
    <Transition name="modal">
      <div v-if="modalMode === 'delete'" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="closeModal">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-red-500 mb-2">⚠️ 删除学生</h3>
          <p class="text-sm text-gray-500 mb-5">确认删除学生「{{ targetStudent?.name }}」？删除后 5 秒内可撤销。</p>
          <div class="flex gap-3">
            <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
            <button @click="submitDelete" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Group management modal -->
    <Transition name="modal">
      <div v-if="showGroupModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="closeGroupModal">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">⊞ 管理小组</h3>
            <button @click="closeGroupModal" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div class="space-y-2 mb-4">
            <div v-for="g in appStore.currentGroups" :key="g.id"
              class="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50"
            >
              <div class="w-4 h-4 rounded-full shrink-0" :style="{ background: g.color }"></div>
              <input
                v-if="editingGroupId === g.id"
                v-model="editingGroupName"
                class="min-w-0 flex-1 px-2 py-1 text-sm outline-none"
                :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                maxlength="20"
                autofocus
                @keyup.enter="submitRenameGroup"
                @keyup.esc="cancelRenameGroup"
              />
              <span v-else class="flex-1 text-sm font-medium text-gray-700">{{ g.name }}</span>
              <span class="text-xs text-gray-400">{{ appStore.currentStudents.filter(s => s.groupId === g.id).length }}人</span>
              <template v-if="editingGroupId === g.id">
                <button @click="submitRenameGroup" class="text-[#2a9d8f] hover:text-[#238276] transition-colors">✓</button>
                <button @click="cancelRenameGroup" class="text-gray-300 hover:text-gray-500 transition-colors">✕</button>
              </template>
              <button
                v-else-if="!g.id.startsWith('ungrouped-')"
                @click="startRenameGroup(g.id, g.name)"
                class="text-gray-300 hover:text-[#4ecdc4] transition-colors"
              >✏️</button>
              <button
                v-if="!g.id.startsWith('ungrouped-') && editingGroupId !== g.id"
                @click="deleteGroup(g.id)"
                class="text-gray-300 hover:text-red-400 transition-colors"
              >🗑</button>
            </div>
          </div>
          <div class="border-t border-gray-100 pt-4 space-y-3">
            <div class="text-sm font-medium text-gray-600">新增小组</div>
            <div class="flex gap-2">
              <input v-model="groupForm.name" placeholder="小组名称" class="flex-1 px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
              <input type="color" v-model="groupForm.color" class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            </div>
            <button @click="submitAddGroup" class="w-full py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">添加小组</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Batch group change modal -->
    <Transition name="modal">
      <div v-if="showBatchGroupSelect" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showBatchGroupSelect = false">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-gray-800 mb-4">批量换组（{{ selectedIds.size }}人）</h3>
          <div class="grid grid-cols-2 gap-2 mb-4">
            <button
              v-for="g in appStore.currentGroups"
              :key="g.id"
              @click="batchTargetGroupId = g.id"
              class="py-3 rounded-xl font-medium text-sm transition-all"
              :style="batchTargetGroupId === g.id ? { background: g.color, color: '#fff' } : { background: g.color + '22', color: g.color }"
            >{{ g.name }}</button>
          </div>
          <div class="flex gap-3">
            <button @click="showBatchGroupSelect = false" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600">取消</button>
            <button @click="batchMoveGroup" :disabled="!batchTargetGroupId" class="flex-1 py-2 rounded-xl text-white font-semibold disabled:opacity-50 transition-all" :class="theme.buttonPrimary">确认换组</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="dropdown">
      <div
        v-if="deletedStudent"
        class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl"
      >
        <span>已提交删除「{{ deletedStudent.name }}」</span>
        <button @click="undoDelete" class="font-bold text-[#ffd93d] hover:text-white">撤销</button>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="closeImport">
        <div class="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6 shadow-2xl" :class="[theme.cardBg, theme.cardRounded]">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-lg font-bold text-gray-800">⇧ 批量导入学生</h3>
              <p class="mt-1 text-xs text-gray-400">文本每行一人；Excel 使用“姓名、小组、宠物名称”列，后两列可选。</p>
            </div>
            <button @click="closeImport" class="text-xl text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-600">文本粘贴</label>
              <textarea
                v-model="importText"
                rows="7"
                class="w-full resize-none px-3 py-2 text-sm outline-none"
                :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                placeholder="张三&#10;李四&#10;王五"
              ></textarea>
              <button @click="previewTextImport" class="w-full rounded-xl bg-gray-100 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200">预览文本名单</button>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-600">Excel 上传</label>
              <label class="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 text-center hover:border-[#4ecdc4]">
                <span class="text-3xl">📄</span>
                <span class="mt-2 text-sm font-semibold text-gray-600">{{ importFileName || '选择 .xlsx / .xls 文件' }}</span>
                <span class="mt-1 text-xs text-gray-400">支持新版和旧版 Excel 工作簿</span>
                <input type="file" accept=".xlsx,.xls" class="hidden" @change="handleImportFile" />
              </label>
            </div>
          </div>

          <div v-if="importError" class="mt-4 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-600">{{ importError }}</div>

          <div v-if="importPreview.length" class="mt-5 space-y-3">
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <span class="font-semibold text-gray-600">预览 {{ importPreview.length }} 行</span>
              <span class="text-[#2a9d8f]">可导入 {{ importSummary.ready }}</span>
              <span class="text-[#a16207]">跳过 {{ importSummary.skipped }}</span>
              <span class="text-red-400">错误 {{ importSummary.error }}</span>
            </div>
            <div class="max-h-64 overflow-auto rounded-xl border border-gray-100">
              <table class="w-full min-w-[620px] text-xs">
                <thead class="sticky top-0 bg-gray-50 text-left text-gray-400">
                  <tr>
                    <th class="px-3 py-2">行</th>
                    <th class="px-3 py-2">姓名</th>
                    <th class="px-3 py-2">小组</th>
                    <th class="px-3 py-2">宠物</th>
                    <th class="px-3 py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in importPreview" :key="row.index" class="border-t border-gray-50">
                    <td class="px-3 py-2 text-gray-300">{{ row.index }}</td>
                    <td class="px-3 py-2 font-semibold text-gray-700">{{ row.name || '-' }}</td>
                    <td class="px-3 py-2 text-gray-500">{{ row.groupName }}</td>
                    <td class="px-3 py-2 text-gray-500">{{ row.petName || '-' }}</td>
                    <td class="px-3 py-2">
                      <span v-if="row.status === 'ready'" class="text-[#2a9d8f]">可导入</span>
                      <span v-else :class="row.status === 'skipped' ? 'text-[#a16207]' : 'text-red-400'">{{ row.reason }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="importResult" class="mt-4 rounded-xl bg-[#4ecdc4]/10 px-4 py-3 text-sm text-[#2a9d8f]">
            导入完成：成功 {{ importResult.created }} 人，跳过 {{ importResult.skipped }} 人，失败 {{ importResult.failed }} 人。
          </div>

          <div class="mt-5 flex justify-end gap-3">
            <button @click="closeImport" class="rounded-xl bg-gray-100 px-5 py-2 text-sm text-gray-600">关闭</button>
            <button
              @click="submitImport"
              :disabled="importSubmitting || importSummary.ready === 0"
              class="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              :class="theme.buttonPrimary"
            >{{ importSubmitting ? '导入中...' : `确认导入 ${importSummary.ready} 人` }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
