import type { Pet } from '@/types'

// 宠物数据
// hasImage: true 表示有真实图片素材，PetAvatar 渲染时优先用 /pets/{id}/stage{0-4}.png
// hasImage: false / 缺省 表示当前用 emoji 占位（后续补充图片时改为 true 即可）
export const PETS: Pet[] = [
  // ─── 猫科 ─────────────────────────────────────────────
  {
    id: 'cat_orange', name: '橘猫', emoji: '🐱', category: '猫科', baseColor: '#f0813a', hasImage: true,
    stages: ['幼橘猫', '少年橘猫', '青年橘猫', '成年橘猫', '橘猫王'],
  },
  {
    id: 'cat_tabby', name: '狸花猫', emoji: '🐈', category: '猫科', baseColor: '#a07a4a', hasImage: true,
    stages: ['幼狸花', '少年狸花', '青年狸花', '成年狸花', '狸花王'],
  },
  {
    id: 'cat_white', name: '白猫', emoji: '🐱', category: '猫科', baseColor: '#f5f5f5', hasImage: true,
    stages: ['雪团', '少年白猫', '青年白猫', '成年白猫', '雪猫仙'],
  },

  // ─── 其它宠物（emoji 占位，等素材到位再升级） ─────────────────
  {
    id: 'dog', name: '小狗狗', emoji: '🐶', category: '犬科', baseColor: '#d4a254',
    stages: ['幼犬', '少年犬', '青年犬', '成年犬', '犬神'],
  },
  {
    id: 'rabbit', name: '小兔兔', emoji: '🐰', category: '兔类', baseColor: '#f9d4d4',
    stages: ['兔宝', '跳兔', '快乐兔', '智慧兔', '兔神'],
  },
  {
    id: 'hamster', name: '仓鼠', emoji: '🐹', category: '兔类', baseColor: '#e8c5a0',
    stages: ['鼠宝', '胖仓鼠', '灵仓鼠', '智鼠', '仓鼠王'],
  },
  {
    id: 'fox', name: '小狐狸', emoji: '🦊', category: '犬科', baseColor: '#e88a2e',
    stages: ['狐宝', '灵狐', '智狐', '仙狐', '狐仙'],
  },
  {
    id: 'panda', name: '熊猫', emoji: '🐼', category: '熊科', baseColor: '#4a4a4a',
    stages: ['幼熊猫', '小熊猫', '青年熊猫', '成年熊猫', '熊猫仙'],
  },
  {
    id: 'koala', name: '考拉', emoji: '🐨', category: '熊科', baseColor: '#9e9e9e',
    stages: ['小考拉', '萌考拉', '乖考拉', '智慧考拉', '考拉王'],
  },
  {
    id: 'lion', name: '狮子', emoji: '🦁', category: '猫科', baseColor: '#e8a235',
    stages: ['幼狮', '少狮', '青狮', '壮狮', '狮王'],
  },
  {
    id: 'tiger', name: '老虎', emoji: '🐯', category: '猫科', baseColor: '#e06020',
    stages: ['幼虎', '少虎', '青虎', '壮虎', '虎王'],
  },
  {
    id: 'leopard', name: '豹子', emoji: '🐆', category: '猫科', baseColor: '#c8a028',
    stages: ['豹宝', '少豹', '青豹', '壮豹', '豹神'],
  },
  {
    id: 'polar_bear', name: '北极熊', emoji: '🐻‍❄️', category: '熊科', baseColor: '#b0d8f0',
    stages: ['雪宝', '白熊', '北极熊', '雪王', '冰神'],
  },
  {
    id: 'elephant', name: '大象', emoji: '🐘', category: '熊科', baseColor: '#9e8888',
    stages: ['象宝', '小象', '青象', '象', '象王'],
  },
  {
    id: 'giraffe', name: '长颈鹿', emoji: '🦒', category: '熊科', baseColor: '#d4b040',
    stages: ['鹿宝', '花鹿', '青鹿', '高鹿', '鹿神'],
  },
  {
    id: 'zebra', name: '斑马', emoji: '🦓', category: '熊科', baseColor: '#808080',
    stages: ['斑马宝', '少斑马', '青斑马', '壮斑马', '斑马王'],
  },
  {
    id: 'hippo', name: '河马', emoji: '🦛', category: '熊科', baseColor: '#9888a8',
    stages: ['河马宝', '胖胖', '大嘴巴', '壮壮', '河马王'],
  },
  {
    id: 'penguin', name: '企鹅', emoji: '🐧', category: '鸟类', baseColor: '#2c3e6c',
    stages: ['企鹅蛋', '毛茸茸', '少企鹅', '成企鹅', '企鹅王'],
  },
  {
    id: 'parrot', name: '鹦鹉', emoji: '🦜', category: '鸟类', baseColor: '#38a838',
    stages: ['雏鸟', '小鹦鹉', '彩鹦鹉', '智鹦鹉', '鹦王'],
  },
  {
    id: 'owl', name: '猫头鹰', emoji: '🦉', category: '鸟类', baseColor: '#886040',
    stages: ['猫头鹰蛋', '雏鸮', '少鸮', '智鸮', '鸮仙'],
  },
  {
    id: 'dolphin', name: '小海豚', emoji: '🐬', category: '海洋类', baseColor: '#4090d8',
    stages: ['海豚宝', '欢乐豚', '灵豚', '智豚', '海王'],
  },
]

export const PET_CATEGORIES = ['全部', '猫科', '犬科', '熊科', '兔类', '鸟类', '海洋类']

export const PET_SCALE_BY_LEVEL = [0.55, 0.67, 0.79, 0.90, 1.00]

export function getPetById(id: string): Pet | undefined {
  return PETS.find(p => p.id === id)
}

/**
 * 返回宠物某成长阶段的图片路径
 * 约定：public/pets/{petId}/stage{level}.png
 * level: 0=幼年 1=少年 2=青年 3=成年 4=满级
 */
export function getPetImageUrl(petId: string, level: number): string {
  return `/pets/${petId}/stage${level}.png`
}

/**
 * 判断该宠物是否有真实图片素材
 */
export function petHasImage(petId: string): boolean {
  return getPetById(petId)?.hasImage === true
}
