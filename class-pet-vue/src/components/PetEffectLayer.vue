<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AnimationState } from '@/types'

const props = defineProps<{
  state: AnimationState
}>()

const effectKey = ref(0)

watch(() => props.state, (state) => {
  if (state === 'happy' || state === 'sad') {
    effectKey.value += 1
  }
})

const hearts = computed(() => [
  { id: `${effectKey.value}-heart-1`, left: 42, delay: 0, scale: 1 },
  { id: `${effectKey.value}-heart-2`, left: 58, delay: 120, scale: 0.82 },
  { id: `${effectKey.value}-heart-3`, left: 50, delay: 240, scale: 0.7 },
])

const tears = computed(() => [
  { id: `${effectKey.value}-tear-1`, left: 41, delay: 0 },
  { id: `${effectKey.value}-tear-2`, left: 59, delay: 160 },
])

const zzzs = [
  { id: 'zzz-1', left: 60, top: 12, delay: 0, scale: 0.78 },
  { id: 'zzz-2', left: 72, top: 2, delay: 900, scale: 1 },
  { id: 'zzz-3', left: 82, top: -8, delay: 1800, scale: 0.72 },
]
</script>

<template>
  <div class="pet-effect-layer" aria-hidden="true">
    <template v-if="state === 'happy'">
      <span
        v-for="heart in hearts"
        :key="heart.id"
        class="pet-effect-heart"
        :style="{
          left: heart.left + '%',
          animationDelay: heart.delay + 'ms',
          transform: `translate(-50%, 0) scale(${heart.scale})`,
        }"
      >💕</span>
    </template>

    <template v-else-if="state === 'sad'">
      <span
        v-for="tear in tears"
        :key="tear.id"
        class="pet-effect-tear"
        :style="{ left: tear.left + '%', animationDelay: tear.delay + 'ms' }"
      >💧</span>
    </template>

    <template v-else-if="state === 'sleeping'">
      <span
        v-for="zzz in zzzs"
        :key="zzz.id"
        class="pet-effect-zzz"
        :style="{
          left: zzz.left + '%',
          top: zzz.top + '%',
          animationDelay: zzz.delay + 'ms',
          transform: `translate(-50%, 0) scale(${zzz.scale})`,
        }"
      >💤</span>
    </template>
  </div>
</template>
