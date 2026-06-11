import type { Pet } from '@/types'

export const PET_STAGE_COUNT = 5

// hasImage=true 表示 public/pets/{id}/stage0-4.png 已具备完整五阶段图片。
export const PETS: Pet[] = [
  {
    id: 'cat_orange',
    name: '橘猫',
    emoji: '🐱',
    category: '猫科',
    baseColor: '#f0813a',
    hasImage: true,
    stages: ['幼年橘猫', '少年橘猫', '青年橘猫', '成年橘猫', '橘猫王'],
  },
  {
    id: 'cat_tabby',
    name: '狸花猫',
    emoji: '🐈',
    category: '猫科',
    baseColor: '#a07a4a',
    hasImage: true,
    stages: ['幼年狸花', '少年狸花', '青年狸花', '成年狸花', '狸花王'],
  },
  {
    id: 'cat_white',
    name: '白猫',
    emoji: '🐱',
    category: '猫科',
    baseColor: '#f5f5f5',
    hasImage: true,
    stages: ['雪团', '少年白猫', '青年白猫', '成年白猫', '雪猫仙'],
  },
]

export const PET_CATEGORIES = ['全部', ...Array.from(new Set(PETS.map(pet => pet.category)))]

export function getPetById(id: string): Pet | undefined {
  return PETS.find(p => p.id === id)
}

export function getPetImageUrl(petId: string, level: number): string {
  const stage = Math.min(Math.max(Math.trunc(level), 0), PET_STAGE_COUNT - 1)
  return `/pets/${petId}/stage${stage}.png`
}

export function getPetCatalogStats() {
  return {
    total: PETS.length,
    imaged: PETS.filter(pet => pet.hasImage).length,
    categories: PET_CATEGORIES.length - 1,
    target: 100,
  }
}
