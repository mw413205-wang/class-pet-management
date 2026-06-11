import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Student, Class, Group, ScoreRule, ScoreAction, BadgeRecord, AppToast, StudentImportResult, StudentImportRow } from '@/types'
import { PETS } from '@/data/petData'
import { api, getStoredUser } from '@/services/api'
import type { BootstrapData } from '@/services/api'

export type ResetMode = 'score' | 'score_badges' | 'all_growth'

const CLASS_GRADIENTS = [
  { from: '#4ecdc4', to: '#95e1d3' },
  { from: '#ff6b9d', to: '#c44569' },
  { from: '#ffd93d', to: '#ff9a3c' },
  { from: '#a8edea', to: '#fed6e3' },
  { from: '#96e6a1', to: '#d4fc79' },
]

const STUDENT_NAMES = [
  '陈静', '刘明', '王芳', '张磊', '李娟', '赵平', '周洋', '吴敏', '郑美', '钱帅',
  '孙华', '李强', '周杰', '吴桂', '郑宇', '王梅', '赵聪', '周欣', '吴超', '叶文',
  '孙丽', '马骏', '黄鑫', '陈帅', '刘晓', '林佳', '徐明', '朱亮', '高燕', '唐飞',
]

// 有真实图片的宠物 ID 池：初始学生优先用这些以获得最佳演示效果
const IMAGE_PET_IDS = PETS.filter(p => p.hasImage).map(p => p.id)

function makeStudents(classId: number, groupIds: string[]): Student[] {
  const scores = [12, 25, 38, 45, 53, 67, 72, 85, 91, 105, 118, 125, 133, 148, 156, 162, 178, 183, 195, 208, 220, 235, 18, 44, 88, 130, 165, 192, 48, 78]
  const petIds = IMAGE_PET_IDS.length ? IMAGE_PET_IDS : PETS.map(pet => pet.id)
  return STUDENT_NAMES.map((name, i) => ({
    id: classId * 1000 + i + 1,
    name,
    classId,
    groupId: groupIds[i % groupIds.length],
    // 前 70% 学生分到有图片的宠物，剩余随机其他宠物
    petId: petIds.length ? petIds[i % petIds.length] : null,
    petNickname: '',
    score: scores[i] ?? Math.floor(Math.random() * 220),
    badges: Math.floor((scores[i] ?? 0) / 100),
    cosmetics: { toyId: null, headId: null, backId: null, neckId: null, faceId: null },
  }))
}

export const useAppStore = defineStore('app', () => {
  const authUser = getStoredUser()
  const fullClassPermissions = { canScore: true, canManageStudents: true, canManageConfig: true }
  // ─── Classes ──────────────────────────────────────────────────────────────
  const classes = ref<Class[]>([
    { id: 1, name: '三年级(1)班', gradientFrom: CLASS_GRADIENTS[0].from, gradientTo: CLASS_GRADIENTS[0].to, teacherCount: 1, permissions: fullClassPermissions },
    { id: 2, name: '三年级(2)班', gradientFrom: CLASS_GRADIENTS[1].from, gradientTo: CLASS_GRADIENTS[1].to, teacherCount: 1, permissions: fullClassPermissions },
  ])
  const storedClassId = Number(localStorage.getItem('current-class-id'))
  const currentClassId = ref(Number.isInteger(storedClassId) && storedClassId > 0 ? storedClassId : 1)
  const currentClass = computed(() => classes.value.find(c => c.id === currentClassId.value))
  const currentClassPermissions = computed(() => getClassPermissions(currentClassId.value))

  function getClassPermissions(classId: number) {
    if (authUser?.role === 'owner') return fullClassPermissions
    return classes.value.find(c => c.id === classId)?.permissions ?? { canScore: false, canManageStudents: false, canManageConfig: false }
  }

  function canScoreClass(classId: number) {
    return getClassPermissions(classId).canScore
  }

  function canManageClassStudents(classId: number) {
    return getClassPermissions(classId).canManageStudents
  }

  function canManageClassConfig(classId: number) {
    return getClassPermissions(classId).canManageConfig
  }

  // ─── Groups ───────────────────────────────────────────────────────────────
  const groups = ref<Group[]>([
    { id: 'ungrouped-1', name: '未分组', color: '#9ca3af', bgClass: 'bg-gray-100', textClass: 'text-gray-600', borderColor: '#9ca3af', classId: 1 },
    { id: 'red-1', name: '红组', color: '#ef4444', bgClass: 'bg-[#fecaca]', textClass: 'text-[#991b1b]', borderColor: '#ef4444', classId: 1 },
    { id: 'blue-1', name: '蓝组', color: '#3b82f6', bgClass: 'bg-[#bfdbfe]', textClass: 'text-[#1e40af]', borderColor: '#3b82f6', classId: 1 },
    { id: 'yellow-1', name: '黄组', color: '#f59e0b', bgClass: 'bg-[#fef08a]', textClass: 'text-[#854d0e]', borderColor: '#f59e0b', classId: 1 },
    { id: 'green-1', name: '绿组', color: '#22c55e', bgClass: 'bg-[#bbf7d0]', textClass: 'text-[#166534]', borderColor: '#22c55e', classId: 1 },
    { id: 'ungrouped-2', name: '未分组', color: '#9ca3af', bgClass: 'bg-gray-100', textClass: 'text-gray-600', borderColor: '#9ca3af', classId: 2 },
    { id: 'red-2', name: '红组', color: '#ef4444', bgClass: 'bg-[#fecaca]', textClass: 'text-[#991b1b]', borderColor: '#ef4444', classId: 2 },
    { id: 'blue-2', name: '蓝组', color: '#3b82f6', bgClass: 'bg-[#bfdbfe]', textClass: 'text-[#1e40af]', borderColor: '#3b82f6', classId: 2 },
    { id: 'yellow-2', name: '黄组', color: '#f59e0b', bgClass: 'bg-[#fef08a]', textClass: 'text-[#854d0e]', borderColor: '#f59e0b', classId: 2 },
    { id: 'green-2', name: '绿组', color: '#22c55e', bgClass: 'bg-[#bbf7d0]', textClass: 'text-[#166534]', borderColor: '#22c55e', classId: 2 },
  ])
  const currentGroups = computed(() => groups.value.filter(g => g.classId === currentClassId.value))

  // ─── Students ─────────────────────────────────────────────────────────────
  const groupIds1 = groups.value.filter(g => g.classId === 1 && !g.id.startsWith('ungrouped-')).map(g => g.id)
  const groupIds2 = groups.value.filter(g => g.classId === 2 && !g.id.startsWith('ungrouped-')).map(g => g.id)
  const students = ref<Student[]>([
    ...makeStudents(1, groupIds1),
    ...makeStudents(2, groupIds2),
  ])
  const currentStudents = computed(() => students.value.filter(s => s.classId === currentClassId.value))

  // ─── Score Rules ──────────────────────────────────────────────────────────
  const scoreRules = ref<ScoreRule[]>([
    { id: 1, name: '认真听讲', icon: '👂', value: 2, enabled: true, isQuick: true, order: 1, classId: 1 },
    { id: 2, name: '积极回答', icon: '✋', value: 3, enabled: true, isQuick: true, order: 2, classId: 1 },
    { id: 3, name: '作业优秀', icon: '📝', value: 5, enabled: true, isQuick: true, order: 3, classId: 1 },
    { id: 4, name: '帮助同学', icon: '🤝', value: 3, enabled: true, isQuick: false, order: 4, classId: 1 },
    { id: 5, name: '课堂表现优秀', icon: '⭐', value: 5, enabled: true, isQuick: false, order: 5, classId: 1 },
    { id: 6, name: '违反纪律', icon: '⚠️', value: -2, enabled: true, isQuick: false, order: 6, classId: 1 },
    { id: 7, name: '未完成作业', icon: '❌', value: -3, enabled: true, isQuick: false, order: 7, classId: 1 },
    { id: 8, name: '认真听讲', icon: '👂', value: 2, enabled: true, isQuick: true, order: 1, classId: 2 },
    { id: 9, name: '积极回答', icon: '✋', value: 3, enabled: true, isQuick: true, order: 2, classId: 2 },
    { id: 10, name: '作业优秀', icon: '📝', value: 5, enabled: true, isQuick: true, order: 3, classId: 2 },
    { id: 11, name: '帮助同学', icon: '🤝', value: 3, enabled: true, isQuick: false, order: 4, classId: 2 },
    { id: 12, name: '课堂表现优秀', icon: '⭐', value: 5, enabled: true, isQuick: false, order: 5, classId: 2 },
    { id: 13, name: '违反纪律', icon: '⚠️', value: -2, enabled: true, isQuick: false, order: 6, classId: 2 },
    { id: 14, name: '未完成作业', icon: '❌', value: -3, enabled: true, isQuick: false, order: 7, classId: 2 },
  ])
  const currentRules = computed(() => scoreRules.value.filter(r => r.classId === currentClassId.value).sort((a, b) => a.order - b.order))
  const currentQuickRules = computed(() => currentRules.value.filter(r => r.enabled && r.isQuick))

  // ─── Level Thresholds ─────────────────────────────────────────────────────
  const levelThresholds = ref([50, 100, 150, 200])
  const allowPetChange = ref(false)
  const systemName = ref(localStorage.getItem('system-name') || '班级宠物园')

  // ─── Score Actions (for undo) ─────────────────────────────────────────────
  const recentActions = ref<ScoreAction[]>([])

  // ─── Badge Records ────────────────────────────────────────────────────────
  const badgeRecords = ref<BadgeRecord[]>(
    students.value.flatMap(student => {
      const earned = Math.floor(student.score / 100)
      return Array.from({ length: earned }, (_, index) => ({
        id: student.id * 100 + index,
        studentId: student.id,
        type: 'milestone' as const,
        amount: 1,
        description: `达到 ${((index + 1) * 100)} 积分`,
        timestamp: Date.now(),
        milestone: (index + 1) * 100,
      }))
    })
  )

  // ─── Cross-window score sync ──────────────────────────────────────────────
  const scoreSyncChannel = typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('class-pet-score-sync')
  const scoreSyncSource = `${Date.now()}-${Math.random()}`
  let applyingRemoteScoreState = false

  function broadcastScoreState() {
    if (!scoreSyncChannel || applyingRemoteScoreState) return
    scoreSyncChannel.postMessage({
      type: 'score-state',
      source: scoreSyncSource,
      students: students.value.map(student => ({ id: student.id, score: student.score, badges: student.badges })),
      recentActions: recentActions.value.map(action => ({ ...action })),
      badgeRecords: badgeRecords.value.map(record => ({ ...record })),
    })
  }

  if (scoreSyncChannel) {
    scoreSyncChannel.onmessage = event => {
      if (event.data?.source === scoreSyncSource) return
      if (event.data?.type === 'request-score-state') {
        broadcastScoreState()
        return
      }
      if (event.data?.type !== 'score-state') return
      if (!Array.isArray(event.data.students) || !Array.isArray(event.data.recentActions) || !Array.isArray(event.data.badgeRecords)) return
      applyingRemoteScoreState = true
      event.data.students.forEach((incoming: { id: number; score: number; badges: number }) => {
        const student = students.value.find(item => item.id === incoming.id)
        if (student) {
          student.score = incoming.score
          student.badges = incoming.badges
        }
      })
      recentActions.value = event.data.recentActions
      badgeRecords.value = event.data.badgeRecords
      applyingRemoteScoreState = false
    }
    scoreSyncChannel.postMessage({ type: 'request-score-state', source: scoreSyncSource })
  }

  watch(currentClassId, classId => {
    if (classId > 0) localStorage.setItem('current-class-id', String(classId))
    broadcastScoreState()
  })

  // ─── Toasts ───────────────────────────────────────────────────────────────
  const toasts = ref<AppToast[]>([])
  const persistenceReady = ref(false)
  const persistenceLoading = ref(false)
  const pendingWrites = ref(0)
  let initializePromise: Promise<void> | null = null
  let mutationQueue: Promise<unknown> = Promise.resolve()
  const pendingScoreActionIds = new Map<number, Promise<number | undefined>>()

  function applyBootstrap(data: BootstrapData) {
    classes.value = data.classes
    groups.value = data.groups
    students.value = data.students
    scoreRules.value = data.scoreRules
    recentActions.value = data.recentActions
    badgeRecords.value = data.badgeRecords
    levelThresholds.value = data.levelThresholds
    allowPetChange.value = data.allowPetChange
    systemName.value = data.systemName
    localStorage.setItem('system-name', data.systemName)
    if (!classes.value.some(item => item.id === currentClassId.value)) {
      currentClassId.value = classes.value[0]?.id ?? 0
    }
    broadcastScoreState()
  }

  async function loadPersistedState() {
    persistenceLoading.value = true
    try {
      applyBootstrap(await api<BootstrapData>('/bootstrap'))
      persistenceReady.value = true
    } finally {
      persistenceLoading.value = false
    }
  }

  function initializePersistence() {
    if (!initializePromise) {
      initializePromise = loadPersistedState().catch(error => {
        initializePromise = null
        addToast(`后端连接失败：${error.message}`, 'error')
      })
    }
    return initializePromise
  }

  function syncAfter<T>(
    requestFactory: () => Promise<T>,
    successMessage?: string,
    successType: AppToast['type'] = 'success',
  ): Promise<T | undefined> {
    pendingWrites.value += 1
    const operation = mutationQueue.then(async () => {
      try {
        const result = await requestFactory()
        await loadPersistedState()
        if (successMessage) addToast(successMessage, successType)
        return result
      } catch (error) {
        addToast(`保存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error')
        await loadPersistedState().catch(() => undefined)
        return undefined
      } finally {
        pendingWrites.value -= 1
      }
    })
    mutationQueue = operation
    return operation
  }

  // ─── Level Up Event ───────────────────────────────────────────────────────
  // ─── Helpers ──────────────────────────────────────────────────────────────
  function getLevel(score: number): number {
    const t = levelThresholds.value
    if (score >= t[3]) return 4
    if (score >= t[2]) return 3
    if (score >= t[1]) return 2
    if (score >= t[0]) return 1
    return 0
  }

  function getProgress(score: number) {
    const level = getLevel(score)
    const t = levelThresholds.value
    if (level === 4) {
      return { percent: 100, current: score - t[3], max: 0, isMax: true, label: 'MAX' }
    }
    const prevT = level === 0 ? 0 : t[level - 1]
    const current = score - prevT
    const max = t[level] - prevT
    return { percent: Math.min(100, Math.round((current / max) * 100)), current, max, isMax: false, label: `${current}/${max}` }
  }

  function getGroupById(groupId: string): Group | undefined {
    return groups.value.find(g => g.id === groupId)
  }

  function getUngroupedGroup(classId = currentClassId.value): Group | undefined {
    return groups.value.find(g => g.classId === classId && g.id === `ungrouped-${classId}`)
  }

  // ─── Toasts ───────────────────────────────────────────────────────────────
  function addToast(message: string, type: AppToast['type'] = 'info') {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
  }

  // ─── Score Actions ────────────────────────────────────────────────────────
  function applyScoreLocally(studentId: number, rule: ScoreRule) {
    const student = students.value.find(s => s.id === studentId)
    if (!student) return null
    const previousScore = student.score
    student.score = Math.max(0, student.score + rule.value)
    const appliedValue = student.score - previousScore
    if (student.score > previousScore) {
      const firstMilestone = (Math.floor(previousScore / 100) + 1) * 100
      for (let milestone = firstMilestone; milestone <= student.score; milestone += 100) {
        const alreadyAwarded = badgeRecords.value.some(record =>
          record.studentId === studentId && record.type === 'milestone' && record.milestone === milestone
        )
        if (!alreadyAwarded) {
          badgeRecords.value.unshift({
            id: Date.now() + Math.random(),
            studentId,
            type: 'milestone',
            amount: 1,
            description: `达到 ${milestone} 积分`,
            timestamp: Date.now(),
            milestone,
          })
          student.badges += 1
        }
      }
    }
    const action: ScoreAction = {
      id: Date.now() + Math.random(),
      studentId,
      ruleId: rule.id,
      ruleName: rule.name,
      studentName: student.name,
      value: appliedValue,
      timestamp: Date.now(),
      reverted: false,
    }
    recentActions.value.unshift(action)
    if (recentActions.value.length > 50) recentActions.value.pop()
    return action
  }

  function addScore(studentId: number, rule: ScoreRule) {
    const action = applyScoreLocally(studentId, rule)
    if (!action) return
    broadcastScoreState()
    const persistedActionId = syncAfter(() => api<{ actionId: number }>('/scores', {
      method: 'POST',
      body: JSON.stringify({ studentId, ruleId: rule.id }),
    })).then(result => result?.actionId)
    pendingScoreActionIds.set(action.id, persistedActionId)
    void persistedActionId.finally(() => {
      window.setTimeout(() => pendingScoreActionIds.delete(action.id), 5000)
    })
    const sign = action.value > 0 ? '+' : ''
    addToast(`已为 ${action.studentName} ${sign}${action.value} 分`, 'info')
  }

  function batchAddScore(studentIds: number[], rule: ScoreRule) {
    const uniqueStudentIds = [...new Set(studentIds)]
    if (uniqueStudentIds.length > 100) {
      addToast('批量积分每次最多选择 100 名学生', 'warning')
      return
    }
    const actions = uniqueStudentIds
      .map(id => applyScoreLocally(id, rule))
      .filter((action): action is ScoreAction => Boolean(action))
    if (!actions.length) return
    broadcastScoreState()
    const persistedActions = syncAfter(() => api<{ actions: { actionId: number }[] }>('/scores/batch', {
      method: 'POST',
      body: JSON.stringify({ studentIds: actions.map(action => action.studentId), ruleId: rule.id }),
    })).then(result => result?.actions)
    actions.forEach((action, index) => {
      const persistedActionId = persistedActions.then(result => result?.[index]?.actionId)
      pendingScoreActionIds.set(action.id, persistedActionId)
      void persistedActionId.finally(() => {
        window.setTimeout(() => pendingScoreActionIds.delete(action.id), 5000)
      })
    })
    addToast(`已为 ${actions.length} 名学生批量${rule.value > 0 ? '加分' : '扣分'}`, 'info')
  }

  function revertAction(actionId: number) {
    const action = recentActions.value.find(a => a.id === actionId)
    if (!action || action.reverted) return
    if (Date.now() - action.timestamp > 24 * 3600 * 1000) return
    const student = students.value.find(s => s.id === action.studentId)
    if (!student) return
    student.score = Math.max(0, student.score - action.value)
    action.reverted = true
    broadcastScoreState()
    const persistedActionId = pendingScoreActionIds.get(actionId)
    syncAfter(async () => {
      const id = persistedActionId ? await persistedActionId : actionId
      if (!id) throw new Error('积分操作尚未保存，请稍后重试')
      return api(`/scores/${id}/revert`, { method: 'POST' })
    }, `已撤回 ${action.studentName} 的 ${action.ruleName} 操作`, 'info')
  }

  function getStudentRecentActions(studentId: number): ScoreAction[] {
    return recentActions.value.filter(a => a.studentId === studentId && !a.reverted).slice(0, 5)
  }

  // ─── Class CRUD ───────────────────────────────────────────────────────────
  function addClass(name: string, copyFromClassId: number | null = null) {
    void syncAfter(() => api<{ id: number }>('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, copyFromClassId }),
    })).then(result => {
      if (result) addToast(`班级「${name}」创建成功`, 'success')
    })
  }

  function updateClass(id: number, name: string) {
    const cls = classes.value.find(c => c.id === id)
    if (cls) {
      cls.name = name
      syncAfter(() => api(`/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      }), '班级名称已更新')
    }
  }

  function deleteClass(id: number) {
    const deletedStudentIds = students.value.filter(s => s.classId === id).map(s => s.id)
    classes.value = classes.value.filter(c => c.id !== id)
    students.value = students.value.filter(s => s.classId !== id)
    scoreRules.value = scoreRules.value.filter(r => r.classId !== id)
    groups.value = groups.value.filter(g => g.classId !== id)
    badgeRecords.value = badgeRecords.value.filter(record => !deletedStudentIds.includes(record.studentId))
    if (currentClassId.value === id && classes.value.length > 0) {
      currentClassId.value = classes.value[0].id
    }
    syncAfter(() => api(`/classes/${id}`, { method: 'DELETE' }), '班级已删除', 'info')
  }

  function resetClassProgress(id: number, mode: ResetMode, confirmation: string) {
    return syncAfter(() => api(`/classes/${id}/reset`, {
      method: 'POST',
      body: JSON.stringify({ mode, confirmation }),
    }), '班级进度已重置')
  }

  function resetAllClassProgress(mode: ResetMode, confirmation: string, password: string) {
    return syncAfter(() => api('/classes/reset-all', {
      method: 'POST',
      body: JSON.stringify({ mode, confirmation, password }),
    }), '全部班级进度已重置')
  }

  // ─── Student CRUD ─────────────────────────────────────────────────────────
  function addStudent(data: Partial<Student>) {
    const student = {
      name: data.name ?? '',
      classId: currentClassId.value,
      groupId: data.groupId ?? (getUngroupedGroup()?.id ?? ''),
      petId: data.petId ?? null,
      petNickname: data.petNickname ?? '',
    }
    void syncAfter(() => api<{ id: number }>('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    })).then(result => {
      if (result) addToast(`学生「${student.name}」已添加`, 'success')
    })
  }

  function updateStudent(id: number, data: Partial<Student>) {
    const s = students.value.find(s => s.id === id)
    if (s) {
      if (Object.hasOwn(data, 'petId') && data.petId !== s.petId && !canChangeStudentPet(s)) {
        addToast('该学生已有成长积分，请先重置积分或在系统设置中允许更换宠物', 'warning')
        return
      }
      Object.assign(s, data)
      syncAfter(() => api(`/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }), '学生信息已更新')
    }
  }

  function deleteStudent(id: number) {
    const s = students.value.find(s => s.id === id)
    if (!s) return
    students.value = students.value.filter(s => s.id !== id)
    syncAfter(() => api(`/students/${id}`, { method: 'DELETE' }))
    return s
  }

  async function importStudents(rows: StudentImportRow[]) {
    const result = await syncAfter(() => api<StudentImportResult>('/students/import', {
      method: 'POST',
      body: JSON.stringify({ classId: currentClassId.value, rows }),
    }))
    if (result) {
      addToast(`导入完成：成功 ${result.created} 人，跳过 ${result.skipped} 人，失败 ${result.failed} 人`, 'success')
    }
    return result
  }

  function restoreStudent(student: Student) {
    if (students.value.some(s => s.id === student.id)) return
    students.value.push(student)
    syncAfter(() => api(`/students/${student.id}/restore`, { method: 'POST' }), `已恢复学生「${student.name}」`)
  }

  function savePetDetails(studentId: number, petId: string | null, petNickname: string, successMessage: string | null = '宠物分配成功') {
    const s = students.value.find(s => s.id === studentId)
    if (s) {
      if (petId !== s.petId && !canChangeStudentPet(s)) {
        addToast('该学生已有成长积分，请先重置积分或在系统设置中允许更换宠物', 'warning')
        return
      }
      s.petId = petId
      s.petNickname = petNickname
      syncAfter(() => api(`/students/${studentId}/pet`, {
        method: 'PUT',
        body: JSON.stringify({ petId: s.petId, petNickname: s.petNickname }),
      }), successMessage ?? undefined)
    }
  }

  function assignPet(studentId: number, petId: string | null) {
    const student = students.value.find(item => item.id === studentId)
    if (student) savePetDetails(studentId, petId, student.petNickname, null)
  }

  function assignPetNickname(studentId: number, nickname: string) {
    const s = students.value.find(s => s.id === studentId)
    if (s) savePetDetails(studentId, s.petId, nickname)
  }

  // ─── Group CRUD ───────────────────────────────────────────────────────────
  function addGroup(name: string, color: string) {
    const classId = currentClassId.value
    void syncAfter(() => api<{ id: string }>('/groups', {
      method: 'POST',
      body: JSON.stringify({ classId, name, color }),
    })).then(result => {
      if (result) addToast(`小组「${name}」已创建`, 'success')
    })
  }

  function deleteGroup(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group || group.id.startsWith('ungrouped-')) return
    const ungrouped = getUngroupedGroup(group.classId)
    if (!ungrouped) return
    students.value.filter(s => s.groupId === groupId).forEach(s => s.groupId = ungrouped.id)
    groups.value = groups.value.filter(g => g.id !== groupId)
    syncAfter(() => api(`/groups/${groupId}`, { method: 'DELETE' }), '小组已删除', 'info')
  }

  function canChangeStudentPet(student: Student) {
    return !student.petId || student.score === 0 || allowPetChange.value
  }

  function renameGroup(groupId: string, name: string) {
    return syncAfter(() => api(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }), '小组名称已更新')
  }

  // ─── Score Rule CRUD ──────────────────────────────────────────────────────
  function addScoreRule(data: Partial<ScoreRule>) {
    const maxOrder = Math.max(0, ...currentRules.value.map(r => r.order))
    const rule = {
      name: data.name ?? '',
      icon: data.icon ?? '⭐',
      value: data.value ?? 1,
      enabled: true,
      isQuick: data.isQuick ?? false,
      order: data.order ?? maxOrder + 1,
      classId: currentClassId.value,
    }
    void syncAfter(() => api<{ id: number }>('/score-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    })).then(result => {
      if (result) addToast('规则已创建', 'success')
    })
  }

  function updateScoreRule(id: number, data: Partial<ScoreRule>) {
    const r = scoreRules.value.find(r => r.id === id)
    if (r) {
      Object.assign(r, data)
      syncAfter(() => api(`/score-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }), '规则已更新')
    }
  }

  function deleteScoreRule(id: number) {
    scoreRules.value = scoreRules.value.filter(r => r.id !== id)
    syncAfter(() => api(`/score-rules/${id}`, { method: 'DELETE' }), '规则已删除', 'info')
  }

  function toggleScoreRule(id: number) {
    const r = scoreRules.value.find(r => r.id === id)
    if (r) {
      r.enabled = !r.enabled
      syncAfter(() => api(`/score-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: r.enabled }),
      }))
    }
  }

  function toggleQuickScoreRule(id: number) {
    const r = scoreRules.value.find(r => r.id === id)
    if (r) {
      r.isQuick = !r.isQuick
      syncAfter(() => api(`/score-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isQuick: r.isQuick }),
      }))
    }
  }

  function moveRule(id: number, dir: 1 | -1) {
    const rules = currentRules.value
    const idx = rules.findIndex(r => r.id === id)
    const target = idx + dir
    if (target < 0 || target >= rules.length) return
    const temp = rules[idx].order
    rules[idx].order = rules[target].order
    rules[target].order = temp
    syncAfter(() => Promise.all([
      api(`/score-rules/${rules[idx].id}`, {
        method: 'PUT',
        body: JSON.stringify({ order: rules[idx].order }),
      }),
      api(`/score-rules/${rules[target].id}`, {
        method: 'PUT',
        body: JSON.stringify({ order: rules[target].order }),
      }),
    ]))
  }

  // ─── Cosmetics ────────────────────────────────────────────────────────────
  function equipCosmetic(studentId: number, type: keyof Student['cosmetics'], cosmeticId: string | null) {
    const s = students.value.find(s => s.id === studentId)
    if (s) {
      s.cosmetics[type] = cosmeticId
      syncAfter(() => api(`/students/${studentId}/cosmetics`, {
        method: 'PUT',
        body: JSON.stringify(s.cosmetics),
      }))
    }
  }

  function removeAllCosmetics(studentId: number) {
    const student = students.value.find(item => item.id === studentId)
    if (!student) return
    student.cosmetics = { toyId: null, headId: null, backId: null, neckId: null, faceId: null }
    syncAfter(() => api(`/students/${studentId}/cosmetics`, {
      method: 'PUT',
      body: JSON.stringify(student.cosmetics),
    }), '已卸下所有装扮', 'info')
  }

  function saveLevelThresholds(values: number[]) {
    levelThresholds.value = values
    syncAfter(() => api('/settings/level-thresholds', {
      method: 'PUT',
      body: JSON.stringify({ values }),
    }), '等级阈值已更新')
  }

  function saveAllowPetChange(enabled: boolean) {
    allowPetChange.value = enabled
    syncAfter(() => api('/settings/allow-pet-change', {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }), '宠物更换设置已更新')
  }

  function saveSystemName(name: string) {
    const systemNameValue = name.trim()
    systemName.value = systemNameValue
    localStorage.setItem('system-name', systemNameValue)
    return syncAfter(() => api('/settings/system-name', {
      method: 'PUT',
      body: JSON.stringify({ systemName: systemNameValue }),
    }), '系统名称已更新')
  }

  return {
    classes, currentClassId, currentClass, currentClassPermissions,
    groups, currentGroups,
    students, currentStudents,
    scoreRules, currentRules, currentQuickRules,
    levelThresholds, allowPetChange, systemName,
    recentActions, badgeRecords, toasts, persistenceReady, persistenceLoading, pendingWrites,
    getLevel, getProgress, getGroupById, getUngroupedGroup, getClassPermissions, canScoreClass, canManageClassStudents, canManageClassConfig,
    addToast, initializePersistence, loadPersistedState,
    addScore, batchAddScore, revertAction, getStudentRecentActions,
    addClass, updateClass, deleteClass, resetClassProgress, resetAllClassProgress,
    addStudent, updateStudent, importStudents, deleteStudent, restoreStudent, assignPet, assignPetNickname, savePetDetails, canChangeStudentPet,
    addGroup, deleteGroup, renameGroup,
    addScoreRule, updateScoreRule, deleteScoreRule, toggleScoreRule, toggleQuickScoreRule, moveRule,
    equipCosmetic, removeAllCosmetics, saveLevelThresholds, saveAllowPetChange, saveSystemName,
  }
})
