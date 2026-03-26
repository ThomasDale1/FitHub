// ─────────────────────────────────────────────────────
// mobile/lib/stepTracker.ts
// Background step tracking — sincroniza pasos sin la app abierta
//
// Usa expo-background-task + expo-task-manager para ejecutar
// tareas periódicas que leen el podómetro y sincronizan al backend.
// También re-sincroniza al volver al foreground via AppState.
//
// Step source priority:
//   1. HealthKit (iOS) / Health Connect (Android) — most accurate
//   2. CMPedometer (expo-sensors) — fallback
// ─────────────────────────────────────────────────────
import * as BackgroundTask from "expo-background-task"
import * as TaskManager from "expo-task-manager"
import { Pedometer } from "expo-sensors"
import { AppState, type AppStateStatus } from "react-native"
import { stepsAPI, api, BG_AUTH_TOKEN_KEY, getTokenIfAvailable } from "./api"
import * as SecureStore from "expo-secure-store"
import { getStepsSinceMidnight as healthGetSteps } from "./healthSteps"

// ─── Task names ──────────────────────────────────────
export const STEP_SYNC_TASK = "STEP_SYNC_BACKGROUND_TASK"

// ─── Helper: get steps since midnight ────────────────
// Uses HealthKit/Health Connect when available, else CMPedometer
async function getStepsSinceMidnight(): Promise<number> {
  try {
    const result = await healthGetSteps()
    return result.steps
  } catch {
    // Ultimate fallback to raw pedometer
    try {
      const available = await Pedometer.isAvailableAsync()
      if (!available) return 0
      const midnight = new Date()
      midnight.setHours(0, 0, 0, 0)
      const result = await Pedometer.getStepCountAsync(midnight, new Date())
      return result.steps
    } catch {
      return 0
    }
  }
}

// ─── Foreground sync: usa el interceptor de api (ya tiene token) ──
async function syncStepsForeground(steps: number): Promise<boolean> {
  try {
    if (steps <= 0) return false
    // Skip if no token — avoids 401 during sign-in/sign-out transitions
    const token = await getTokenIfAvailable()
    if (!token) return false
    await stepsAPI.syncSteps(steps)
    return true
  } catch (err: any) {
    if (err?.response?.status !== 401) {
      console.error("🦶 [FG] Sync failed:", err)
    }
    return false
  }
}

// ─── Background sync: usa token de SecureStore ───────
async function syncStepsBackground(steps: number): Promise<boolean> {
  try {
    if (steps <= 0) return false

    const token = await SecureStore.getItemAsync(BG_AUTH_TOKEN_KEY)
    if (!token) {
      console.log("🦶 [BG] No auth token available, skipping sync")
      return false
    }

    const localDate = new Date().toLocaleDateString("en-CA")
    await api.post(
      "/api/steps/sync",
      { steps, date: localDate },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    console.log(`🦶 [BG] Synced ${steps} steps`)
    return true
  } catch (err) {
    console.error("🦶 [BG] Sync failed:", err)
    return false
  }
}

// ═══════════════════════════════════════════════════════
// DEFINE BACKGROUND TASK (must be in global scope)
// ═══════════════════════════════════════════════════════
TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  try {
    const steps = await getStepsSinceMidnight()
    if (steps > 0) {
      const success = await syncStepsBackground(steps)
      if (success) {
        return BackgroundTask.BackgroundTaskResult.Success
      }
    }
    return BackgroundTask.BackgroundTaskResult.Failed
  } catch (error) {
    console.error("🦶 [BG Task] Error:", error)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

// ═══════════════════════════════════════════════════════
// REGISTER / UNREGISTER
// ═══════════════════════════════════════════════════════
export async function registerStepSyncTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync()
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.log("🦶 [BG] Background tasks restricted (normal on Expo Go)")
      return
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK)
    if (isRegistered) {
      console.log("🦶 [BG] Step sync task already registered")
      return
    }

    await BackgroundTask.registerTaskAsync(STEP_SYNC_TASK, {
      minimumInterval: 15,
    })
    console.log("🦶 [BG] Step sync task registered (every ~15 min)")
  } catch (error) {
    console.error("🦶 [BG] Failed to register step sync:", error)
  }
}

export async function unregisterStepSyncTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK)
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(STEP_SYNC_TASK)
      console.log("🦶 [BG] Step sync task unregistered")
    }
  } catch (error) {
    console.error("🦶 [BG] Failed to unregister:", error)
  }
}

// ═══════════════════════════════════════════════════════
// FOREGROUND SYNC — AppState listener
// ═══════════════════════════════════════════════════════
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null
let lastForegroundSync = 0

export function startForegroundSyncListener(): void {
  if (appStateSubscription) return

  appStateSubscription = AppState.addEventListener(
    "change",
    async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        const now = Date.now()
        if (now - lastForegroundSync < 30000) return
        lastForegroundSync = now

        const steps = await getStepsSinceMidnight()
        if (steps > 0) {
          await syncStepsForeground(steps)
        }
      }
    }
  )
  console.log("🦶 [FG] Foreground sync listener active")
}

export function stopForegroundSyncListener(): void {
  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }
}

// ═══════════════════════════════════════════════════════
// INIT — call once after auth is ready
// ═══════════════════════════════════════════════════════
export async function initStepTracking(): Promise<void> {
  // 1. Register background task (silently fails on Expo Go)
  await registerStepSyncTask()

  // 2. Start foreground sync listener
  startForegroundSyncListener()

  // 3. Immediate sync on init (uses api interceptor which has token)
  const steps = await getStepsSinceMidnight()
  if (steps > 0) {
    await syncStepsForeground(steps)
  }
}

// Export for use in steps screen
export { getStepsSinceMidnight }
