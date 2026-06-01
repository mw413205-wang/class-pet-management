import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeStyle = 'cartoon' | 'minimal'

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
    headerBorder: 'border-b-4 border-[#4ecdc4]',
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
    headerBorder: 'border-b border-gray-200',
    headerShadow: 'shadow-sm',
    titleGradient: 'text-gray-900',
    badgeRounded: 'rounded-md',
    enableDecorations: false,
    enableEmojis: false,
  },
}

export const useThemeStore = defineStore('theme', () => {
  const style = ref<ThemeStyle>(
    (localStorage.getItem('theme-style') as ThemeStyle) || 'cartoon'
  )

  const theme = computed(() => themeStyles[style.value])

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
  }

  return { style, theme, toggleStyle, setStyle }
})
