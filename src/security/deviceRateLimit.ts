const STORAGE_KEY = '3d_impact_device_email_rate_limit_v1'
const WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_EMAIL_SENDS_PER_WINDOW = 5
const COOLDOWN_MS = 2 * 60 * 1000

type RateLimitReason = 'cooldown' | 'quota'

interface SavedRateLimitState {
  emailSendTimestamps: number[]
}

export interface DeviceEmailAllowance {
  allowed: boolean
  reason?: RateLimitReason
  retryAfterMs?: number
  remaining: number
}

const readState = (): SavedRateLimitState => {
  const saved = localStorage.getItem(STORAGE_KEY)

  if (!saved) {
    return { emailSendTimestamps: [] }
  }

  try {
    const parsed = JSON.parse(saved) as Partial<SavedRateLimitState>
    return {
      emailSendTimestamps: Array.isArray(parsed.emailSendTimestamps)
        ? parsed.emailSendTimestamps.filter(timestamp => Number.isFinite(timestamp))
        : [],
    }
  } catch (error) {
    console.error("Impossible de lire l'état de limitation d'envoi :", error)
    return { emailSendTimestamps: [] }
  }
}

const saveState = (state: SavedRateLimitState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const cleanTimestamps = (timestamps: number[], now: number) =>
  timestamps
    .filter(timestamp => timestamp > now - WINDOW_MS && timestamp <= now)
    .sort((left, right) => left - right)

const getAllowanceSnapshot = (now: number) => {
  const state = readState()
  const timestamps = cleanTimestamps(state.emailSendTimestamps, now)
  saveState({ emailSendTimestamps: timestamps })
  return timestamps
}

export const getDeviceEmailAllowance = (now = Date.now()): DeviceEmailAllowance => {
  const timestamps = getAllowanceSnapshot(now)
  const lastTimestamp = timestamps.at(-1)

  if (lastTimestamp) {
    const retryAfterMs = lastTimestamp + COOLDOWN_MS - now

    if (retryAfterMs > 0) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterMs,
        remaining: Math.max(0, MAX_EMAIL_SENDS_PER_WINDOW - timestamps.length),
      }
    }
  }

  if (timestamps.length >= MAX_EMAIL_SENDS_PER_WINDOW) {
    return {
      allowed: false,
      reason: 'quota',
      retryAfterMs: timestamps[0] + WINDOW_MS - now,
      remaining: 0,
    }
  }

  return {
    allowed: true,
    remaining: MAX_EMAIL_SENDS_PER_WINDOW - timestamps.length,
  }
}

export const reserveDeviceEmailSend = (now = Date.now()): DeviceEmailAllowance => {
  const allowance = getDeviceEmailAllowance(now)

  if (!allowance.allowed) {
    return allowance
  }

  const timestamps = getAllowanceSnapshot(now)
  timestamps.push(now)
  saveState({ emailSendTimestamps: timestamps })

  return {
    allowed: true,
    remaining: Math.max(0, MAX_EMAIL_SENDS_PER_WINDOW - timestamps.length),
  }
}
