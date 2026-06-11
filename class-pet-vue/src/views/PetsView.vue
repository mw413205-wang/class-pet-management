<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import { PETS, PET_CATEGORIES, getPetById, getPetCatalogStats, getPetImageUrl } from '@/data/petData'
import { COSMETICS, COSMETIC_TYPE_LABELS, getCosmeticAssetUrl, getCosmeticStats } from '@/data/cosmeticData'
import type { CosmeticType, Student } from '@/types'
import { api } from '@/services/api'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Tabs ─────────────────────────────────────────────────
type Tab = 'catalog' | 'students' | 'dressing'
const activeTab = ref<Tab>('catalog')

// ─── Pet Catalog ──────────────────────────────────────────
const catalogCategory = ref('全部')
const catalogImageFailures = ref(new Set<string>())
const catalogStats = computed(() => getPetCatalogStats())

const filteredPets = computed(() => {
  if (catalogCategory.value === '全部') return PETS
  return PETS.filter(p => p.category === catalogCategory.value)
})

function getCatalogImageKey(petId: string, stageIndex: number) {
  return `${petId}:${stageIndex}`
}

function markCatalogImageFailed(petId: string, stageIndex: number) {
  const next = new Set(catalogImageFailures.value)
  next.add(getCatalogImageKey(petId, stageIndex))
  catalogImageFailures.value = next
}

function canShowCatalogImage(petId: string, stageIndex: number) {
  return !catalogImageFailures.value.has(getCatalogImageKey(petId, stageIndex))
}

// ─── Student Pet Status ───────────────────────────────────
const searchQuery = ref('')

const studentsWithPets = computed(() => {
  let list = appStore.currentStudents
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q))
  }
  return list
})

const studentsNoPet = computed(() => appStore.currentStudents.filter(s => !s.petId))

function assignRandomPet(student: Student) {
  if (!PETS.length) return
  const pet = PETS[Math.floor(Math.random() * PETS.length)]
  appStore.assignPet(student.id, pet.id)
}

function assignAllNoPet() {
  const students = [...studentsNoPet.value]
  students.forEach(s => assignRandomPet(s))
  appStore.addToast(`正在为 ${students.length} 名学生随机分配宠物`, 'info')
}

// ─── Pet assignment modal ─────────────────────────────────
const showAssignModal = ref(false)
const assignTarget = ref<Student | null>(null)
const assignPetId = ref<string | null>(null)
const assignNickname = ref('')
const assignPetCategory = ref('全部')
const canAssignTargetPet = computed(() => !assignTarget.value || appStore.canChangeStudentPet(assignTarget.value))

function openAssignModal(s: Student) {
  assignTarget.value = s
  assignPetId.value = s.petId
  assignNickname.value = s.petNickname
  assignPetCategory.value = '全部'
  showAssignModal.value = true
}

function submitAssign() {
  if (!assignTarget.value) return
  appStore.savePetDetails(assignTarget.value.id, assignPetId.value, assignNickname.value)
  showAssignModal.value = false
}

const filteredAssignPets = computed(() => {
  if (assignPetCategory.value === '全部') return PETS
  return PETS.filter(p => p.category === assignPetCategory.value)
})

// ─── Dressing Room ────────────────────────────────────────
const dressingStudentId = ref<number | null>(null)
const dressingStudent = computed(() => appStore.students.find(student => student.id === dressingStudentId.value) ?? null)
const dressingSearchQuery = ref('')

const dressingStudents = computed(() => {
  let list = appStore.currentStudents
  if (dressingSearchQuery.value.trim()) {
    const q = dressingSearchQuery.value.trim().toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q))
  }
  return list
})

const activeCosmeticType = ref<'toy' | 'head' | 'back' | 'neck' | 'face'>('head')
const ownedCosmeticIds = ref(new Set<string>())
const cosmeticInventoryLoading = ref(false)
const cosmeticsByType = computed(() => COSMETICS.filter(c => c.type === activeCosmeticType.value && ownedCosmeticIds.value.has(c.id)))
const cosmeticStats = computed(() => getCosmeticStats())

type CosmeticTypeKey = keyof Student['cosmetics']
const cosmeticTypeToKey: Record<CosmeticType, CosmeticTypeKey> = {
  toy: 'toyId', head: 'headId', back: 'backId', neck: 'neckId', face: 'faceId',
}

function equipCosmetic(cosmeticId: string) {
  if (!dressingStudent.value) return
  const key = cosmeticTypeToKey[activeCosmeticType.value]
  const current = dressingStudent.value.cosmetics[key]
  appStore.equipCosmetic(dressingStudent.value.id, key, current === cosmeticId ? null : cosmeticId)
}

function removeAllCosmetics() {
  if (!dressingStudent.value) return
  appStore.removeAllCosmetics(dressingStudent.value.id)
}

interface StudentCosmeticInventoryItem {
  cosmeticId: string
}

async function selectDressingStudent(student: Student) {
  dressingStudentId.value = student.id
  ownedCosmeticIds.value = new Set()
  cosmeticInventoryLoading.value = true
  try {
    const inventory = await api<StudentCosmeticInventoryItem[]>(`/students/${student.id}/cosmetics`)
    if (dressingStudentId.value !== student.id) return
    ownedCosmeticIds.value = new Set(inventory.map(item => item.cosmeticId))
  } catch (error) {
    if (dressingStudentId.value !== student.id) return
    appStore.addToast(`装扮库存加载失败：${(error as Error).message}`, 'error')
  } finally {
    if (dressingStudentId.value === student.id) cosmeticInventoryLoading.value = false
  }
}

watch(() => appStore.currentClassId, () => {
  showAssignModal.value = false
  assignTarget.value = null
  dressingStudentId.value = null
  ownedCosmeticIds.value = new Set()
})

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl animate-bounce-light">🐾</span>
      <h1 class="text-3xl font-bold" :class="theme.titleGradient">宠物系统</h1>
    </div>

    <!-- Tab navigation -->
    <div class="flex gap-1 p-1 rounded-2xl bg-gray-100 w-fit">
      <button
        v-for="(label, key) in { catalog: '📖 宠物图鉴', students: '🎮 宠物状态', dressing: '👗 装扮间' }"
        :key="key"
        @click="activeTab = key as Tab"
        class="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        :class="activeTab === key ? 'bg-white shadow-md text-[#4ecdc4]' : 'text-gray-500 hover:text-gray-700'"
      >{{ label }}</button>
    </div>

    <!-- ─── Pet Catalog ─── -->
    <div v-if="activeTab === 'catalog'" class="space-y-4">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
          <div class="text-xs font-semibold text-gray-400">已配置宠物</div>
          <div class="mt-1 text-2xl font-black text-gray-800">{{ catalogStats.total }}</div>
        </div>
        <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
          <div class="text-xs font-semibold text-gray-400">完整图片素材</div>
          <div class="mt-1 text-2xl font-black text-[#4ecdc4]">{{ catalogStats.imaged }}</div>
        </div>
        <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
          <div class="text-xs font-semibold text-gray-400">分类数量</div>
          <div class="mt-1 text-2xl font-black text-[#ff9800]">{{ catalogStats.categories }}</div>
        </div>
        <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
          <div class="text-xs font-semibold text-gray-400">目标宠物数</div>
          <div class="mt-1 text-2xl font-black text-gray-800">{{ catalogStats.target }}</div>
        </div>
      </div>

      <!-- Category filter -->
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="cat in PET_CATEGORIES"
          :key="cat"
          @click="catalogCategory = cat"
          class="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
          :class="catalogCategory === cat ? 'bg-[#4ecdc4] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        >{{ cat }}</button>
      </div>

      <!-- Pet grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div
          v-for="pet in filteredPets"
          :key="pet.id"
          class="p-4 flex flex-col items-center gap-3 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']"
        >
          <div
            class="h-28 w-full rounded-xl flex items-center justify-center overflow-hidden"
            :style="{ background: pet.baseColor + '22' }"
          >
            <img
              v-if="pet.hasImage && canShowCatalogImage(pet.id, 4)"
              :src="getPetImageUrl(pet.id, 4)"
              :alt="`${pet.name}满级形态`"
              class="h-full w-full object-contain p-2 drop-shadow-md"
              draggable="false"
              @error="markCatalogImageFailed(pet.id, 4)"
            />
            <span v-else class="text-5xl">{{ pet.emoji }}</span>
          </div>
          <div class="text-center">
            <div class="text-sm font-bold text-gray-800">{{ pet.name }}</div>
            <div class="mt-1 text-xs px-2 py-0.5 rounded-full font-medium" :style="{ background: pet.baseColor + '22', color: pet.baseColor }">{{ pet.category }}</div>
          </div>
          <!-- Stages -->
          <div class="grid w-full grid-cols-5 gap-1.5">
            <div
              v-for="(stage, i) in pet.stages"
              :key="stage"
              class="flex min-w-0 flex-col items-center gap-1"
              :title="`Lv.${i + 1} ${stage}`"
            >
              <div class="h-9 w-full rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                <img
                  v-if="pet.hasImage && canShowCatalogImage(pet.id, i)"
                  :src="getPetImageUrl(pet.id, i)"
                  :alt="stage"
                  class="h-full w-full object-contain p-0.5"
                  draggable="false"
                  @error="markCatalogImageFailed(pet.id, i)"
                />
                <span v-else class="text-lg">{{ pet.emoji }}</span>
              </div>
              <span class="text-[10px] font-semibold leading-none" :style="{ color: levelColors[i] }">Lv.{{ i + 1 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Student Pet Status ─── -->
    <div v-else-if="activeTab === 'students'" class="space-y-4">
      <!-- No pet alert -->
      <div v-if="studentsNoPet.length > 0"
        class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#ffd93d]/10 border border-[#ffd93d]/30"
      >
        <span class="text-2xl">⚠️</span>
        <span class="text-sm text-[#854d0e]">有 {{ studentsNoPet.length }} 名学生还没有宠物</span>
        <button @click="assignAllNoPet" class="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#ffd93d] text-gray-800 hover:bg-[#f0c800] transition-all">一键随机分配</button>
      </div>

      <!-- Search -->
      <div class="relative max-w-xs">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          v-model="searchQuery"
          placeholder="搜索学生..."
          class="w-full pl-8 pr-3 py-2 text-sm outline-none"
          :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
        />
      </div>

      <!-- Student pet cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="student in studentsWithPets"
          :key="student.id"
          class="p-3 flex flex-col items-center gap-2 hover:shadow-md transition-all cursor-pointer"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']"
          @click="openAssignModal(student)"
        >
          <PetAvatar :student="student" size="md" :show-level="true" />
          <div class="text-sm font-semibold text-gray-700 text-center">{{ student.name }}</div>
          <div v-if="student.petNickname" class="text-xs text-gray-400">「{{ student.petNickname }}」</div>
          <div v-if="!student.petId" class="text-xs text-[#ff6b9d]">未领养宠物</div>
          <div v-else class="text-xs text-gray-400">{{ getPetById(student.petId!)?.name }}</div>
          <!-- Progress bar -->
          <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full" :style="{ width: appStore.getProgress(student.score).percent + '%', background: levelColors[appStore.getLevel(student.score)] }"></div>
          </div>
          <div class="text-xs text-gray-400">{{ appStore.getProgress(student.score).label }}</div>
        </div>
      </div>
    </div>

    <!-- ─── Dressing Room ─── -->
    <div v-else-if="activeTab === 'dressing'" class="space-y-4">
      <div class="flex gap-5 items-start flex-wrap lg:flex-nowrap">
        <!-- Student selector -->
        <div class="w-full lg:w-64 shrink-0 space-y-3">
          <div class="text-sm font-semibold text-gray-600">选择学生</div>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input v-model="dressingSearchQuery" placeholder="搜索..." class="w-full pl-8 pr-3 py-1.5 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
          </div>
          <div class="space-y-1 max-h-96 overflow-y-auto">
            <button
              v-for="s in dressingStudents"
              :key="s.id"
              @click="selectDressingStudent(s)"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
              :class="dressingStudent?.id === s.id
                ? 'bg-[#4ecdc4]/15 text-[#2a9d8f] font-semibold ring-1 ring-[#4ecdc4]'
                : 'hover:bg-gray-50 text-gray-700'"
            >
              <PetAvatar :student="s" size="xs" />
              <span class="flex-1 text-left">{{ s.name }}</span>
            </button>
          </div>
        </div>

        <!-- Dressing panel -->
        <div v-if="dressingStudent" class="flex-1 space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-3 shadow-sm']">
              <div class="text-xs font-semibold text-gray-400">装扮配置</div>
              <div class="mt-1 text-xl font-black text-gray-800">{{ cosmeticStats.total }}</div>
            </div>
            <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-3 shadow-sm']">
              <div class="text-xs font-semibold text-gray-400">图片素材</div>
              <div class="mt-1 text-xl font-black text-[#4ecdc4]">{{ cosmeticStats.imaged }}</div>
            </div>
            <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-3 shadow-sm']">
              <div class="text-xs font-semibold text-gray-400">装扮层级</div>
              <div class="mt-1 text-xl font-black text-[#ff9800]">{{ cosmeticStats.types }}</div>
            </div>
          </div>

          <!-- Preview -->
          <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-6 flex flex-col items-center gap-3 shadow-sm']">
            <PetAvatar :student="dressingStudent" size="xl" :show-level="true" :show-score="true" />
            <div class="text-lg font-bold text-gray-800">{{ dressingStudent.name }}</div>
            <div v-if="dressingStudent.petNickname" class="text-sm text-gray-400">「{{ dressingStudent.petNickname }}」</div>
            <button @click="removeAllCosmetics" class="text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-all">卸下所有装扮</button>
          </div>

          <!-- Cosmetic type tabs -->
          <div class="flex gap-1 p-1 rounded-2xl bg-gray-100 w-fit">
            <button
              v-for="(label, type) in COSMETIC_TYPE_LABELS"
              :key="type"
              @click="activeCosmeticType = type as CosmeticType"
              class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              :class="activeCosmeticType === type ? 'bg-white shadow text-[#4ecdc4]' : 'text-gray-500 hover:text-gray-700'"
            >{{ label }}</button>
          </div>

          <!-- Cosmetic items -->
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            <!-- Unequip button -->
            <button
              @click="appStore.equipCosmetic(dressingStudent.id, cosmeticTypeToKey[activeCosmeticType], null)"
              class="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all hover:shadow-md"
              :class="!dressingStudent.cosmetics[cosmeticTypeToKey[activeCosmeticType]]
                ? 'bg-gray-200 ring-2 ring-gray-400'
                : 'bg-gray-50 hover:bg-gray-100'"
            >
              <span class="text-2xl">✕</span>
              <span class="text-xs text-gray-400">不佩戴</span>
            </button>

            <button
              v-for="item in cosmeticsByType"
              :key="item.id"
              @click="equipCosmetic(item.id)"
              class="flex flex-col items-center gap-1 p-3 rounded-2xl transition-all hover:shadow-md hover:scale-105"
              :class="dressingStudent.cosmetics[cosmeticTypeToKey[activeCosmeticType]] === item.id
                ? 'bg-[#4ecdc4]/20 ring-2 ring-[#4ecdc4]'
                : 'bg-gray-50 hover:bg-gray-100'"
            >
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-3xl shadow-sm">
                <img
                  v-if="item.assetPath"
                  :src="getCosmeticAssetUrl(item)"
                  :alt="item.name"
                  class="h-full w-full object-contain p-1"
                  draggable="false"
                />
                <span v-else>{{ item.icon }}</span>
              </span>
              <span class="text-xs text-gray-600 text-center">{{ item.name }}</span>
            </button>
          </div>
          <div v-if="cosmeticInventoryLoading" class="py-3 text-sm text-gray-400">正在加载装扮库存...</div>
          <div v-else-if="!cosmeticsByType.length" class="py-3 text-sm text-gray-400">该分类暂无已兑换装扮</div>
        </div>

        <!-- No student selected -->
        <div v-else class="flex-1 flex flex-col items-center justify-center py-20 text-gray-300">
          <div class="text-6xl mb-4">👗</div>
          <div class="text-lg">请从左侧选择一名学生</div>
          <div class="text-sm mt-1">为你的宠物换上漂亮的装扮吧！</div>
        </div>
      </div>
    </div>

    <!-- Assign pet modal -->
    <Transition name="modal">
      <div v-if="showAssignModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showAssignModal = false">
        <div class="w-full max-w-md animate-modal-in max-h-[90vh] overflow-y-auto" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">🐾 为「{{ assignTarget?.name }}」分配宠物</h3>
            <button @click="showAssignModal = false" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <!-- Category tabs -->
          <div class="flex gap-1 flex-wrap mb-3">
            <button
              v-for="cat in PET_CATEGORIES"
              :key="cat"
              @click="assignPetCategory = cat"
              class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              :class="assignPetCategory === cat ? 'bg-[#4ecdc4] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
            >{{ cat }}</button>
          </div>

          <!-- Pet grid -->
          <p v-if="!canAssignTargetPet" class="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-600">该学生已有成长积分，请先重置积分或在系统设置中允许更换宠物。仍可修改宠物昵称。</p>
          <div class="grid grid-cols-4 gap-2 mb-4 max-h-48 overflow-y-auto">
            <button
              @click="assignPetId = null"
              :disabled="!canAssignTargetPet"
              class="flex flex-col items-center p-2 rounded-xl transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              :class="assignPetId === null ? 'bg-gray-200 ring-2 ring-gray-400' : 'bg-gray-50 hover:bg-gray-100'"
            >
              <span class="text-2xl">🐾</span>
              <span class="text-[10px] text-gray-400 mt-0.5">无宠物</span>
            </button>
            <button
              v-for="pet in filteredAssignPets"
              :key="pet.id"
              @click="assignPetId = pet.id"
              :disabled="!canAssignTargetPet"
              class="flex flex-col items-center p-2 rounded-xl transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              :class="assignPetId === pet.id ? 'bg-[#4ecdc4]/20 ring-2 ring-[#4ecdc4]' : 'bg-gray-50 hover:bg-gray-100'"
            >
              <span class="text-2xl">{{ pet.emoji }}</span>
              <span class="text-[10px] text-gray-400 mt-0.5 truncate w-full text-center">{{ pet.name.slice(0,4) }}</span>
            </button>
          </div>

          <!-- Nickname -->
          <div class="mb-4">
            <label class="text-sm text-gray-600 mb-1 block">宠物昵称（选填）</label>
            <input v-model="assignNickname" placeholder="给宠物起个名字..." class="w-full px-3 py-2 outline-none text-sm" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
          </div>

          <div class="flex gap-3">
            <button @click="showAssignModal = false" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
            <button @click="submitAssign" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">确认分配</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
