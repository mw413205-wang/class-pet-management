<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)

// ─── Prize Management ─────────────────────────────────────
interface Prize {
  id: number
  name: string
  icon: string
  probability: number  // relative weight
  stock: number        // -1 = unlimited
  inLottery: boolean
}

const prizes = ref<Prize[]>([
  { id: 1, name: '铅笔一支', icon: '✏️', probability: 30, stock: -1, inLottery: true },
  { id: 2, name: '橡皮一块', icon: '🧹', probability: 25, stock: -1, inLottery: true },
  { id: 3, name: '笔记本', icon: '📓', probability: 20, stock: 5, inLottery: true },
  { id: 4, name: '书签', icon: '🔖', probability: 15, stock: 10, inLottery: true },
  { id: 5, name: '再来一次', icon: '🔄', probability: 10, stock: -1, inLottery: true },
])

const nextPrizeId = ref(100)
const showPrizeManager = ref(false)
const prizeForm = ref({ name: '', icon: '🎁', probability: 10, stock: -1 })

function addPrize() {
  if (!prizeForm.value.name.trim()) return
  prizes.value.push({
    id: nextPrizeId.value++,
    name: prizeForm.value.name.trim(),
    icon: prizeForm.value.icon,
    probability: Math.max(1, prizeForm.value.probability),
    stock: prizeForm.value.stock,
    inLottery: true,
  })
  prizeForm.value = { name: '', icon: '🎁', probability: 10, stock: -1 }
}

function deletePrize(id: number) {
  prizes.value = prizes.value.filter(p => p.id !== id)
}

const activePrizes = computed(() => prizes.value.filter(p => p.inLottery && (p.stock === -1 || p.stock > 0)))

// ─── Spinning wheel ───────────────────────────────────────
const spinning = ref(false)
const resultPrize = ref<Prize | null>(null)
const showResult = ref(false)
const spinDeg = ref(0)
const history = ref<{ prize: Prize; time: string }[]>([])

let spinTimeout: ReturnType<typeof setTimeout> | null = null

function pickWeighted(): Prize | null {
  const pool = activePrizes.value
  if (!pool.length) return null
  const totalWeight = pool.reduce((sum, p) => sum + p.probability, 0)
  let r = Math.random() * totalWeight
  for (const p of pool) {
    r -= p.probability
    if (r <= 0) return p
  }
  return pool[pool.length - 1]
}

function spin() {
  if (spinning.value || activePrizes.value.length === 0) return
  showResult.value = false
  resultPrize.value = null
  spinning.value = true

  const winner = pickWeighted()!
  const winnerIdx = activePrizes.value.indexOf(winner)
  const segAngle = 360 / activePrizes.value.length
  const targetAngle = 360 * 5 + (360 - winnerIdx * segAngle - segAngle / 2)
  spinDeg.value += targetAngle + Math.random() * segAngle * 0.5

  spinTimeout = setTimeout(() => {
    spinning.value = false
    resultPrize.value = winner
    showResult.value = true
    // Decrement stock
    if (winner.stock > 0) winner.stock--
    // Record history
    history.value.unshift({
      prize: winner,
      time: new Date().toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }),
    })
    if (history.value.length > 20) history.value.pop()
  }, 4000)
}

onUnmounted(() => {
  if (spinTimeout) clearTimeout(spinTimeout)
})

// Wheel segment colors
const segColors = ['#4ecdc4', '#ff6b9d', '#ffd93d', '#96e6a1', '#ff9800', '#c44569', '#95e1d3', '#ffd700']
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <span v-if="theme.enableEmojis" class="text-4xl animate-spin-slow">🎡</span>
        <h1 class="text-3xl font-bold" :class="theme.titleGradient">幸运抽奖</h1>
      </div>
      <button @click="showPrizeManager = !showPrizeManager" class="px-3 py-2 text-sm font-medium transition-all" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'text-gray-600 hover:text-[#4ecdc4]']">
        🎁 管理奖品
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- Wheel -->
      <div class="lg:col-span-2 flex flex-col items-center gap-6">
        <!-- Wheel container -->
        <div class="relative w-72 h-72 sm:w-80 sm:h-80">
          <!-- Pointer -->
          <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 text-3xl filter drop-shadow-lg" style="transform-origin: 50% 100%;">▼</div>

          <!-- Wheel SVG -->
          <svg
            viewBox="0 0 200 200"
            class="w-full h-full transition-transform"
            :style="{ transform: `rotate(${spinDeg}deg)`, transitionDuration: spinning ? '4s' : '0s', transitionTimingFunction: 'cubic-bezier(0.1, 0.7, 0.1, 1)' }"
          >
            <template v-if="activePrizes.length > 0">
              <template v-for="(prize, i) in activePrizes" :key="prize.id">
                <path
                  :d="(() => {
                    const n = activePrizes.length
                    const startAngle = (i / n) * 2 * Math.PI - Math.PI / 2
                    const endAngle = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
                    const x1 = 100 + 95 * Math.cos(startAngle)
                    const y1 = 100 + 95 * Math.sin(startAngle)
                    const x2 = 100 + 95 * Math.cos(endAngle)
                    const y2 = 100 + 95 * Math.sin(endAngle)
                    const largeArc = n === 1 ? 1 : 0
                    return `M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`
                  })()"
                  :fill="segColors[i % segColors.length]"
                  stroke="white"
                  stroke-width="1.5"
                />
                <!-- Prize text -->
                <text
                  :x="100 + 62 * Math.cos(((i + 0.5) / activePrizes.length) * 2 * Math.PI - Math.PI / 2)"
                  :y="100 + 62 * Math.sin(((i + 0.5) / activePrizes.length) * 2 * Math.PI - Math.PI / 2)"
                  :transform="`rotate(${((i + 0.5) / activePrizes.length) * 360 + 90}, ${100 + 62 * Math.cos(((i + 0.5) / activePrizes.length) * 2 * Math.PI - Math.PI / 2)}, ${100 + 62 * Math.sin(((i + 0.5) / activePrizes.length) * 2 * Math.PI - Math.PI / 2)})`"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="white"
                  font-size="7"
                  font-weight="bold"
                  style="text-shadow: 0 1px 2px rgba(0,0,0,0.3)"
                >{{ prize.icon }} {{ prize.name.slice(0, 5) }}</text>
              </template>
            </template>
            <template v-else>
              <circle cx="100" cy="100" r="95" fill="#f0f0f0" />
              <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="#ccc" font-size="12">请添加奖品</text>
            </template>
            <!-- Center circle -->
            <circle cx="100" cy="100" r="15" fill="white" stroke="#4ecdc4" stroke-width="3" />
            <text x="100" y="100" text-anchor="middle" dominant-baseline="middle" font-size="10">🎯</text>
          </svg>
        </div>

        <!-- Spin button -->
        <button
          @click="spin"
          :disabled="spinning || activePrizes.length === 0"
          class="px-12 py-4 text-white text-xl font-black rounded-3xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          :class="spinning ? 'bg-gradient-to-r from-[#ffd93d] to-[#ff9800] animate-pulse' : 'bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:shadow-2xl'"
        >{{ spinning ? '🎡 旋转中...' : '🎡 开始抽奖！' }}</button>

        <!-- Result display -->
        <Transition name="modal">
          <div v-if="showResult && resultPrize" class="text-center space-y-2 animate-modal-in">
            <div class="text-5xl animate-bounce-light">{{ resultPrize.icon }}</div>
            <div class="text-2xl font-black text-gray-800">恭喜获得：{{ resultPrize.name }}！</div>
            <div v-if="resultPrize.stock === 0" class="text-sm text-red-400">（此奖品已用完）</div>
          </div>
        </Transition>
      </div>

      <!-- Right panel -->
      <div class="space-y-4">
        <!-- Prize list -->
        <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm space-y-3']">
          <h3 class="font-semibold text-gray-700 text-sm">🎁 奖品列表</h3>
          <div class="space-y-2">
            <div
              v-for="(prize, i) in prizes"
              :key="prize.id"
              class="flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm"
              :class="prize.inLottery && (prize.stock === -1 || prize.stock > 0) ? 'bg-gray-50' : 'bg-gray-50/50 opacity-60'"
            >
              <div class="w-3 h-3 rounded-full shrink-0" :style="{ background: segColors[i % segColors.length] }"></div>
              <span class="text-base">{{ prize.icon }}</span>
              <span class="flex-1 text-xs font-medium text-gray-700 truncate">{{ prize.name }}</span>
              <span class="text-[10px] text-gray-400">
                {{ prize.stock === -1 ? '∞' : prize.stock + '个' }}
              </span>
              <button @click="prize.inLottery = !prize.inLottery" class="w-7 h-4 rounded-full transition-all relative shrink-0" :class="prize.inLottery ? 'bg-[#4ecdc4]' : 'bg-gray-200'">
                <div class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all" :class="prize.inLottery ? 'left-3.5' : 'left-0.5'"></div>
              </button>
            </div>
            <div v-if="prizes.length === 0" class="text-xs text-gray-300 text-center py-3">暂无奖品，点击「管理奖品」添加</div>
          </div>
        </div>

        <!-- Draw history -->
        <div v-if="history.length > 0" :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
          <h3 class="font-semibold text-gray-700 text-sm mb-2">📜 抽奖记录</h3>
          <div class="space-y-1.5 max-h-48 overflow-y-auto">
            <div v-for="(record, idx) in history" :key="idx" class="flex items-center gap-2 text-xs">
              <span>{{ record.prize.icon }}</span>
              <span class="flex-1 text-gray-700">{{ record.prize.name }}</span>
              <span class="text-gray-400">{{ record.time }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Prize manager modal -->
    <Transition name="modal">
      <div v-if="showPrizeManager" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showPrizeManager = false">
        <div class="w-full max-w-md animate-modal-in max-h-[85vh] overflow-y-auto" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-800">🎁 管理奖品</h3>
            <button @click="showPrizeManager = false" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <!-- Existing prizes -->
          <div class="space-y-2 mb-4">
            <div v-for="prize in prizes" :key="prize.id"
              class="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50"
            >
              <span class="text-xl">{{ prize.icon }}</span>
              <span class="flex-1 text-sm font-medium text-gray-700">{{ prize.name }}</span>
              <span class="text-xs text-gray-400">权重{{ prize.probability }}</span>
              <span class="text-xs text-gray-400">{{ prize.stock === -1 ? '不限' : prize.stock + '个' }}</span>
              <button @click="deletePrize(prize.id)" class="text-gray-300 hover:text-red-400 transition-colors">🗑</button>
            </div>
          </div>

          <!-- Add prize form -->
          <div class="border-t border-gray-100 pt-4 space-y-3">
            <div class="text-sm font-medium text-gray-600">添加新奖品</div>
            <div class="flex gap-2">
              <input v-model="prizeForm.icon" class="w-12 text-center px-1 py-2 outline-none text-lg" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" maxlength="2" />
              <input v-model="prizeForm.name" placeholder="奖品名称" class="flex-1 px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">权重（越高越容易抽到）</label>
                <input type="number" v-model.number="prizeForm.probability" min="1" max="100" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">库存（-1 不限）</label>
                <input type="number" v-model.number="prizeForm.stock" min="-1" class="w-full px-3 py-2 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
              </div>
            </div>
            <button @click="addPrize" class="w-full py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">添加奖品</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
