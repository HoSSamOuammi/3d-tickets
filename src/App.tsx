import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import RegistrationForm from './components/RegistrationForm'
import InAppPopup, { type PopupItem, type PopupTone } from './components/InAppPopup'
import {
  getCommitteeBadgeProfile,
  normalizeCommitteeBadgeType,
} from './lib/committeeBadge'
import {
  buildLocalJourJSnapshot,
  MAX_INSIDE_CAPACITY_STORAGE_KEY,
  readStoredJourJAdjustment,
  readStoredMaxInsideCapacity,
} from './lib/jourj'
import { isAdminAccessAttempt } from './security/adminAccess'
import { verifyAdminDeletionPassword } from './security/adminDeletion'
import { reserveDeviceEmailSend, type DeviceEmailAllowance } from './security/deviceRateLimit'
import type {
  AdminPresenceLookupResult,
  CommitteeBadgeType,
  CommitteeMember,
  CommitteeUser,
  Participant,
  Professor,
  RegistrationPayload,
} from './types'

type Page = 'home' | 'success' | 'admin'
type RouteMode = 'main' | 'check_in' | 'jour_j'
type SuccessMode = 'created' | 'duplicate' | 'updated'
type BadgeEmailStatus = 'idle' | 'sent' | 'failed' | 'rate_limited'
type DuplicateMatchType = 'email' | 'phone' | 'email_phone'
type DeleteParticipantResult = 'deleted' | 'invalid_password' | 'not_found' | 'busy'
type SendBadgeContext = 'registration' | 'duplicate' | 'admin'
type CheckInSearchMode = 'ticket' | 'contact'

type CommitteePasswordRegenerationResult = {
  updatedCount: number
  failedUsers: CommitteeUser[]
}
type CommitteeQrDispatchResult = {
  sentCount: number
  failedMembers: CommitteeMember[]
}
type ProfessorEmailDispatchResult = {
  sentCount: number
  failedProfessors: Professor[]
}
type CommitteeMemberImportRow = {
  firstName: string
  lastName: string
  email: string
  phone: string
  badgeType: CommitteeBadgeType
}
type CommitteeMemberImportResult = {
  importedCount: number
  skippedCount: number
}
type ProfessorImportRow = {
  name: string
  primaryEmail: string
  secondaryEmail: string
}
type ProfessorImportResult = {
  importedCount: number
  skippedCount: number
}
type SendBadgeOptions = {
  context?: SendBadgeContext
  bypassRateLimit?: boolean
  duplicate?: boolean
}
type EmailJsModule = typeof import('@emailjs/browser')
type QrCodeModule = typeof import('qrcode')
type BadgePdfModule = typeof import('./lib/badgePdf')
type CheckInCredentials = {
  username: string
  password: string
}
type AdminPresenceLookupMode = 'qr' | 'contact'

const SuccessPage = lazy(() => import('./components/SuccessPage'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
const CheckInPage = lazy(() => import('./components/CheckInPage'))
const JourJMonitor = lazy(() => import('./components/JourJMonitor'))

const STORAGE_KEY = '3d_impact_registrants_v1'
const LEGACY_STORAGE_KEY = 'enactus_registrants_v1'
const EXTERNAL_TICKET_PRICE_STORAGE_KEY = '3d_impact_external_ticket_price_v1'
const REGISTRATION_CLOSED_STORAGE_KEY = '3d_impact_registration_closed_v1'
const COMMITTEE_USERS_STORAGE_KEY = '3d_impact_committee_users_v1'
const COMMITTEE_MEMBERS_STORAGE_KEY = '3d_impact_committee_members_v1'
const PROFESSORS_STORAGE_KEY = '3d_impact_professors_v1'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_EXTERNAL_TICKET_PRICE = 50
const EVENT_LOGO_PATH = '/logo/IMG_1853-cropped-alpha.png'
const EVENT_EMAIL_LOGO_PATH = '/logo/IMG_1853-cropped-visible.png'
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
const REGISTRATION_CLOSED_MESSAGE =
  "Le quota de places disponibles ayant été atteint, les inscriptions en ligne sont désormais clôturées. Un accès sur place pourra toutefois être envisagé le jour J, dans la limite des places disponibles. Les participants déjà munis d'un ticket seront accueillis en priorité. Nous vous remercions pour votre compréhension."
const MAX_INSIDE_CAPACITY_REACHED_MESSAGE =
  'Capacité maximale atteinte. Aucun nouveau check-in ne peut être enregistré.'
const LEGACY_CREATED_AT_FALLBACK = '1970-01-01T00:00:00.000Z'
const EMAIL_SEND_MAX_ATTEMPTS = 3
const EMAIL_SEND_RETRY_DELAY_MS = 800
const CHECK_IN_ADMIN_USERNAME = (
  import.meta.env.VITE_CHECKIN_ADMIN_USERNAME?.trim() || 'admin'
).toLowerCase()
const CHECK_IN_ADMIN_PASSWORDS = Array.from(
  new Set(
    [
      import.meta.env.VITE_LOCAL_CHECKIN_ADMIN_PASSWORD?.trim(),
      import.meta.env.VITE_ADMIN_PASSWORD?.trim(),
    ].filter((value): value is string => Boolean(value)),
  ),
)
const LOCAL_CHECKIN_COMMITTEE_EMAIL =
  import.meta.env.VITE_CHECKIN_COMMITTEE_EMAIL?.trim().toLowerCase() ?? ''
const LOCAL_CHECKIN_COMMITTEE_PASSWORD =
  import.meta.env.VITE_CHECKIN_COMMITTEE_PASSWORD?.trim() ?? ''

const isValidCheckInAdminPassword = (password: string) =>
  CHECK_IN_ADMIN_PASSWORDS.includes(password)
const isValidLocalCommitteeFallbackLogin = (email: string, password: string) =>
  LOCAL_CHECKIN_COMMITTEE_EMAIL !== '' &&
  LOCAL_CHECKIN_COMMITTEE_PASSWORD !== '' &&
  email === LOCAL_CHECKIN_COMMITTEE_EMAIL &&
  password === LOCAL_CHECKIN_COMMITTEE_PASSWORD
const COMMITTEE_PASSWORD_LENGTH = 14
const PASSWORD_UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASSWORD_LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'
const PASSWORD_DIGITS = '23456789'
const PASSWORD_SYMBOLS = '!@#$%*?'
const PASSWORD_ALPHABET =
  PASSWORD_UPPERCASE + PASSWORD_LOWERCASE + PASSWORD_DIGITS + PASSWORD_SYMBOLS
let emailJsModulePromise: Promise<EmailJsModule> | null = null
let qrCodeModulePromise: Promise<QrCodeModule> | null = null
let badgePdfModulePromise: Promise<BadgePdfModule> | null = null

const loadEmailJsModule = () => {
  if (!emailJsModulePromise) {
    emailJsModulePromise = import('@emailjs/browser')
  }

  return emailJsModulePromise
}

const loadQrCodeModule = () => {
  if (!qrCodeModulePromise) {
    qrCodeModulePromise = import('qrcode')
  }

  return qrCodeModulePromise
}

const loadBadgePdfModule = () => {
  if (!badgePdfModulePromise) {
    badgePdfModulePromise = import('./lib/badgePdf')
  }

  return badgePdfModulePromise
}

const createTicketId = (existingIds: Set<string>) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const randomBuffer = new Uint32Array(1)
    crypto.getRandomValues(randomBuffer)
    const candidate = `ENA-${randomBuffer[0]
      .toString(36)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .padStart(6, '0')
      .slice(-6)}`

    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  return `ENA-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

const normalizeStoredParticipant = (participant: Partial<Participant>): Participant => {
  const normalizedType = participant.type === 'external' ? 'external' : 'internal'
  const isConfirmed = true

  return {
    firstName: participant.firstName ?? '',
    lastName: participant.lastName ?? '',
    email: participant.email ?? '',
    phone: participant.phone ?? '',
    type: normalizedType,
    photo: participant.photo ?? '',
    id: participant.id ?? '',
    createdAt: participant.createdAt ?? LEGACY_CREATED_AT_FALLBACK,
    isConfirmed,
    confirmedAt:
      participant.confirmedAt ?? participant.createdAt ?? LEGACY_CREATED_AT_FALLBACK,
    checkedInAt: participant.checkedInAt ?? null,
  }
}

const normalizeStoredCommitteeUser = (user: Partial<CommitteeUser>): CommitteeUser => ({
  id: user.id ?? crypto.randomUUID(),
  name: user.name ?? '',
  email: user.email ?? '',
  isActive: typeof user.isActive === 'boolean' ? user.isActive : true,
  createdAt: user.createdAt ?? new Date(0).toISOString(),
  updatedAt: user.updatedAt ?? user.createdAt ?? new Date(0).toISOString(),
  lastLoginAt: user.lastLoginAt ?? null,
  passwordHash: user.passwordHash,
})

const normalizeStoredCommitteeMember = (member: Partial<CommitteeMember>): CommitteeMember => ({
  id: member.id ?? crypto.randomUUID(),
  firstName: member.firstName ?? '',
  lastName: member.lastName ?? '',
  email: member.email ?? '',
  phone: member.phone ?? '',
  badgeType: normalizeCommitteeBadgeType(member.badgeType),
  createdAt: member.createdAt ?? new Date(0).toISOString(),
  checkedInAt: member.checkedInAt ?? null,
})

const normalizeStoredProfessor = (professor: Partial<Professor>): Professor => ({
  id: professor.id ?? crypto.randomUUID(),
  name: professor.name ?? '',
  primaryEmail: professor.primaryEmail ?? '',
  secondaryEmail: professor.secondaryEmail ?? null,
  createdAt: professor.createdAt ?? new Date(0).toISOString(),
})

const readStoredParticipants = () => {
  const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)

  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved) as Partial<Participant>[]
    return Array.isArray(parsed) ? parsed.map(normalizeStoredParticipant) : []
  } catch (error) {
    console.error('Impossible de lire les inscriptions sauvegardées :', error)
    return []
  }
}

const readStoredCommitteeUsers = () => {
  const saved = localStorage.getItem(COMMITTEE_USERS_STORAGE_KEY)

  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved) as Partial<CommitteeUser>[]
    return Array.isArray(parsed) ? parsed.map(normalizeStoredCommitteeUser) : []
  } catch (error) {
    console.error('Impossible de lire les utilisateurs comité sauvegardés :', error)
    return []
  }
}

const readStoredCommitteeMembers = () => {
  const saved = localStorage.getItem(COMMITTEE_MEMBERS_STORAGE_KEY)

  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved) as Partial<CommitteeMember>[]
    return Array.isArray(parsed) ? parsed.map(normalizeStoredCommitteeMember) : []
  } catch (error) {
    console.error('Impossible de lire les membres comité sauvegardés :', error)
    return []
  }
}

const readStoredExternalTicketPrice = () => {
  const savedPrice = localStorage.getItem(EXTERNAL_TICKET_PRICE_STORAGE_KEY)
  const parsedPrice = savedPrice ? Number(savedPrice) : Number.NaN

  if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
    return parsedPrice
  }

  return DEFAULT_EXTERNAL_TICKET_PRICE
}

const writeMaxInsideCapacityCache = (value: number | null) => {
  if (value === null) {
    localStorage.removeItem(MAX_INSIDE_CAPACITY_STORAGE_KEY)
    return
  }

  localStorage.setItem(MAX_INSIDE_CAPACITY_STORAGE_KEY, String(value))
}

const readStoredProfessors = () => {
  const saved = localStorage.getItem(PROFESSORS_STORAGE_KEY)

  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved) as Partial<Professor>[]
    return Array.isArray(parsed) ? parsed.map(normalizeStoredProfessor) : []
  } catch (error) {
    console.error('Impossible de lire les professeurs sauvegardés :', error)
    return []
  }
}

const buildAbsoluteAppUrl = (path: string) => {
  const baseUrl = PUBLIC_SITE_URL || (typeof window === 'undefined' ? '' : window.location.origin)

  if (!baseUrl) {
    return path
  }

  return new URL(path, baseUrl).toString()
}

const readStoredRegistrationClosed = () => {
  const savedValue = localStorage.getItem(REGISTRATION_CLOSED_STORAGE_KEY)
  return savedValue === '1'
}

const getEmailJsErrorDetails = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return 'erreur inconnue'
  }

  const maybeError = error as {
    status?: number
    text?: string
    message?: string
    name?: string
  }

  const parts = [
    typeof maybeError.status === 'number' ? `status ${maybeError.status}` : '',
    maybeError.text ?? '',
    maybeError.message ?? '',
    maybeError.name ?? '',
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' | ') : 'erreur inconnue'
}

const getEmailJsGuidanceMessage = (error: unknown, duplicate: boolean) => {
  const details = getEmailJsErrorDetails(error)
  const normalizedDetails = details.toLowerCase()

  if (normalizedDetails.includes('recipients address is empty')) {
    return duplicate
      ? "Cette inscription existe déjà, mais EmailJS ne peut pas renvoyer l'email de confirmation car le template n'a pas de destinataire configuré. Dans EmailJS, ouvre le template et mets le champ destinataire sur {{to_email}}."
      : "L'inscription est enregistrée, mais EmailJS rejette l'email de confirmation car le template n'a pas de destinataire configuré. Dans EmailJS, ouvre le template et mets le champ destinataire sur {{to_email}}."
  }

  return duplicate
    ? `Cette inscription existe déjà, mais l'email de confirmation n'a pas pu être renvoyé automatiquement. Détail EmailJS : ${details}`
    : `L'inscription est enregistrée, mais EmailJS a rejeté l'email de confirmation. Détail : ${details}`
}

const shouldRetryEmailSend = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    const fallbackMessage = String(error ?? '').toLowerCase()
    return fallbackMessage.includes('network') || fallbackMessage.includes('fetch')
  }

  const maybeError = error as {
    status?: number
    text?: string
    message?: string
    name?: string
  }

  if (typeof maybeError.status === 'number') {
    if ([408, 425, 429].includes(maybeError.status) || maybeError.status >= 500) {
      return true
    }

    if (maybeError.status >= 400) {
      return false
    }
  }

  const details = [maybeError.text, maybeError.message, maybeError.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return ['network', 'fetch', 'timeout', 'temporarily', 'load failed', 'failed to fetch'].some(
    (fragment) => details.includes(fragment),
  )
}

const wait = (delayMs: number) => new Promise((resolve) => window.setTimeout(resolve, delayMs))

const canReceiveBadge = (participant: Participant) =>
  participant.type === 'internal' || participant.type === 'external' || participant.isConfirmed

const resolveUpdatedParticipantConfirmation = (
  existingParticipant: Participant,
  _nextType: RegistrationPayload['type'],
  nowIso: string,
) => {
  return {
    isConfirmed: true,
    confirmedAt: existingParticipant.confirmedAt ?? nowIso,
  }
}

const writeRegistrantsCache = (participants: Participant[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(participants))
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

const writeExternalTicketPriceCache = (price: number) => {
  localStorage.setItem(EXTERNAL_TICKET_PRICE_STORAGE_KEY, String(price))
}

const writeRegistrationClosedCache = (isClosed: boolean) => {
  localStorage.setItem(REGISTRATION_CLOSED_STORAGE_KEY, isClosed ? '1' : '0')
}

const writeCommitteeUsersCache = (users: CommitteeUser[]) => {
  localStorage.setItem(COMMITTEE_USERS_STORAGE_KEY, JSON.stringify(users))
}

const writeCommitteeMembersCache = (members: CommitteeMember[]) => {
  localStorage.setItem(COMMITTEE_MEMBERS_STORAGE_KEY, JSON.stringify(members))
}

const writeProfessorsCache = (professors: Professor[]) => {
  localStorage.setItem(PROFESSORS_STORAGE_KEY, JSON.stringify(professors))
}

const hashText = async (value: string) => {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const pickRandomCharacter = (alphabet: string) => {
  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  return alphabet[randomBuffer[0] % alphabet.length]
}

const shuffleCharacters = (characters: string[]) => {
  const shuffled = [...characters]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomBuffer = new Uint32Array(1)
    crypto.getRandomValues(randomBuffer)
    const swapIndex = randomBuffer[0] % (index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled.join('')
}

const generateCommitteePassword = (length = COMMITTEE_PASSWORD_LENGTH) => {
  const characters = [
    pickRandomCharacter(PASSWORD_UPPERCASE),
    pickRandomCharacter(PASSWORD_LOWERCASE),
    pickRandomCharacter(PASSWORD_DIGITS),
    pickRandomCharacter(PASSWORD_SYMBOLS),
  ]

  while (characters.length < length) {
    characters.push(pickRandomCharacter(PASSWORD_ALPHABET))
  }

  return shuffleCharacters(characters)
}

const isLikelyMobileDevice = () =>
  typeof navigator !== 'undefined' &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)

const getRouteMode = (): RouteMode => {
  const normalizedPath = (window.location.pathname.replace(/\/+$/, '') || '/').toLowerCase()

  if (normalizedPath === '/check_in') {
    return 'check_in'
  }

  if (normalizedPath === '/jourj') {
    return 'jour_j'
  }

  return 'main'
}

function App() {
  const [routeMode, setRouteMode] = useState<RouteMode>(getRouteMode)
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [currentUser, setCurrentUser] = useState<Participant | null>(null)
  const [registrants, setRegistrants] = useState<Participant[]>(readStoredParticipants)
  const registrantsRef = useRef<Participant[]>(registrants)
  const [committeeUsers, setCommitteeUsers] = useState<CommitteeUser[]>(readStoredCommitteeUsers)
  const committeeUsersRef = useRef<CommitteeUser[]>(committeeUsers)
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>(
    readStoredCommitteeMembers,
  )
  const committeeMembersRef = useRef<CommitteeMember[]>(committeeMembers)
  const [professors, setProfessors] = useState<Professor[]>(readStoredProfessors)
  const professorsRef = useRef<Professor[]>(professors)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [isCheckInAuthenticated, setIsCheckInAuthenticated] = useState(false)
  const [successMode, setSuccessMode] = useState<SuccessMode>('created')
  const [badgeEmailStatus, setBadgeEmailStatus] = useState<BadgeEmailStatus>('idle')
  const [duplicateMatchType, setDuplicateMatchType] = useState<DuplicateMatchType>('email')
  const [isResendingBadge, setIsResendingBadge] = useState(false)
  const [isDownloadingCurrentBadge, setIsDownloadingCurrentBadge] = useState(false)
  const [confirmingParticipantIds, setConfirmingParticipantIds] = useState<string[]>([])
  const confirmingParticipantIdsRef = useRef<Set<string>>(new Set())
  const [sendingBadgeParticipantIds, setSendingBadgeParticipantIds] = useState<string[]>([])
  const sendingBadgeParticipantIdsRef = useRef<Set<string>>(new Set())
  const [downloadingBadgeParticipantIds, setDownloadingBadgeParticipantIds] = useState<
    string[]
  >([])
  const downloadingBadgeParticipantIdsRef = useRef<Set<string>>(new Set())
  const [popups, setPopups] = useState<PopupItem[]>([])
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [isCheckInLoggingIn, setIsCheckInLoggingIn] = useState(false)
  const [externalTicketPrice, setExternalTicketPrice] = useState<number>(
    readStoredExternalTicketPrice,
  )
  const [maxInsideCapacity, setMaxInsideCapacity] = useState<number | null>(
    readStoredMaxInsideCapacity,
  )
  const [isRegistrationClosed, setIsRegistrationClosed] = useState<boolean>(
    readStoredRegistrationClosed,
  )

  useEffect(() => {
    const handlePopState = () => {
      setRouteMode(getRouteMode())
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    registrantsRef.current = registrants
    writeRegistrantsCache(registrants)
  }, [registrants])

  useEffect(() => {
    writeExternalTicketPriceCache(externalTicketPrice)
  }, [externalTicketPrice])

  useEffect(() => {
    writeMaxInsideCapacityCache(maxInsideCapacity)
  }, [maxInsideCapacity])

  useEffect(() => {
    writeRegistrationClosedCache(isRegistrationClosed)
  }, [isRegistrationClosed])

  useEffect(() => {
    committeeUsersRef.current = committeeUsers
    writeCommitteeUsersCache(committeeUsers)
  }, [committeeUsers])

  useEffect(() => {
    committeeMembersRef.current = committeeMembers
    writeCommitteeMembersCache(committeeMembers)
  }, [committeeMembers])

  useEffect(() => {
    professorsRef.current = professors
    writeProfessorsCache(professors)
  }, [professors])

  const showPopup = (message: string, tone: PopupTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setPopups((current) => [...current, { id, message, tone }])
  }

  const dismissPopup = (id: number) => {
    setPopups((current) => current.filter((item) => item.id !== id))
  }

  const getErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (error && typeof error === 'object') {
      const maybeError = error as { payload?: { message?: string }; message?: string }
      return maybeError.payload?.message ?? maybeError.message ?? fallbackMessage
    }

    return fallbackMessage
  }

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const isParticipantEvent =
        !event.key || event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY
      const isPriceEvent = !event.key || event.key === EXTERNAL_TICKET_PRICE_STORAGE_KEY
      const isMaxInsideCapacityEvent = !event.key || event.key === MAX_INSIDE_CAPACITY_STORAGE_KEY
      const isRegistrationClosedEvent =
        !event.key || event.key === REGISTRATION_CLOSED_STORAGE_KEY
      const isCommitteeUserEvent = !event.key || event.key === COMMITTEE_USERS_STORAGE_KEY
      const isCommitteeMemberEvent = !event.key || event.key === COMMITTEE_MEMBERS_STORAGE_KEY
      const isProfessorEvent = !event.key || event.key === PROFESSORS_STORAGE_KEY

      if (isParticipantEvent) {
        const nextRegistrants = readStoredParticipants()
        registrantsRef.current = nextRegistrants
        setRegistrants(nextRegistrants)
        setCurrentUser((previousUser) => {
          if (!previousUser) {
            return previousUser
          }

          return nextRegistrants.find((participant) => participant.id === previousUser.id) ?? null
        })
      }

      if (isPriceEvent) {
        setExternalTicketPrice(readStoredExternalTicketPrice())
      }

      if (isMaxInsideCapacityEvent) {
        setMaxInsideCapacity(readStoredMaxInsideCapacity())
      }

      if (isRegistrationClosedEvent) {
        setIsRegistrationClosed(readStoredRegistrationClosed())
      }

      if (isCommitteeUserEvent) {
        const nextCommitteeUsers = readStoredCommitteeUsers()
        committeeUsersRef.current = nextCommitteeUsers
        setCommitteeUsers(nextCommitteeUsers)
      }

      if (isCommitteeMemberEvent) {
        const nextCommitteeMembers = readStoredCommitteeMembers()
        committeeMembersRef.current = nextCommitteeMembers
        setCommitteeMembers(nextCommitteeMembers)
      }

      if (isProfessorEvent) {
        const nextProfessors = readStoredProfessors()
        professorsRef.current = nextProfessors
        setProfessors(nextProfessors)
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    if (currentPage === 'success' && !currentUser) {
      setCurrentPage('home')
      setSuccessMode('created')
      setBadgeEmailStatus('idle')
    }
  }, [currentPage, currentUser])

  const commitRegistrants = (nextRegistrants: Participant[]) => {
    registrantsRef.current = nextRegistrants
    setRegistrants(nextRegistrants)
    setCurrentUser((previousUser) => {
      if (!previousUser) {
        return previousUser
      }

      return nextRegistrants.find((participant) => participant.id === previousUser.id) ?? null
    })
    writeRegistrantsCache(nextRegistrants)
  }

  const commitCommitteeUsers = (nextUsers: CommitteeUser[]) => {
    committeeUsersRef.current = nextUsers
    setCommitteeUsers(nextUsers)
    writeCommitteeUsersCache(nextUsers)
  }

  const commitCommitteeMembers = (nextMembers: CommitteeMember[]) => {
    committeeMembersRef.current = nextMembers
    setCommitteeMembers(nextMembers)
    writeCommitteeMembersCache(nextMembers)
  }

  const commitProfessors = (nextProfessors: Professor[]) => {
    professorsRef.current = nextProfessors
    setProfessors(nextProfessors)
    writeProfessorsCache(nextProfessors)
  }

  const normalizeEmail = (value: string) => value.trim().toLowerCase()
  const getLocalJourJSnapshot = () =>
    buildLocalJourJSnapshot(
      registrantsRef.current,
      committeeMembersRef.current,
      readStoredJourJAdjustment(),
      maxInsideCapacity,
    )
  const ensureLocalCapacityAvailableForNewPresence = () => {
    const snapshot = getLocalJourJSnapshot()

    if (snapshot.isCapacityReached) {
      throw new Error(MAX_INSIDE_CAPACITY_REACHED_MESSAGE)
    }
  }
  const normalizePhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '')

    if (!digitsOnly) {
      return ''
    }

    const withoutInternationalPrefix = digitsOnly.startsWith('00')
      ? digitsOnly.slice(2)
      : digitsOnly

    if (withoutInternationalPrefix.startsWith('212')) {
      return `212${withoutInternationalPrefix.slice(3).replace(/^0+/, '')}`
    }

    if (withoutInternationalPrefix.length === 10 && withoutInternationalPrefix.startsWith('0')) {
      return `212${withoutInternationalPrefix.slice(1)}`
    }

    if (withoutInternationalPrefix.length === 9 && /^[5-7]/.test(withoutInternationalPrefix)) {
      return `212${withoutInternationalPrefix}`
    }

    return withoutInternationalPrefix
  }

  const formatRetryDelay = (retryAfterMs?: number) => {
    if (!retryAfterMs || retryAfterMs <= 0) {
      return 'quelques instants'
    }

    const totalMinutes = Math.ceil(retryAfterMs / 60000)

    if (totalMinutes < 60) {
      return `${totalMinutes} min`
    }

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (minutes === 0) {
      return `${hours} h`
    }

    return `${hours} h ${minutes} min`
  }

  const getRateLimitMessage = (allowance: DeviceEmailAllowance, duplicate: boolean) => {
    const waitTime = formatRetryDelay(allowance.retryAfterMs)

    if (allowance.reason === 'cooldown') {
      return duplicate
        ? `Cette inscription existe déjà, mais le renvoi de l'email de confirmation est temporairement bloqué sur cet appareil. Réessayez dans ${waitTime}.`
        : `Veuillez patienter ${waitTime} avant une nouvelle inscription depuis cet appareil.`
    }

    return duplicate
      ? `Cette inscription existe déjà, mais la limite quotidienne d'envoi d'emails de confirmation a été atteinte sur cet appareil. Réessayez dans ${waitTime}.`
      : `La limite quotidienne d'inscriptions et d'emails de confirmation a été atteinte sur cet appareil. Réessayez dans ${waitTime}.`
  }

  const buildQrCodeDataUrl = async (ticketId: string) => {
    const qrCode = await loadQrCodeModule()

    return qrCode.toDataURL(ticketId, {
      width: 512,
      margin: 4,
      color: {
        dark: '#070D0D',
        light: '#FFFFFF',
      },
    })
  }

  const buildCommitteeMemberQrValue = (memberId: string) =>
    `3D-IMPACT-COMMITTEE:${memberId.toUpperCase()}`

  const isCommitteeQrPayload = (value: string) =>
    value.trim().toUpperCase().startsWith('3D-IMPACT-COMMITTEE:')

  const buildCommitteeMemberQrDataUrl = async (memberId: string) => {
    const qrCode = await loadQrCodeModule()

    return qrCode.toDataURL(buildCommitteeMemberQrValue(memberId), {
      width: 512,
      margin: 4,
      color: {
        dark: '#070D0D',
        light: '#FFFFFF',
      },
    })
  }

  const splitCommitteeFullName = (fullName: string) => {
    const cleanedName = fullName.replace(/\s+/g, ' ').trim()

    if (!cleanedName) {
      return { firstName: '', lastName: '' }
    }

    const parts = cleanedName.split(' ')

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' }
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    }
  }

  const parseCsvLine = (line: string) => {
    const cells: string[] = []
    let current = ''
    let insideQuotes = false

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      const nextCharacter = line[index + 1]

      if (character === '"' && nextCharacter === '"') {
        current += '"'
        index += 1
        continue
      }

      if (character === '"') {
        insideQuotes = !insideQuotes
        continue
      }

      if (character === ',' && !insideQuotes) {
        cells.push(current.trim())
        current = ''
        continue
      }

      current += character
    }

    cells.push(current.trim())
    return cells
  }

  const parseCommitteeImportCsv = (rawCsv: string): CommitteeMemberImportRow[] =>
    rawCsv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1)
      .map(parseCsvLine)
      .map((columns) => {
        const fullName = columns[0] ?? ''
        const phone = columns[1] ?? ''
        const email = columns[2] ?? ''
        const badgeType = normalizeCommitteeBadgeType(columns[3] ?? '')
        const { firstName, lastName } = splitCommitteeFullName(fullName)

        return {
          firstName,
          lastName,
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          badgeType,
        }
      })
      .filter((member) => member.firstName && member.lastName && member.email)

  const parseProfessorImportCsv = (rawCsv: string): ProfessorImportRow[] =>
    rawCsv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1)
      .map(parseCsvLine)
      .map((columns) => {
        const name = (columns[0] ?? '').replace(/\s+/g, ' ').trim()
        const personalEmail = normalizeEmail(columns[1] ?? '')
        const institutionalEmail = normalizeEmail(columns[2] ?? '')
        const preferredEmail = EMAIL_PATTERN.test(institutionalEmail)
          ? institutionalEmail
          : EMAIL_PATTERN.test(personalEmail)
            ? personalEmail
            : ''
        const alternateEmailCandidates = [institutionalEmail, personalEmail]
          .filter((email, index, collection) => email && collection.indexOf(email) === index)
          .filter((email) => email !== preferredEmail && EMAIL_PATTERN.test(email))

        return {
          name,
          primaryEmail: preferredEmail,
          secondaryEmail: alternateEmailCandidates[0] ?? '',
        }
      })
      .filter((professor) => professor.name && professor.primaryEmail)

  const openPdfPreviewWindow = () => {
    if (!isLikelyMobileDevice()) {
      return null
    }

    const previewWindow = window.open('', '_blank')

    if (!previewWindow) {
      return null
    }

    previewWindow.document.write(`
      <title>Préparation du badge PDF...</title>
      <body style="margin:0; min-height:100vh; display:grid; place-items:center; font-family:Arial,sans-serif; background:#f8fafc; color:#0f172a;">
        <div style="text-align:center; padding:24px;">
          <p style="margin:0; font-size:18px; font-weight:700;">Préparation du badge PDF...</p>
          <p style="margin:12px 0 0; color:#64748b;">Le document va s'ouvrir automatiquement dans cet onglet.</p>
        </div>
      </body>
    `)
    previewWindow.document.close()

    return previewWindow
  }

  const triggerFileDownload = (
    fileBlob: Blob,
    fileName: string,
    previewWindow: Window | null = null,
  ) => {
    const objectUrl = URL.createObjectURL(fileBlob)

    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      return
    }

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  const downloadBadgePdf = async (participant: Participant, previewWindow: Window | null = null) => {
    const qrCodeDataUrl = await buildQrCodeDataUrl(participant.id)
    const { createBadgePdfAttachment } = await loadBadgePdfModule()
    const badgePdf = await createBadgePdfAttachment(participant, qrCodeDataUrl, EVENT_LOGO_PATH)
    triggerFileDownload(badgePdf.blob, badgePdf.fileName, previewWindow)
  }

  const sendCommitteeCredentialsEmail = async (
    committeeUser: CommitteeUser,
    password: string,
  ) => {
    const emailjs = (await loadEmailJsModule()).default
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
    const templateId = import.meta.env.VITE_EMAILJS_COMMITTEE_TEMPLATE_ID?.trim()
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()

    if (!serviceId || !templateId || !publicKey) {
      const missingConfig = [
        !serviceId ? 'VITE_EMAILJS_SERVICE_ID' : '',
        !templateId ? 'VITE_EMAILJS_COMMITTEE_TEMPLATE_ID' : '',
        !publicKey ? 'VITE_EMAILJS_PUBLIC_KEY' : '',
      ].filter(Boolean)

      throw new Error(
        `Configuration EmailJS incomplète pour les comptes comité : ${missingConfig.join(', ')}.`,
      )
    }

    const checkInUrl = `${window.location.origin}/check_in`
    const templateParams = {
      to_name: committeeUser.name,
      to_email: committeeUser.email,
      committee_user_name: committeeUser.name,
      committee_login_email: committeeUser.email,
      committee_login_username: committeeUser.email,
      committee_login_password: password,
      check_in_url: checkInUrl,
      event_name: '3D Impact',
    }

    let lastError: unknown = null

    for (let attempt = 1; attempt <= EMAIL_SEND_MAX_ATTEMPTS; attempt += 1) {
      try {
        await emailjs.send(serviceId, templateId, templateParams, publicKey)
        return
      } catch (mailError) {
        lastError = mailError
        const canRetry =
          attempt < EMAIL_SEND_MAX_ATTEMPTS && shouldRetryEmailSend(mailError)

        if (!canRetry) {
          break
        }

        await wait(EMAIL_SEND_RETRY_DELAY_MS * attempt)
      }
    }

    throw new Error(
      `Email impossible pour ${committeeUser.name} (${committeeUser.email}) : ${getEmailJsErrorDetails(lastError)}.`,
    )
  }

  const sendCommitteeMemberQrEmail = async (committeeMember: CommitteeMember) => {
    const emailjs = (await loadEmailJsModule()).default
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
    const templateId =
      import.meta.env.VITE_EMAILJS_COMMITTEE_MEMBER_TEMPLATE_ID?.trim() ||
      import.meta.env.VITE_EMAILJS_COMMITTEE_TEMPLATE_ID?.trim()
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()

    if (!serviceId || !templateId || !publicKey) {
      const missingConfig = [
        !serviceId ? 'VITE_EMAILJS_SERVICE_ID' : '',
        !templateId
          ? 'VITE_EMAILJS_COMMITTEE_MEMBER_TEMPLATE_ID (ou VITE_EMAILJS_COMMITTEE_TEMPLATE_ID)'
          : '',
        !publicKey ? 'VITE_EMAILJS_PUBLIC_KEY' : '',
      ].filter(Boolean)

      throw new Error(
        `Configuration EmailJS incomplète pour les QR comité : ${missingConfig.join(', ')}.`,
      )
    }

    const qrCodeDataUrl = await buildCommitteeMemberQrDataUrl(committeeMember.id)
    const badgeProfile = getCommitteeBadgeProfile(committeeMember.badgeType)
    const templateParams = {
      to_name: `${committeeMember.firstName} ${committeeMember.lastName}`.trim(),
      to_email: committeeMember.email,
      committee_member_name: `${committeeMember.firstName} ${committeeMember.lastName}`.trim(),
      committee_member_first_name: committeeMember.firstName,
      committee_member_last_name: committeeMember.lastName,
      committee_member_email: committeeMember.email,
      committee_member_phone: committeeMember.phone,
      committee_member_qr_image: qrCodeDataUrl,
      committee_member_qr_value: buildCommitteeMemberQrValue(committeeMember.id),
      event_name: '3D Impact',
      committee_role_label: badgeProfile.label,
      committee_badge_name: badgeProfile.label,
      committee_badge_color: badgeProfile.color,
      committee_badge_text_color: badgeProfile.textColor,
      committee_badge_assignment_message: badgeProfile.assignmentMessage,
      committee_badge_type: committeeMember.badgeType,
    }

    let lastError: unknown = null

    for (let attempt = 1; attempt <= EMAIL_SEND_MAX_ATTEMPTS; attempt += 1) {
      try {
        await emailjs.send(serviceId, templateId, templateParams, publicKey)
        return
      } catch (mailError) {
        lastError = mailError
        const canRetry =
          attempt < EMAIL_SEND_MAX_ATTEMPTS && shouldRetryEmailSend(mailError)

        if (!canRetry) {
          break
        }

        await wait(EMAIL_SEND_RETRY_DELAY_MS * attempt)
      }
    }

    throw new Error(
      `Email QR comité impossible pour ${committeeMember.email} : ${getEmailJsErrorDetails(lastError)}.`,
    )
  }

  const sendProfessorEmail = async (professor: Professor) => {
    const emailjs = (await loadEmailJsModule()).default
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
    const templateId =
      import.meta.env.VITE_EMAILJS_PROFESSOR_TEMPLATE_ID?.trim() ||
      import.meta.env.VITE_EMAILJS_COMMITTEE_TEMPLATE_ID?.trim() ||
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim()
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()
    const logoUrl = buildAbsoluteAppUrl(EVENT_EMAIL_LOGO_PATH)

    if (!serviceId || !templateId || !publicKey) {
      const missingConfig = [
        !serviceId ? 'VITE_EMAILJS_SERVICE_ID' : '',
        !templateId
          ? 'VITE_EMAILJS_PROFESSOR_TEMPLATE_ID (ou un template EmailJS existant)'
          : '',
        !publicKey ? 'VITE_EMAILJS_PUBLIC_KEY' : '',
      ].filter(Boolean)

      throw new Error(
        `Configuration EmailJS incomplète pour les emails professeurs : ${missingConfig.join(', ')}.`,
      )
    }

    const templateParams = {
      to_name: professor.name,
      to_email: professor.primaryEmail,
      professor_name: professor.name,
      professor_email: professor.primaryEmail,
      professor_secondary_email: professor.secondaryEmail ?? '',
      event_name: '3D Impact',
      logo_url: logoUrl,
    }

    let lastError: unknown = null

    for (let attempt = 1; attempt <= EMAIL_SEND_MAX_ATTEMPTS; attempt += 1) {
      try {
        await emailjs.send(serviceId, templateId, templateParams, publicKey)
        return
      } catch (mailError) {
        lastError = mailError
        const canRetry =
          attempt < EMAIL_SEND_MAX_ATTEMPTS && shouldRetryEmailSend(mailError)

        if (!canRetry) {
          break
        }

        await wait(EMAIL_SEND_RETRY_DELAY_MS * attempt)
      }
    }

    throw new Error(
      `Email professeur impossible pour ${professor.name} (${professor.primaryEmail}) : ${getEmailJsErrorDetails(lastError)}.`,
    )
  }

  const sendBadgeEmail = async (
    participant: Participant,
    options: SendBadgeOptions = {},
  ): Promise<BadgeEmailStatus> => {
    const emailjs = (await loadEmailJsModule()).default
    const duplicate = options.duplicate ?? options.context === 'duplicate'
    const { bypassRateLimit = false } = options
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim()
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()

    if (!serviceId || !templateId || !publicKey) {
      const missingConfig = [
        !serviceId ? 'VITE_EMAILJS_SERVICE_ID' : '',
        !templateId ? 'VITE_EMAILJS_TEMPLATE_ID' : '',
        !publicKey ? 'VITE_EMAILJS_PUBLIC_KEY' : '',
      ].filter(Boolean)

      console.warn('EmailJS keys missing. Email not sent.')
      showPopup(
        duplicate
          ? `Cette inscription existe déjà, mais l'email de confirmation n'a pas pu être renvoyé car la configuration EmailJS est incomplète : ${missingConfig.join(', ')}.`
          : `Configuration EmailJS incomplète : ${missingConfig.join(', ')}.`,
        'error',
      )
      return 'failed'
    }

    if (!bypassRateLimit) {
      const allowance = reserveDeviceEmailSend()

      if (!allowance.allowed) {
        showPopup(getRateLimitMessage(allowance, duplicate), 'warning')
        return 'rate_limited'
      }
    }

    try {
      const qrCodeDataUrl = await buildQrCodeDataUrl(participant.id)
      const templateParams = {
        to_name: `${participant.firstName} ${participant.lastName}`,
        to_email: participant.email,
        ticket_id: participant.id,
        type: participant.type === 'internal' ? 'Etudiant/Interne' : 'Externe',
        participant_photo: '',
        has_photo: 'false',
        photo_section_style:
          'display:none !important; max-height:0; overflow:hidden; margin:0; padding:0;',
        photo_label_style: 'display:none !important;',
        photo_image_style:
          'display:none !important; width:0; height:0; border:0; margin:0 auto;',
        photo_section_html: '',
        qr_code_image: qrCodeDataUrl,
      }

      let lastError: unknown = null

      for (let attempt = 1; attempt <= EMAIL_SEND_MAX_ATTEMPTS; attempt += 1) {
        try {
          await emailjs.send(serviceId, templateId, templateParams, publicKey)
          return 'sent'
        } catch (mailError) {
          lastError = mailError
          const canRetry =
            attempt < EMAIL_SEND_MAX_ATTEMPTS && shouldRetryEmailSend(mailError)

          if (!canRetry) {
            break
          }

          await wait(EMAIL_SEND_RETRY_DELAY_MS * attempt)
        }
      }

      console.error('EmailJS Error:', lastError)
      showPopup(getEmailJsGuidanceMessage(lastError, duplicate), 'error')
      return 'failed'
    } catch (mailError) {
      console.error('Email preparation error:', mailError)
      showPopup(
        duplicate
          ? "Cette inscription existe déjà, mais une erreur technique a empêché le renvoi de l'email de confirmation."
          : "Une erreur technique a empêché la préparation de l'email de confirmation.",
        'error',
      )
      return 'failed'
    }
  }

  const handleRegister = async (data: RegistrationPayload) => {
    setIsSubmitting(true)

    try {
      const normalizedParticipant: RegistrationPayload = {
        ...data,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        photo: '',
      }

      const isAdminCredentials = await isAdminAccessAttempt(normalizedParticipant)

      if (isAdminCredentials) {

        setIsAdminAuthenticated(true)
        setIsCheckInAuthenticated(false)
        setCurrentUser(null)
        setCurrentPage('admin')
        return
      }

      if (isRegistrationClosed && !isEditingInfo) {
        showPopup(REGISTRATION_CLOSED_MESSAGE, 'warning')
        return
      }

      if (
        !normalizedParticipant.firstName ||
        !normalizedParticipant.lastName ||
        !normalizedParticipant.email ||
        !normalizedParticipant.phone
      ) {
        showPopup(
          'Veuillez remplir tous les champs obligatoires pour une inscription participant.',
          'warning',
        )
        return
      }

      if (!EMAIL_PATTERN.test(normalizedParticipant.email)) {
        showPopup("Veuillez saisir une adresse email valide pour l'inscription.", 'warning')
        return
      }


      const currentRegistrants = registrantsRef.current
      const currentCommitteeMembers = committeeMembersRef.current
      const normalizedEmail = normalizeEmail(normalizedParticipant.email)
      const normalizedPhone = normalizePhone(normalizedParticipant.phone)

      const emailMatch =
        currentRegistrants.find(
          (participant) => normalizeEmail(participant.email) === normalizedEmail && (!isEditingInfo || participant.id !== currentUser?.id),
        ) ?? null

      const phoneMatch =
        normalizedPhone
          ? (currentRegistrants.find(
              (participant) => normalizePhone(participant.phone) === normalizedPhone && (!isEditingInfo || participant.id !== currentUser?.id),
            ) ?? null)
          : null

      const committeeEmailMatch =
        currentCommitteeMembers.find((member) => normalizeEmail(member.email) === normalizedEmail) ??
        null
      const committeePhoneMatch =
        normalizedPhone
          ? (currentCommitteeMembers.find(
              (member) => normalizePhone(member.phone) === normalizedPhone,
            ) ?? null)
          : null

      if (committeeEmailMatch || committeePhoneMatch) {
        showPopup(
          "Cette adresse email ou ce numero de telephone est deja utilise par un membre du comite. Un participant ne peut pas aussi faire partie du comite.",
          'warning',
        )
        return
      }

      if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
        showPopup(
          "Cette adresse email et ce numéro de téléphone correspondent déjà à deux inscriptions différentes. Merci de contacter l'équipe organisatrice.",
          'warning',
        )
        return
      }

      const existingParticipant = emailMatch ?? phoneMatch

      if (existingParticipant) {
        const duplicateType: DuplicateMatchType =
          emailMatch && phoneMatch ? 'email_phone' : emailMatch ? 'email' : 'phone'

        setCurrentUser(existingParticipant)
        setSuccessMode('duplicate')
        setBadgeEmailStatus('idle')
        setDuplicateMatchType(duplicateType)
        setCurrentPage('success')
        return
      }

      const nowIso = new Date().toISOString()
      const newParticipant: Participant =
        isEditingInfo && currentUser
          ? {
              ...currentUser,
              ...normalizedParticipant,
              ...resolveUpdatedParticipantConfirmation(
                currentUser,
                normalizedParticipant.type,
                nowIso,
              ),
              type: normalizedParticipant.type,
              checkedInAt: currentUser.checkedInAt,
            }
          : {
              ...normalizedParticipant,
              id: createTicketId(new Set(currentRegistrants.map((participant) => participant.id))),
              createdAt: nowIso,
              isConfirmed: true,
              confirmedAt: nowIso,
              checkedInAt: null,
            }

      let emailStatus: BadgeEmailStatus = 'idle'
      emailStatus = await sendBadgeEmail(newParticipant, { context: 'registration' })

      if (emailStatus === 'rate_limited') {
        return
      }

      if (isEditingInfo && currentUser) {
        commitRegistrants(currentRegistrants.map(p => p.id === currentUser.id ? newParticipant : p))
        setSuccessMode('updated')
        setIsEditingInfo(false)
      } else {
        commitRegistrants([...currentRegistrants, newParticipant])
        setSuccessMode('created')
      }
      setCurrentUser(newParticipant)
      setBadgeEmailStatus(emailStatus)
      setDuplicateMatchType('email')
      setCurrentPage('success')
    } catch (error) {
      console.error("Erreur critique d'inscription :", error)
      showPopup(
        getErrorMessage(error, 'Une erreur technique est survenue. Veuillez réessayer.'),
        'error',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCheckInLogin = async (credentials: CheckInCredentials) => {

    setIsCheckInLoggingIn(true)

    try {
      const normalizedUsername = credentials.username.trim()
      const normalizedLowerUsername = normalizedUsername.toLowerCase()


      if (normalizedLowerUsername === CHECK_IN_ADMIN_USERNAME) {
        if (!isValidCheckInAdminPassword(credentials.password)) {
          showPopup('Connexion admin impossible avec ces identifiants.', 'error')
          return false
        }

        setIsAdminAuthenticated(true)
        setIsCheckInAuthenticated(true)
        setCurrentPage('admin')
        showPopup('Connexion admin check-in ouverte.', 'success')
        return true
      }

      const currentCommitteeUsers = committeeUsersRef.current
      const matchingCommitteeUser = currentCommitteeUsers.find(
        (user) =>
          user.isActive && user.email.trim().toLowerCase() === normalizedLowerUsername,
      )

      if (isValidLocalCommitteeFallbackLogin(normalizedLowerUsername, credentials.password)) {
        setIsAdminAuthenticated(false)
        setIsCheckInAuthenticated(true)
        showPopup('Connexion check-in ouverte.', 'success')
        return true
      }

      if (!matchingCommitteeUser?.passwordHash) {
        showPopup('Connexion comité impossible avec ces identifiants.', 'error')
        return false
      }

      const passwordHash = await hashText(credentials.password)

      if (matchingCommitteeUser.passwordHash !== passwordHash) {
        showPopup('Connexion comité impossible avec ces identifiants.', 'error')
        return false
      }

      const nowIso = new Date().toISOString()
      commitCommitteeUsers(
        currentCommitteeUsers.map((user) =>
          user.id === matchingCommitteeUser.id ? { ...user, lastLoginAt: nowIso } : user,
        ),
      )
      setIsAdminAuthenticated(false)
      setIsCheckInAuthenticated(true)
      showPopup('Connexion check-in ouverte.', 'success')
      return true
    } finally {
      setIsCheckInLoggingIn(false)
    }
  }

  const handleCheckInSearch = async (mode: CheckInSearchMode, query: string) => {
    const trimmedQuery = query.trim()


    const participants = registrantsRef.current

    const participant =
      mode === 'ticket'
        ? participants.find(
            (item) => item.id.trim().toUpperCase() === trimmedQuery.trim().toUpperCase(),
          ) ?? null
        : participants.find((item) => {
            const normalizedQuery = trimmedQuery.includes('@')
              ? normalizeEmail(trimmedQuery)
              : normalizePhone(trimmedQuery)

            if (trimmedQuery.includes('@')) {
              return normalizeEmail(item.email) === normalizedQuery
            }

            return normalizePhone(item.phone) === normalizedQuery
          }) ?? null

    if (!participant) {
      return { found: false }
    }

    const canRecordPresence = true

    if (!canRecordPresence) {
      return { found: true, participant, presenceRecorded: false, alreadyPresent: false }
    }

    if (participant.checkedInAt) {
      return { found: true, participant, presenceRecorded: false, alreadyPresent: true }
    }

    ensureLocalCapacityAvailableForNewPresence()

    const updatedParticipant: Participant = {
      ...participant,
      checkedInAt: new Date().toISOString(),
    }

    commitRegistrants(
      participants.map((item) => (item.id === updatedParticipant.id ? updatedParticipant : item)),
    )

    return { found: true, participant: updatedParticipant, presenceRecorded: true, alreadyPresent: false }
  }

  const handleAdminPresenceLookup = async (
    mode: AdminPresenceLookupMode,
    query: string,
  ): Promise<AdminPresenceLookupResult> => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return { found: false }
    }


    const currentCommitteeMembers = committeeMembersRef.current
    const currentRegistrants = registrantsRef.current

    if (mode === 'contact') {
      const isEmailQuery = trimmedQuery.includes('@')
      const normalizedContact = isEmailQuery
        ? normalizeEmail(trimmedQuery)
        : normalizePhone(trimmedQuery)
      const matchingCommitteeMember =
        currentCommitteeMembers.find((member) =>
          isEmailQuery
            ? normalizeEmail(member.email) === normalizedContact
            : normalizePhone(member.phone) === normalizedContact,
        ) ?? null
      const matchingParticipant =
        currentRegistrants.find((participant) =>
          isEmailQuery
            ? normalizeEmail(participant.email) === normalizedContact
            : normalizePhone(participant.phone) === normalizedContact,
        ) ?? null

      if (matchingCommitteeMember && matchingParticipant) {
        throw new Error(
          'Ce contact correspond a la fois a un participant et a un membre du comite. Corrigez les donnees avant de marquer la presence.',
        )
      }

      if (matchingCommitteeMember) {
        if (matchingCommitteeMember.checkedInAt) {
          return {
            found: true,
            entityType: 'committee_member',
            committeeMember: matchingCommitteeMember,
            presenceRecorded: false,
            alreadyPresent: true,
          }
        }

        ensureLocalCapacityAvailableForNewPresence()

        const updatedMember: CommitteeMember = {
          ...matchingCommitteeMember,
          checkedInAt: new Date().toISOString(),
        }

        commitCommitteeMembers(
          currentCommitteeMembers.map((member) =>
            member.id === updatedMember.id ? updatedMember : member,
          ),
        )

        return {
          found: true,
          entityType: 'committee_member',
          committeeMember: updatedMember,
          presenceRecorded: true,
          alreadyPresent: false,
        }
      }

      if (matchingParticipant) {
        if (matchingParticipant.checkedInAt) {
          return {
            found: true,
            entityType: 'participant',
            participant: matchingParticipant,
            presenceRecorded: false,
            alreadyPresent: true,
          }
        }

        ensureLocalCapacityAvailableForNewPresence()

        const updatedParticipant: Participant = {
          ...matchingParticipant,
          checkedInAt: new Date().toISOString(),
        }

        commitRegistrants(
          currentRegistrants.map((participant) =>
            participant.id === updatedParticipant.id ? updatedParticipant : participant,
          ),
        )

        return {
          found: true,
          entityType: 'participant',
          participant: updatedParticipant,
          presenceRecorded: true,
          alreadyPresent: false,
        }
      }

      return { found: false }
    }

    const normalizedQrValue = trimmedQuery.toUpperCase()
    const matchingCommitteeMember =
      isCommitteeQrPayload(trimmedQuery) || /^[A-F0-9]{16}$/i.test(trimmedQuery)
        ? (currentCommitteeMembers.find(
            (member) =>
              buildCommitteeMemberQrValue(member.id).toUpperCase() === normalizedQrValue ||
              member.id.toUpperCase() === normalizedQrValue,
          ) ?? null)
        : null

    if (matchingCommitteeMember) {
      if (matchingCommitteeMember.checkedInAt) {
        return {
          found: true,
          entityType: 'committee_member',
          committeeMember: matchingCommitteeMember,
          presenceRecorded: false,
          alreadyPresent: true,
        }
      }

      ensureLocalCapacityAvailableForNewPresence()

      const updatedMember: CommitteeMember = {
        ...matchingCommitteeMember,
        checkedInAt: new Date().toISOString(),
      }

      commitCommitteeMembers(
        currentCommitteeMembers.map((member) =>
          member.id === updatedMember.id ? updatedMember : member,
        ),
      )

      return {
        found: true,
        entityType: 'committee_member',
        committeeMember: updatedMember,
        presenceRecorded: true,
        alreadyPresent: false,
      }
    }

    const matchingParticipant =
      currentRegistrants.find(
        (participant) => participant.id.trim().toUpperCase() === normalizedQrValue,
      ) ?? null

    if (!matchingParticipant) {
      return { found: false }
    }

    if (matchingParticipant.checkedInAt) {
      return {
        found: true,
        entityType: 'participant',
        participant: matchingParticipant,
        presenceRecorded: false,
        alreadyPresent: true,
      }
    }

    ensureLocalCapacityAvailableForNewPresence()

    const updatedParticipant: Participant = {
      ...matchingParticipant,
      checkedInAt: new Date().toISOString(),
    }

    commitRegistrants(
      currentRegistrants.map((participant) =>
        participant.id === updatedParticipant.id ? updatedParticipant : participant,
      ),
    )

    return {
      found: true,
      entityType: 'participant',
      participant: updatedParticipant,
      presenceRecorded: true,
      alreadyPresent: false,
    }
  }

  const handleResendBadge = async () => {
    if (!currentUser || successMode !== 'duplicate') {
      return
    }

    if (!canReceiveBadge(currentUser)) {
      showPopup(
        "Ce participant externe doit d'abord être confirmé par l'admin avant l'envoi de l'email de confirmation.",
        'warning',
      )
      return
    }

    setIsResendingBadge(true)

    try {
      const emailStatus = await sendBadgeEmail(currentUser, { context: 'duplicate' })
      setBadgeEmailStatus(emailStatus)
    } finally {
      setIsResendingBadge(false)
    }
  }

  const handleDownloadCurrentBadge = async () => {
    if (!currentUser) {
      return
    }

    if (!canReceiveBadge(currentUser)) {
      showPopup(
        "Ce participant externe doit d'abord être confirmé par l'admin avant le téléchargement du badge PDF.",
        'warning',
      )
      return
    }

    setIsDownloadingCurrentBadge(true)
    const previewWindow = openPdfPreviewWindow()

    try {
      await downloadBadgePdf(currentUser, previewWindow)

      if (previewWindow) {
        showPopup(
          "Sur téléphone, le badge PDF s'ouvre dans un nouvel onglet. Vous pourrez ensuite l'enregistrer depuis le navigateur.",
          'info',
        )
      }
    } catch (error) {
      console.error('Téléchargement du badge PDF impossible :', error)
      previewWindow?.close()
      showPopup('Impossible de générer le badge PDF pour le moment.', 'error')
    } finally {
      setIsDownloadingCurrentBadge(false)
    }
  }

  const handleConfirmExternalParticipant = async (participantId: string) => {
    const currentRegistrants = registrantsRef.current
    const participant = currentRegistrants.find((item) => item.id === participantId)

    if (!participant || participant.type !== 'external' || participant.isConfirmed) {
      return
    }

    if (
      confirmingParticipantIdsRef.current.has(participantId) ||
      sendingBadgeParticipantIdsRef.current.has(participantId)
    ) {
      return
    }

    confirmingParticipantIdsRef.current.add(participantId)

    const confirmedParticipant: Participant = {
      ...participant,
      isConfirmed: true,
      confirmedAt: new Date().toISOString(),
    }

    setConfirmingParticipantIds((previousIds) =>
      previousIds.includes(participantId) ? previousIds : [...previousIds, participantId],
    )

    try {

      commitRegistrants(
        currentRegistrants.map((item) => (item.id === participantId ? confirmedParticipant : item)),
      )

      const emailStatus = await sendBadgeEmail(confirmedParticipant, {
        context: 'admin',
        bypassRateLimit: true,
      })

      if (emailStatus === 'sent') {
        showPopup("Participant externe confirmé. L'email de confirmation a été envoyé.", 'success')
      } else {
        showPopup(
          "Participant confirmé, mais l'email de confirmation n'a pas pu être envoyé automatiquement. Vous pourrez le renvoyer plus tard.",
          'warning',
        )
      }
    } catch (error) {
      console.error('Confirmation externe impossible :', error)
      showPopup(
        getErrorMessage(error, "Impossible de confirmer ce participant pour le moment."),
        'error',
      )
    } finally {
      confirmingParticipantIdsRef.current.delete(participantId)
      setConfirmingParticipantIds((previousIds) =>
        previousIds.filter((id) => id !== participantId),
      )
    }
  }

  const handleAdminSendBadge = async (participantId: string) => {
    const participant = registrantsRef.current.find((item) => item.id === participantId)

    if (!participant) {
      showPopup('Impossible de retrouver cette inscription dans la liste actuelle.', 'warning')
      return
    }

    if (!canReceiveBadge(participant)) {
      showPopup(
        "Ce participant externe doit d'abord être confirmé avant l'envoi ou le renvoi de l'email de confirmation.",
        'warning',
      )
      return
    }

    if (
      sendingBadgeParticipantIdsRef.current.has(participantId) ||
      confirmingParticipantIdsRef.current.has(participantId)
    ) {
      return
    }

    sendingBadgeParticipantIdsRef.current.add(participantId)
    setSendingBadgeParticipantIds((previousIds) =>
      previousIds.includes(participantId) ? previousIds : [...previousIds, participantId],
    )

    try {
      const emailStatus = await sendBadgeEmail(participant, {
        context: 'admin',
        bypassRateLimit: true,
      })

      if (emailStatus === 'sent') {
        showPopup(
          `L'email de confirmation de ${participant.firstName} ${participant.lastName} a été envoyé.`,
          'success',
        )
      } else {
        showPopup(
          `L'email de confirmation de ${participant.firstName} ${participant.lastName} n'a pas pu être envoyé automatiquement. Vous pouvez réessayer.`,
          'warning',
        )
      }
    } finally {
      sendingBadgeParticipantIdsRef.current.delete(participantId)
      setSendingBadgeParticipantIds((previousIds) =>
        previousIds.filter((id) => id !== participantId),
      )
    }
  }

  const handleAdminDownloadBadge = async (participantId: string) => {
    const participant = registrantsRef.current.find((item) => item.id === participantId)

    if (!participant) {
      showPopup('Impossible de retrouver cette inscription dans la liste actuelle.', 'warning')
      return
    }

    if (!canReceiveBadge(participant)) {
      showPopup(
        "Ce participant externe doit d'abord être confirmé avant le téléchargement du badge PDF.",
        'warning',
      )
      return
    }

    if (downloadingBadgeParticipantIdsRef.current.has(participantId)) {
      return
    }

    downloadingBadgeParticipantIdsRef.current.add(participantId)
    setDownloadingBadgeParticipantIds((previousIds) =>
      previousIds.includes(participantId) ? previousIds : [...previousIds, participantId],
    )
    const previewWindow = openPdfPreviewWindow()

    try {
      await downloadBadgePdf(participant, previewWindow)

      if (previewWindow) {
        showPopup(
          `Le badge PDF de ${participant.firstName} ${participant.lastName} s'est ouvert dans un nouvel onglet pour enregistrement mobile.`,
          'info',
        )
      }
    } catch (error) {
      console.error('Téléchargement admin du badge PDF impossible :', error)
      previewWindow?.close()
      showPopup(
        `Impossible de générer le badge PDF de ${participant.firstName} ${participant.lastName}.`,
        'error',
      )
    } finally {
      downloadingBadgeParticipantIdsRef.current.delete(participantId)
      setDownloadingBadgeParticipantIds((previousIds) =>
        previousIds.filter((id) => id !== participantId),
      )
    }
  }

  const handleDeleteParticipant = async (
    participantId: string,
    password: string,
  ): Promise<DeleteParticipantResult> => {
    if (
      confirmingParticipantIdsRef.current.has(participantId) ||
      sendingBadgeParticipantIdsRef.current.has(participantId)
    ) {
      return 'busy'
    }


    const hasValidPassword = await verifyAdminDeletionPassword(password)

    if (!hasValidPassword) {
      return 'invalid_password'
    }

    const currentRegistrants = registrantsRef.current
    const participantToDelete = currentRegistrants.find(
      (participant) => participant.id === participantId,
    )

    if (!participantToDelete) {
      showPopup('Impossible de retrouver cette inscription dans la liste actuelle.', 'warning')
      return 'not_found'
    }

    commitRegistrants(currentRegistrants.filter((participant) => participant.id !== participantId))
    confirmingParticipantIdsRef.current.delete(participantId)
    setConfirmingParticipantIds((previousIds) => previousIds.filter((id) => id !== participantId))
    sendingBadgeParticipantIdsRef.current.delete(participantId)
    setSendingBadgeParticipantIds((previousIds) =>
      previousIds.filter((id) => id !== participantId),
    )
    showPopup(
      `L'inscription de ${participantToDelete.firstName} ${participantToDelete.lastName} a été supprimée.`,
      'success',
    )

    return 'deleted'
  }

  const handleExternalTicketPriceChange = async (price: number) => {

    setExternalTicketPrice(price)
  }

  const handleRegistrationClosureChange = async (closed: boolean) => {

    setIsRegistrationClosed(closed)
  }

  const handleMaxInsideCapacityChange = async (nextCapacity: number | null) => {

    setMaxInsideCapacity(nextCapacity)
  }

  const handleCreateCommitteeUser = async (payload: {
    name: string
    email: string
  }) => {
    const normalizedEmail = normalizeEmail(payload.email)
    const generatedPassword = generateCommitteePassword()
    const sourceCommitteeMember = committeeMembersRef.current.find(
      (member) => normalizeEmail(member.email) === normalizedEmail,
    )

    if (!payload.name.trim() || !normalizedEmail) {
      throw new Error('Nom et email sont obligatoires.')
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new Error('Veuillez saisir une adresse email valide.')
    }

    if (!sourceCommitteeMember) {
      throw new Error(
        'Un compte check-in doit être créé à partir d’un membre du comité existant.',
      )
    }


    const currentCommitteeUsers = committeeUsersRef.current

    if (currentCommitteeUsers.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
      throw new Error('Cette adresse email est déjà utilisée par un utilisateur comité.')
    }

    const nowIso = new Date().toISOString()
    const passwordHash = await hashText(generatedPassword)
    const newUser = {
      id: crypto.randomUUID(),
      name: payload.name.trim(),
      email: normalizedEmail,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: null,
      passwordHash,
    }

    commitCommitteeUsers([newUser, ...currentCommitteeUsers])
    await sendCommitteeCredentialsEmail(newUser as CommitteeUser, generatedPassword).catch((err) => {
      console.error('Email de création comité échoué en local:', err)
    })
  }

  const handleUpdateCommitteeUser = async (payload: {
    userId: string
    name: string
    email: string
    password?: string
  }) => {
    const normalizedEmail = normalizeEmail(payload.email)

    if (!payload.userId || !payload.name.trim() || !normalizedEmail) {
      throw new Error('Nom et email sont obligatoires.')
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new Error('Veuillez saisir une adresse email valide.')
    }


    const currentCommitteeUsers = committeeUsersRef.current
    const emailOwner = currentCommitteeUsers.find(
      (user) => normalizeEmail(user.email) === normalizedEmail,
    )

    if (emailOwner && emailOwner.id !== payload.userId) {
      throw new Error('Cette adresse email est déjà utilisée par un autre utilisateur comité.')
    }

    const nextUsers = await Promise.all(
      currentCommitteeUsers.map(async (user) => {
        if (user.id !== payload.userId) {
          return user
        }

        return {
          ...user,
          name: payload.name.trim(),
          email: normalizedEmail,
          updatedAt: new Date().toISOString(),
          passwordHash:
            payload.password?.trim() ? await hashText(payload.password.trim()) : user.passwordHash,
        }
      }),
    )

    commitCommitteeUsers(nextUsers)
  }

  const handleSetCommitteeUserAccess = async (userId: string, isActive: boolean) => {
    if (!userId) {
      throw new Error('Utilisateur comité introuvable.')
    }


    const currentCommitteeUsers = committeeUsersRef.current
    const targetUser = currentCommitteeUsers.find((user) => user.id === userId)

    if (!targetUser) {
      throw new Error('Utilisateur comité introuvable.')
    }

    commitCommitteeUsers(
      currentCommitteeUsers.map((user) =>
        user.id === userId ? { ...user, isActive, updatedAt: new Date().toISOString() } : user,
      ),
    )
  }

  const handleDeleteCommitteeUser = async (userId: string) => {
    if (!userId) {
      throw new Error('Utilisateur comité introuvable.')
    }


    const currentCommitteeUsers = committeeUsersRef.current

    if (!currentCommitteeUsers.some((user) => user.id === userId)) {
      throw new Error('Utilisateur comité introuvable.')
    }

    commitCommitteeUsers(currentCommitteeUsers.filter((user) => user.id !== userId))
  }

  const handleCreateCommitteeMember = async (payload: CommitteeMemberImportRow) => {
    const firstName = payload.firstName.trim()
    const lastName = payload.lastName.trim()
    const email = normalizeEmail(payload.email)
    const phone = payload.phone.trim()
    const badgeType = normalizeCommitteeBadgeType(payload.badgeType)
    const normalizedPhone = normalizePhone(phone)

    if (!firstName || !lastName || !email) {
      throw new Error('Prénom, nom et email sont obligatoires.')
    }

    if (!EMAIL_PATTERN.test(email)) {
      throw new Error('Veuillez saisir une adresse email valide.')
    }


    const currentCommitteeMembers = committeeMembersRef.current

    if (currentCommitteeMembers.some((member) => normalizeEmail(member.email) === email)) {
      throw new Error('Cette adresse email est déjà utilisée par un membre comité.')
    }

    const currentRegistrants = registrantsRef.current

    if (
      normalizedPhone &&
      currentCommitteeMembers.some((member) => normalizePhone(member.phone) === normalizedPhone)
    ) {
      throw new Error('Ce numero de telephone est deja utilise par un membre du comite.')
    }

    if (currentRegistrants.some((participant) => normalizeEmail(participant.email) === email)) {
      throw new Error(
        "Cette adresse email est deja utilisee par un participant. Un membre du comite ne peut pas aussi etre participant.",
      )
    }

    if (
      normalizedPhone &&
      currentRegistrants.some(
        (participant) => normalizePhone(participant.phone) === normalizedPhone,
      )
    ) {
      throw new Error(
        "Ce numero de telephone est deja utilise par un participant. Un membre du comite ne peut pas aussi etre participant.",
      )
    }

    commitCommitteeMembers([
      {
        id: crypto.randomUUID(),
        firstName,
        lastName,
        email,
        phone,
        badgeType,
        createdAt: new Date().toISOString(),
        checkedInAt: null,
      },
      ...currentCommitteeMembers,
    ])
  }

  const handleImportCommitteeMembers = async (
    members: CommitteeMemberImportRow[],
  ): Promise<CommitteeMemberImportResult> => {
    const sanitizedMembers = members
      .map((member) => ({
        firstName: member.firstName.trim(),
        lastName: member.lastName.trim(),
        email: normalizeEmail(member.email),
        phone: member.phone.trim(),
        badgeType: normalizeCommitteeBadgeType(member.badgeType),
      }))
      .filter(
        (member) =>
          member.firstName &&
          member.lastName &&
          member.email &&
          EMAIL_PATTERN.test(member.email),
      )

    if (sanitizedMembers.length === 0) {
      throw new Error('Aucune ligne valide à importer dans le fichier comité.')
    }


    const currentCommitteeMembers = committeeMembersRef.current
    const currentRegistrants = registrantsRef.current
    const knownEmails = new Set(
      currentCommitteeMembers.map((member) => normalizeEmail(member.email)),
    )
    const knownPhones = new Set(
      currentCommitteeMembers
        .map((member) => normalizePhone(member.phone))
        .filter((phoneNumber) => phoneNumber !== ''),
    )
    const participantEmails = new Set(
      currentRegistrants.map((participant) => normalizeEmail(participant.email)),
    )
    const participantPhones = new Set(
      currentRegistrants
        .map((participant) => normalizePhone(participant.phone))
        .filter((phoneNumber) => phoneNumber !== ''),
    )
    const nextMembers = [...currentCommitteeMembers]
    let importedCount = 0
    let skippedCount = 0

    for (const member of sanitizedMembers) {
      const normalizedMemberPhone = normalizePhone(member.phone)

      if (knownEmails.has(member.email)) {
        skippedCount += 1
        continue
      }

      if (normalizedMemberPhone && knownPhones.has(normalizedMemberPhone)) {
        skippedCount += 1
        continue
      }

      if (participantEmails.has(member.email)) {
        skippedCount += 1
        continue
      }

      if (normalizedMemberPhone && participantPhones.has(normalizedMemberPhone)) {
        skippedCount += 1
        continue
      }

      knownEmails.add(member.email)
      if (normalizedMemberPhone) {
        knownPhones.add(normalizedMemberPhone)
      }
        nextMembers.unshift({
          id: crypto.randomUUID(),
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone,
          badgeType: member.badgeType,
          createdAt: new Date().toISOString(),
          checkedInAt: null,
        })
      importedCount += 1
    }

    commitCommitteeMembers(nextMembers)

    return { importedCount, skippedCount }
  }

  const handleImportCommitteeMembersFromCsv = async (rawCsv: string) =>
    handleImportCommitteeMembers(parseCommitteeImportCsv(rawCsv))

  const handleImportProfessors = async (
    professorsToImport: ProfessorImportRow[],
  ): Promise<ProfessorImportResult> => {
    const sanitizedProfessors = professorsToImport
      .map((professor) => ({
        name: professor.name.trim(),
        primaryEmail: normalizeEmail(professor.primaryEmail),
        secondaryEmail: normalizeEmail(professor.secondaryEmail),
      }))
      .filter(
        (professor) =>
          professor.name &&
          professor.primaryEmail &&
          EMAIL_PATTERN.test(professor.primaryEmail) &&
          (!professor.secondaryEmail || EMAIL_PATTERN.test(professor.secondaryEmail)),
      )
      .map((professor) => ({
        ...professor,
        secondaryEmail:
          professor.secondaryEmail && professor.secondaryEmail !== professor.primaryEmail
            ? professor.secondaryEmail
            : '',
      }))

    if (sanitizedProfessors.length === 0) {
      throw new Error('Aucune ligne valide à importer dans le fichier professeurs.')
    }


    const currentProfessors = professorsRef.current
    const knownEmails = new Set(
      currentProfessors.flatMap((professor) =>
        [professor.primaryEmail, professor.secondaryEmail ?? ''].filter(Boolean).map(normalizeEmail),
      ),
    )
    const nextProfessors = [...currentProfessors]
    let importedCount = 0
    let skippedCount = 0

    for (const professor of sanitizedProfessors) {
      const emails = [professor.primaryEmail, professor.secondaryEmail]
        .filter(Boolean)
        .map(normalizeEmail)

      if (emails.some((email) => knownEmails.has(email))) {
        skippedCount += 1
        continue
      }

      emails.forEach((email) => knownEmails.add(email))
      nextProfessors.unshift({
        id: crypto.randomUUID(),
        name: professor.name,
        primaryEmail: professor.primaryEmail,
        secondaryEmail: professor.secondaryEmail || null,
        createdAt: new Date().toISOString(),
      })
      importedCount += 1
    }

    commitProfessors(nextProfessors)

    return { importedCount, skippedCount }
  }

  const handleCreateProfessor = async (payload: {
    name: string
    primaryEmail: string
    secondaryEmail?: string
  }) => {
    const name = payload.name.trim()
    const primaryEmail = normalizeEmail(payload.primaryEmail)
    const secondaryEmail = normalizeEmail(payload.secondaryEmail ?? '')

    if (!name || !primaryEmail) {
      throw new Error('Nom et email principal requis.')
    }

    if (!EMAIL_PATTERN.test(primaryEmail)) {
      throw new Error('Veuillez saisir une adresse email principale valide.')
    }

    if (secondaryEmail && !EMAIL_PATTERN.test(secondaryEmail)) {
      throw new Error('Veuillez saisir une adresse email secondaire valide.')
    }

    const normalizedSecondaryEmail =
      secondaryEmail && secondaryEmail !== primaryEmail ? secondaryEmail : ''


    const currentProfessors = professorsRef.current
    const knownEmails = new Set(
      currentProfessors.flatMap((professor) =>
        [professor.primaryEmail, professor.secondaryEmail ?? ''].filter(Boolean).map(normalizeEmail),
      ),
    )

    if ([primaryEmail, normalizedSecondaryEmail].filter(Boolean).some((email) => knownEmails.has(email))) {
      throw new Error('Cette adresse email est déjà utilisée par un professeur.')
    }

    commitProfessors([
      {
        id: crypto.randomUUID(),
        name,
        primaryEmail,
        secondaryEmail: normalizedSecondaryEmail || null,
        createdAt: new Date().toISOString(),
      },
      ...currentProfessors,
    ])
  }

  const handleImportProfessorsFromCsv = async (rawCsv: string) =>
    handleImportProfessors(parseProfessorImportCsv(rawCsv))

  const handleDeleteProfessor = async (professorId: string) => {
    if (!professorId) {
      throw new Error('Professeur introuvable.')
    }


    const currentProfessors = professorsRef.current

    if (!currentProfessors.some((professor) => professor.id === professorId)) {
      throw new Error('Professeur introuvable.')
    }

    commitProfessors(currentProfessors.filter((professor) => professor.id !== professorId))
  }

  const handleSendProfessorEmails = async (
    professorIds: string[],
  ): Promise<ProfessorEmailDispatchResult> => {
    const uniqueProfessorIds = Array.from(new Set(professorIds.filter(Boolean)))

    if (uniqueProfessorIds.length === 0) {
      throw new Error('Sélectionnez au moins un professeur.')
    }

    const currentProfessors = professorsRef.current
    const targetProfessors = uniqueProfessorIds
      .map((professorId) => currentProfessors.find((professor) => professor.id === professorId))
      .filter((professor): professor is Professor => Boolean(professor))

    if (targetProfessors.length === 0) {
      throw new Error('Aucun professeur correspondant dans la sélection.')
    }

    const failedProfessors: Professor[] = []
    let sentCount = 0

    for (const professor of targetProfessors) {
      try {
        await sendProfessorEmail(professor)
        sentCount += 1
      } catch (error) {
        console.error(`Envoi email professeur impossible pour ${professor.primaryEmail} :`, error)
        failedProfessors.push(professor)
      }
    }

    return {
      sentCount,
      failedProfessors,
    }
  }

  const handleDeleteCommitteeMember = async (memberId: string) => {
    if (!memberId) {
      throw new Error('Membre comité introuvable.')
    }


    const currentCommitteeMembers = committeeMembersRef.current

    if (!currentCommitteeMembers.some((member) => member.id === memberId)) {
      throw new Error('Membre comité introuvable.')
    }

    commitCommitteeMembers(currentCommitteeMembers.filter((member) => member.id !== memberId))
  }

  const handleSetCommitteeMemberPresence = async (memberId: string, present: boolean) => {
    if (!memberId) {
      throw new Error('Membre comité introuvable.')
    }


    const currentCommitteeMembers = committeeMembersRef.current
    const targetMember = currentCommitteeMembers.find((member) => member.id === memberId)

    if (!targetMember) {
      throw new Error('Membre comité introuvable.')
    }

    if (present && targetMember.checkedInAt) {
      return
    }

    if (!present && !targetMember.checkedInAt) {
      return
    }

    if (present) {
      ensureLocalCapacityAvailableForNewPresence()
    }

    commitCommitteeMembers(
      currentCommitteeMembers.map((member) =>
        member.id === memberId
          ? {
              ...member,
              checkedInAt: present ? new Date().toISOString() : null,
            }
          : member,
      ),
    )
  }

  const handleSetParticipantPresence = async (participantId: string, present: boolean) => {
    if (!participantId) {
      throw new Error('Participant introuvable.')
    }


    const currentRegistrants = registrantsRef.current
    const targetParticipant = currentRegistrants.find((participant) => participant.id === participantId)

    if (!targetParticipant) {
      throw new Error('Participant introuvable.')
    }

    if (present && targetParticipant.checkedInAt) {
      return
    }

    if (!present && !targetParticipant.checkedInAt) {
      return
    }

    if (present) {
      ensureLocalCapacityAvailableForNewPresence()
    }

    commitRegistrants(
      currentRegistrants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              checkedInAt: present ? new Date().toISOString() : null,
            }
          : participant,
      ),
    )
  }

  const handleSendCommitteeMemberQrs = async (
    memberIds: string[],
  ): Promise<CommitteeQrDispatchResult> => {
    const uniqueMemberIds = Array.from(new Set(memberIds.filter(Boolean)))

    if (uniqueMemberIds.length === 0) {
      throw new Error('Sélectionnez au moins un membre comité.')
    }

    const currentCommitteeMembers = committeeMembersRef.current
    const targetMembers = uniqueMemberIds
      .map((memberId) => currentCommitteeMembers.find((member) => member.id === memberId))
      .filter((member): member is CommitteeMember => Boolean(member))

    if (targetMembers.length === 0) {
      throw new Error('Aucun membre comité correspondant dans la sélection.')
    }

    const failedMembers: CommitteeMember[] = []
    let sentCount = 0

    for (const member of targetMembers) {
      try {
        await sendCommitteeMemberQrEmail(member)
        sentCount += 1
      } catch (error) {
        console.error(`Envoi du QR comité impossible pour ${member.email} :`, error)
        failedMembers.push(member)
      }
    }

    return { sentCount, failedMembers }
  }

  const handleRegenerateCommitteePasswords = async (
    userIds: string[],
  ): Promise<CommitteePasswordRegenerationResult> => {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
    const templateId = import.meta.env.VITE_EMAILJS_COMMITTEE_TEMPLATE_ID?.trim()
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()

    if (uniqueUserIds.length === 0) {
      throw new Error('Sélectionnez au moins un utilisateur comité.')
    }

    if (!serviceId || !templateId || !publicKey) {
      const missingConfig = [
        !serviceId ? 'VITE_EMAILJS_SERVICE_ID' : '',
        !templateId ? 'VITE_EMAILJS_COMMITTEE_TEMPLATE_ID' : '',
        !publicKey ? 'VITE_EMAILJS_PUBLIC_KEY' : '',
      ].filter(Boolean)

      throw new Error(
        `Configuration EmailJS incomplète pour l'envoi des identifiants comité : ${missingConfig.join(', ')}.`,
      )
    }

    const currentCommitteeUsers = committeeUsersRef.current
    const targetUsers = uniqueUserIds
      .map((userId) => currentCommitteeUsers.find((user) => user.id === userId))
      .filter((user): user is CommitteeUser => Boolean(user))

    if (targetUsers.length === 0) {
      throw new Error('Aucun utilisateur comité correspondant dans la sélection.')
    }

    const failedUsers: CommitteeUser[] = []
    let updatedCount = 0

    for (const user of targetUsers) {
      const generatedPassword = generateCommitteePassword()

      try {
        await handleUpdateCommitteeUser({
          userId: user.id,
          name: user.name,
          email: user.email,
          password: generatedPassword,
        })
        await sendCommitteeCredentialsEmail(user, generatedPassword)
        updatedCount += 1
      } catch (error) {
        console.error(`Régénération du mot de passe impossible pour ${user.email} :`, error)
        failedUsers.push(user)
      }
    }

    return {
      updatedCount,
      failedUsers,
    }
  }

  const logoutAdmin = () => {

    setIsAdminAuthenticated(false)
    setIsCheckInAuthenticated(false)
    setCurrentUser(null)
    setCurrentPage('home')
  }

  const logoutCheckIn = () => {

    setIsAdminAuthenticated(false)
    setIsCheckInAuthenticated(false)
    setCurrentPage('home')
  }

  const openAdminFromCheckIn = () => {
    setCurrentPage('admin')
  }

  const isAdminView = currentPage === 'admin' && isAdminAuthenticated && routeMode === 'main'
  const isCheckInAdminView =
    routeMode === 'check_in' && currentPage === 'admin' && isAdminAuthenticated
  const isCheckInRoute = routeMode === 'check_in'
  const isJourJRoute = routeMode === 'jour_j'
  const usesDashboardLayout =
    isAdminView || isCheckInRoute || isCheckInAdminView || isJourJRoute
  const deferredViewFallback = (
    <div
      className="glass"
      style={{
        width: '100%',
        maxWidth: usesDashboardLayout ? '1280px' : '480px',
        margin: '0 auto',
        minHeight: usesDashboardLayout ? '240px' : '180px',
        padding: usesDashboardLayout ? '1.25rem' : '1.5rem',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontWeight: 600,
      }}
    >
      Chargement de l'interface...
    </div>
  )

  return (
    <div className="App">
      <main
        className={usesDashboardLayout ? 'app-main app-main-admin' : 'app-main'}
        style={{
          paddingTop: usesDashboardLayout ? '1.25rem' : '1.5rem',
          minHeight: 'calc(100vh - 4rem)',
          display: 'flex',
          alignItems: usesDashboardLayout ? 'stretch' : 'center',
          justifyContent: usesDashboardLayout ? 'flex-start' : 'center',
        }}
      >
        <Suspense fallback={deferredViewFallback}>
          {isJourJRoute ? (
          <JourJMonitor
            registrants={registrants}
            committeeMembers={committeeMembers}
            maxInsideCapacity={maxInsideCapacity}
            logo={EVENT_LOGO_PATH}
            onNotify={showPopup}
            isPublic
          />
        ) : isCheckInAdminView ? (
          <AdminPanel
            key="checkin-admin"
            registrants={registrants}
            committeeUsers={committeeUsers}
            committeeMembers={committeeMembers}
            professors={professors}
            externalTicketPrice={externalTicketPrice}
            maxInsideCapacity={maxInsideCapacity}
            isRegistrationClosed={isRegistrationClosed}
            onExternalTicketPriceChange={handleExternalTicketPriceChange}
            onMaxInsideCapacityChange={handleMaxInsideCapacityChange}
            onRegistrationClosureChange={handleRegistrationClosureChange}
            onConfirmExternalParticipant={handleConfirmExternalParticipant}
            confirmingParticipantIds={confirmingParticipantIds}
            onSendBadgeToParticipant={handleAdminSendBadge}
            sendingBadgeParticipantIds={sendingBadgeParticipantIds}
            onDownloadBadgeForParticipant={handleAdminDownloadBadge}
            downloadingBadgeParticipantIds={downloadingBadgeParticipantIds}
            onDeleteParticipant={handleDeleteParticipant}
            onSetParticipantPresence={handleSetParticipantPresence}
            onCreateCommitteeUser={handleCreateCommitteeUser}
            onUpdateCommitteeUser={handleUpdateCommitteeUser}
            onDeleteCommitteeUser={handleDeleteCommitteeUser}
            onSetCommitteeUserAccess={handleSetCommitteeUserAccess}

            onRegenerateCommitteePasswords={handleRegenerateCommitteePasswords}
            onCreateCommitteeMember={handleCreateCommitteeMember}
            onImportCommitteeCsv={handleImportCommitteeMembersFromCsv}
            onDeleteCommitteeMember={handleDeleteCommitteeMember}
            onSetCommitteeMemberPresence={handleSetCommitteeMemberPresence}
            onSendCommitteeMemberQrs={handleSendCommitteeMemberQrs}
            onImportProfessorsCsv={handleImportProfessorsFromCsv}
            onCreateProfessor={handleCreateProfessor}
            onDeleteProfessor={handleDeleteProfessor}
            onSendProfessorEmails={handleSendProfessorEmails}
            onAdminPresenceLookup={handleAdminPresenceLookup}
            logo={EVENT_LOGO_PATH}
            onNotify={showPopup}
            onLogout={logoutCheckIn}
          />
        ) : isCheckInRoute ? (
          <CheckInPage
            logo={EVENT_LOGO_PATH}
            isAuthenticated={isCheckInAuthenticated}
            canOpenAdminSpace={isAdminAuthenticated}
            isLoggingIn={isCheckInLoggingIn}
            onLogin={handleCheckInLogin}
            onLogout={logoutCheckIn}
            onOpenAdminSpace={openAdminFromCheckIn}
            onSearch={handleCheckInSearch}
            onNotify={showPopup}
          />
        ) : isAdminView ? (
          <AdminPanel
            key="admin"
            registrants={registrants}
            committeeUsers={committeeUsers}
            committeeMembers={committeeMembers}
            professors={professors}
            externalTicketPrice={externalTicketPrice}
            maxInsideCapacity={maxInsideCapacity}
            isRegistrationClosed={isRegistrationClosed}
            onExternalTicketPriceChange={handleExternalTicketPriceChange}
            onMaxInsideCapacityChange={handleMaxInsideCapacityChange}
            onRegistrationClosureChange={handleRegistrationClosureChange}
            onConfirmExternalParticipant={handleConfirmExternalParticipant}
            confirmingParticipantIds={confirmingParticipantIds}
            onSendBadgeToParticipant={handleAdminSendBadge}
            sendingBadgeParticipantIds={sendingBadgeParticipantIds}
            onDownloadBadgeForParticipant={handleAdminDownloadBadge}
            downloadingBadgeParticipantIds={downloadingBadgeParticipantIds}
            onDeleteParticipant={handleDeleteParticipant}
            onSetParticipantPresence={handleSetParticipantPresence}
            onCreateCommitteeUser={handleCreateCommitteeUser}
            onUpdateCommitteeUser={handleUpdateCommitteeUser}
            onDeleteCommitteeUser={handleDeleteCommitteeUser}
            onSetCommitteeUserAccess={handleSetCommitteeUserAccess}
            onRegenerateCommitteePasswords={handleRegenerateCommitteePasswords}
            onCreateCommitteeMember={handleCreateCommitteeMember}
            onImportCommitteeCsv={handleImportCommitteeMembersFromCsv}
            onDeleteCommitteeMember={handleDeleteCommitteeMember}
            onSetCommitteeMemberPresence={handleSetCommitteeMemberPresence}
            onSendCommitteeMemberQrs={handleSendCommitteeMemberQrs}
            onImportProfessorsCsv={handleImportProfessorsFromCsv}
            onCreateProfessor={handleCreateProfessor}
            onDeleteProfessor={handleDeleteProfessor}
            onSendProfessorEmails={handleSendProfessorEmails}
            onAdminPresenceLookup={handleAdminPresenceLookup}
            logo={EVENT_LOGO_PATH}
            onNotify={showPopup}
            onLogout={logoutAdmin}
          />
          ) : (
            <AnimatePresence mode="wait">
              {currentPage === 'home' && (
                <RegistrationForm
                  key="form"
                  onRegister={handleRegister}
                  initialData={isEditingInfo ? currentUser : null}
                  isEditing={isEditingInfo}
                  isSubmitting={isSubmitting}
                  isRegistrationClosed={isRegistrationClosed}
                  registrationClosedMessage={REGISTRATION_CLOSED_MESSAGE}
                  logo={EVENT_LOGO_PATH}
                />
              )}

              {currentPage === 'success' && currentUser && (
                <SuccessPage
                  key="success"
                  user={currentUser}
                  mode={successMode}
                  badgeEmailStatus={badgeEmailStatus}
                  duplicateMatchType={duplicateMatchType}
                  externalTicketPrice={externalTicketPrice}
                  isResendingBadge={isResendingBadge}
                  isDownloadingBadge={isDownloadingCurrentBadge}
                  onClose={() => setCurrentPage('home')}
                  onResendBadge={handleResendBadge}
                  onDownloadBadge={handleDownloadCurrentBadge}
                  onEditInfo={() => {
                    setIsEditingInfo(true)
                    setCurrentPage('home')
                  }}
                />
              )}
            </AnimatePresence>
          )}
        </Suspense>
      </main>

      <InAppPopup items={popups} onDismiss={dismissPopup} />

      <footer
        style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          marginTop: '4rem',
        }}
      >
        © 2026 3D Impact - 3D impact in Action.
      </footer>
    </div>
  )
}

export default App
