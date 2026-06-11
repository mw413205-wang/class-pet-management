<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import type { ResetMode } from '@/stores/appStore'
import { api, getStoredUser } from '@/services/api'
import type { Class } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Modals ──────────────────────────────────────────────
type ModalMode = 'add' | 'edit' | 'delete' | 'reset' | null
const modalMode = ref<ModalMode>(null)
const targetClass = ref<Class | null>(null)
const formName = ref('')
const copyFromClassId = ref<number | null>(null)
const resetMode = ref<ResetMode>('score')
const resetConfirmation = ref('')
const showTeachersModal = ref(false)
const teacherClass = ref<Class | null>(null)
const teachers = ref<ClassTeacher[]>([])
const teacherUsername = ref('')
const teacherPermissions = ref({ canScore: true, canManageStudents: false, canManageConfig: false })
const teacherLoading = ref(false)
const teacherError = ref('')
const isOwner = getStoredUser()?.role === 'owner'

interface ClassTeacher {
  id: number
  username: string
  displayName: string
  role: 'owner' | 'teacher'
  permissions: {
    canScore: boolean
    canManageStudents: boolean
    canManageConfig: boolean
  }
}

const permissionOptions = [
  { key: 'canScore', label: '积分', description: '加扣分、撤回、兑换和手动颁章' },
  { key: 'canManageStudents', label: '学生', description: '新增、导入、编辑、恢复和宠物装扮' },
  { key: 'canManageConfig', label: '配置', description: '班级、小组、规则、重置和排行榜结算' },
] as const

function openAdd() {
  formName.value = ''
  copyFromClassId.value = null
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
  resetMode.value = 'score'
  resetConfirmation.value = ''
  modalMode.value = 'reset'
}

function closeModal() {
  modalMode.value = null
  targetClass.value = null
  formName.value = ''
  copyFromClassId.value = null
}

function submitAdd() {
  if (!formName.value.trim()) return
  appStore.addClass(formName.value.trim(), copyFromClassId.value)
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
  if (resetConfirmation.value !== '重置当前班级') {
    appStore.addToast('请输入“重置当前班级”确认操作', 'warning')
    return
  }
  void appStore.resetClassProgress(targetClass.value.id, resetMode.value, resetConfirmation.value)
  closeModal()
}

async function loadTeachers() {
  if (!teacherClass.value) return
  const classId = teacherClass.value.id
  teacherLoading.value = true
  teacherError.value = ''
  try {
    const result = await api<ClassTeacher[]>(`/classes/${classId}/teachers`)
    if (teacherClass.value?.id !== classId) return
    teachers.value = result
    teacherClass.value.teacherCount = result.length
  } catch (error) {
    if (teacherClass.value?.id !== classId) return
    teacherError.value = error instanceof Error ? error.message : '教师列表加载失败'
  } finally {
    if (teacherClass.value?.id === classId) teacherLoading.value = false
  }
}

function openTeachers(cls: Class) {
  teacherClass.value = cls
  teacherUsername.value = ''
  teacherPermissions.value = { canScore: true, canManageStudents: false, canManageConfig: false }
  showTeachersModal.value = true
  void loadTeachers()
}

function closeTeachers() {
  showTeachersModal.value = false
  teacherClass.value = null
  teachers.value = []
  teacherUsername.value = ''
  teacherPermissions.value = { canScore: true, canManageStudents: false, canManageConfig: false }
  teacherError.value = ''
}

async function addTeacher() {
  if (!teacherClass.value || !teacherUsername.value.trim() || teacherLoading.value) return
  teacherLoading.value = true
  teacherError.value = ''
  try {
    await api(`/classes/${teacherClass.value.id}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ username: teacherUsername.value.trim(), permissions: teacherPermissions.value }),
    })
    teacherUsername.value = ''
    appStore.addToast('协作教师已添加', 'success')
    await loadTeachers()
  } catch (error) {
    teacherError.value = error instanceof Error ? error.message : '添加失败'
    teacherLoading.value = false
  }
}

async function updateTeacherPermissions(teacher: ClassTeacher) {
  if (!teacherClass.value || teacher.role === 'owner' || teacherLoading.value) return
  teacherLoading.value = true
  teacherError.value = ''
  try {
    await api(`/classes/${teacherClass.value.id}/teachers/${teacher.id}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: teacher.permissions }),
    })
    appStore.addToast('协作权限已更新', 'success')
    await loadTeachers()
  } catch (error) {
    teacherError.value = error instanceof Error ? error.message : '权限更新失败'
    await loadTeachers()
  } finally {
    teacherLoading.value = false
  }
}

function canManageClass(cls: Class) {
  return isOwner || appStore.canManageClassConfig(cls.id)
}

async function removeTeacher(teacher: ClassTeacher) {
  if (!teacherClass.value || teacher.role === 'owner' || teacherLoading.value) return
  teacherLoading.value = true
  teacherError.value = ''
  try {
    await api(`/classes/${teacherClass.value.id}/teachers/${teacher.id}`, { method: 'DELETE' })
    appStore.addToast('协作教师已移除', 'info')
    await loadTeachers()
  } catch (error) {
    teacherError.value = error instanceof Error ? error.message : '移除失败'
    teacherLoading.value = false
  }
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
        v-if="isOwner"
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
          <div class="grid grid-cols-4 gap-2">
            <div class="text-center p-2 rounded-xl bg-gray-50">
              <div class="text-lg font-black" :style="{ color: cls.gradientFrom }">{{ getStudentCount(cls.id) }}</div>
              <div class="text-xs text-gray-400">学生</div>
            </div>
            <div class="text-center p-2 rounded-xl bg-gray-50">
              <div class="text-lg font-black" :style="{ color: cls.gradientFrom }">{{ getGroupCount(cls.id) }}</div>
              <div class="text-xs text-gray-400">小组</div>
            </div>
            <div class="text-center p-2 rounded-xl bg-gray-50">
              <div class="text-lg font-black" :style="{ color: cls.gradientFrom }">{{ cls.teacherCount }}</div>
              <div class="text-xs text-gray-400">教师</div>
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
              @click="openTeachers(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-[#4ecdc4]/10 hover:bg-[#4ecdc4]/20 text-[#2a9d8f] transition-all"
              title="协作教师"
            >👩‍🏫</button>
            <button
              v-if="canManageClass(cls)"
              @click="openEdit(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all"
            >✏️</button>
            <button
              v-if="canManageClass(cls)"
              @click="openReset(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-[#ffd93d]/20 hover:bg-[#ffd93d]/40 text-[#854d0e] transition-all"
            >🔄</button>
            <button
              v-if="canManageClass(cls) && appStore.classes.length > 1"
              @click="openDelete(cls)"
              class="px-3 py-2 text-sm rounded-xl bg-red-50 hover:bg-red-100 text-red-400 transition-all"
            >🗑</button>
          </div>
        </div>
      </div>

      <!-- Add class card (empty state) -->
      <button
        v-if="isOwner"
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
              <div>
                <label class="text-sm text-gray-600 mb-1 block">初始配置</label>
                <select
                  v-model="copyFromClassId"
                  class="w-full px-3 py-2 outline-none"
                  :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                >
                  <option :value="null">使用系统默认配置</option>
                  <option v-for="cls in appStore.classes" :key="cls.id" :value="cls.id">复用「{{ cls.name }}」</option>
                </select>
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
            <p class="text-sm text-gray-500 mb-4">将按所选范围重置「{{ targetClass?.name }}」的成长数据。此操作不可撤销。</p>
            <div class="space-y-3 mb-4">
              <select v-model="resetMode" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
                <option value="score">仅重置积分</option>
                <option value="score_badges">重置积分和徽章</option>
                <option value="all_growth">重置全部成长数据</option>
              </select>
              <p v-if="resetMode === 'all_growth'" class="text-xs text-gray-400">将清空积分、徽章、当前装扮和装扮库存，保留学生、宠物种类与昵称。</p>
              <input v-model="resetConfirmation" type="text" autocomplete="off" placeholder="输入：重置当前班级" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div class="flex gap-3">
              <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
              <button @click="submitReset" class="flex-1 py-2 rounded-xl bg-[#ff9800] text-white font-semibold hover:bg-[#f08000] transition-all">确认重置</button>
            </div>
          </template>

          <!-- Delete -->
          <template v-else-if="modalMode === 'delete'">
            <h3 class="text-lg font-bold text-red-500 mb-2">⚠️ 删除班级</h3>
            <p class="text-sm text-gray-500 mb-4">确认删除「{{ targetClass?.name }}」？该班级将从当前列表中移除，历史审计数据仍会保留。</p>
            <div class="flex gap-3">
              <button @click="closeModal" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">取消</button>
              <button @click="submitDelete" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all">确认删除</button>
            </div>
          </template>

        </div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showTeachersModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="closeTeachers">
        <div class="w-full max-w-md animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-lg font-bold text-gray-800">👩‍🏫 协作教师</h3>
              <p class="mt-1 text-xs text-gray-400">{{ teacherClass?.name }}</p>
            </div>
            <button @click="closeTeachers" class="text-xl text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div v-if="teacherError" class="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{{ teacherError }}</div>
          <div class="max-h-60 space-y-2 overflow-y-auto">
            <div v-for="teacher in teachers" :key="teacher.id" class="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <span class="text-xl">👩‍🏫</span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-gray-700">{{ teacher.displayName }}</div>
                <div class="truncate text-xs text-gray-400">@{{ teacher.username }}</div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="option in permissionOptions"
                    :key="option.key"
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    :class="teacher.permissions[option.key] || teacher.role === 'owner'
                      ? 'bg-[#4ecdc4]/10 text-[#2a9d8f]'
                      : 'bg-gray-100 text-gray-300'"
                  >{{ option.label }}</span>
                </div>
              </div>
              <span v-if="teacher.role === 'owner'" class="rounded-full bg-[#ffd93d]/20 px-2 py-0.5 text-[10px] font-bold text-[#a16207]">管理员</span>
              <div v-else-if="isOwner" class="flex items-center gap-1">
                <details class="relative">
                  <summary class="cursor-pointer rounded-lg px-2 py-1 text-xs text-[#2a9d8f] hover:bg-[#4ecdc4]/10">权限</summary>
                  <div class="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-gray-100 bg-white p-3 shadow-xl">
                    <label v-for="option in permissionOptions" :key="option.key" class="mb-2 flex items-start gap-2 text-xs last:mb-0">
                      <input v-model="teacher.permissions[option.key]" type="checkbox" class="mt-0.5 accent-[#4ecdc4]" />
                      <span>
                        <span class="block font-semibold text-gray-700">{{ option.label }}</span>
                        <span class="block text-gray-400">{{ option.description }}</span>
                      </span>
                    </label>
                    <button
                      @click="updateTeacherPermissions(teacher)"
                      class="mt-3 w-full rounded-lg bg-[#4ecdc4] px-3 py-1.5 text-xs font-semibold text-white"
                    >保存权限</button>
                  </div>
                </details>
                <button
                  @click="removeTeacher(teacher)"
                  class="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-50"
                >移除</button>
              </div>
            </div>
            <div v-if="!teacherLoading && teachers.length === 0" class="py-6 text-center text-sm text-gray-300">暂无协作教师</div>
          </div>

          <div v-if="isOwner" class="mt-4 border-t border-gray-100 pt-4">
            <label class="mb-1 block text-sm text-gray-600">按用户名添加教师</label>
            <div class="mb-3 grid gap-2 rounded-xl bg-gray-50 p-3">
              <label v-for="option in permissionOptions" :key="option.key" class="flex items-start gap-2 text-xs">
                <input v-model="teacherPermissions[option.key]" type="checkbox" class="mt-0.5 accent-[#4ecdc4]" />
                <span>
                  <span class="block font-semibold text-gray-700">{{ option.label }}权限</span>
                  <span class="block text-gray-400">{{ option.description }}</span>
                </span>
              </label>
            </div>
            <div class="flex gap-2">
              <input
                v-model="teacherUsername"
                class="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                placeholder="请输入已注册账号"
                @keyup.enter="addTeacher"
              />
              <button
                @click="addTeacher"
                :disabled="teacherLoading || !teacherUsername.trim()"
                class="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :class="theme.buttonPrimary"
              >添加</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
