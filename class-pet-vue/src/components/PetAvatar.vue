<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CosmeticItem, Student } from '@/types'
import { getPetById, getPetImageUrl } from '@/data/petData'
import { getCosmeticAssetUrl, getCosmeticById } from '@/data/cosmeticData'
import { useAppStore } from '@/stores/appStore'

const props = withDefaults(defineProps<{
  student: Student
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showLevel?: boolean
  showScore?: boolean
  interactive?: boolean
  fill?: boolean
}>(), {
  size: 'md',
  showLevel: false,
  showScore: false,
  interactive: false,
  fill: false,
})

const appStore = useAppStore()
const pet = computed(() => props.student.petId ? getPetById(props.student.petId) : null)
const level = computed(() => appStore.getLevel(props.student.score))
const isMaxLevel = computed(() => level.value === 4)
const stageName = computed(() => pet.value?.stages[level.value] ?? '')

const imageFailed = ref(false)
const cosmeticImageFailures = ref(new Set<string>())
const petImageUrl = computed(() => pet.value ? getPetImageUrl(pet.value.id, level.value) : '')
const useImage = computed(() => pet.value?.hasImage === true && !imageFailed.value)

watch(petImageUrl, () => {
  imageFailed.value = false
})

function onImageError() {
  imageFailed.value = true
}

function canUseCosmeticImage(item: CosmeticItem) {
  return Boolean(item.assetPath) && !cosmeticImageFailures.value.has(item.id)
}

function markCosmeticImageFailed(item: CosmeticItem) {
  const next = new Set(cosmeticImageFailures.value)
  next.add(item.id)
  cosmeticImageFailures.value = next
}

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
  width: props.fill ? '100%' : `${sizeConfig.value.container}px`,
  height: props.fill ? '100%' : `${sizeConfig.value.container}px`,
}))

const bodyStyle = computed(() => ({
  width: props.fill ? '100%' : `${sizeConfig.value.imgSize}px`,
  height: props.fill ? '100%' : `${sizeConfig.value.imgSize}px`,
}))

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
    :class="[{ 'h-full w-full': fill }, interactive ? 'cursor-pointer' : '']"
  >
    <div class="pet-avatar-shell relative flex items-center justify-center" :style="containerStyle">
      <span v-if="!pet" class="pet-avatar-empty text-gray-300" :class="sizeConfig.petText">&#128049;</span>

      <template v-else>
        <span
          v-if="backCosmetic"
          class="pet-cosmetic pet-cosmetic-back pointer-events-none"
          :class="sizeConfig.cosText"
        >
          <img
            v-if="canUseCosmeticImage(backCosmetic)"
            :src="getCosmeticAssetUrl(backCosmetic)"
            :alt="backCosmetic.name"
            class="pet-cosmetic-image"
            draggable="false"
            @error="markCosmeticImageFailed(backCosmetic)"
          />
          <span v-else>{{ backCosmetic.icon }}</span>
        </span>

        <div class="pet-avatar-body relative flex items-center justify-center" :style="bodyStyle">
          <img
            v-if="useImage"
            :src="petImageUrl"
            :alt="pet.name"
            class="pet-avatar-image"
            draggable="false"
            @error="onImageError"
          />

          <span v-if="!useImage" class="pet-avatar-emoji" :class="sizeConfig.petText">
            {{ pet.emoji }}
          </span>

          <span v-if="faceCosmetic" class="pet-cosmetic pet-cosmetic-face pointer-events-none">
            <img
              v-if="canUseCosmeticImage(faceCosmetic)"
              :src="getCosmeticAssetUrl(faceCosmetic)"
              :alt="faceCosmetic.name"
              class="pet-cosmetic-image"
              draggable="false"
              @error="markCosmeticImageFailed(faceCosmetic)"
            />
            <span v-else>{{ faceCosmetic.icon }}</span>
          </span>

          <span v-if="neckCosmetic" class="pet-cosmetic pet-cosmetic-neck pointer-events-none">
            <img
              v-if="canUseCosmeticImage(neckCosmetic)"
              :src="getCosmeticAssetUrl(neckCosmetic)"
              :alt="neckCosmetic.name"
              class="pet-cosmetic-image"
              draggable="false"
              @error="markCosmeticImageFailed(neckCosmetic)"
            />
            <span v-else>{{ neckCosmetic.icon }}</span>
          </span>
        </div>

        <span
          v-if="headCosmetic"
          class="pet-cosmetic pet-cosmetic-head pointer-events-none"
          :class="sizeConfig.cosText"
        >
          <img
            v-if="canUseCosmeticImage(headCosmetic)"
            :src="getCosmeticAssetUrl(headCosmetic)"
            :alt="headCosmetic.name"
            class="pet-cosmetic-image"
            draggable="false"
            @error="markCosmeticImageFailed(headCosmetic)"
          />
          <span v-else>{{ headCosmetic.icon }}</span>
        </span>

        <span
          v-if="toyCosmetic"
          class="pet-cosmetic pet-cosmetic-toy pointer-events-none"
          :class="sizeConfig.cosText"
        >
          <img
            v-if="canUseCosmeticImage(toyCosmetic)"
            :src="getCosmeticAssetUrl(toyCosmetic)"
            :alt="toyCosmetic.name"
            class="pet-cosmetic-image"
            draggable="false"
            @error="markCosmeticImageFailed(toyCosmetic)"
          />
          <span v-else>{{ toyCosmetic.icon }}</span>
        </span>

        <span
          v-if="isMaxLevel"
          class="absolute z-10 rounded bg-white/90 px-1 py-0.5 text-[10px] font-black leading-none text-yellow-500 shadow-sm"
          :class="fill ? 'right-1 top-1' : '-right-1 -top-1'"
        >
          MAX
        </span>
      </template>
    </div>

    <div v-if="showLevel && pet" class="flex items-center gap-1">
      <span
        class="font-bold rounded-full leading-none py-0.5"
        :class="[sizeConfig.levelBadge, levelBadgeStyle.bg, levelBadgeStyle.text]"
      >Lv.{{ level + 1 }}</span>
      <span class="text-gray-500 leading-none text-[10px]">{{ stageName }}</span>
    </div>

    <div v-if="showScore" class="text-xs text-gray-500 font-medium">
      {{ student.score }}
    </div>
  </div>
</template>
