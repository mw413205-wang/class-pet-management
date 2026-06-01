<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import PetAvatar from '@/components/PetAvatar.vue'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Leaderboard tabs ─────────────────────────────────────
type RankTab = 'score' | 'badges' | 'level'
const activeTab = ref<RankTab>('score')

const rankedStudents = computed(() => {
  const list = [...appStore.currentStudents]
  if (activeTab.value === 'score') return list.sort((a, b) => b.score - a.score)
  if (activeTab.value === 'badges') return list.sort((a, b) => b.badges - a.badges)
  return list.sort((a, b) => appStore.getLevel(b.score) - appStore.getLevel(a.score) || b.score - a.score)
})

const top3 = computed(() => rankedStudents.value.slice(0, 3))
const rest = computed(() => rankedStudents.value.slice(3))

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']

// Badge display mock
const badgeTypes = [
  { id: 'score_100', icon: '🥉', name: '百分达人', desc: '积分达到100', color: '#cd7f32' },
  { id: 'score_200', icon: '🥈', name: '双百勇士', desc: '积分达到200', color: '#aaa' },
  { id: 'score_300', icon: '🥇', name: '三百精英', desc: '积分达到300', color: '#ffd700' },
  { id: 'week_top', icon: '🌟', name: '周榜冠军', desc: '周积分第一', color: '#ff9800' },
  { id: 'month_top', icon: '🏆', name: '月度之星', desc: '月积分第一', color: '#4ecdc4' },
]

// Stats
const studentsWithBadges = computed(() => appStore.currentStudents.filter(s => s.badges > 0).length)
const topBadgeStudent = computed(() => {
  const s = appStore.currentStudents
  if (!s.length) return null
  return s.reduce((top, x) => x.badges > top.badges ? x : top, s[0])
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl animate-bounce-light">🏆</span>
      <h1 class="text-3xl font-bold" :class="theme.titleGradient">徽章墙</h1>
    </div>

    <!-- Stats row -->
    <div class="grid grid-cols-3 gap-4">
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-3xl font-black text-[#ffd700]">{{ appStore.currentStudents.reduce((s,x) => s + x.badges, 0) }}</div>
        <div class="text-xs text-gray-400 mt-1">班级总徽章</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-3xl font-black text-[#4ecdc4]">{{ studentsWithBadges }}</div>
        <div class="text-xs text-gray-400 mt-1">获得过徽章</div>
      </div>
      <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 text-center shadow-sm']">
        <div class="text-xl font-black text-[#ff9800] truncate">{{ topBadgeStudent?.name ?? '-' }}</div>
        <div class="text-xs text-gray-400 mt-1">徽章最多</div>
      </div>
    </div>

    <!-- Badge types legend -->
    <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-4 shadow-sm']">
      <h3 class="text-sm font-semibold text-gray-600 mb-3">🎖️ 徽章类型</h3>
      <div class="flex gap-3 flex-wrap">
        <div v-for="badge in badgeTypes" :key="badge.id" class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50">
          <span class="text-xl">{{ badge.icon }}</span>
          <div>
            <div class="text-xs font-semibold" :style="{ color: badge.color }">{{ badge.name }}</div>
            <div class="text-[10px] text-gray-400">{{ badge.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rank tabs -->
    <div class="flex gap-1 p-1 rounded-2xl bg-gray-100 w-fit">
      <button
        v-for="(label, key) in { score: '⭐ 积分榜', badges: '🏅 徽章榜', level: '🏆 等级榜' }"
        :key="key"
        @click="activeTab = key as RankTab"
        class="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        :class="activeTab === key ? 'bg-white shadow text-[#4ecdc4]' : 'text-gray-500 hover:text-gray-700'"
      >{{ label }}</button>
    </div>

    <!-- Top 3 podium -->
    <div v-if="top3.length >= 3" class="flex items-end justify-center gap-4 py-4">
      <!-- 2nd place -->
      <div class="flex flex-col items-center gap-2">
        <PetAvatar :student="top3[1]" size="lg" :show-level="true" />
        <div class="text-sm font-bold text-gray-700">{{ top3[1].name }}</div>
        <div class="w-20 flex flex-col items-center justify-end rounded-t-2xl py-4 shadow-lg"
          style="height: 90px; background: linear-gradient(to bottom, #e8e8e8, #c0c0c0)">
          <span class="text-2xl">🥈</span>
          <div class="text-xs font-bold text-gray-600 mt-1">{{ activeTab === 'badges' ? top3[1].badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(top3[1].score)+1) : top3[1].score + '分' }}</div>
        </div>
      </div>
      <!-- 1st place -->
      <div class="flex flex-col items-center gap-2 -translate-y-4">
        <div v-if="theme.enableEmojis" class="text-2xl animate-bounce-light">👑</div>
        <PetAvatar :student="top3[0]" size="xl" :show-level="true" />
        <div class="text-base font-bold text-gray-800">{{ top3[0].name }}</div>
        <div class="w-24 flex flex-col items-center justify-end rounded-t-2xl py-5 shadow-xl"
          style="height: 120px; background: linear-gradient(to bottom, #ffe57a, #ffd700)">
          <span class="text-3xl">🥇</span>
          <div class="text-sm font-black text-[#7d5c00] mt-1">{{ activeTab === 'badges' ? top3[0].badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(top3[0].score)+1) : top3[0].score + '分' }}</div>
        </div>
      </div>
      <!-- 3rd place -->
      <div class="flex flex-col items-center gap-2">
        <PetAvatar :student="top3[2]" size="lg" :show-level="true" />
        <div class="text-sm font-bold text-gray-700">{{ top3[2].name }}</div>
        <div class="w-20 flex flex-col items-center justify-end rounded-t-2xl py-3 shadow-lg"
          style="height: 72px; background: linear-gradient(to bottom, #f0c890, #cd7f32)">
          <span class="text-2xl">🥉</span>
          <div class="text-xs font-bold text-[#7a3e00] mt-1">{{ activeTab === 'badges' ? top3[2].badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(top3[2].score)+1) : top3[2].score + '分' }}</div>
        </div>
      </div>
    </div>

    <!-- Rest of list -->
    <div :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'shadow-sm overflow-hidden']">
      <div
        v-for="(student, idx) in rest"
        :key="student.id"
        class="flex items-center gap-4 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
      >
        <span class="w-8 text-center text-sm font-bold text-gray-400">{{ idx + 4 }}</span>
        <PetAvatar :student="student" size="sm" />
        <div class="flex-1">
          <div class="text-sm font-semibold text-gray-800">{{ student.name }}</div>
          <div class="text-xs text-gray-400">{{ appStore.getGroupById(student.groupId)?.name }}</div>
        </div>
        <!-- Badges display -->
        <div class="flex gap-1">
          <span v-for="n in Math.min(student.badges, 5)" :key="n" class="text-lg">🏅</span>
          <span v-if="student.badges > 5" class="text-xs text-[#ff9800] font-bold">×{{ student.badges }}</span>
        </div>
        <div class="text-right">
          <div class="text-sm font-black" :style="{ color: levelColors[appStore.getLevel(student.score)] }">
            {{ activeTab === 'badges' ? student.badges + '枚' : activeTab === 'level' ? 'Lv.' + (appStore.getLevel(student.score)+1) : student.score + '分' }}
          </div>
        </div>
      </div>
      <div v-if="rankedStudents.length === 0" class="text-center py-10 text-gray-300">暂无数据</div>
    </div>
  </div>
</template>
