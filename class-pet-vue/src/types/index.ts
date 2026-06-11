export interface Pet {
  id: string
  name: string
  emoji: string
  category: string
  stages: string[]
  baseColor: string
  hasImage?: boolean
}

export type CosmeticType = 'toy' | 'head' | 'back' | 'neck' | 'face'

export interface CosmeticItem {
  id: string
  name: string
  icon: string
  type: CosmeticType
  assetPath?: string
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
}

export interface Class {
  id: number
  name: string
  gradientFrom: string
  gradientTo: string
  teacherCount: number
  permissions: {
    canScore: boolean
    canManageStudents: boolean
    canManageConfig: boolean
  }
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
  isQuick: boolean
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

export interface BadgeRecord {
  id: number
  studentId: number
  type: 'milestone' | 'exchange' | 'manual' | 'weekly' | 'monthly' | 'semester'
  amount: number
  description: string
  timestamp: number
  milestone?: number
  settlementId?: number
  customBadgeId?: number
  customBadgeName?: string
  icon?: string
  operatorName?: string
}

export interface AppToast {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export interface StudentImportRow {
  index: number
  name: string
  groupId: string
  petId: string | null
}

export interface StudentImportResultRow {
  index: number
  name: string
  studentId?: number
  status: 'created' | 'skipped' | 'failed'
  reason?: string
}

export interface StudentImportResult {
  created: number
  skipped: number
  failed: number
  rows: StudentImportResultRow[]
}
