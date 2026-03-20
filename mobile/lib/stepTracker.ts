// ─────────────────────────────────────────────────────
// mobile/lib/stepTracker.ts
// Background step tracking — sincroniza pasos sin la app abierta
//
// Usa expo-background-task + expo-task-manager para ejecutar
// tareas periódicas que leen el podómetro y sincronizan al backend.
// También re-sincroniza al volver al foreground via AppState.
// ─────────────────────────────────────────────────────
import * as BackgroundTask from "expo-background-task"
import * as TaskManager from "expo-task-manager"
import { Pedometer } from "expo-sensors"
import { AppState, type AppStateStatus } from "react-native"
import { api } from "./api"
import * as SecureStore from "expo-secure-store"

// ─── Task names ──────────────────────────────────────
export const STEP_SYNC_TASK = "STEP_SYNC_BACKGROUND_TASK"
export const NOTIFICATION_BACKGROUND_TASK = "NOTIFICATION_BACKGROUND_TASK"

// ─── Helper: get auth token for background requests ──
async function getBackgroundAuthToken(): Promise<string | null> {
  try {
    // Clerk stores the session token in SecureStore
    const token = await SecureStore.getItemAsync("__clerk_client_jwt")
    return token
  } catch {
    return null
  }
}

// ─── Helper: sync steps to backend ───────────────────
async function syncStepsToBackend(steps: number): Promise<boolean> {
  try {
    const token = await getBackgroundAuthToken()
    if (!token || steps <= 0) return false

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

// ─── Helper: get steps since midnight ────────────────
async function getStepsSinceMidnight(): Promise<number> {
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

// ═══════════════════════════════════════════════════════
// DEFINE BACKGROUND TASK (must be in global scope)
// ═══════════════════════════════════════════════════════
TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  try {
    const steps = await getStepsSinceMidnight()
    if (steps > 0) {
      const success = await syncStepsToBackend(steps)
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

/**
 * Registra la tarea de background para sincronizar pasos periódicamente.
 * Minimum interval en iOS/Android es 15 minutos.
 */
export async function registerStepSyncTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync()
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.log("🦶 [BG] Background tasks restricted on this device")
      return
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK)
    if (isRegistered) {
      console.log("🦶 [BG] Step sync task already registered")
      return
    }

    await BackgroundTask.registerTaskAsync(STEP_SYNC_TASK, {
      minimumInterval: 15, // 15 minutes minimum
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
// Sincroniza inmediatamente cuando la app vuelve al foreground
// ═══════════════════════════════════════════════════════
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null
let lastForegroundSync = 0

export function startForegroundSyncListener(): void {
  if (appStateSubscription) return // Ya está activo

  appStateSubscription = AppState.addEventListener(
    "change",
    async (nextState: AppStateStatus) => {
      if (nextState === "active") {
        // Throttle: no sincronizar más de una vez cada 30 segundos
        const now = Date.now()
        if (now - lastForegroundSync < 30000) return
        lastForegroundSync = now

        const steps = await getStepsSinceMidnight()
        if (steps > 0) {
          await syncStepsToBackend(steps)
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
// INIT — call once on app startup
// ═══════════════════════════════════════════════════════
export async function initStepTracking(): Promise<void> {
  // 1. Register background task
  await registerStepSyncTask()

  // 2. Start foreground sync listener
  startForegroundSyncListener()

  // 3. Immediate sync on init
  const steps = await getStepsSinceMidnight()
  if (steps > 0) {
    await syncStepsToBackend(steps)
  }
}

// Export for use in steps screen
export { getStepsSinceMidnight }
