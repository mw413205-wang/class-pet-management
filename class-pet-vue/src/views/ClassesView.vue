<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import type { Class } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Modals ──────────────────────────────────────────────
type ModalMode = 'add' | 'edit' | 'delete' | 'reset' | null
const modalMode = ref<ModalMode>(null)
const targetClass = ref<Class | null>(null)
const formName = ref('')
const includesBadges = ref(false)

function openAdd() {
  formName.value = ''
  modalMode.value = 'add'
}

function openEdit(cls: Class) {
  targetClass.value = cls
  formName.value = cls.name
  modalMode.value = 'edit'
}

function openDelete(cls: Class) {
  targetClass.value = cls
  modalMode.value = 'delete'
}

function openReset(cls: Class) {
  targetClass.value = cls
  includesBadges.value = false
  modalMode.value = 'reset'
}

function closeModal() {
  modalMode.value = null
  targetClass.value = null
  formName.value = ''
}

function submitAdd() {
  if (!formName.value.trim()) return
  appStore.addClass(formName.value.trim())
  closeModal()
}

function submitEdit() {
  if (!targetClass.value || !formName.value.trim()) return
  appStore.updateClass(targetClass.value.id, formName.value.trim())
  closeModal()
}

function submitDelete() {
  if (!targetClass.value) return
  appStore.deleteClass(targetClass.value.id)
  closeModal()
}

function submitReset() {
  if (!targetClass.value) return
  appStore.resetClassProgress(targetClass.value.id, includesBadges.value)
  closeModal()
}

// Student count per class
function getStudentCount(classId: number) {
  return appStore.students.filter(s => s.classId === classId).length
}
function getGroupCount(classId: number) {
  return appStore.groups.filter(g => g.classId === classId).length
}
function getAvgScore(classId: number) {
  const ss = appStore.students.filter(s => s.classId === classId)
  if (!ss.length) return 0
  return Math.round(ss.reduce((sum, s) => sum + s.score, 0) / ss.length)
}
function getTopScorer(classId: number) {
  const ss = appStore.students.filter(s => s.classId === classId)
  if (!ss.length) return null
  return ss.reduce((top, s) => s.score > top.score ? s : top, ss[0])
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl">📚</span>
        <h1 class="text-3xl font-bold" :class="theme.titleGradient">班级管理</h1>
      </div>
      <button
        @click="openAdd"
        class="flex items-center gap-2 px-4 py-2 text-white font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
        :class="[theme.buttonPrimary, theme.buttonRounded, theme.buttonShadow]"
      >
        <span class="text-lg">+</span> 新建班级
      </button>
    </div>

    <!-- Class cards grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div
        v-for="cls in appStore.classes"
        :key="cls.id"
        class="overflow-hidden"
        :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm hover:shadow-lg transition-all duration-200']"
      >
        <!-- Gradient top band -->
        <div
          class="h-3"
          :style="{ background: `linear-gradient(to right, ${cls.gradientFrom}, ${cls.gradientTo})` }"
        ></div>

        <div class="p-5 space-y-4">
          <!-- Class name + active indicator -->
          <div class="flex items-start justify-between">
            <div>
              <div class="text-xl font-bold text-gray-800">{{ cls.name }}</div>
              <div class="flex items-center gap-1.5 mt-1">
                <span
                  v-if="appStore.currentClassId === cls.id"
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :style="{ background: cls.gradientFrom + '33', color: cls.gradientFrom }"
                >当前班级</span>
              </div>
            </div>
            <!-- Gradient circle icon -->
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner"
              :style="{ background: `linear-gradient(135deg, ${cls.gradientFrom}, ${cls.gradientTo})` }"
            >🏫</div>
          </div>

          <!-- Stats row -->
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center p-2 rounded-xl bg-gray-50">
              <div class="text-lg font-black" :style="{ color: cls.gradientFrom }">{{ getStudentCount(cls.id) }}</div>
              <div class="text-xs text-gray-400">学生</div>
            </div>
            <div class="text-center p-2 rounded-xl bg-gray-50">
              <div class="text-lg font-black" :style="{ color: cls.gradientFrom }">{{ getGroupCount(cls.id) }}</div>
              <div class="text-xs text-gray-400">小组</div>
            </div>
            <div class="text-center p-2 rounded-xl bg-gray-50">
              <div class="text-lg font-black" :style="{ color: cls.gradientFrom }">{{ getAvgScore(cls.id) }}</div>
              <div class="text-xs text-gray-400">均分</div>
            </div>
          </div>

          <!-- Top scorer -->
          <div v-if="getTopScorer(cls.id)" class="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#ffd700]/10">
            <span class="text-lg">👑</span>
            <span class="text-sm text-gray-600">积分第一：</span>
            <span class="text-sm font-bold text-gray-800">{{ getTopScorer(cls.id)!.name }}</span>
            <span class="ml-auto text-sm font-black text-[#ff9800]">{{ getTopScorer(cls.id)!.score }}分</span>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-1">
            <button
              @click="appStore.currentClassId = cls.id"
              class="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
              :class="appStore.currentClassId === cls.id
                ? 'text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
              :style="appStore.currentClassId === cls.id ? { background: `linear-gradient(to right, ${cls.gradientFrom}, ${cls.gradientTo})` } : {}"
            >{{ appStore.currentClassId === cls.id ? '✓ 已切换' : '切换班级' }}</button>
            <button
              @click="openEdit(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all"
            >✏️</button>
            <button
              @click="openReset(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-[#ffd93d]/20 hover:bg-[#ffd93d]/40 text-[#854d0e] transition-all"
            >🔄</button>
            <button
              v-if="appStore.classes.length > 1"
              @click="openDelete(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-red-50 hover:bg-red-100 text-red-400 transition-all"
            >🗑</button>
          </div>
        </div>
      </div>

      <!-- Add class card (empty state) -->
      <button
        @click="openAdd"
        class="min-h-[220px] flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl hover:border-[#4ecdc4] hover:bg-[#4ecdc4]/5 transition-all group"
      >
        <div class="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-[#4ecdc4]/20 flex items-center justify-center text-3xl transition-all">+</div>
        <div class="text-sm text-gray-400 group-hover:text-[#4ecdc4] font-medium transition-all">新建班级</div>
      </button>
    </div>

    <!-- ─── Modals ─── -->
    <Transition name="modal">
      <div v-if="modalMode" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="closeModal">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">

          <!-- Add -->
          <template v-if="modalMode === 'add'">
            <h3 class="text-lg font-bold text-gray-800 mb-4">📚 新建班级</h3>
            <div class="space-y-3">
              <div>
                <label class="text-sm text-gray-600 mb-1 block">班级名称</label>
                <input
                  v-model="formName"
                  placeholder="例：三年级(1)班"
                  class="w-full px-3 py-2 outline-none"
                  :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                  @keyup.enter="submitAdd"
                  autofocus
                />
              </div>
              <div class="flex gap-3 pt-2">
                <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
                <button @click="submitAdd" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">创建</button>
              </div>
            </div>
          </template>

          <!-- Edit -->
          <template v-else-if="modalMode === 'edit'">
            <h3 class="text-lg font-bold text-gray-800 mb-4">✏️ 编辑班级</h3>
            <div class="space-y-3">
              <div>
                <label class="text-sm text-gray-600 mb-1 block">班级名称</label>
                <input
                  v-model="formName"
                  class="w-full px-3 py-2 outline-none"
                  :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                  @keyup.enter="submitEdit"
                  autofocus
                />
              </div>
              <div class="flex gap-3 pt-2">
                <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
                <button @click="submitEdit" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">保存</button>
              </div>
            </div>
          </template>

          <!-- Reset -->
          <template v-else-if="modalMode === 'reset'">
            <h3 class="text-lg font-bold text-gray-800 mb-2">🔄 重置班级进度</h3>
            <p class="text-sm text-gray-500 mb-4">将重置「{{ targetClass?.name }}」所有学生的积分为 0。此操作不可撤销。</p>
            <label class="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
              <input type="checkbox" v-model="includesBadges" class="w-4 h-4 accent-[#ff9800]" />
              同时重置徽章数量
            </label>
            <div class="flex gap-3">
              <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
              <button @click="submitReset" class="flex-1 py-2 rounded-xl bg-[#ff9800] text-white font-semibold hover:bg-[#f08000] transition-all">确认重置</button>
            </div>
          </template>

          <!-- Delete -->
          <template v-else-if="modalMode === 'delete'">
            <h3 class="text-lg font-bold text-red-500 mb-2">⚠️ 删除班级</h3>
            <p class="text-sm text-gray-500 mb-4">确认删除「{{ targetClass?.name }}」？该班级下所有学生数据将被永久删除，此操作不可撤销。</p>
            <div class="flex gap-3">
              <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
              <button @click="submitDelete" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all">确认删除</button>
            </div>
          </template>

        </div>
      </div>
    </Transition>
  </div>
</template>
