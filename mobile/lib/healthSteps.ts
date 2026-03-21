// ─────────────────────────────────────────────────────
// mobile/lib/healthSteps.ts
// Cross-platform step counting via HealthKit (iOS) and
// Health Connect (Android). Falls back to CMPedometer
// if health services are unavailable or denied.
// ─────────────────────────────────────────────────────
import { Platform } from "react-native"
import { Pedometer } from "expo-sensors"

// ─── Types ──────────────────────────────────────────
export interface StepResult {
  steps: number
  source: "healthkit" | "health_connect" | "pedometer"
}

// ─── State ──────────────────────────────────────────
let _initialized = false
let _healthAvailable = false
let _source: StepResult["source"] = "pedometer"

// ─── iOS: HealthKit ─────────────────────────────────
async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== "ios") return false
  try {
    const HealthKit = require("@kingstinct/react-native-healthkit")
    const isAvailable = await HealthKit.isHealthDataAvailable()
    if (!isAvailable) return false

    // Request read permission for step count
    await HealthKit.requestAuthorization([HealthKit.HKQuantityTypeIdentifier.stepCount])
    return true
  } catch (err) {
    console.log("🏥 HealthKit not available:", err)
    return false
  }
}

async function getStepsFromHealthKit(start: Date, end: Date): Promise<number> {
  try {
    const HealthKit = require("@kingstinct/react-native-healthkit")

    const result = await HealthKit.queryStatisticsForQuantity(
      HealthKit.HKQuantityTypeIdentifier.stepCount,
      [HealthKit.HKStatisticsOptions.cumulativeSum],
      start,
      end,
    )

    return result?.sumQuantity?.quantity ?? 0
  } catch {
    return -1 // signal failure so we can fallback
  }
}

// ─── Android: Health Connect ────────────────────────
async function initHealthConnect(): Promise<boolean> {
  if (Platform.OS !== "android") return false
  try {
    const HC = require("react-native-health-connect")
    const initialized = await HC.initialize()
    if (!initialized) return false

    const granted = await HC.requestPermission([
      { accessType: "read", recordType: "Steps" },
    ])

    return granted.length > 0
  } catch (err) {
    console.log("🏥 Health Connect not available:", err)
    return false
  }
}

async function getStepsFromHealthConnect(start: Date, end: Date): Promise<number> {
  try {
    const HC = require("react-native-health-connect")

    const result = await HC.readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    })

    if (!result?.records?.length) return -1

    return result.records.reduce(
      (sum: number, record: any) => sum + (record.count || 0),
      0,
    )
  } catch {
    return -1
  }
}

// ─── Fallback: CMPedometer (expo-sensors) ───────────
async function getStepsFromPedometer(start: Date, end: Date): Promise<number> {
  try {
    const available = await Pedometer.isAvailableAsync()
    if (!available) return 0
    const result = await Pedometer.getStepCountAsync(start, end)
    return result.steps
  } catch {
    return 0
  }
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

/**
 * Initialize health services. Call once at app startup.
 * Requests permissions and determines best data source.
 */
export async function initHealthSteps(): Promise<StepResult["source"]> {
  if (_initialized) return _source

  if (Platform.OS === "ios") {
    _healthAvailable = await initHealthKit()
    _source = _healthAvailable ? "healthkit" : "pedometer"
  } else if (Platform.OS === "android") {
    _healthAvailable = await initHealthConnect()
    _source = _healthAvailable ? "health_connect" : "pedometer"
  } else {
    _source = "pedometer"
  }

  _initialized = true
  console.log(`🏥 Step source: ${_source}`)
  return _source
}

/**
 * Get steps since midnight (local time).
 * Uses HealthKit/Health Connect if available, else CMPedometer.
 */
export async function getStepsSinceMidnight(): Promise<StepResult> {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const now = new Date()

  // Try health platform first
  if (_healthAvailable) {
    let steps = -1

    if (_source === "healthkit") {
      steps = await getStepsFromHealthKit(midnight, now)
    } else if (_source === "health_connect") {
      steps = await getStepsFromHealthConnect(midnight, now)
    }

    if (steps >= 0) {
      return { steps, source: _source }
    }
    // Health read failed — fall through to pedometer
  }

  // Fallback to CMPedometer
  const steps = await getStepsFromPedometer(midnight, now)
  return { steps, source: "pedometer" }
}

/**
 * Get steps for a specific date range.
 */
export async function getStepsForRange(start: Date, end: Date): Promise<StepResult> {
  if (_healthAvailable) {
    let steps = -1

    if (_source === "healthkit") {
      steps = await getStepsFromHealthKit(start, end)
    } else if (_source === "health_connect") {
      steps = await getStepsFromHealthConnect(start, end)
    }

    if (steps >= 0) {
      return { steps, source: _source }
    }
  }

  const steps = await getStepsFromPedometer(start, end)
  return { steps, source: "pedometer" }
}

/**
 * Check if health services (HealthKit/Health Connect) are the active source.
 */
export function isUsingHealthService(): boolean {
  return _healthAvailable
}

/**
 * Get the current step source name.
 */
export function getStepSource(): StepResult["source"] {
  return _source
}
