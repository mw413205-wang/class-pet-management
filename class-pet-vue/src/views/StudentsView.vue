<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import { PETS } from '@/data/petData'
import type { Student } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Filters ─────────────────────────────────────────────
const searchQuery = ref('')
const selectedGroupId = ref('all')

const filteredStudents = computed(() => {
  let list = appStore.currentStudents
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q))
  }
  if (selectedGroupId.value !== 'all') {
    list = list.filter(s => s.groupId === selectedGroupId.value)
  }
  return list
})

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

function openAdd() {
  form.value = {
    name: '',
    groupId: appStore.currentGroups[0]?.id ?? '',
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
  appStore.deleteStudent(targetStudent.value.id)
  closeModal()
}

// Group management
const groupForm = ref({ name: '', color: '#4ecdc4' })
const showGroupModal = ref(false)

function submitAddGroup() {
  if (!groupForm.value.name.trim()) return
  appStore.addGroup(groupForm.value.name.trim(), groupForm.value.color)
  groupForm.value = { name: '', color: '#4ecdc4' }
}

function deleteGroup(groupId: string) {
  if (appStore.currentGroups.length <= 1) {
    appStore.addToast('至少需要保留一个小组', 'warning')
    return
  }
  appStore.deleteGroup(groupId)
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
  appStore.addToast(`已将 ${selectedIds.value.size} 人移至新小组`, 'success')
  selectedIds.value.clear()
  showBatchGroupSelect.value = false
  batchTargetGroupId.value = ''
}

function getGroupInfo(groupId: string) {
  return appStore.getGroupById(groupId)
}

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']
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
          <tr
            v-for="(student) in filteredStudents"
            :key="student.id"
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
                  {{ appStore.currentStudents.indexOf(student) + 1 }}
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
              <div class="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto pr-1">
                <button
                  @click="form.petId = null"
                  class="flex flex-col items-center p-1.5 rounded-xl text-xl transition-all hover:scale-105"
                  :class="form.petId === null ? 'bg-gray-200 ring-2 ring-gray-400' : 'bg-gray-50 hover:bg-gray-100'"
                >
                  🐾
                  <span class="text-[10px] text-gray-400 leading-none mt-0.5">无</span>
                </button>
                <button
                  v-for="pet in PETS"
                  :key="pet.id"
                  @click="form.petId = form.petId === pet.id ? null : pet.id"
                  class="flex flex-col items-center p-1.5 rounded-xl text-xl transition-all hover:scale-105"
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
          <p class="text-sm text-gray-500 mb-5">确认删除学生「{{ targetStudent?.name }}」？该操作不可撤销。</p>
          <div class="flex gap-3">
            <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
            <button @click="submitDelete" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600">确认删除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Group management modal -->
    <Transition name="modal">
      <div v-if="showGroupModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showGroupModal = false">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">⊞ 管理小组</h3>
            <button @click="showGroupModal = false" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div class="space-y-2 mb-4">
            <div v-for="g in appStore.currentGroups" :key="g.id"
              class="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50"
            >
              <div class="w-4 h-4 rounded-full shrink-0" :style="{ background: g.color }"></div>
              <span class="flex-1 text-sm font-medium text-gray-700">{{ g.name }}</span>
              <span class="text-xs text-gray-400">{{ appStore.currentStudents.filter(s => s.groupId === g.id).length }}人</span>
              <button @click="deleteGroup(g.id)" class="text-gray-300 hover:text-red-400 transition-colors">🗑</button>
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
  </div>
</template>
