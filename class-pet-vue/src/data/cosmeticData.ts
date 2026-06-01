import type { CosmeticItem } from '@/types'

export const COSMETICS: CosmeticItem[] = [
  // 玩具
  { id: 'toy_ball', name: '小皮球', icon: '🎾', type: 'toy' },
  { id: 'toy_frisbee', name: '飞盘', icon: '🥏', type: 'toy' },
  { id: 'toy_bone', name: '骨头', icon: '🦴', type: 'toy' },
  { id: 'toy_bell', name: '铃铛球', icon: '🔔', type: 'toy' },
  { id: 'toy_yarn', name: '毛线球', icon: '🧶', type: 'toy' },
  // 头部
  { id: 'head_birthday', name: '生日帽', icon: '🎂', type: 'head' },
  { id: 'head_grad', name: '学士帽', icon: '🎓', type: 'head' },
  { id: 'head_crown', name: '皇冠', icon: '👑', type: 'head' },
  { id: 'head_santa', name: '圣诞帽', icon: '🎅', type: 'head' },
  // 背部
  { id: 'back_angel', name: '天使翅膀', icon: '👼', type: 'back' },
  { id: 'back_butterfly', name: '蝴蝶翅膀', icon: '🦋', type: 'back' },
  { id: 'back_cape', name: '超人披风', icon: '🦸', type: 'back' },
  // 颈部
  { id: 'neck_scarf', name: '围巾', icon: '🧣', type: 'neck' },
  { id: 'neck_bow', name: '领结', icon: '🎀', type: 'neck' },
  // 脸部
  { id: 'face_glasses', name: '眼镜', icon: '👓', type: 'face' },
]

export function getCosmeticById(id: string): CosmeticItem | undefined {
  return COSMETICS.find(c => c.id === id)
}

export const COSMETIC_TYPE_LABELS: Record<string, string> = {
  toy: '玩具',
  head: '头部',
  back: '背部',
  neck: '颈部',
  face: '脸部',
}
