import type { CosmeticItem, CosmeticType } from '@/types'

export const COSMETIC_ASSET_ROOT = '/cosmetics'

// assetPath 预留真实装扮图片路径，例如 /cosmetics/head/crown.png。
// 当前尚未收到用户提供的装扮图片素材，先保留 emoji 兜底显示。
export const COSMETICS: CosmeticItem[] = [
  { id: 'toy_ball', name: '小皮球', icon: '🎾', type: 'toy' },
  { id: 'toy_frisbee', name: '飞盘', icon: '🥏', type: 'toy' },
  { id: 'toy_bone', name: '骨头', icon: '🦴', type: 'toy' },
  { id: 'toy_bell', name: '铃铛球', icon: '🔔', type: 'toy' },
  { id: 'toy_yarn', name: '毛线球', icon: '🧶', type: 'toy' },
  { id: 'head_birthday', name: '生日帽', icon: '🎉', type: 'head' },
  { id: 'head_grad', name: '学士帽', icon: '🎓', type: 'head' },
  { id: 'head_crown', name: '皇冠', icon: '👑', type: 'head' },
  { id: 'head_santa', name: '圣诞帽', icon: '🎅', type: 'head' },
  { id: 'back_angel', name: '天使翅膀', icon: '🪽', type: 'back' },
  { id: 'back_butterfly', name: '蝴蝶翅膀', icon: '🦋', type: 'back' },
  { id: 'back_cape', name: '超人披风', icon: '🦸', type: 'back' },
  { id: 'neck_scarf', name: '围巾', icon: '🧣', type: 'neck' },
  { id: 'neck_bow', name: '领结', icon: '🎀', type: 'neck' },
  { id: 'face_glasses', name: '眼镜', icon: '👓', type: 'face' },
]

export const COSMETIC_TYPE_LABELS: Record<CosmeticType, string> = {
  toy: '玩具',
  head: '头部',
  back: '背部',
  neck: '颈部',
  face: '脸部',
}

export function getCosmeticById(id: string): CosmeticItem | undefined {
  return COSMETICS.find(c => c.id === id)
}

export function getCosmeticAssetUrl(item: CosmeticItem): string {
  if (!item.assetPath) return ''
  return item.assetPath.startsWith('/') ? item.assetPath : `${COSMETIC_ASSET_ROOT}/${item.assetPath}`
}

export function getCosmeticStats() {
  return {
    total: COSMETICS.length,
    imaged: COSMETICS.filter(item => Boolean(item.assetPath)).length,
    types: Object.keys(COSMETIC_TYPE_LABELS).length,
  }
}
