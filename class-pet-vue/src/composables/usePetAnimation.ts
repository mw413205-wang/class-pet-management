import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import type { AnimationState, Student } from '@/types'

const AUTO_STATES = new Set<AnimationState>(['breathing', 'sleeping', 'playing', 'showing'])
const FEEDBACK_STATES = new Set<AnimationState>(['happy', 'sad'])

function randomIdleDelay() {
  return 4000 + Math.floor(Math.random() * 4000)
}

function isAutoState(state: AnimationState) {
  return AUTO_STATES.has(state)
}

export function usePetAnimation(student: Readonly<Ref<Student>>, target: Ref<HTMLElement | null>) {
  const isVisible = ref(true)
  const isPageVisible = ref(true)
  const isMobile = ref(false)

  let observer: IntersectionObserver | null = null
  let mediaQuery: MediaQueryList | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let sleepTimer: ReturnType<typeof setTimeout> | null = null
  let playTimer: ReturnType<typeof setTimeout> | null = null
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let stateResetTimer: ReturnType<typeof setTimeout> | null = null

  function clearScheduleTimers() {
    if (idleTimer) clearTimeout(idleTimer)
    if (sleepTimer) clearTimeout(sleepTimer)
    if (playTimer) clearTimeout(playTimer)
    if (showTimer) clearTimeout(showTimer)
    idleTimer = null
    sleepTimer = null
    playTimer = null
    showTimer = null
  }

  function clearResetTimer() {
    if (stateResetTimer) clearTimeout(stateResetTimer)
    stateResetTimer = null
  }

  function canRunAuto() {
    return isVisible.value && isPageVisible.value && !isMobile.value
  }

  function isFeedbackState() {
    return FEEDBACK_STATES.has(student.value.animState)
  }

  function setIdleIfAuto() {
    if (isAutoState(student.value.animState)) {
      student.value.animState = 'idle'
    }
  }

  function setTimedState(state: AnimationState, duration: number) {
    if (!canRunAuto() || isFeedbackState() || student.value.animState === 'sleeping') return
    clearResetTimer()
    student.value.animState = state
    stateResetTimer = setTimeout(() => {
      if (student.value.animState === state) {
        student.value.animState = 'idle'
      }
    }, duration)
  }

  function scheduleIdleLoop() {
    idleTimer = setTimeout(() => {
      if (!canRunAuto()) return
      const current = student.value.animState
      if (!isFeedbackState() && current !== 'sleeping' && current !== 'playing' && current !== 'showing') {
        student.value.animState = current === 'breathing' ? 'idle' : 'breathing'
      }
      scheduleIdleLoop()
    }, randomIdleDelay())
  }

  function scheduleSleep() {
    sleepTimer = setTimeout(() => {
      if (!canRunAuto() || isFeedbackState()) return
      if (student.value.animState !== 'playing' && student.value.animState !== 'showing') {
        student.value.animState = 'sleeping'
      }
    }, 30000)
  }

  function schedulePlaying() {
    if (!student.value.cosmetics.toyId) return
    playTimer = setTimeout(() => {
      setTimedState('playing', 2000)
      schedulePlaying()
    }, 15000)
  }

  function scheduleShowing() {
    if (!student.value.cosmetics.headId && !student.value.cosmetics.backId) return
    showTimer = setTimeout(() => {
      setTimedState('showing', 1500)
      scheduleShowing()
    }, 25000)
  }

  function refreshSchedules() {
    clearScheduleTimers()

    if (!canRunAuto()) {
      setIdleIfAuto()
      return
    }

    scheduleIdleLoop()
    scheduleSleep()
    schedulePlaying()
    scheduleShowing()
  }

  function pauseSchedules() {
    clearScheduleTimers()
    setIdleIfAuto()
  }

  function observeTarget(el: HTMLElement | null) {
    if (observer) observer.disconnect()
    observer = null

    if (!el || typeof IntersectionObserver === 'undefined') {
      isVisible.value = true
      refreshSchedules()
      return
    }

    observer = new IntersectionObserver(([entry]) => {
      isVisible.value = entry ? entry.isIntersecting : true
      if (isVisible.value) refreshSchedules()
      else pauseSchedules()
    }, { threshold: 0.1 })

    observer.observe(el)
  }

  function handlePageVisibility() {
    isPageVisible.value = typeof document === 'undefined' || document.visibilityState === 'visible'
    if (isPageVisible.value) refreshSchedules()
    else pauseSchedules()
  }

  function handleMediaChange(event?: MediaQueryListEvent) {
    isMobile.value = event ? event.matches : mediaQuery?.matches ?? false
    refreshSchedules()
  }

  onMounted(() => {
    isPageVisible.value = document.visibilityState === 'visible'
    mediaQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    isMobile.value = mediaQuery.matches
    mediaQuery.addEventListener('change', handleMediaChange)
    document.addEventListener('visibilitychange', handlePageVisibility)
    observeTarget(target.value)
  })

  watch(target, observeTarget)

  watch(() => student.value.score, () => {
    if (student.value.animState === 'sleeping') student.value.animState = 'idle'
    refreshSchedules()
  })

  watch(
    () => [student.value.cosmetics.toyId, student.value.cosmetics.headId, student.value.cosmetics.backId],
    refreshSchedules,
  )

  onUnmounted(() => {
    clearScheduleTimers()
    clearResetTimer()
    if (observer) observer.disconnect()
    if (mediaQuery) mediaQuery.removeEventListener('change', handleMediaChange)
    document.removeEventListener('visibilitychange', handlePageVisibility)
  })

  return { isVisible, isMobile }
}
