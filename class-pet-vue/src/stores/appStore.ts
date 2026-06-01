import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Student, Class, Group, ScoreRule, ScoreAction, AppToast, AnimationState, LevelUpEvent } from '@/types'
import { PETS, getPetById } from '@/data/petData'

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
const ALL_PET_IDS = PETS.map(p => p.id)

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function makeStudents(classId: number, groupIds: string[]): Student[] {
  const scores = [12, 25, 38, 45, 53, 67, 72, 85, 91, 105, 118, 125, 133, 148, 156, 162, 178, 183, 195, 208, 220, 235, 18, 44, 88, 130, 165, 192, 48, 78]
  return STUDENT_NAMES.map((name, i) => ({
    id: classId * 1000 + i + 1,
    name,
    classId,
    groupId: groupIds[i % groupIds.length],
    // 前 70% 学生分到有图片的宠物，剩余随机其他宠物
    petId: i < STUDENT_NAMES.length * 0.7
      ? IMAGE_PET_IDS[i % IMAGE_PET_IDS.length]
      : randomPick(ALL_PET_IDS),
    petNickname: '',
    score: scores[i] ?? Math.floor(Math.random() * 220),
    badges: Math.floor((scores[i] ?? 0) / 100),
    cosmetics: { toyId: null, headId: null, backId: null, neckId: null, faceId: null },
    animState: 'idle' as AnimationState,
  }))
}

export const useAppStore = defineStore('app', () => {
  // ─── Classes ──────────────────────────────────────────────────────────────
  const classes = ref<Class[]>([
    { id: 1, name: '三年级(1)班', gradientFrom: CLASS_GRADIENTS[0].from, gradientTo: CLASS_GRADIENTS[0].to },
    { id: 2, name: '三年级(2)班', gradientFrom: CLASS_GRADIENTS[1].from, gradientTo: CLASS_GRADIENTS[1].to },
  ])
  const currentClassId = ref(1)
  const currentClass = computed(() => classes.value.find(c => c.id === currentClassId.value))

  // ─── Groups ───────────────────────────────────────────────────────────────
  const groups = ref<Group[]>([
    { id: 'red-1', name: '红组', color: '#ef4444', bgClass: 'bg-[#fecaca]', textClass: 'text-[#991b1b]', borderColor: '#ef4444', classId: 1 },
    { id: 'blue-1', name: '蓝组', color: '#3b82f6', bgClass: 'bg-[#bfdbfe]', textClass: 'text-[#1e40af]', borderColor: '#3b82f6', classId: 1 },
    { id: 'yellow-1', name: '黄组', color: '#f59e0b', bgClass: 'bg-[#fef08a]', textClass: 'text-[#854d0e]', borderColor: '#f59e0b', classId: 1 },
    { id: 'green-1', name: '绿组', color: '#22c55e', bgClass: 'bg-[#bbf7d0]', textClass: 'text-[#166534]', borderColor: '#22c55e', classId: 1 },
    { id: 'red-2', name: '红组', color: '#ef4444', bgClass: 'bg-[#fecaca]', textClass: 'text-[#991b1b]', borderColor: '#ef4444', classId: 2 },
    { id: 'blue-2', name: '蓝组', color: '#3b82f6', bgClass: 'bg-[#bfdbfe]', textClass: 'text-[#1e40af]', borderColor: '#3b82f6', classId: 2 },
    { id: 'yellow-2', name: '黄组', color: '#f59e0b', bgClass: 'bg-[#fef08a]', textClass: 'text-[#854d0e]', borderColor: '#f59e0b', classId: 2 },
    { id: 'green-2', name: '绿组', color: '#22c55e', bgClass: 'bg-[#bbf7d0]', textClass: 'text-[#166534]', borderColor: '#22c55e', classId: 2 },
  ])
  const currentGroups = computed(() => groups.value.filter(g => g.classId === currentClassId.value))

  // ─── Students ─────────────────────────────────────────────────────────────
  const groupIds1 = groups.value.filter(g => g.classId === 1).map(g => g.id)
  const groupIds2 = groups.value.filter(g => g.classId === 2).map(g => g.id)
  const students = ref<Student[]>([
    ...makeStudents(1, groupIds1),
    ...makeStudents(2, groupIds2),
  ])
  const currentStudents = computed(() => students.value.filter(s => s.classId === currentClassId.value))

  // ─── Score Rules ──────────────────────────────────────────────────────────
  const scoreRules = ref<ScoreRule[]>([
    { id: 1, name: '认真听讲', icon: '👂', value: 2, enabled: true, order: 1, classId: 1 },
    { id: 2, name: '积极回答', icon: '✋', value: 3, enabled: true, order: 2, classId: 1 },
    { id: 3, name: '作业优秀', icon: '📝', value: 5, enabled: true, order: 3, classId: 1 },
    { id: 4, name: '帮助同学', icon: '🤝', value: 3, enabled: true, order: 4, classId: 1 },
    { id: 5, name: '课堂表现优秀', icon: '⭐', value: 5, enabled: true, order: 5, classId: 1 },
    { id: 6, name: '违反纪律', icon: '⚠️', value: -2, enabled: true, order: 6, classId: 1 },
    { id: 7, name: '未完成作业', icon: '❌', value: -3, enabled: true, order: 7, classId: 1 },
    { id: 8, name: '认真听讲', icon: '👂', value: 2, enabled: true, order: 1, classId: 2 },
    { id: 9, name: '积极回答', icon: '✋', value: 3, enabled: true, order: 2, classId: 2 },
    { id: 10, name: '作业优秀', icon: '📝', value: 5, enabled: true, order: 3, classId: 2 },
    { id: 11, name: '帮助同学', icon: '🤝', value: 3, enabled: true, order: 4, classId: 2 },
    { id: 12, name: '课堂表现优秀', icon: '⭐', value: 5, enabled: true, order: 5, classId: 2 },
    { id: 13, name: '违反纪律', icon: '⚠️', value: -2, enabled: true, order: 6, classId: 2 },
    { id: 14, name: '未完成作业', icon: '❌', value: -3, enabled: true, order: 7, classId: 2 },
  ])
  const currentRules = computed(() => scoreRules.value.filter(r => r.classId === currentClassId.value).sort((a, b) => a.order - b.order))

  // ─── Level Thresholds ─────────────────────────────────────────────────────
  const levelThresholds = ref([50, 100, 150, 200])

  // ─── Score Actions (for undo) ─────────────────────────────────────────────
  const recentActions = ref<ScoreAction[]>([])

  // ─── Toasts ───────────────────────────────────────────────────────────────
  const toasts = ref<AppToast[]>([])

  // ─── Level Up Event ───────────────────────────────────────────────────────
  const levelUpEvent = ref<LevelUpEvent | null>(null)
  function clearLevelUpEvent() { levelUpEvent.value = null }

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

  // ─── Toasts ───────────────────────────────────────────────────────────────
  function addToast(message: string, type: AppToast['type'] = 'info') {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
  }

  // ─── Score Actions ────────────────────────────────────────────────────────
  function addScore(studentId: number, rule: ScoreRule) {
    const student = students.value.find(s => s.id === studentId)
    if (!student) return
    const prevLevel = getLevel(student.score)
    student.score = Math.max(0, student.score + rule.value)
    student.badges = Math.floor(student.score / 100)
    const newLevel = getLevel(student.score)
    student.animState = rule.value > 0 ? 'happy' : 'sad'
    setTimeout(() => { student.animState = 'idle' }, 1600)
    const action: ScoreAction = {
      id: Date.now() + Math.random(),
      studentId,
      ruleId: rule.id,
      ruleName: rule.name,
      studentName: student.name,
      value: rule.value,
      timestamp: Date.now(),
      reverted: false,
    }
    recentActions.value.unshift(action)
    if (recentActions.value.length > 50) recentActions.value.pop()
    if (newLevel > prevLevel) {
      const pet = getPetById(student.petId ?? '')
      if (pet) {
        levelUpEvent.value = {
          studentId: student.id,
          studentName: student.name,
          petId: pet.id,
          petName: pet.name,
          newLevel,
          stageName: pet.stages[newLevel] ?? pet.stages[4],
          isMaxLevel: newLevel === 4,
        }
      } else {
        addToast(`🎉 ${student.name} 的宠物升级到 ${newLevel + 1} 级！`, 'success')
      }
    } else {
      const sign = rule.value > 0 ? '+' : ''
      addToast(`已为 ${student.name} ${sign}${rule.value} 分`, 'info')
    }
  }

  function batchAddScore(studentIds: number[], rule: ScoreRule) {
    studentIds.forEach(id => addScore(id, rule))
  }

  function revertAction(actionId: number) {
    const action = recentActions.value.find(a => a.id === actionId)
    if (!action || action.reverted) return
    if (Date.now() - action.timestamp > 24 * 3600 * 1000) return
    const student = students.value.find(s => s.id === action.studentId)
    if (!student) return
    student.score = Math.max(0, student.score - action.value)
    student.badges = Math.floor(student.score / 100)
    action.reverted = true
    addToast(`已撤回 ${action.studentName} 的 ${action.ruleName} 操作`, 'info')
  }

  function getStudentRecentActions(studentId: number): ScoreAction[] {
    return recentActions.value.filter(a => a.studentId === studentId && !a.reverted).slice(0, 5)
  }

  // ─── Class CRUD ───────────────────────────────────────────────────────────
  const nextClassId = ref(3)
  function addClass(name: string) {
    const id = nextClassId.value++
    const g = CLASS_GRADIENTS[(id - 1) % CLASS_GRADIENTS.length]
    classes.value.push({ id, name, gradientFrom: g.from, gradientTo: g.to })
    // Create default groups
    const defaultGroups = ['红组', '蓝组', '黄组', '绿组']
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e']
    const bgs = ['bg-[#fecaca]', 'bg-[#bfdbfe]', 'bg-[#fef08a]', 'bg-[#bbf7d0]']
    const texts = ['text-[#991b1b]', 'text-[#1e40af]', 'text-[#854d0e]', 'text-[#166534]']
    defaultGroups.forEach((gName, i) => {
      groups.value.push({ id: `${gName.replace('组', '')}-${id}`, name: gName, color: colors[i], bgClass: bgs[i], textClass: texts[i], borderColor: colors[i], classId: id })
    })
    // Add default rules
    const baseRules = scoreRules.value.filter(r => r.classId === 1).map((r, i) => ({
      ...r, id: Date.now() + i, classId: id
    }))
    scoreRules.value.push(...baseRules)
    addToast(`班级「${name}」创建成功`, 'success')
  }

  function updateClass(id: number, name: string) {
    const cls = classes.value.find(c => c.id === id)
    if (cls) { cls.name = name; addToast('班级名称已更新', 'success') }
  }

  function deleteClass(id: number) {
    classes.value = classes.value.filter(c => c.id !== id)
    students.value = students.value.filter(s => s.classId !== id)
    scoreRules.value = scoreRules.value.filter(r => r.classId !== id)
    groups.value = groups.value.filter(g => g.classId !== id)
    if (currentClassId.value === id && classes.value.length > 0) {
      currentClassId.value = classes.value[0].id
    }
    addToast('班级已删除', 'info')
  }

  function resetClassProgress(id: number, includesBadges: boolean) {
    students.value.filter(s => s.classId === id).forEach(s => {
      s.score = 0
      if (includesBadges) s.badges = 0
    })
    addToast('班级进度已重置', 'success')
  }

  // ─── Student CRUD ─────────────────────────────────────────────────────────
  const nextStudentId = ref(10000)
  function addStudent(data: Partial<Student>) {
    const id = nextStudentId.value++
    const student: Student = {
      id,
      name: data.name ?? '',
      classId: currentClassId.value,
      groupId: data.groupId ?? (currentGroups.value[0]?.id ?? ''),
      petId: data.petId ?? null,
      petNickname: data.petNickname ?? '',
      score: 0,
      badges: 0,
      cosmetics: { toyId: null, headId: null, backId: null, neckId: null, faceId: null },
      animState: 'idle',
    }
    students.value.push(student)
    addToast(`学生「${student.name}」已添加`, 'success')
  }

  function updateStudent(id: number, data: Partial<Student>) {
    const s = students.value.find(s => s.id === id)
    if (s) {
      Object.assign(s, data)
      addToast('学生信息已更新', 'success')
    }
  }

  function deleteStudent(id: number) {
    const s = students.value.find(s => s.id === id)
    if (!s) return
    students.value = students.value.filter(s => s.id !== id)
    addToast(`已删除学生「${s.name}」`, 'info')
    return s
  }

  function assignPet(studentId: number, petId: string) {
    const s = students.value.find(s => s.id === studentId)
    if (s) { s.petId = petId; addToast('宠物分配成功', 'success') }
  }

  function assignPetNickname(studentId: number, nickname: string) {
    const s = students.value.find(s => s.id === studentId)
    if (s) s.petNickname = nickname
  }

  // ─── Group CRUD ───────────────────────────────────────────────────────────
  function addGroup(name: string, color: string) {
    const id = `custom-${Date.now()}`
    groups.value.push({ id, name, color, bgClass: '', textClass: '', borderColor: color, classId: currentClassId.value })
    addToast(`小组「${name}」已创建`, 'success')
  }

  function deleteGroup(groupId: string) {
    const ungrouped = currentGroups.value[0]
    if (!ungrouped) return
    students.value.filter(s => s.groupId === groupId).forEach(s => s.groupId = ungrouped.id)
    groups.value = groups.value.filter(g => g.id !== groupId)
    addToast('小组已删除', 'info')
  }

  // ─── Score Rule CRUD ──────────────────────────────────────────────────────
  const nextRuleId = ref(100)
  function addScoreRule(data: Partial<ScoreRule>) {
    const maxOrder = Math.max(0, ...currentRules.value.map(r => r.order))
    scoreRules.value.push({
      id: nextRuleId.value++,
      name: data.name ?? '',
      icon: data.icon ?? '⭐',
      value: data.value ?? 1,
      enabled: true,
      order: maxOrder + 1,
      classId: currentClassId.value,
    })
    addToast('规则已创建', 'success')
  }

  function updateScoreRule(id: number, data: Partial<ScoreRule>) {
    const r = scoreRules.value.find(r => r.id === id)
    if (r) { Object.assign(r, data); addToast('规则已更新', 'success') }
  }

  function deleteScoreRule(id: number) {
    scoreRules.value = scoreRules.value.filter(r => r.id !== id)
    addToast('规则已删除', 'info')
  }

  function toggleScoreRule(id: number) {
    const r = scoreRules.value.find(r => r.id === id)
    if (r) r.enabled = !r.enabled
  }

  function moveRule(id: number, dir: 1 | -1) {
    const rules = currentRules.value
    const idx = rules.findIndex(r => r.id === id)
    const target = idx + dir
    if (target < 0 || target >= rules.length) return
    const temp = rules[idx].order
    rules[idx].order = rules[target].order
    rules[target].order = temp
  }

  // ─── Cosmetics ────────────────────────────────────────────────────────────
  function equipCosmetic(studentId: number, type: keyof Student['cosmetics'], cosmeticId: string | null) {
    const s = students.value.find(s => s.id === studentId)
    if (s) { s.cosmetics[type] = cosmeticId }
  }

  return {
    classes, currentClassId, currentClass,
    groups, currentGroups,
    students, currentStudents,
    scoreRules, currentRules,
    levelThresholds,
    recentActions, toasts,
    levelUpEvent, clearLevelUpEvent,
    getLevel, getProgress, getGroupById,
    addToast,
    addScore, batchAddScore, revertAction, getStudentRecentActions,
    addClass, updateClass, deleteClass, resetClassProgress,
    addStudent, updateStudent, deleteStudent, assignPet, assignPetNickname,
    addGroup, deleteGroup,
    addScoreRule, updateScoreRule, deleteScoreRule, toggleScoreRule, moveRule,
    equipCosmetic,
  }
})
