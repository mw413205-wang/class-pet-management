<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { LevelUpEvent } from '@/types'
import { getPetById, getPetImageUrl } from '@/data/petData'

const props = defineProps<{
  event: LevelUpEvent | null
}>()

const emit = defineEmits<{
  close: []
}>()

const visible = ref(false)
const showContent = ref(false)
const imageFailed = ref(false)
const imageLoaded = ref(false)

// 粒子系统
interface Particle {
  id: number
  x: number
  y: number
  size: number
  color: string
  vx: number
  vy: number
  life: number
  maxLife: number
  shape: 'circle' | 'star' | 'diamond'
}

const particles = ref<Particle[]>([])
let particleTimer: ReturnType<typeof setInterval> | null = null
let particleId = 0

const COLORS = ['#FFD700', '#FF6B9D', '#4ECDC4', '#FF9800', '#A855F7', '#F97316']
const BURST_EMOJIS = ['✨', '⭐', '🌟', '💫', '🏅', '🎉', '👏', '💖', '✦', '✧']

function spawnParticles() {
  const newBatch: Particle[] = []
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 3
    newBatch.push({
      id: particleId++,
      x: 40 + Math.random() * 20,  // % from left
      y: 30 + Math.random() * 20,
      size: 4 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 60 + Math.random() * 40,
      shape: (['circle', 'star', 'diamond'] as const)[Math.floor(Math.random() * 3)],
    })
  }
  particles.value.push(...newBatch)
  // 清理已死亡粒子
  particles.value = particles.value.filter(p => p.life < p.maxLife)
}

let animFrame: number | null = null
function animateParticles() {
  particles.value.forEach(p => {
    p.x += p.vx * 0.3
    p.y += p.vy * 0.3 + 0.05  // 重力
    p.life++
  })
  particles.value = particles.value.filter(p => p.life < p.maxLife)
  animFrame = requestAnimationFrame(animateParticles)
}

watch(() => props.event, (evt) => {
  if (evt) {
    imageFailed.value = false
    imageLoaded.value = false
    visible.value = true
    // 延迟一帧让过渡动画触发
    requestAnimationFrame(() => {
      showContent.value = true
    })
    // 粒子动画
    animateParticles()
    particleTimer = setInterval(spawnParticles, 300)
    // 初始爆发
    for (let i = 0; i < 3; i++) spawnParticles()
  } else {
    handleClose()
  }
})

function handleClose() {
  showContent.value = false
  setTimeout(() => {
    visible.value = false
    particles.value = []
    if (particleTimer) { clearInterval(particleTimer); particleTimer = null }
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
    emit('close')
  }, 300)
}

onUnmounted(() => {
  if (particleTimer) clearInterval(particleTimer)
  if (animFrame) cancelAnimationFrame(animFrame)
})

const pet = computed(() => props.event ? getPetById(props.event.petId) : null)
const petImageUrl = computed(() => props.event ? getPetImageUrl(props.event.petId, props.event.newLevel) : '')

function onImgLoad() { imageLoaded.value = true }
function onImgError() { imageFailed.value = true }

const levelLabel = computed(() => {
  if (!props.event) return ''
  return `Lv.${props.event.newLevel + 1}`
})

const titleText = computed(() => {
  if (!props.event) return ''
  return props.event.isMaxLevel ? '满级！' : '升级了！'
})

const ringColor = computed(() => {
  const level = props.event?.newLevel ?? 0
  return ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700'][level] ?? '#ffd700'
})

function particleStyle(p: Particle) {
  const opacity = 1 - p.life / p.maxLife
  return {
    position: 'absolute' as const,
    left: `${p.x}%`,
    top: `${p.y}%`,
    width: `${p.size}px`,
    height: `${p.size}px`,
    opacity,
    backgroundColor: p.shape === 'circle' ? p.color : 'transparent',
    borderRadius: p.shape === 'circle' ? '50%' : '0',
    transform: p.shape === 'diamond' ? `rotate(45deg)` : 'none',
    border: p.shape === 'diamond' ? `${p.size / 2}px solid ${p.color}` : 'none',
    pointerEvents: 'none' as const,
    transition: 'none',
  }
}

function burstParticleStyle(index: number) {
  const angle = (index / BURST_EMOJIS.length) * Math.PI * 2 - Math.PI / 2
  const distance = 68 + (index % 3) * 16
  return {
    '--burst-x': `${Math.cos(angle) * distance}px`,
    '--burst-y': `${Math.sin(angle) * distance}px`,
    '--burst-rotate': `${index % 2 === 0 ? 80 : -80}deg`,
    animationDelay: `${index * 45}ms`,
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 flex items-center justify-center"
        style="z-index: 9999;"
        @click.self="handleClose"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <!-- 粒子层 -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            v-for="p in particles"
            :key="p.id"
            :style="particleStyle(p)"
          />
        </div>

        <!-- 弹窗主体 -->
        <Transition name="modal-scale">
          <div
            v-if="showContent && event"
            class="relative mx-4 w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl"
            style="background: linear-gradient(160deg, #fffbef 0%, #ffffff 60%, #fff8f0 100%);"
          >
            <!-- 顶部彩色边框光效 -->
            <div
              class="absolute inset-0 rounded-3xl pointer-events-none"
              :style="`box-shadow: inset 0 0 0 3px ${ringColor}80, 0 0 40px ${ringColor}40;`"
            />

            <!-- 顶部装饰小星星 -->
            <div class="absolute top-4 left-5 text-yellow-400 animate-spin-slow text-xl">✦</div>
            <div class="absolute top-4 right-5 text-purple-400 animate-bounce-slow text-lg">✦</div>
            <div class="absolute top-12 left-10 text-pink-400 animate-pulse text-sm">✧</div>

            <div class="px-6 pt-8 pb-6 flex flex-col items-center gap-4">

              <!-- 标题 -->
              <div class="flex items-center gap-2">
                <span class="text-2xl">🎉</span>
                <h2
                  class="text-2xl font-black tracking-tight"
                  style="color: #f97316; text-shadow: 0 2px 8px #ffd70060;"
                >{{ titleText }}</h2>
              </div>

              <!-- 学生名 -->
              <p class="text-gray-500 text-sm -mt-2">
                恭喜
                <span class="font-bold text-blue-500">{{ event.studentName }}</span>
              </p>

              <!-- 宠物展示区域 -->
              <div class="relative flex items-center justify-center my-2">
                <!-- 发光圆形背景 -->
                <div
                  class="absolute rounded-full"
                  :style="`width: 170px; height: 170px; background: radial-gradient(circle, ${ringColor}30 0%, transparent 70%); box-shadow: 0 0 60px ${ringColor}50;`"
                />
                <!-- 装饰圆圈 -->
                <div
                  class="absolute rounded-full border-2 border-dashed animate-spin-slow"
                  :style="`width: 155px; height: 155px; border-color: ${ringColor}60;`"
                />

                <!-- 升级 emoji 粒子爆炸 -->
                <div class="absolute inset-0 pointer-events-none overflow-visible">
                  <span
                    v-for="(emoji, index) in BURST_EMOJIS"
                    :key="`${event.studentId}-${event.newLevel}-${index}`"
                    class="level-up-burst-particle"
                    :style="burstParticleStyle(index)"
                  >{{ emoji }}</span>
                </div>

                <!-- 宠物图片 -->
                <div class="relative" style="width: 130px; height: 130px;">
                  <img
                    v-if="pet?.hasImage && !imageFailed"
                    :src="petImageUrl"
                    :alt="event.petName"
                    class="w-full h-full object-contain pet-avatar-max-glow animate-pet-showing"
                    draggable="false"
                    @load="onImgLoad"
                    @error="onImgError"
                  />
                  <!-- emoji 降级 -->
                  <div
                    v-if="!pet?.hasImage || imageFailed || !imageLoaded"
                    class="w-full h-full flex items-center justify-center text-7xl animate-pet-showing"
                    :class="{ 'opacity-0 absolute inset-0': pet?.hasImage && imageLoaded && !imageFailed }"
                  >{{ pet?.emoji ?? '🐾' }}</div>
                </div>

                <!-- 满级金光特效 -->
                <div
                  v-if="event.isMaxLevel"
                  class="absolute inset-0 rounded-full pointer-events-none"
                  style="background: radial-gradient(circle, #ffd70030 0%, transparent 70%); animation: pet-max-glow-pulse 1.5s ease-in-out infinite;"
                />
              </div>

              <!-- 宠物名称 + 阶段 -->
              <div class="text-center -mt-2">
                <div class="text-2xl font-black text-gray-800">{{ event.petName }}</div>
                <div class="flex items-center justify-center gap-1 mt-1">
                  <span class="text-yellow-400 text-sm">⭐</span>
                  <span class="text-sm font-medium" :style="`color: ${ringColor};`">
                    {{ event.isMaxLevel ? '守护神兽 · ' : '' }}{{ event.stageName }} · {{ levelLabel }}
                  </span>
                  <span class="text-yellow-400 text-sm">⭐</span>
                </div>
              </div>

              <!-- 徽章奖励提示 -->
              <div
                class="w-full rounded-2xl px-4 py-3 flex items-center gap-3"
                style="background: linear-gradient(135deg, #fff8e6 0%, #fff3d0 100%); border: 1px solid #ffd70040;"
              >
                <span class="text-2xl">🏅</span>
                <div>
                  <div class="font-bold text-orange-500 text-sm">获得成长奖励</div>
                  <div class="text-xs text-gray-400">✦ 继续加油，解锁更多形态 ✦</div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="flex gap-3 w-full mt-1">
                <button
                  class="flex-1 py-3 rounded-2xl text-gray-500 font-medium text-sm transition-all hover:bg-gray-100 active:scale-95"
                  style="background: #f3f4f6;"
                  @click="handleClose"
                >稍后再说</button>
                <button
                  class="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
                  style="background: linear-gradient(135deg, #f97316, #fbbf24); box-shadow: 0 4px 15px #f9731640;"
                  @click="handleClose"
                >✦ 太棒了！</button>
              </div>

            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-scale-leave-active {
  transition: all 0.25s ease-in;
}
.modal-scale-enter-from {
  opacity: 0;
  transform: scale(0.7) translateY(30px);
}
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-10px);
}

.animate-spin-slow {
  animation: spin 8s linear infinite;
}
.animate-bounce-slow {
  animation: bounce 2s ease-in-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
</style>
