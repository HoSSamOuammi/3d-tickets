import type { CommitteeMember, JourJSnapshot, Participant } from '../types'

export const LOCAL_JOURJ_ADJUSTMENT_STORAGE_KEY = '3d_impact_jourj_adjustment_v1'
export const MAX_INSIDE_CAPACITY_STORAGE_KEY = '3d_impact_max_inside_capacity_v1'
const PARTICIPANTS_STORAGE_KEY = '3d_impact_registrants_v1'
const LEGACY_PARTICIPANTS_STORAGE_KEY = 'enactus_registrants_v1'
const COMMITTEE_MEMBERS_STORAGE_KEY = '3d_impact_committee_members_v1'

type CheckedInStorageRecord = {
  checkedInAt?: string | null
}

export const normalizeMaxInsideCapacity = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null
  }

  return parsedValue
}

export const readStoredJourJAdjustment = () => {
  if (typeof window === 'undefined') {
    return 0
  }

  const savedValue = window.localStorage.getItem(LOCAL_JOURJ_ADJUSTMENT_STORAGE_KEY)
  const parsedValue = savedValue ? Number(savedValue) : Number.NaN

  return Number.isInteger(parsedValue) ? parsedValue : 0
}

export const readStoredMaxInsideCapacity = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return normalizeMaxInsideCapacity(
    window.localStorage.getItem(MAX_INSIDE_CAPACITY_STORAGE_KEY),
  )
}

const readStoredList = (primaryKey: string, legacyKey?: string) => {
  if (typeof window === 'undefined') {
    return []
  }

  const savedValue = window.localStorage.getItem(primaryKey)
  const legacyValue = legacyKey ? window.localStorage.getItem(legacyKey) : null
  const serialized = savedValue ?? legacyValue

  if (!serialized) {
    return []
  }

  try {
    const parsedValue = JSON.parse(serialized) as CheckedInStorageRecord[]
    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

const countCheckedInRecords = (records: CheckedInStorageRecord[]) =>
  records.filter((record) => Boolean(record?.checkedInAt)).length

export const buildBrowserJourJSnapshot = (
  maxInsideCapacity: number | null,
): JourJSnapshot => {
  const participantPresentCount = countCheckedInRecords(
    readStoredList(PARTICIPANTS_STORAGE_KEY, LEGACY_PARTICIPANTS_STORAGE_KEY),
  )
  const committeePresentCount = countCheckedInRecords(
    readStoredList(COMMITTEE_MEMBERS_STORAGE_KEY),
  )
  const checkedInCount = participantPresentCount + committeePresentCount
  const manualAdjustment = readStoredJourJAdjustment()
  const normalizedMaxInsideCapacity = normalizeMaxInsideCapacity(maxInsideCapacity)
  const insideCount = Math.max(0, checkedInCount + manualAdjustment)

  return {
    participantPresentCount,
    committeePresentCount,
    checkedInCount,
    manualAdjustment,
    insideCount,
    maxInsideCapacity: normalizedMaxInsideCapacity,
    isCapacityReached:
      normalizedMaxInsideCapacity !== null && insideCount >= normalizedMaxInsideCapacity,
    updatedAt: new Date().toISOString(),
  }
}

export const buildLocalJourJSnapshot = (
  registrants: Participant[],
  committeeMembers: CommitteeMember[],
  manualAdjustment: number,
  maxInsideCapacity: number | null,
): JourJSnapshot => {
  const participantPresentCount = registrants.filter((participant) =>
    Boolean(participant.checkedInAt),
  ).length
  const committeePresentCount = committeeMembers.filter((member) =>
    Boolean(member.checkedInAt),
  ).length
  const checkedInCount = participantPresentCount + committeePresentCount
  const normalizedMaxInsideCapacity = normalizeMaxInsideCapacity(maxInsideCapacity)
  const insideCount = Math.max(0, checkedInCount + manualAdjustment)

  return {
    participantPresentCount,
    committeePresentCount,
    checkedInCount,
    manualAdjustment,
    insideCount,
    maxInsideCapacity: normalizedMaxInsideCapacity,
    isCapacityReached:
      normalizedMaxInsideCapacity !== null && insideCount >= normalizedMaxInsideCapacity,
    updatedAt: new Date().toISOString(),
  }
}
