<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Shop items ───────────────────────────────────────────
interface ShopItem {
  id: number
  name: string
  icon: string
  description: string
  price: number       // in badges
  stock: number       // -1 = unlimited
  category: string
  inLottery: boolean
}

const shopItems = ref<ShopItem[]>([
  { id: 1, name: '铅笔', icon: '✏️', description: '优质2B铅笔一支', price: 1, stock: -1, category: '文具', inLottery: false },
  { id: 2, name: '橡皮', icon: '🧹', description: '大块无尘橡皮', price: 1, stock: -1, category: '文具', inLottery: false },
  { id: 3, name: '笔记本', icon: '📓', description: '精美笔记本一本', price: 3, stock: 10, category: '文具', inLottery: true },
  { id: 4, name: '贴纸包', icon: '🌟', description: '精美贴纸若干', price: 2, stock: 20, category: '奖励', inLottery: true },
  { id: 5, name: '小零食', icon: '🍬', description: '美味小零食一份', price: 2, stock: 15, category: '奖励', inLottery: true },
  { id: 6, name: '免作业券', icon: '📋', description: '一次免做作业的机会', price: 5, stock: 5, category: '特权', inLottery: true },
  { id: 7, name: '座位自选券', icon: '💺', description: '一次自由选座位机会', price: 8, stock: 3, category: '特权', inLottery: false },
  { id: 8, name: '图书借阅券', icon: '📚', description: '优先借阅图书馆书籍', price: 3, stock: -1, category: '奖励', inLottery: false },
])

const nextItemId = ref(100)
const categories = ref(['文具', '奖励', '特权'])
const activeCategory = ref('全部')

type ModalMode = 'add' | 'edit' | null
const modalMode = ref<ModalMode>(null)
const targetItem = ref<ShopItem | null>(null)
const itemForm = ref({
  name: '',
  icon: '🎁',
  description: '',
  price: 1,
  stock: -1,
  category: '奖励',
  inLottery: false,
})

function openAdd() {
  itemForm.value = { name: '', icon: '🎁', description: '', price: 1, stock: -1, category: categories.value[0], inLottery: false }
  targetItem.value = null
  modalMode.value = 'add'
}

function openEdit(item: ShopItem) {
  itemForm.value = { ...item }
  targetItem.value = item
  modalMode.value = 'edit'
}

function submitItem() {
  if (!itemForm.value.name.trim()) return
  if (modalMode.value === 'add') {
    shopItems.value.push({ id: nextItemId.value++, ...itemForm.value, name: itemForm.value.name.trim() })
  } else if (targetItem.value) {
    Object.assign(targetItem.value, itemForm.value)
  }
  modalMode.value = null
}

function deleteItem(id: number) {
  shopItems.value = shopItems.value.filter(i => i.id !== id)
}

const filteredItems = computed(() => {
  if (activeCategory.value === '全部') return shopItems.value
  return shopItems.value.filter(i => i.category === activeCategory.value)
})

// ─── Exchange ─────────────────────────────────────────────
const showExchangeModal = ref(false)
const exchangeItem = ref<ShopItem | null>(null)
const selectedStudentId = ref<number | null>(null)

function openExchange(item: ShopItem) {
  exchangeItem.value = item
  selectedStudentId.value = null
  showExchangeModal.value = true
}

function confirmExchange() {
  if (!exchangeItem.value || !selectedStudentId.value) return
  const student = appStore.students.find(s => s.id === selectedStudentId.value)
  if (!student) return
  if (student.badges < exchangeItem.value.price) {
    appStore.addToast(`${student.name} 的徽章不足，需要 ${exchangeItem.value.price} 枚`, 'warning')
    return
  }
  student.badges -= exchangeItem.value.price
  if (exchangeItem.value.stock > 0) exchangeItem.value.stock--
  appStore.addToast(`已为 ${student.name} 兑换「${exchangeItem.value.name}」`, 'success')
  showExchangeModal.value = false
}

function addCategory(name: string) {
  if (!name.trim() || categories.value.includes(name)) return
  categories.value.push(name.trim())
}

const allCategories = computed(() => ['全部', ...categories.value])
const newCategoryInput = ref('')
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl">🏪</span>
        <h1 class="text-3xl font-bold" :class="theme.titleGradient">小卖部</h1>
      </div>
      <div class="flex gap-2">
        <button @click="openAdd" class="flex items-center gap-2 px-4 py-2 text-white font-semibold transition-all active:scale-95" :class="[theme.buttonPrimary, theme.buttonRounded, theme.buttonShadow]">+ 上架商品</button>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="flex gap-4 flex-wrap">
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'px-4 py-2 flex items-center gap-2 shadow-sm']">
        <span class="text-xl">🏅</span>
        <div>
          <div class="text-xs text-gray-400">班级总徽章</div>
          <div class="font-bold text-[#ff9800]">{{ appStore.currentStudents.reduce((s,x) => s + x.badges, 0) }} 枚</div>
        </div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'px-4 py-2 flex items-center gap-2 shadow-sm']">
        <span class="text-xl">📦</span>
        <div>
          <div class="text-xs text-gray-400">商品数量</div>
          <div class="font-bold text-[#4ecdc4]">{{ shopItems.length }} 种</div>
        </div>
      </div>
    </div>

    <!-- Category tabs -->
    <div class="flex gap-2 flex-wrap items-center">
      <button
        v-for="cat in allCategories"
        :key="cat"
        @click="activeCategory = cat"
        class="px-3 py-1.5 text-sm font-medium rounded-xl transition-all"
        :class="activeCategory === cat ? 'bg-[#4ecdc4] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >{{ cat }}</button>
      <!-- Add category -->
      <div class="flex gap-1 ml-auto items-center">
        <input v-model="newCategoryInput" placeholder="新类别..." class="w-24 px-2 py-1.5 text-xs outline-none rounded-lg border border-gray-200 bg-white" @keyup.enter="addCategory(newCategoryInput); newCategoryInput = ''" />
        <button @click="addCategory(newCategoryInput); newCategoryInput = ''" class="px-2 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-all">+</button>
      </div>
    </div>

    <!-- Shop grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="flex flex-col gap-2 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden"
        :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm', (item.stock === 0) ? 'opacity-60' : '']"
      >
        <!-- Item icon -->
        <div class="relative">
          <div class="h-24 flex items-center justify-center text-6xl bg-gradient-to-br from-gray-50 to-gray-100">
            {{ item.icon }}
          </div>
          <!-- Stock badge -->
          <div class="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
            :class="item.stock === 0 ? 'bg-red-100 text-red-400' : item.stock === -1 ? 'bg-green-100 text-green-600' : 'bg-[#ffd93d]/30 text-[#854d0e]'"
          >{{ item.stock === 0 ? '缺货' : item.stock === -1 ? '∞' : item.stock }}</div>
          <!-- Lottery badge -->
          <div v-if="item.inLottery" class="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded-full bg-[#ff6b9d]/20 text-[#c44569] font-medium">抽奖</div>
        </div>

        <div class="px-3 pb-3 space-y-2 flex-1 flex flex-col">
          <div>
            <div class="text-sm font-bold text-gray-800">{{ item.name }}</div>
            <div class="text-xs text-gray-400 leading-tight">{{ item.description }}</div>
          </div>
          <div class="text-[#ff9800] font-black text-base mt-auto">🏅 × {{ item.price }}</div>

          <!-- Actions -->
          <div class="flex gap-1">
            <button
              @click="openExchange(item)"
              :disabled="item.stock === 0"
              class="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :class="theme.buttonPrimary"
            >兑换</button>
            <button @click="openEdit(item)" class="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all text-xs">✏️</button>
            <button @click="deleteItem(item.id)" class="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 transition-all text-xs">🗑</button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <button
        @click="openAdd"
        class="min-h-[180px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl hover:border-[#4ecdc4] hover:bg-[#4ecdc4]/5 transition-all group"
      >
        <div class="text-3xl text-gray-300 group-hover:text-[#4ecdc4] transition-colors">+</div>
        <div class="text-xs text-gray-300 group-hover:text-[#4ecdc4] transition-colors font-medium">上架商品</div>
      </button>
    </div>

    <!-- Add/Edit Item Modal -->
    <Transition name="modal">
      <div v-if="modalMode" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="modalMode = null">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-gray-800 mb-5">{{ modalMode === 'add' ? '➕ 上架商品' : '✏️ 编辑商品' }}</h3>
          <div class="space-y-4">
            <div class="flex gap-2">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">图标</label>
                <input v-model="itemForm.icon" class="w-14 text-center px-1 py-2 text-2xl outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" maxlength="2" />
              </div>
              <div class="flex-1">
                <label class="text-xs text-gray-500 mb-1 block">名称 *</label>
                <input v-model="itemForm.name" placeholder="商品名称" class="w-full px-3 py-2 outline-none text-sm" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">描述</label>
              <input v-model="itemForm.description" placeholder="商品描述（选填）" class="w-full px-3 py-2 outline-none text-sm" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">价格（徽章）</label>
                <input type="number" v-model.number="itemForm.price" min="1" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">库存（-1不限）</label>
                <input type="number" v-model.number="itemForm.stock" min="-1" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">类别</label>
              <select v-model="itemForm.category" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]">
                <option v-for="cat in categories" :key="cat">{{ cat }}</option>
              </select>
            </div>
            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" v-model="itemForm.inLottery" class="w-4 h-4 accent-[#ff6b9d]" />
              加入幸运抽奖
            </label>
            <div class="flex gap-3 pt-1">
              <button @click="modalMode = null" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
              <button @click="submitItem" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">
                {{ modalMode === 'add' ? '上架' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Exchange Modal -->
    <Transition name="modal">
      <div v-if="showExchangeModal && exchangeItem" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showExchangeModal = false">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-gray-800 mb-2">🛒 兑换「{{ exchangeItem.name }}」</h3>
          <div class="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-[#ff9800]/10">
            <span class="text-4xl">{{ exchangeItem.icon }}</span>
            <div>
              <div class="font-semibold text-gray-800">{{ exchangeItem.name }}</div>
              <div class="text-sm text-[#ff9800] font-bold">🏅 × {{ exchangeItem.price }} 枚徽章</div>
            </div>
          </div>

          <div class="mb-4">
            <label class="text-sm text-gray-600 mb-2 block">为哪位学生兑换？</label>
            <div class="space-y-1.5 max-h-48 overflow-y-auto">
              <button
                v-for="s in appStore.currentStudents"
                :key="s.id"
                @click="selectedStudentId = s.id"
                class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                :class="[
                  selectedStudentId === s.id ? 'bg-[#4ecdc4]/15 ring-1 ring-[#4ecdc4] text-[#2a9d8f] font-semibold' : 'hover:bg-gray-50 text-gray-700',
                  s.badges < exchangeItem.price ? 'opacity-50' : ''
                ]"
              >
                <span class="flex-1 text-left">{{ s.name }}</span>
                <span :class="s.badges >= exchangeItem.price ? 'text-[#ff9800]' : 'text-gray-300'" class="text-xs font-semibold">🏅 {{ s.badges }}</span>
              </button>
            </div>
          </div>

          <div class="flex gap-3">
            <button @click="showExchangeModal = false" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
            <button @click="confirmExchange" :disabled="!selectedStudentId" class="flex-1 py-2 rounded-xl text-white font-semibold disabled:opacity-50 transition-all" :class="theme.buttonPrimary">确认兑换</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
