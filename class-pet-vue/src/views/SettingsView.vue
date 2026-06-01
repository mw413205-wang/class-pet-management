<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/appStore'
import type { ScoreRule } from '@/types'

const themeStore = useThemeStore()
const theme = computed(() => themeStore.theme)
const appStore = useAppStore()

// ─── Score Rules ──────────────────────────────────────────
const ruleModalMode = ref<'add' | 'edit' | null>(null)
const targetRule = ref<ScoreRule | null>(null)
const ruleForm = ref({ name: '', icon: '⭐', value: 1 })

const COMMON_ICONS = ['⭐', '✋', '📝', '🤝', '👂', '🎯', '💡', '🏆', '❌', '⚠️', '😴', '🎮', '📚', '🌟', '🎨', '🔥']

function openAddRule() {
  ruleForm.value = { name: '', icon: '⭐', value: 1 }
  targetRule.value = null
  ruleModalMode.value = 'add'
}

function openEditRule(rule: ScoreRule) {
  ruleForm.value = { name: rule.name, icon: rule.icon, value: rule.value }
  targetRule.value = rule
  ruleModalMode.value = 'edit'
}

function submitRule() {
  if (!ruleForm.value.name.trim()) return
  if (ruleModalMode.value === 'add') {
    appStore.addScoreRule({ ...ruleForm.value })
  } else if (targetRule.value) {
    appStore.updateScoreRule(targetRule.value.id, { ...ruleForm.value })
  }
  ruleModalMode.value = null
}

// ─── Level thresholds ─────────────────────────────────────
const thresholds = computed(() => appStore.levelThresholds)
const thresholdEditing = ref(false)
const thresholdDraft = ref([...appStore.levelThresholds])

function startEditThresholds() {
  thresholdDraft.value = [...appStore.levelThresholds]
  thresholdEditing.value = true
}

function saveThresholds() {
  // Sort & validate
  const sorted = [...thresholdDraft.value].map(Number).sort((a, b) => a - b)
  if (sorted.some(v => isNaN(v) || v <= 0)) {
    appStore.addToast('阈值必须为正整数', 'warning')
    return
  }
  appStore.levelThresholds.splice(0, 4, ...sorted)
  thresholdEditing.value = false
  appStore.addToast('等级阈值已更新', 'success')
}

function cancelEditThresholds() {
  thresholdEditing.value = false
}

// ─── Danger zone ──────────────────────────────────────────
const showDangerConfirm = ref<'reset-class' | 'reset-rules' | null>(null)
const dangerIncludesBadges = ref(false)

function confirmDanger() {
  if (showDangerConfirm.value === 'reset-class') {
    appStore.resetClassProgress(appStore.currentClassId, dangerIncludesBadges.value)
  } else if (showDangerConfirm.value === 'reset-rules') {
    // Reset rules to default
    appStore.currentRules.forEach(r => appStore.deleteScoreRule(r.id))
    ;[
      { name: '认真听讲', icon: '👂', value: 2 },
      { name: '积极回答', icon: '✋', value: 3 },
      { name: '作业优秀', icon: '📝', value: 5 },
      { name: '帮助同学', icon: '🤝', value: 3 },
      { name: '课堂表现优秀', icon: '⭐', value: 5 },
      { name: '违反纪律', icon: '⚠️', value: -2 },
      { name: '未完成作业', icon: '❌', value: -3 },
    ].forEach(r => appStore.addScoreRule(r))
    appStore.addToast('积分规则已重置为默认', 'success')
  }
  showDangerConfirm.value = null
}

const levelColors = ['#a0a0a0', '#4ecdc4', '#ffd93d', '#ff9800', '#ffd700']
const levelNames = ['入门', '进阶', '高手', '精英', 'MAX']
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <span v-if="theme.enableEmojis" class="text-4xl">⚙️</span>
      <h1 class="text-3xl font-bold" :class="theme.titleGradient">设置</h1>
    </div>

    <!-- ─── Score Rules ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800">📋 积分规则</h2>
          <p class="text-xs text-gray-400 mt-0.5">{{ appStore.currentClass?.name }} 的积分规则</p>
        </div>
        <button @click="openAddRule" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white transition-all" :class="theme.buttonPrimary">
          + 新增规则
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="rule in appStore.currentRules"
          :key="rule.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          :class="rule.enabled ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-50/50 opacity-60'"
        >
          <!-- Move buttons -->
          <div class="flex flex-col gap-0.5">
            <button @click="appStore.moveRule(rule.id, -1)" class="text-gray-300 hover:text-gray-500 text-xs leading-none">▲</button>
            <button @click="appStore.moveRule(rule.id, 1)" class="text-gray-300 hover:text-gray-500 text-xs leading-none">▼</button>
          </div>

          <!-- Icon -->
          <span class="text-2xl w-8 text-center">{{ rule.icon }}</span>

          <!-- Name -->
          <span class="flex-1 text-sm font-medium text-gray-700">{{ rule.name }}</span>

          <!-- Value -->
          <span
            class="text-sm font-bold px-2 py-0.5 rounded-full"
            :class="rule.value > 0 ? 'bg-[#4ecdc4]/15 text-[#2a9d8f]' : 'bg-[#ff6b9d]/15 text-[#c44569]'"
          >{{ rule.value > 0 ? '+' : '' }}{{ rule.value }}</span>

          <!-- Toggle -->
          <button
            @click="appStore.toggleScoreRule(rule.id)"
            class="w-10 h-5 rounded-full transition-all relative shrink-0"
            :class="rule.enabled ? 'bg-[#4ecdc4]' : 'bg-gray-200'"
          >
            <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" :class="rule.enabled ? 'left-5' : 'left-0.5'"></div>
          </button>

          <!-- Edit / Delete -->
          <button @click="openEditRule(rule)" class="p-1.5 rounded-lg hover:bg-[#4ecdc4]/10 text-gray-400 hover:text-[#4ecdc4] transition-all text-sm">✏️</button>
          <button @click="appStore.deleteScoreRule(rule.id)" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400 transition-all text-sm">🗑</button>
        </div>

        <div v-if="appStore.currentRules.length === 0" class="text-center py-8 text-gray-300">
          <div class="text-4xl mb-2">📋</div>
          <div class="text-sm">还没有积分规则，点击上方「新增规则」添加</div>
        </div>
      </div>
    </section>

    <!-- ─── Level Thresholds ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-gray-800">🏆 等级阈值</h2>
          <p class="text-xs text-gray-400 mt-0.5">达到对应积分后宠物升级</p>
        </div>
        <button v-if="!thresholdEditing" @click="startEditThresholds" class="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">✏️ 编辑</button>
        <div v-else class="flex gap-2">
          <button @click="cancelEditThresholds" class="px-3 py-1.5 rounded-xl text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
          <button @click="saveThresholds" class="px-3 py-1.5 rounded-xl text-sm text-white font-semibold transition-all" :class="theme.buttonPrimary">保存</button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="(threshold, idx) in thresholds"
          :key="idx"
          class="p-4 rounded-2xl text-center space-y-2"
          :style="{ background: levelColors[idx + 1] + '15', borderColor: levelColors[idx + 1] + '44', border: '2px solid' }"
        >
          <div class="text-2xl font-black" :style="{ color: levelColors[idx + 1] }">
            Lv.{{ idx + 2 }}
          </div>
          <div class="text-xs text-gray-400 font-medium">{{ levelNames[idx + 1] }}</div>
          <div v-if="!thresholdEditing" class="text-lg font-bold text-gray-700">{{ threshold }} 分</div>
          <input
            v-else
            type="number"
            v-model.number="thresholdDraft[idx]"
            min="1"
            class="w-full text-center py-1 rounded-lg text-sm font-bold outline-none border"
            :style="{ borderColor: levelColors[idx + 1], color: levelColors[idx + 1] }"
          />
        </div>
      </div>

      <!-- Level visualization bar -->
      <div class="relative h-8 rounded-full overflow-hidden flex">
        <div class="h-full flex items-center justify-center text-xs font-bold text-white" :style="{ width: `${(thresholds[0] / thresholds[3]) * 100}%`, background: levelColors[1] }">
          <span v-if="(thresholds[0] / thresholds[3]) > 0.1">0-{{ thresholds[0] }}</span>
        </div>
        <div class="h-full flex items-center justify-center text-xs font-bold text-white" :style="{ width: `${((thresholds[1] - thresholds[0]) / thresholds[3]) * 100}%`, background: levelColors[2] }">
          <span v-if="((thresholds[1] - thresholds[0]) / thresholds[3]) > 0.08">{{ thresholds[0] }}-{{ thresholds[1] }}</span>
        </div>
        <div class="h-full flex items-center justify-center text-xs font-bold text-white" :style="{ width: `${((thresholds[2] - thresholds[1]) / thresholds[3]) * 100}%`, background: levelColors[3] }">
          <span v-if="((thresholds[2] - thresholds[1]) / thresholds[3]) > 0.08">{{ thresholds[1] }}-{{ thresholds[2] }}</span>
        </div>
        <div class="h-full flex-1 flex items-center justify-center text-xs font-bold text-white" :style="{ background: levelColors[4] }">
          {{ thresholds[2] }}-{{ thresholds[3] }}+
        </div>
      </div>
    </section>

    <!-- ─── Theme Settings ─── -->
    <section :class="[theme.cardBg, theme.cardBorder, theme.cardRounded, 'p-5 shadow-sm space-y-4']">
      <h2 class="text-lg font-bold text-gray-800">🎨 主题设置</h2>
      <div class="flex gap-4">
        <button
          @click="themeStore.setStyle('cartoon')"
          class="flex-1 p-4 rounded-2xl border-2 transition-all"
          :class="themeStore.style === 'cartoon' ? 'border-[#4ecdc4] bg-[#4ecdc4]/10' : 'border-gray-200 hover:border-gray-300'"
        >
          <div class="text-3xl mb-2">🎠</div>
          <div class="font-semibold text-gray-800 text-sm">卡通模式</div>
          <div class="text-xs text-gray-400 mt-1">渐变色彩、圆角卡片、动画装饰</div>
          <div v-if="themeStore.style === 'cartoon'" class="mt-2 text-xs text-[#4ecdc4] font-semibold">✓ 当前模式</div>
        </button>
        <button
          @click="themeStore.setStyle('minimal')"
          class="flex-1 p-4 rounded-2xl border-2 transition-all"
          :class="themeStore.style === 'minimal' ? 'border-[#4ecdc4] bg-[#4ecdc4]/10' : 'border-gray-200 hover:border-gray-300'"
        >
          <div class="text-3xl mb-2">📐</div>
          <div class="font-semibold text-gray-800 text-sm">简洁模式</div>
          <div class="text-xs text-gray-400 mt-1">扁平风格、小圆角、无装饰</div>
          <div v-if="themeStore.style === 'minimal'" class="mt-2 text-xs text-[#4ecdc4] font-semibold">✓ 当前模式</div>
        </button>
      </div>
    </section>

    <!-- ─── Danger Zone ─── -->
    <section class="p-5 rounded-2xl border-2 border-red-200 bg-red-50/50 space-y-4">
      <h2 class="text-lg font-bold text-red-500">⚠️ 危险区域</h2>
      <p class="text-sm text-gray-500">以下操作不可撤销，请谨慎执行。</p>
      <div class="flex flex-wrap gap-3">
        <button
          @click="showDangerConfirm = 'reset-class'"
          class="px-4 py-2 rounded-xl border-2 border-red-200 bg-white text-red-500 text-sm font-semibold hover:bg-red-50 transition-all"
        >🔄 重置当前班级积分</button>
        <button
          @click="showDangerConfirm = 'reset-rules'"
          class="px-4 py-2 rounded-xl border-2 border-orange-200 bg-white text-orange-500 text-sm font-semibold hover:bg-orange-50 transition-all"
        >📋 重置积分规则为默认</button>
      </div>
    </section>

    <!-- ─── Rule Add/Edit Modal ─── -->
    <Transition name="modal">
      <div v-if="ruleModalMode" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="ruleModalMode = null">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-gray-800 mb-5">{{ ruleModalMode === 'add' ? '➕ 新增规则' : '✏️ 编辑规则' }}</h3>
          <div class="space-y-4">
            <div>
              <label class="text-sm text-gray-600 mb-1 block">规则名称 <span class="text-red-400">*</span></label>
              <input v-model="ruleForm.name" placeholder="例：认真听讲" class="w-full px-3 py-2 outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" />
            </div>
            <div>
              <label class="text-sm text-gray-600 mb-2 block">图标</label>
              <div class="grid grid-cols-8 gap-1.5">
                <button
                  v-for="icon in COMMON_ICONS"
                  :key="icon"
                  @click="ruleForm.icon = icon"
                  class="w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all hover:scale-110"
                  :class="ruleForm.icon === icon ? 'bg-[#4ecdc4]/20 ring-2 ring-[#4ecdc4]' : 'bg-gray-50 hover:bg-gray-100'"
                >{{ icon }}</button>
              </div>
              <input v-model="ruleForm.icon" class="mt-2 w-full px-3 py-1.5 text-sm outline-none" :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]" placeholder="或输入自定义 emoji" maxlength="2" />
            </div>
            <div>
              <label class="text-sm text-gray-600 mb-1 block">分值</label>
              <div class="flex gap-2 items-center">
                <button @click="ruleForm.value = Math.abs(ruleForm.value) * -1" class="px-3 py-2 rounded-xl text-sm font-bold transition-all" :class="ruleForm.value < 0 ? 'bg-[#ff6b9d] text-white' : 'bg-gray-100 text-gray-500'">扣分</button>
                <button @click="ruleForm.value = Math.abs(ruleForm.value)" class="px-3 py-2 rounded-xl text-sm font-bold transition-all" :class="ruleForm.value > 0 ? 'bg-[#4ecdc4] text-white' : 'bg-gray-100 text-gray-500'">加分</button>
                <input
                  type="number"
                  :value="Math.abs(ruleForm.value)"
                  @input="(e: Event) => { const v = parseInt((e.target as HTMLInputElement).value); ruleForm.value = ruleForm.value < 0 ? -Math.abs(v || 1) : Math.abs(v || 1) }"
                  min="1"
                  max="100"
                  class="flex-1 px-3 py-2 outline-none text-center font-bold"
                  :class="[theme.inputBg, theme.inputBorder, theme.inputRounded]"
                />
                <span class="text-sm text-gray-400">分</span>
              </div>
              <div class="text-center mt-2 text-lg font-black" :class="ruleForm.value > 0 ? 'text-[#4ecdc4]' : 'text-[#ff6b9d]'">
                {{ ruleForm.value > 0 ? '+' : '' }}{{ ruleForm.value }}
              </div>
            </div>
            <div class="flex gap-3 pt-2">
              <button @click="ruleModalMode = null" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
              <button @click="submitRule" class="flex-1 py-2 rounded-xl text-white font-semibold transition-all" :class="theme.buttonPrimary">
                {{ ruleModalMode === 'add' ? '创建' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Danger confirm modal -->
    <Transition name="modal">
      <div v-if="showDangerConfirm" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showDangerConfirm = null">
        <div class="w-full max-w-sm animate-modal-in" :class="[theme.cardBg, theme.cardRounded, 'p-6 shadow-2xl']">
          <h3 class="text-lg font-bold text-red-500 mb-2">⚠️ 确认操作</h3>
          <p class="text-sm text-gray-500 mb-4">
            <span v-if="showDangerConfirm === 'reset-class'">将重置「{{ appStore.currentClass?.name }}」所有学生积分为 0。此操作不可撤销。</span>
            <span v-else>将重置当前班级的积分规则为系统默认值。此操作不可撤销。</span>
          </p>
          <label v-if="showDangerConfirm === 'reset-class'" class="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
            <input type="checkbox" v-model="dangerIncludesBadges" class="w-4 h-4 accent-[#ff9800]" />
            同时重置徽章数量
          </label>
          <div class="flex gap-3">
            <button @click="showDangerConfirm = null" class="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
            <button @click="confirmDanger" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600">确认执行</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
