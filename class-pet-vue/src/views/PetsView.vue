<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'
import { PETS, PET_CATEGORIES, getPetById } from '@/data/petData'
import { COSMETICS, COSMETIC_TYPE_LABELS } from '@/data/cosmeticData'
import type { Student } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Tabs ─────────────────────────────────────────────────
type Tab = 'catalog' | 'students' | 'dressing'
const activeTab = ref<Tab>('catalog')

// ─── Pet Catalog ──────────────────────────────────────────
const catalogCategory = ref('全部')

const filteredPets = computed(() => {
  if (catalogCategory.value === '全部') return PETS
  return PETS.filter(p => p.category === catalogCategory.value)
})

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
  const pet = PETS[Math.floor(Math.random() * PETS.length)]
  appStore.assignPet(student.id, pet.id)
}

function assignAllNoPet() {
  studentsNoPet.value.forEach(s => assignRandomPet(s))
  appStore.addToast(`已为 ${studentsNoPet.value.length} 名学生随机分配宠物`, 'success')
}

// ─── Pet assignment modal ─────────────────────────────────
const showAssignModal = ref(false)
const assignTarget = ref<Student | null>(null)
const assignPetId = ref<string | null>(null)
const assignNickname = ref('')
const assignPetCategory = ref('全部')

function openAssignModal(s: Student) {
  assignTarget.value = s
  assignPetId.value = s.petId
  assignNickname.value = s.petNickname
  assignPetCategory.value = '全部'
  showAssignModal.value = true
}

function submitAssign() {
  if (!assignTarget.value) return
  if (assignPetId.value) {
    appStore.assignPet(assignTarget.value.id, assignPetId.value)
  }
  appStore.assignPetNickname(assignTarget.value.id, assignNickname.value)
  showAssignModal.value = false
}

const filteredAssignPets = computed(() => {
  if (assignPetCategory.value === '全部') return PETS
  return PETS.filter(p => p.category === assignPetCategory.value)
})

// ─── Dressing Room ────────────────────────────────────────
const dressingStudent = ref<Student | null>(null)
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
const cosmeticsByType = computed(() => COSMETICS.filter(c => c.type === activeCosmeticType.value))

type CosmeticTypeKey = keyof Student['cosmetics']
const cosmeticTypeToKey: Record<'toy' | 'head' | 'back' | 'neck' | 'face', CosmeticTypeKey> = {
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
  const keys = Object.values(cosmeticTypeToKey) as CosmeticTypeKey[]
  keys.forEach(k => appStore.equipCosmetic(dressingStudent.value!.id, k, null))
  appStore.addToast('已卸下所有装扮', 'info')
}

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
          class="p-4 flex flex-col items-center gap-2 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
          :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm']"
        >
          <div
            class="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl"
            :style="{ background: pet.baseColor + '22' }"
          >{{ pet.emoji }}</div>
          <div class="text-sm font-bold text-gray-800 text-center">{{ pet.name }}</div>
          <div class="text-xs px-2 py-0.5 rounded-full font-medium" :style="{ background: pet.baseColor + '22', color: pet.baseColor }">{{ pet.category }}</div>
          <!-- Stages -->
          <div class="w-full space-y-1">
            <div v-for="(stage, i) in pet.stages" :key="i" class="flex items-center gap-1.5">
              <div class="w-2 h-2 rounded-full shrink-0" :style="{ background: levelColors[i] }"></div>
              <span class="text-xs text-gray-500">{{ stage }}</span>
              <span class="ml-auto text-xs text-gray-300">Lv.{{ i + 1 }}</span>
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
              @click="dressingStudent = s"
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
              @click="activeCosmeticType = type as 'toy' | 'head' | 'back' | 'neck' | 'face'"
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
              <span class="text-3xl">{{ item.icon }}</span>
              <span class="text-xs text-gray-600 text-center">{{ item.name }}</span>
            </button>
          </div>
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
          <div class="grid grid-cols-4 gap-2 mb-4 max-h-48 overflow-y-auto">
            <button
              @click="assignPetId = null"
              class="flex flex-col items-center p-2 rounded-xl transition-all hover:scale-105"
              :class="assignPetId === null ? 'bg-gray-200 ring-2 ring-gray-400' : 'bg-gray-50 hover:bg-gray-100'"
            >
              <span class="text-2xl">🐾</span>
              <span class="text-[10px] text-gray-400 mt-0.5">无宠物</span>
            </button>
            <button
              v-for="pet in filteredAssignPets"
              :key="pet.id"
              @click="assignPetId = pet.id"
              class="flex flex-col items-center p-2 rounded-xl transition-all hover:scale-105"
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
