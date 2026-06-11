import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeStyle = 'cartoon' | 'minimal'
export type ThemeColor = 'emerald' | 'sky' | 'peach' | 'pink' | 'lavender'

export const themeColorOptions: Array<{ id: ThemeColor; name: string; color: string }> = [
  { id: 'emerald', name: '翡翠绿', color: '#5fb894' },
  { id: 'sky', name: '天空蓝', color: '#7ec8e3' },
  { id: 'peach', name: '蜜桃橙', color: '#ffd4a3' },
  { id: 'pink', name: '樱花粉', color: '#f8b4d9' },
  { id: 'lavender', name: '薰衣紫', color: '#c4b5fd' },
]

const themeColorClasses: Record<ThemeColor, { cartoon: string; minimal: string; header: string }> = {
  emerald: {
    cartoon: 'bg-gradient-to-r from-[#5fb894] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#5fb894]',
    minimal: 'bg-[#5fb894] hover:bg-[#4aa17f]',
    header: 'border-[#5fb894]',
  },
  sky: {
    cartoon: 'bg-gradient-to-r from-[#7ec8e3] to-[#b7e4f4] hover:from-[#b7e4f4] hover:to-[#7ec8e3]',
    minimal: 'bg-[#7ec8e3] hover:bg-[#66b5d2]',
    header: 'border-[#7ec8e3]',
  },
  peach: {
    cartoon: 'bg-gradient-to-r from-[#f2ad72] to-[#ffd4a3] hover:from-[#ffd4a3] hover:to-[#f2ad72]',
    minimal: 'bg-[#e7a164] hover:bg-[#d88c4c]',
    header: 'border-[#e7a164]',
  },
  pink: {
    cartoon: 'bg-gradient-to-r from-[#e895bf] to-[#f8b4d9] hover:from-[#f8b4d9] hover:to-[#e895bf]',
    minimal: 'bg-[#df8eb9] hover:bg-[#ce75a5]',
    header: 'border-[#df8eb9]',
  },
  lavender: {
    cartoon: 'bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd] hover:from-[#c4b5fd] hover:to-[#a78bfa]',
    minimal: 'bg-[#9b82e8] hover:bg-[#896dd8]',
    header: 'border-[#9b82e8]',
  },
}

export const themeStyles = {
  cartoon: {
    background: 'bg-gradient-to-br from-[#fff9f0] via-[#ffe5d9] to-[#ffd9e8]',
    cardBg: 'bg-white/90',
    cardBorder: 'border-4 border-[#ffe5d9]',
    cardRounded: 'rounded-3xl',
    buttonRounded: 'rounded-2xl',
    buttonShadow: 'shadow-xl',
    buttonPrimary: 'bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#4ecdc4]',
    buttonSecondary: 'bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] hover:from-[#ff8fab] hover:to-[#ff6b9d]',
    inputRounded: 'rounded-2xl',
    inputBg: 'bg-[#fff9f0]',
    inputBorder: 'border-2 border-[#ffe5d9]',
    headerBorder: 'border-b-4',
    headerShadow: 'shadow-xl',
    titleGradient: 'text-gradient',
    badgeRounded: 'rounded-full',
    enableDecorations: true,
    enableEmojis: true,
  },
  minimal: {
    background: 'bg-gray-50',
    cardBg: 'bg-white',
    cardBorder: 'border border-gray-200',
    cardRounded: 'rounded-lg',
    buttonRounded: 'rounded-md',
    buttonShadow: 'shadow-sm',
    buttonPrimary: 'bg-[#4ecdc4] hover:bg-[#3db8af]',
    buttonSecondary: 'bg-[#ff6b9d] hover:bg-[#ff5589]',
    inputRounded: 'rounded-md',
    inputBg: 'bg-white',
    inputBorder: 'border border-gray-300',
    headerBorder: 'border-b',
    headerShadow: 'shadow-sm',
    titleGradient: 'text-gray-900',
    badgeRounded: 'rounded-md',
    enableDecorations: false,
    enableEmojis: false,
  },
}

export const useThemeStore = defineStore('theme', () => {
  const storedStyle = localStorage.getItem('theme-style') as ThemeStyle
  const style = ref<ThemeStyle>(storedStyle === 'minimal' || storedStyle === 'cartoon' ? storedStyle : 'cartoon')
  const storedColor = localStorage.getItem('theme-color') as ThemeColor
  const themeColor = ref<ThemeColor>(themeColorClasses[storedColor] ? storedColor : 'emerald')
  const notificationsEnabled = ref(localStorage.getItem('notification-reminders-enabled') === 'true')
  const animationsEnabled = ref(localStorage.getItem('animations-enabled') === 'true')

  const theme = computed(() => ({
    ...themeStyles[style.value],
    buttonPrimary: themeColorClasses[themeColor.value][style.value],
    headerBorder: `${themeStyles[style.value].headerBorder} ${themeColorClasses[themeColor.value].header}`,
  }))

  function toggleStyle() {
    style.value = style.value === 'cartoon' ? 'minimal' : 'cartoon'
    localStorage.setItem('theme-style', style.value)
    document.documentElement.style.setProperty(
      '--radius',
      style.value === 'minimal' ? '0.5rem' : '1.5rem'
    )
  }

  function setStyle(newStyle: ThemeStyle) {
    style.value = newStyle
    localStorage.setItem('theme-style', newStyle)
    document.documentElement.style.setProperty(
      '--radius',
      newStyle === 'minimal' ? '0.5rem' : '1.5rem'
    )
  }

  function setThemeColor(newColor: ThemeColor) {
    themeColor.value = newColor
    localStorage.setItem('theme-color', newColor)
  }

  function setNotificationsEnabled(enabled: boolean) {
    notificationsEnabled.value = enabled
    localStorage.setItem('notification-reminders-enabled', String(enabled))
  }

  function setAnimationsEnabled(enabled: boolean) {
    animationsEnabled.value = enabled
    localStorage.setItem('animations-enabled', String(enabled))
  }

  return {
    style,
    theme,
    themeColor,
    notificationsEnabled,
    animationsEnabled,
    toggleStyle,
    setStyle,
    setThemeColor,
    setNotificationsEnabled,
    setAnimationsEnabled,
  }
})
