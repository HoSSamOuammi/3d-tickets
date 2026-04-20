import type {
  AdminPresenceLookupResult,
  CommitteeMember,
  CommitteeUser,
  JourJSnapshot,
  Participant,
  Professor,
  RegistrationPayload,
} from '../types'

export type RemoteRegisterResponse =
  | {
    ok: true
    mode: 'created' | 'updated'
    participant: Participant
    externalTicketPrice: number
  }
  | {
    ok: true
    mode: 'duplicate'
    participant: Participant
    duplicateMatchType: 'email' | 'phone' | 'email_phone'
    externalTicketPrice: number
  }

export interface RemoteBootstrapResponse {
  ok: true
  mode: 'remote'
  adminAuthenticated: boolean
  checkInAuthenticated: boolean
  externalTicketPrice: number
  isRegistrationClosed: boolean
  maxInsideCapacity: number | null
  registrants: Participant[]
  committeeUsers: CommitteeUser[]
  committeeMembers: CommitteeMember[]
  professors: Professor[]
}

interface RemoteAdminLoginResponse {
  ok: true
  authenticated: boolean
  registrants?: Participant[]
  externalTicketPrice?: number
  isRegistrationClosed?: boolean
  maxInsideCapacity?: number | null
  committeeUsers?: CommitteeUser[]
  committeeMembers?: CommitteeMember[]
  professors?: Professor[]
}

interface RemoteCommitteeLoginResponse {
  ok: true
  authenticated: boolean
  user?: CommitteeUser
}

interface RemoteConfirmResponse {
  ok: true
  participant: Participant
  registrants: Participant[]
}

interface RemoteParticipantsResponse {
  ok: true
  participant: Participant
  registrants: Participant[]
}

interface RemoteDeleteSuccessResponse {
  ok: true
  result: 'deleted'
  registrants: Participant[]
}

interface RemoteDeleteFailureResponse {
  ok: false
  result: 'invalid_password' | 'not_found'
}

interface RemoteSettingsResponse {
  ok: true
  externalTicketPrice: number
  isRegistrationClosed: boolean
  maxInsideCapacity: number | null
}

interface RemoteCheckInSearchResponse {
  ok: true
  found: boolean
  participant?: Participant
  presenceRecorded?: boolean
  alreadyPresent?: boolean
}

interface RemoteCommitteeUsersResponse {
  ok: true
  committeeUsers: CommitteeUser[]
}

interface RemoteCommitteeMembersResponse {
  ok: true
  committeeMembers: CommitteeMember[]
  importedCount?: number
  skippedCount?: number
}

interface RemoteProfessorsResponse {
  ok: true
  professors: Professor[]
  importedCount?: number
  skippedCount?: number
}

interface RemoteCommitteeMemberPresenceResponse {
  ok: true
  status: 'marked_present' | 'already_present' | 'not_found'
  committeeMember?: CommitteeMember
  committeeMembers: CommitteeMember[]
}

type RemoteJourJResponse = JourJSnapshot & {
  ok: true
}

type RemoteAdminPresenceResponse = AdminPresenceLookupResult & {
  ok: true
  registrants: Participant[]
  committeeMembers: CommitteeMember[]
}

interface RemoteErrorPayload {
  ok?: false
  message?: string
}

const API_BASE = '/api'

const parseJsonBody = <T>(text: string, path: string, status: number): T & RemoteErrorPayload => {
  if (!text) {
    return {} as T & RemoteErrorPayload
  }

  try {
    return JSON.parse(text) as T & RemoteErrorPayload
  } catch {
    const error = new Error(`Réponse API invalide reçue depuis ${path} (HTTP ${status}).`)
    ;(error as Error & { rawBody?: string }).rawBody = text.slice(0, 300)
    throw error
  }
}

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const text = await response.text()
  const payload = parseJsonBody<T>(text, path, response.status)

  if (!response.ok) {
    const error = new Error(payload.message ?? `HTTP ${response.status}`)
      ; (error as Error & { payload?: unknown }).payload = payload
    throw error
  }

  return payload
}

const fetchJsonAllowFailure = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const text = await response.text()
  return parseJsonBody<T>(text, path, response.status)
}

export const probeRemoteApi = async (): Promise<RemoteBootstrapResponse | null> => {
  try {
    const payload = await fetchJson<RemoteBootstrapResponse>('/bootstrap.php', {
      method: 'GET',
      headers: {},
    })

    return payload.ok ? payload : null
  } catch {
    return null
  }
}

export const remoteAdminLogin = (fields: RegistrationPayload) =>
  fetchJson<RemoteAdminLoginResponse>('/admin-login.php', {
    method: 'POST',
    body: JSON.stringify(fields),
  })

export const remoteAdminPortalLogin = (payload: { username: string; password: string }) =>
  fetchJson<RemoteAdminLoginResponse>('/admin-login.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const remoteAdminLogout = () =>
  fetchJson<{ ok: true }>('/admin-logout.php', {
    method: 'POST',
    body: JSON.stringify({}),
  })

export const remoteCommitteeLogin = (payload: { email: string; password: string }) =>
  fetchJson<RemoteCommitteeLoginResponse>('/committee-login.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const remoteCommitteeLogout = () =>
  fetchJson<{ ok: true }>('/committee-logout.php', {
    method: 'POST',
    body: JSON.stringify({}),
  })

export const remoteRegisterParticipant = (payload: RegistrationPayload) =>
  fetchJson<RemoteRegisterResponse>('/register.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const remoteUpdateParticipant = (id: string, payload: RegistrationPayload) =>
  fetchJson<RemoteRegisterResponse>('/update.php', {
    method: 'POST',
    body: JSON.stringify({ id, ...payload }),
  })

export const remoteConfirmParticipant = (participantId: string) =>
  fetchJson<RemoteConfirmResponse>('/admin-confirm.php', {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  })

export const remoteDeleteParticipant = (
  participantId: string,
  password: string,
): Promise<RemoteDeleteSuccessResponse | RemoteDeleteFailureResponse> =>
  fetchJsonAllowFailure<RemoteDeleteSuccessResponse | RemoteDeleteFailureResponse>('/admin-delete.php', {
    method: 'POST',
    body: JSON.stringify({ participantId, password }),
  })

export const remoteSaveExternalTicketPrice = (
  externalTicketPrice: number,
  isRegistrationClosed?: boolean,
) =>
  fetchJson<RemoteSettingsResponse>('/admin-settings.php', {
    method: 'POST',
    body: JSON.stringify({
      externalTicketPrice,
      ...(typeof isRegistrationClosed === 'boolean' ? { isRegistrationClosed } : {}),
    }),
  })

export const remoteSaveMaxInsideCapacity = (maxInsideCapacity: number | null) =>
  fetchJson<RemoteSettingsResponse>('/admin-settings.php', {
    method: 'POST',
    body: JSON.stringify({
      maxInsideCapacity,
    }),
  })

export const remoteCheckInSearch = (mode: 'ticket' | 'contact', query: string) =>
  fetchJson<RemoteCheckInSearchResponse>('/check-in-search.php', {
    method: 'POST',
    body: JSON.stringify({ mode, query }),
  })

export const remoteFetchCommitteeUsers = () =>
  fetchJson<RemoteCommitteeUsersResponse>('/admin-committee-users.php', {
    method: 'GET',
    headers: {},
  })

export const remoteCreateCommitteeUser = (payload: {
  name: string
  email: string
  password: string
}) =>
  fetchJson<RemoteCommitteeUsersResponse>('/admin-committee-users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...payload }),
  })

export const remoteUpdateCommitteeUser = (payload: {
  userId: string
  name: string
  email: string
  password?: string
}) =>
  fetchJson<RemoteCommitteeUsersResponse>('/admin-committee-users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'update', ...payload }),
  })

export const remoteSetCommitteeUserAccess = (payload: { userId: string; isActive: boolean }) =>
  fetchJson<RemoteCommitteeUsersResponse>('/admin-committee-users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'set_access', ...payload }),
  })

export const remoteDeleteCommitteeUser = (userId: string) =>
  fetchJson<RemoteCommitteeUsersResponse>('/admin-committee-users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', userId }),
  })

export const remoteFetchCommitteeMembers = () =>
  fetchJson<RemoteCommitteeMembersResponse>('/admin-committee-members.php', {
    method: 'GET',
    headers: {},
  })

export const remoteCreateCommitteeMember = (payload: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  badgeType?: 'committee' | 'ensatpress'
}) =>
  fetchJson<RemoteCommitteeMembersResponse>('/admin-committee-members.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...payload }),
  })

export const remoteImportCommitteeMembers = (
  members: Array<{
    firstName: string
    lastName: string
    email: string
    phone?: string
    badgeType?: 'committee' | 'ensatpress'
  }>,
) =>
  fetchJson<RemoteCommitteeMembersResponse>('/admin-committee-members.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'import', members }),
  })

export const remoteDeleteCommitteeMember = (memberId: string) =>
  fetchJson<RemoteCommitteeMembersResponse>('/admin-committee-members.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', memberId }),
  })

export const remoteSetCommitteeMemberPresence = (memberId: string, present: boolean) =>
  fetchJson<RemoteCommitteeMembersResponse>('/admin-committee-members.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'set_presence', memberId, present }),
  })

export const remoteMarkCommitteeMemberPresentByQr = (qrPayload: string) =>
  fetchJson<RemoteCommitteeMemberPresenceResponse>('/admin-committee-members.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'mark_present_by_qr', qrPayload }),
  })

export const remoteFetchJourJSnapshot = () =>
  fetchJson<RemoteJourJResponse>('/jourj.php', {
    method: 'GET',
    headers: {},
  })

export const remoteAdjustJourJ = (delta: number) =>
  fetchJson<RemoteJourJResponse>('/jourj.php', {
    method: 'POST',
    body: JSON.stringify({ delta }),
  })

export const remoteFetchProfessors = () =>
  fetchJson<RemoteProfessorsResponse>('/admin-professors.php', {
    method: 'GET',
    headers: {},
  })

export const remoteImportProfessors = (
  professors: Array<{
    name: string
    primaryEmail: string
    secondaryEmail?: string | null
  }>,
) =>
  fetchJson<RemoteProfessorsResponse>('/admin-professors.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'import', professors }),
  })

export const remoteCreateProfessor = (payload: {
  name: string
  primaryEmail: string
  secondaryEmail?: string | null
}) =>
  fetchJson<RemoteProfessorsResponse>('/admin-professors.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...payload }),
  })

export const remoteDeleteProfessor = (professorId: string) =>
  fetchJson<RemoteProfessorsResponse>('/admin-professors.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', professorId }),
  })

export const remoteAdminPresenceLookup = (mode: 'qr' | 'contact', query: string) =>
  fetchJson<RemoteAdminPresenceResponse>('/admin-presence.php', {
    method: 'POST',
    body: JSON.stringify({ mode, query }),
  })

export const remoteSetParticipantPresence = (participantId: string, present: boolean) =>
  fetchJson<RemoteParticipantsResponse>('/admin-participants.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'set_presence', participantId, present }),
  })
