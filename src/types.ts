export type ParticipantType = 'internal' | 'external'

export interface Participant {
  firstName: string
  lastName: string
  email: string
  phone: string
  type: ParticipantType
  photo: string
  id: string
  createdAt: string
  isConfirmed: boolean
  confirmedAt: string | null
  checkedInAt: string | null
}

export interface CommitteeUser {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  passwordHash?: string
}

export type CommitteeBadgeType = 'committee' | 'ensatpress'

export interface CommitteeMember {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  badgeType: CommitteeBadgeType
  createdAt: string
  checkedInAt: string | null
}

export interface Professor {
  id: string
  name: string
  primaryEmail: string
  secondaryEmail: string | null
  createdAt: string
}

export interface JourJSnapshot {
  participantPresentCount: number
  committeePresentCount: number
  checkedInCount: number
  manualAdjustment: number
  insideCount: number
  maxInsideCapacity: number | null
  isCapacityReached: boolean
  updatedAt: string
}

export type AdminPresenceLookupResult =
  | {
      found: false
      entityType?: null
      presenceRecorded?: false
      alreadyPresent?: false
    }
  | {
      found: true
      entityType: 'participant'
      participant: Participant
      presenceRecorded: boolean
      alreadyPresent: boolean
    }
  | {
      found: true
      entityType: 'committee_member'
      committeeMember: CommitteeMember
      presenceRecorded: boolean
      alreadyPresent: boolean
    }

export type RegistrationPayload = Omit<
  Participant,
  'id' | 'createdAt' | 'isConfirmed' | 'confirmedAt' | 'checkedInAt'
>
