<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Student } from '@/types'
import { getPetById, getPetImageUrl, PET_SCALE_BY_LEVEL } from '@/data/petData'
import { getCosmeticById } from '@/data/cosmeticData'
import { useAppStore } from '@/stores/appStore'
import { usePetAnimation } from '@/composables/usePetAnimation'
import PetEffectLayer from '@/components/PetEffectLayer.vue'

const props = withDefaults(defineProps<{
  student: Student
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showLevel?: boolean
  showScore?: boolean
  interactive?: boolean
}>(), {
  size: 'md',
  showLevel: false,
  showScore: false,
  interactive: false,
})

const appStore = useAppStore()
const avatarRef = ref<HTMLElement | null>(null)
usePetAnimation(computed(() => props.student), avatarRef)

const pet = computed(() => props.student.petId ? getPetById(props.student.petId) : null)
const level = computed(() => appStore.getLevel(props.student.score))
const isMaxLevel = computed(() => level.value === 4)

const stageName = computed(() => {
  if (!pet.value) return ''
  return pet.value.stages[level.value] ?? pet.value.stages[4]
})

const petScale = computed(() => PET_SCALE_BY_LEVEL[level.value] ?? 1)

const imageLoaded = ref(false)
const imageFailed = ref(false)

const petImageUrl = computed(() => {
  if (!pet.value) return ''
  return getPetImageUrl(pet.value.id, level.value)
})

watch(petImageUrl, () => {
  imageLoaded.value = false
  imageFailed.value = false
})

function onImageLoad() {
  imageLoaded.value = true
  imageFailed.value = false
}

function onImageError() {
  imageFailed.value = true
  imageLoaded.value = false
}

const useImage = computed(() => pet.value?.hasImage === true && !imageFailed.value)

const backCosmetic = computed(() => props.student.cosmetics.backId ? getCosmeticById(props.student.cosmetics.backId) : null)
const headCosmetic = computed(() => props.student.cosmetics.headId ? getCosmeticById(props.student.cosmetics.headId) : null)
const neckCosmetic = computed(() => props.student.cosmetics.neckId ? getCosmeticById(props.student.cosmetics.neckId) : null)
const toyCosmetic = computed(() => props.student.cosmetics.toyId ? getCosmeticById(props.student.cosmetics.toyId) : null)
const faceCosmetic = computed(() => props.student.cosmetics.faceId ? getCosmeticById(props.student.cosmetics.faceId) : null)

const sizeConfig = computed(() => {
  const map = {
    xs: { container: 40, petText: 'text-xl', cosText: 'text-sm', levelBadge: 'text-[10px] px-1', imgSize: 36 },
    sm: { container: 56, petText: 'text-3xl', cosText: 'text-base', levelBadge: 'text-xs px-1.5', imgSize: 50 },
    md: { container: 80, petText: 'text-5xl', cosText: 'text-xl', levelBadge: 'text-xs px-1.5', imgSize: 72 },
    lg: { container: 108, petText: 'text-7xl', cosText: 'text-2xl', levelBadge: 'text-sm px-2', imgSize: 98 },
    xl: { container: 140, petText: 'text-9xl', cosText: 'text-3xl', levelBadge: 'text-sm px-2', imgSize: 128 },
  }
  return map[props.size]
})

const containerStyle = computed(() => ({
  width: `${sizeConfig.value.container}px`,
  height: `${sizeConfig.value.container}px`,
}))

const bodyStyle = computed(() => ({
  width: `${sizeConfig.value.imgSize}px`,
  height: `${sizeConfig.value.imgSize}px`,
}))

const scaleStyle = computed(() => ({
  transform: `scale(${petScale.value})`,
}))

const animClass = computed(() => {
  const s = props.student.animState
  if (s === 'breathing') return 'animate-pet-breathing'
  if (s === 'happy') return 'animate-pet-happy'
  if (s === 'sad') return 'animate-pet-sad'
  if (s === 'sleeping') return 'animate-pet-sleeping'
  if (s === 'playing') return 'animate-pet-playing'
  if (s === 'showing') return 'animate-pet-showing'
  return ''
})

const levelColors = [
  { bg: 'bg-gray-400', text: 'text-white' },
  { bg: 'bg-[#4ecdc4]', text: 'text-white' },
  { bg: 'bg-[#ffd93d]', text: 'text-gray-800' },
  { bg: 'bg-[#ff9800]', text: 'text-white' },
  { bg: 'bg-[#ffd700]', text: 'text-gray-800' },
]
const levelBadgeStyle = computed(() => levelColors[level.value] ?? levelColors[4])
</script>

<template>
  <div
    class="flex flex-col items-center gap-1 select-none"
    :class="interactive ? 'cursor-pointer' : ''"
  >
    <div
      ref="avatarRef"
      class="pet-avatar-shell relative flex items-center justify-center"
      :class="{ 'pet-avatar-shell-max': isMaxLevel }"
      :style="containerStyle"
    >
      <template v-if="!pet">
        <span class="pet-avatar-empty text-gray-300" :class="sizeConfig.petText">🐾</span>
      </template>

      <template v-else>
        <div class="pet-avatar-scale absolute inset-0 flex items-center justify-center" :style="scaleStyle">
          <span
            v-if="backCosmetic"
            class="pet-cosmetic pet-cosmetic-back pointer-events-none"
            :class="sizeConfig.cosText"
          >{{ backCosmetic.icon }}</span>

          <div
            class="pet-avatar-motion relative flex items-center justify-center"
            :class="animClass"
            :style="bodyStyle"
          >
            <img
              v-if="useImage"
              :src="petImageUrl"
              :alt="pet.name"
              class="pet-avatar-image"
              :class="{ 'pet-avatar-image-hidden': !imageLoaded, 'pet-avatar-max-glow': isMaxLevel }"
              draggable="false"
              @load="onImageLoad"
              @error="onImageError"
            />

            <span
              v-if="!useImage || !imageLoaded"
              class="pet-avatar-emoji"
              :class="[sizeConfig.petText, { 'pet-avatar-emoji-max': isMaxLevel }]"
            >{{ pet.emoji }}</span>

            <span
              v-if="faceCosmetic"
              class="pet-cosmetic pet-cosmetic-face pointer-events-none"
            >{{ faceCosmetic.icon }}</span>

            <span
              v-if="neckCosmetic"
              class="pet-cosmetic pet-cosmetic-neck pointer-events-none"
            >{{ neckCosmetic.icon }}</span>
          </div>

          <span
            v-if="headCosmetic"
            class="pet-cosmetic pet-cosmetic-head pointer-events-none"
            :class="sizeConfig.cosText"
          >{{ headCosmetic.icon }}</span>
        </div>

        <span
          v-if="toyCosmetic"
          class="pet-cosmetic pet-cosmetic-toy pointer-events-none"
          :class="sizeConfig.cosText"
        >{{ toyCosmetic.icon }}</span>

        <PetEffectLayer :state="student.animState" />

        <span
          v-if="isMaxLevel"
          class="absolute -top-1 -right-1 text-yellow-400 font-black pointer-events-none"
          style="z-index: 80; font-size: 0.35em; text-shadow: 0 1px 4px #ffd700;"
        >MAX</span>
      </template>
    </div>

    <div v-if="showLevel && pet" class="flex items-center gap-1">
      <span
        class="font-bold rounded-full leading-none py-0.5"
        :class="[sizeConfig.levelBadge, levelBadgeStyle.bg, levelBadgeStyle.text]"
      >Lv.{{ level + 1 }}</span>
      <span class="text-gray-500 leading-none" :style="{ fontSize: '0.65em' }">{{ stageName }}</span>
    </div>

    <div v-if="showScore" class="text-xs text-gray-500 font-medium">
      {{ student.score }} 分
    </div>
  </div>
</template>
