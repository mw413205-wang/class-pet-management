export type AnimationState = 'idle' | 'breathing' | 'happy' | 'sad' | 'sleeping' | 'playing' | 'showing'

export interface Pet {
  id: string
  name: string
  emoji: string
  category: string
  stages: string[]
  baseColor: string
}

export interface CosmeticItem {
  id: string
  name: string
  icon: string
  type: 'toy' | 'head' | 'back' | 'neck' | 'face'
}

export interface StudentCosmetics {
  toyId: string | null
  headId: string | null
  backId: string | null
  neckId: string | null
  faceId: string | null
}

export interface Student {
  id: number
  name: string
  classId: number
  groupId: string
  petId: string | null
  petNickname: string
  score: number
  badges: number
  cosmetics: StudentCosmetics
  animState: AnimationState
}

export interface Class {
  id: number
  name: string
  gradientFrom: string
  gradientTo: string
}

export interface Group {
  id: string
  name: string
  color: string
  bgClass: string
  textClass: string
  borderColor: string
  classId: number
}

export interface ScoreRule {
  id: number
  name: string
  icon: string
  value: number
  enabled: boolean
  order: number
  classId: number
}

export interface ScoreAction {
  id: number
  studentId: number
  ruleId: number
  ruleName: string
  studentName: string
  value: number
  timestamp: number
  reverted: boolean
}

export interface AppToast {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface LevelUpEvent {
  studentId: number
  studentName: string
  petId: string
  petName: string
  newLevel: number   // 0-4
  stageName: string  // 如"猫王"
  isMaxLevel: boolean
}
