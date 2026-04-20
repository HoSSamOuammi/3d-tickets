import React, { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  GraduationCap,
  Loader2,
  LogOut,
  MailCheck,
  Pencil,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import type {
  AdminPresenceLookupResult,
  CommitteeMember,
  CommitteeUser,
  Participant,
  Professor,
} from '../types'
import type { PopupTone } from './InAppPopup'
import AdminPresenceManager from './AdminPresenceManager'
import CommitteeMembersManager from './CommitteeMembersManager'
import JourJMonitor from './JourJMonitor'
import ProfessorsManager from './ProfessorsManager'

type AdminTab =
  | 'dashboard'
  | 'participants'
  | 'jour_j'
  | 'presence'
  | 'committee_members'
  | 'professors'
  | 'checkin_accounts'
  | 'settings'

interface AdminPanelProps {
  dataMode: 'checking' | 'local' | 'remote'
  registrants: Participant[]
  committeeUsers: CommitteeUser[]
  committeeMembers: CommitteeMember[]
  professors: Professor[]
  externalTicketPrice: number
  maxInsideCapacity: number | null
  isRegistrationClosed: boolean
  onExternalTicketPriceChange: (price: number) => void | Promise<void>
  onMaxInsideCapacityChange: (capacity: number | null) => void | Promise<void>
  onRegistrationClosureChange: (isClosed: boolean) => void | Promise<void>
  onConfirmExternalParticipant: (participantId: string) => Promise<void>
  onSendBadgeToParticipant: (participantId: string) => Promise<void>
  onDownloadBadgeForParticipant: (participantId: string) => Promise<void>
  onDeleteParticipant: (
    participantId: string,
    password: string,
  ) => Promise<'deleted' | 'invalid_password' | 'not_found' | 'busy'>
  onSetParticipantPresence: (participantId: string, present: boolean) => Promise<void>
  onCreateCommitteeUser: (payload: {
    name: string
    email: string
  }) => Promise<void>
  onUpdateCommitteeUser: (payload: {
    userId: string
    name: string
    email: string
    password?: string
  }) => Promise<void>
  onDeleteCommitteeUser: (userId: string) => Promise<void>
  onSetCommitteeUserAccess: (userId: string, isActive: boolean) => Promise<void>
  onRegenerateCommitteePasswords: (userIds: string[]) => Promise<{
    updatedCount: number
    failedUsers: CommitteeUser[]
  }>
  onCreateCommitteeMember: (payload: {
    firstName: string
    lastName: string
    email: string
    phone: string
    badgeType: 'committee' | 'ensatpress'
  }) => Promise<void>
  onImportCommitteeCsv: (rawCsv: string) => Promise<{
    importedCount: number
    skippedCount: number
  }>
  onDeleteCommitteeMember: (memberId: string) => Promise<void>
  onSetCommitteeMemberPresence: (memberId: string, present: boolean) => Promise<void>
  onSendCommitteeMemberQrs: (memberIds: string[]) => Promise<{
    sentCount: number
    failedMembers: CommitteeMember[]
  }>
  onImportProfessorsCsv: (rawCsv: string) => Promise<{
    importedCount: number
    skippedCount: number
  }>
  onCreateProfessor: (payload: {
    name: string
    primaryEmail: string
    secondaryEmail?: string
  }) => Promise<void>
  onDeleteProfessor: (professorId: string) => Promise<void>
  onSendProfessorEmails: (professorIds: string[]) => Promise<{
    sentCount: number
    failedProfessors: Professor[]
  }>
  onAdminPresenceLookup: (
    mode: 'qr' | 'contact',
    query: string,
  ) => Promise<AdminPresenceLookupResult>
  confirmingParticipantIds: string[]
  sendingBadgeParticipantIds: string[]
  downloadingBadgeParticipantIds: string[]
  logo: string
  onNotify: (message: string, tone?: PopupTone) => void
  onLogout: () => void
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Jamais'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Inconnue'
  }

  return parsedDate.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const formatDate = (value: string) => {
  if (value === '1970-01-01T00:00:00.000Z') {
    return 'Ancienne donnée'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Inconnue'
  }

  return parsedDate.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const normalizeEmailValue = (value: string) => value.trim().toLowerCase()

const AdminPanel: React.FC<AdminPanelProps> = ({
  dataMode,
  registrants,
  committeeUsers,
  committeeMembers,
  professors,
  externalTicketPrice,
  maxInsideCapacity,
  isRegistrationClosed,
  onExternalTicketPriceChange,
  onMaxInsideCapacityChange,
  onRegistrationClosureChange,
  onSendBadgeToParticipant,
  onDownloadBadgeForParticipant,
  onDeleteParticipant,
  onSetParticipantPresence,
  onCreateCommitteeUser,
  onUpdateCommitteeUser,
  onDeleteCommitteeUser,
  onSetCommitteeUserAccess,
  onRegenerateCommitteePasswords,
  onCreateCommitteeMember,
  onImportCommitteeCsv,
  onDeleteCommitteeMember,
  onSetCommitteeMemberPresence,
  onSendCommitteeMemberQrs,
  onImportProfessorsCsv,
  onCreateProfessor,
  onDeleteProfessor,
  onSendProfessorEmails,
  onAdminPresenceLookup,
  confirmingParticipantIds,
  sendingBadgeParticipantIds,
  downloadingBadgeParticipantIds,
  logo,
  onNotify,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [ticketPriceDraft, setTicketPriceDraft] = useState(String(externalTicketPrice))
  const [maxInsideCapacityDraft, setMaxInsideCapacityDraft] = useState(
    maxInsideCapacity !== null ? String(maxInsideCapacity) : '',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [committeeSearchQuery, setCommitteeSearchQuery] = useState('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
  const [participantDeleteTargetIds, setParticipantDeleteTargetIds] = useState<string[]>([])
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingParticipant, setIsDeletingParticipant] = useState(false)
  const [participantBusyIds, setParticipantBusyIds] = useState<string[]>([])
  const [isParticipantBatchActionRunning, setIsParticipantBatchActionRunning] = useState(false)
  const [isParticipantStatsModalOpen, setIsParticipantStatsModalOpen] = useState(false)
  const [editingCommitteeUser, setEditingCommitteeUser] = useState<CommitteeUser | null>(null)
  const [committeeName, setCommitteeName] = useState('')
  const [committeeEmail, setCommitteeEmail] = useState('')
  const [isSavingCommitteeUser, setIsSavingCommitteeUser] = useState(false)
  const [isCommitteeUserModalOpen, setIsCommitteeUserModalOpen] = useState(false)
  const [selectedCommitteeMemberForAccountId, setSelectedCommitteeMemberForAccountId] = useState<
    string | null
  >(null)
  const [committeeBusyUserIds, setCommitteeBusyUserIds] = useState<string[]>([])
  const [selectedCommitteeUserIds, setSelectedCommitteeUserIds] = useState<string[]>([])
  const [isCommitteeBatchActionRunning, setIsCommitteeBatchActionRunning] = useState(false)
  const [isRegistrationClosureSaving, setIsRegistrationClosureSaving] = useState(false)
  const [isMaxCapacitySaving, setIsMaxCapacitySaving] = useState(false)

  useEffect(() => {
    setTicketPriceDraft(String(externalTicketPrice))
  }, [externalTicketPrice])

  useEffect(() => {
    setMaxInsideCapacityDraft(maxInsideCapacity !== null ? String(maxInsideCapacity) : '')
  }, [maxInsideCapacity])

  useEffect(() => {
    if (!editingCommitteeUser) {
      setCommitteeName('')
      setCommitteeEmail('')
      return
    }

    setCommitteeName(editingCommitteeUser.name)
    setCommitteeEmail(editingCommitteeUser.email)
  }, [editingCommitteeUser])

  const stats = useMemo(
    () => ({
      total: registrants.length,
      present: registrants.filter((participant) => participant.checkedInAt !== null).length,
      absent: registrants.filter((participant) => participant.checkedInAt === null).length,
      internal: registrants.filter((participant) => participant.type === 'internal').length,
      external: registrants.filter((participant) => participant.type === 'external').length,
      committeeTotal: committeeMembers.length,
      committeePresent: committeeMembers.filter((member) => member.checkedInAt !== null).length,
    }),
    [registrants, committeeMembers],
  )

  const filteredRegistrants = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return registrants
    }

    return registrants.filter((participant) =>
      [
        participant.id,
        participant.firstName,
        participant.lastName,
        participant.email,
        participant.phone,
        participant.type,
        participant.checkedInAt ? 'present' : 'absent',
        participant.createdAt,
        participant.checkedInAt ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [registrants, searchQuery])

  const filteredCommitteeUsers = useMemo(() => {
    const normalizedQuery = committeeSearchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return committeeUsers
    }

    return committeeUsers.filter((user) =>
      [user.name, user.email, user.isActive ? 'actif' : 'révoqué']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [committeeUsers, committeeSearchQuery])

  const selectedCommitteeUsers = useMemo(
    () => committeeUsers.filter((user) => selectedCommitteeUserIds.includes(user.id)),
    [committeeUsers, selectedCommitteeUserIds],
  )
  const selectedParticipants = useMemo(
    () => registrants.filter((participant) => selectedParticipantIds.includes(participant.id)),
    [registrants, selectedParticipantIds],
  )
  const participantDeleteTargets = useMemo(
    () =>
      registrants.filter((participant) => participantDeleteTargetIds.includes(participant.id)),
    [registrants, participantDeleteTargetIds],
  )
  const participantOperationBusyIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...participantBusyIds,
          ...confirmingParticipantIds,
          ...sendingBadgeParticipantIds,
          ...downloadingBadgeParticipantIds,
        ]),
      ),
    [
      participantBusyIds,
      confirmingParticipantIds,
      sendingBadgeParticipantIds,
      downloadingBadgeParticipantIds,
    ],
  )
  const participantPendingDelete =
    participantDeleteTargets[0] ??
    ({
      id: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      type: 'internal',
      photo: '',
      createdAt: '',
      isConfirmed: false,
      confirmedAt: null,
      checkedInAt: null,
    } satisfies Participant)
  const allFilteredParticipantsSelected =
    filteredRegistrants.length > 0 &&
    filteredRegistrants.every((participant) => selectedParticipantIds.includes(participant.id))
  const hasSelectedPresentParticipants = selectedParticipants.some((participant) =>
    Boolean(participant.checkedInAt),
  )
  const hasSelectedAbsentParticipants = selectedParticipants.some(
    (participant) => !participant.checkedInAt,
  )
  const participantStats = useMemo(
    () => ({
      present: registrants.filter((participant) => Boolean(participant.checkedInAt)).length,
      absent: registrants.filter((participant) => !participant.checkedInAt).length,
    }),
    [registrants],
  )
  const presentParticipants = useMemo(
    () => registrants.filter((participant) => Boolean(participant.checkedInAt)),
    [registrants],
  )
  const absentParticipants = useMemo(
    () => registrants.filter((participant) => !participant.checkedInAt),
    [registrants],
  )

  const availableCommitteeMembersForAccounts = useMemo(() => {
    const usedEmails = new Set(committeeUsers.map((user) => normalizeEmailValue(user.email)))

    return committeeMembers.filter((member) => !usedEmails.has(normalizeEmailValue(member.email)))
  }, [committeeMembers, committeeUsers])

  const allFilteredCommitteeUsersSelected =
    filteredCommitteeUsers.length > 0 &&
    filteredCommitteeUsers.every((user) => selectedCommitteeUserIds.includes(user.id))

  const canEditSelectedCommitteeUser =
    selectedCommitteeUsers.length === 1 && !isCommitteeBatchActionRunning

  useEffect(() => {
    setSelectedParticipantIds((currentIds) =>
      currentIds.filter((participantId) =>
        registrants.some((participant) => participant.id === participantId),
      ),
    )
  }, [registrants])

  useEffect(() => {
    setSelectedParticipantIds((currentIds) =>
      currentIds.filter((participantId) =>
        registrants.some((participant) => participant.id === participantId),
      ),
    )
  }, [registrants])

  useEffect(() => {
    setParticipantDeleteTargetIds((currentIds) =>
      currentIds.filter((participantId) =>
        registrants.some((participant) => participant.id === participantId),
      ),
    )
  }, [registrants])

  useEffect(() => {
    setSelectedCommitteeUserIds((currentIds) =>
      currentIds.filter((userId) => committeeUsers.some((user) => user.id === userId)),
    )
  }, [committeeUsers])

  useEffect(() => {
    setParticipantDeleteTargetIds((currentIds) =>
      currentIds.filter((participantId) =>
        registrants.some((participant) => participant.id === participantId),
      ),
    )
  }, [registrants])

  const closeCommitteeUserModal = (force = false) => {
    if (isSavingCommitteeUser && !force) {
      return
    }

    setIsCommitteeUserModalOpen(false)
    setEditingCommitteeUser(null)
    setCommitteeName('')
    setCommitteeEmail('')
    setSelectedCommitteeMemberForAccountId(null)
  }

  const openCreateCommitteeUserModal = () => {
    setEditingCommitteeUser(null)
    setCommitteeName('')
    setCommitteeEmail('')
    setSelectedCommitteeMemberForAccountId(null)
    setIsCommitteeUserModalOpen(true)
  }

  const openEditCommitteeUserModal = () => {
    if (selectedCommitteeUsers.length !== 1) {
      onNotify('Sélectionnez exactement un compte check-in à modifier.', 'warning')
      return
    }

    setEditingCommitteeUser(selectedCommitteeUsers[0])
    setSelectedCommitteeMemberForAccountId(null)
    setIsCommitteeUserModalOpen(true)
  }

  const handlePrefillCommitteeUserFromMember = (member: CommitteeMember) => {
    setSelectedCommitteeMemberForAccountId(member.id)
    setCommitteeName(`${member.firstName} ${member.lastName}`.trim())
    setCommitteeEmail(member.email)
  }

  const recentCheckIns = useMemo(
    () =>
      [...registrants]
        .filter((participant) => participant.checkedInAt)
        .sort(
          (left, right) =>
            new Date(right.checkedInAt ?? 0).getTime() - new Date(left.checkedInAt ?? 0).getTime(),
        )
        .slice(0, 8),
    [registrants],
  )

  const handleExport = () => {
    if (filteredRegistrants.length === 0) {
      onNotify('Aucune inscription à exporter.', 'info')
      return
    }

    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const rows = filteredRegistrants.map((participant) =>
      [
        participant.id,
        participant.firstName,
        participant.lastName,
        participant.email,
        participant.phone,
        participant.type,
        participant.checkedInAt ? 'PRESENT' : 'ABSENT',
        participant.createdAt,
        participant.checkedInAt ?? '',
      ]
        .map(escapeCsv)
        .join(';'),
    )
    const content = [
      ['Ticket ID', 'Prenom', 'Nom', 'Email', 'Telephone', 'Type', 'Presence', 'Inscription ISO', 'Check-in ISO']
        .map(escapeCsv)
        .join(';'),
      ...rows,
    ].join('\n')

    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `3d-impact-inscriptions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    onNotify('Export termine.', 'success')
  }

  const handlePriceSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsedPrice = Number(ticketPriceDraft)

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      onNotify('Veuillez saisir un montant valide superieur ou egal a 0.', 'warning')
      return
    }

    try {
      await onExternalTicketPriceChange(parsedPrice)
      onNotify('Le prix du ticket externe a été mis à jour.', 'success')
    } catch {
      return
    }
  }

  const handleRegistrationClosureToggle = async () => {
    const nextState = !isRegistrationClosed
    setIsRegistrationClosureSaving(true)

    try {
      await onRegistrationClosureChange(nextState)
      onNotify(
        nextState
          ? "Les inscriptions en ligne sont maintenant closes pour le public."
          : "Les inscriptions en ligne sont de nouveau ouvertes au public.",
        'success',
      )
    } catch {
      return
    } finally {
      setIsRegistrationClosureSaving(false)
    }
  }

  const handleMaxInsideCapacitySubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedValue = maxInsideCapacityDraft.trim()
    const nextCapacity = trimmedValue === '' ? null : Number(trimmedValue)

    if (
      trimmedValue !== '' &&
      (!Number.isInteger(nextCapacity) || nextCapacity === null || nextCapacity <= 0)
    ) {
      onNotify('Veuillez saisir un nombre entier supérieur à 0, ou laisser vide.', 'warning')
      return
    }

    setIsMaxCapacitySaving(true)

    try {
      await onMaxInsideCapacityChange(nextCapacity)
      onNotify(
        nextCapacity === null
          ? 'La capacité maximale a été retirée.'
          : 'La capacité maximale de la salle a été mise à jour.',
        'success',
      )
    } catch {
      return
    } finally {
      setIsMaxCapacitySaving(false)
    }
  }

  const handleDeleteSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (participantDeleteTargetIds.length === 0) {
      return
    }

    setIsDeletingParticipant(true)
    setDeleteError('')

    try {
      let deletedCount = 0
      let busyCount = 0
      let missingCount = 0

      for (const participantId of participantDeleteTargetIds) {
        const result = await onDeleteParticipant(participantId, deletePassword)

        if (result === 'invalid_password') {
          setDeleteError('Mot de passe incorrect.')
          return
        }

        if (result === 'deleted') {
          deletedCount += 1
          continue
        }

        if (result === 'busy') {
          busyCount += 1
        } else {
          missingCount += 1
        }
      }

      if (deletedCount > 0) {
        onNotify(
          deletedCount === 1
            ? "L'inscription a été supprimée."
            : `${deletedCount} inscriptions ont été supprimées.`,
          'success',
        )
      }

      if (busyCount > 0 || missingCount > 0) {
        setDeleteError(
          busyCount > 0
            ? `${busyCount} suppression(s) restent bloquées par une opération en cours.`
            : `${missingCount} inscription(s) n’étaient plus disponibles.`,
        )
        return
      }

      setSelectedParticipantIds((currentIds) =>
        currentIds.filter((participantId) => !participantDeleteTargetIds.includes(participantId)),
      )
      setParticipantDeleteTargetIds([])
      setDeletePassword('')
    } finally {
      setIsDeletingParticipant(false)
    }
  }

  const markParticipantsBusy = (participantIds: string[]) => {
    setParticipantBusyIds((currentIds) =>
      Array.from(new Set([...currentIds, ...participantIds.filter(Boolean)])),
    )
  }

  const isParticipantBusy = (participantId: string) =>
    participantOperationBusyIds.includes(participantId)

  const clearParticipantsBusy = (participantIds: string[]) => {
    setParticipantBusyIds((currentIds) =>
      currentIds.filter((participantId) => !participantIds.includes(participantId)),
    )
  }

  const toggleParticipantSelection = (participantId: string) => {
    if (isParticipantBatchActionRunning || isParticipantBusy(participantId)) {
      return
    }

    setSelectedParticipantIds((currentIds) =>
      currentIds.includes(participantId)
        ? currentIds.filter((id) => id !== participantId)
        : [...currentIds, participantId],
    )
  }

  const toggleSelectAllFilteredParticipants = () => {
    if (isParticipantBatchActionRunning) {
      return
    }

    const filteredIds = filteredRegistrants.map((participant) => participant.id)

    setSelectedParticipantIds((currentIds) => {
      if (filteredIds.every((id) => currentIds.includes(id))) {
        return currentIds.filter((id) => !filteredIds.includes(id))
      }

      return Array.from(new Set([...currentIds, ...filteredIds]))
    })
  }

  const openParticipantDeleteModal = (explicitParticipantIds?: string[]) => {
    const targetIds =
      explicitParticipantIds && explicitParticipantIds.length > 0
        ? explicitParticipantIds
        : selectedParticipantIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un participant.', 'warning')
      return
    }

    setParticipantDeleteTargetIds(targetIds)
    setDeletePassword('')
    setDeleteError('')
  }

  const runParticipantSelectionAction = async (action: 'send' | 'download', explicitParticipantIds?: string[]) => {
    const targetIds =
      explicitParticipantIds && explicitParticipantIds.length > 0
        ? explicitParticipantIds
        : selectedParticipantIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un participant.', 'warning')
      return
    }

    const relevantParticipants = registrants.filter((participant) =>
      targetIds.includes(participant.id),
    )

    if (relevantParticipants.length === 0) {
      onNotify('Aucun participant sélectionné ne peut recevoir cette action.', 'warning')
      return
    }

    const relevantIds = relevantParticipants.map((participant) => participant.id)
    markParticipantsBusy(relevantIds)
    setIsParticipantBatchActionRunning(true)

    try {
      let completedCount = 0

      for (const participant of relevantParticipants) {
        try {
          if (action === 'send') {
            await onSendBadgeToParticipant(participant.id)
          } else {
            await onDownloadBadgeForParticipant(participant.id)
          }
          completedCount += 1
        } catch (error) {
          onNotify(
            error instanceof Error ? error.message : 'Action participant impossible.',
            'error',
          )
        }
      }

      if (completedCount > 0) {
        onNotify(
          action === 'send'
            ? completedCount === 1
              ? "L'email a été renvoyé."
              : `${completedCount} emails ont été renvoyés.`
            : completedCount === 1
              ? 'Le badge PDF a été téléchargé.'
              : `${completedCount} badges PDF ont été téléchargés.`,
          'success',
        )
      }
    } finally {
      clearParticipantsBusy(relevantIds)
      setIsParticipantBatchActionRunning(false)
    }
  }

  const runParticipantPresenceAction = async (present: boolean, participantIds: string[]) => {
    if (participantIds.length === 0) {
      onNotify('Sélectionnez au moins un participant.', 'warning')
      return
    }

    const targetParticipants = registrants.filter(
      (participant) =>
        participantIds.includes(participant.id) && Boolean(participant.checkedInAt) !== present,
    )

    if (targetParticipants.length === 0) {
      onNotify(
        present
          ? 'Tous les participants ciblés sont déjà présents.'
          : 'Tous les participants ciblés sont déjà absents.',
        'warning',
      )
      return
    }

    const targetIds = targetParticipants.map((participant) => participant.id)
    markParticipantsBusy(targetIds)
    setIsParticipantBatchActionRunning(true)

    try {
      let updatedCount = 0

      for (const participant of targetParticipants) {
        try {
          await onSetParticipantPresence(participant.id, present)
          updatedCount += 1
        } catch (error) {
          onNotify(
            error instanceof Error
              ? error.message
              : present
                ? 'Marquage présence impossible.'
                : 'Annulation présence impossible.',
            'error',
          )
        }
      }

      if (updatedCount > 0) {
        onNotify(
          present
            ? updatedCount === 1
              ? 'Le participant a été marqué présent.'
              : `${updatedCount} participants ont été marqués présents.`
            : updatedCount === 1
              ? 'La présence du participant a été annulée.'
              : `${updatedCount} présences participants ont été annulées.`,
          'success',
        )
      }
    } finally {
      clearParticipantsBusy(targetIds)
      setIsParticipantBatchActionRunning(false)
    }
  }

  const handleCommitteeSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const selectedCommitteeMemberForAccount = !editingCommitteeUser
      ? availableCommitteeMembersForAccounts.find(
          (member) => member.id === selectedCommitteeMemberForAccountId,
        )
      : null

    if (!editingCommitteeUser && !selectedCommitteeMemberForAccount) {
      onNotify('Sélectionnez d’abord un membre du comité pour créer le compte check-in.', 'warning')
      return
    }

    setIsSavingCommitteeUser(true)

    try {
      if (editingCommitteeUser) {
        await onUpdateCommitteeUser({
          userId: editingCommitteeUser.id,
          name: committeeName.trim(),
          email: committeeEmail.trim(),
        })
        onNotify('Utilisateur comité mis à jour.', 'success')
      } else {
        await onCreateCommitteeUser({
          name: `${selectedCommitteeMemberForAccount?.firstName ?? ''} ${selectedCommitteeMemberForAccount?.lastName ?? ''}`.trim(),
          email: selectedCommitteeMemberForAccount?.email ?? '',
        })
        onNotify(
          'Utilisateur comité créé. Son mot de passe a été généré automatiquement et restera le même tant qu’il n’est pas régénéré par l’admin.',
          'success',
        )
      }

      closeCommitteeUserModal(true)
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Opération comité impossible.', 'error')
    } finally {
      setIsSavingCommitteeUser(false)
    }
  }

  const isCommitteeUserBusy = (userId: string) => committeeBusyUserIds.includes(userId)

  const markCommitteeUsersBusy = (userIds: string[]) => {
    setCommitteeBusyUserIds((currentIds) =>
      Array.from(new Set([...currentIds, ...userIds.filter(Boolean)])),
    )
  }

  const clearCommitteeUsersBusy = (userIds: string[]) => {
    setCommitteeBusyUserIds((currentIds) => currentIds.filter((id) => !userIds.includes(id)))
  }

  const toggleCommitteeUserSelection = (userId: string) => {
    if (isCommitteeBatchActionRunning || isCommitteeUserBusy(userId)) {
      return
    }

    setSelectedCommitteeUserIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId],
    )
  }

  const toggleSelectAllFilteredCommitteeUsers = () => {
    if (isCommitteeBatchActionRunning) {
      return
    }

    const filteredIds = filteredCommitteeUsers.map((user) => user.id)

    setSelectedCommitteeUserIds((currentIds) => {
      if (filteredIds.every((id) => currentIds.includes(id))) {
        return currentIds.filter((id) => !filteredIds.includes(id))
      }

      return Array.from(new Set([...currentIds, ...filteredIds]))
    })
  }

  const runCommitteeSelectionAction = async (
    action: 'authorize' | 'revoke' | 'delete' | 'regenerate_password',
    explicitUserIds?: string[],
  ) => {
    const targetUserIds =
      explicitUserIds && explicitUserIds.length > 0 ? explicitUserIds : selectedCommitteeUserIds

    if (targetUserIds.length === 0) {
      onNotify('Sélectionnez au moins un utilisateur comité.', 'warning')
      return
    }

    const targetUsers = committeeUsers.filter((user) => targetUserIds.includes(user.id))

    if (targetUsers.length === 0) {
      onNotify('Aucun utilisateur comité disponible pour cette action.', 'warning')
      return
    }

    markCommitteeUsersBusy(targetUsers.map((user) => user.id))
    setIsCommitteeBatchActionRunning(true)

    try {

      if (action === 'regenerate_password') {
        const result = await onRegenerateCommitteePasswords(targetUsers.map((user) => user.id))

        if (result.updatedCount > 0 && result.failedUsers.length === 0) {
          onNotify(
            result.updatedCount === 1
              ? 'Le mot de passe du compte comité a été régénéré.'
              : `${result.updatedCount} mots de passe comité ont été régénérés.`,
            'success',
          )
        } else if (result.updatedCount > 0) {
          onNotify(
            `${result.updatedCount} mots de passe régénérés, ${result.failedUsers.length} utilisateurs restent inchangés.`,
            'warning',
          )
        } else {
          onNotify("Aucun mot de passe n'a pu être régénéré.", 'error')
        }

        return
      }

      let completedCount = 0

      for (const user of targetUsers) {
        try {
          if (action === 'authorize') {
            await onSetCommitteeUserAccess(user.id, true)
          } else if (action === 'revoke') {
            await onSetCommitteeUserAccess(user.id, false)
          } else if (action === 'delete') {
            await onDeleteCommitteeUser(user.id)
            if (editingCommitteeUser?.id === user.id) {
              closeCommitteeUserModal(true)
            }
          }

          completedCount += 1
        } catch (error) {
          onNotify(error instanceof Error ? error.message : 'Opération comité impossible.', 'error')
        }
      }

      if (action === 'delete') {
        setSelectedCommitteeUserIds((currentIds) =>
          currentIds.filter((id) => !targetUsers.some((user) => user.id === id)),
        )
      }

      if (completedCount > 0) {
        const actionLabel =
          action === 'authorize'
            ? 'autorisation'
            : action === 'revoke'
              ? 'révocation'
              : 'suppression'
        onNotify(
          completedCount === 1
            ? `1 ${actionLabel} effectuée sur un utilisateur comité.`
            : `${completedCount} ${actionLabel}s effectuées sur les utilisateurs comité.`,
          'success',
        )
      }
    } finally {
      clearCommitteeUsersBusy(targetUsers.map((user) => user.id))
      setIsCommitteeBatchActionRunning(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-main">
          <div>
            <div className="admin-subtitle">
              <ShieldCheck size={16} />
              <span>Console administrative</span>
            </div>
            <h1 className="admin-title">3D Impact Admin</h1>
            <p className="admin-header-copy">
              Dashboard, suivi des inscriptions, présences et gestion des utilisateurs du check-in.
            </p>
          </div>
          <button type="button" onClick={onLogout} className="btn btn-secondary admin-header-logout">
            <LogOut size={18} /> Quitter l'admin
          </button>
        </div>
        <div className="admin-tabs">
          <button type="button" onClick={() => setActiveTab('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <Database size={18} /> Dashboard
          </button>
          <button type="button" onClick={() => setActiveTab('participants')} className={`btn ${activeTab === 'participants' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <Users size={18} /> Participants
          </button>
          <button type="button" onClick={() => setActiveTab('jour_j')} className={`btn ${activeTab === 'jour_j' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <CheckCircle2 size={18} /> Jour J
          </button>
          <button type="button" onClick={() => setActiveTab('presence')} className={`btn ${activeTab === 'presence' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <QrCode size={18} /> Marquer presence
          </button>
          <button type="button" onClick={() => setActiveTab('committee_members')} className={`btn ${activeTab === 'committee_members' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <Users size={18} /> Membres comité
          </button>
          <button type="button" onClick={() => setActiveTab('professors')} className={`btn ${activeTab === 'professors' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <GraduationCap size={18} /> Professeurs
          </button>
          <button type="button" onClick={() => setActiveTab('checkin_accounts')} className={`btn ${activeTab === 'checkin_accounts' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <UserCog size={18} /> Comptes check-in
          </button>
          <button type="button" onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'} admin-tab-button`}>
            <Settings size={18} /> Configuration
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div className="admin-stats-grid admin-stats-grid-wide">
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Database size={18} />
              </div>
              <div className="admin-stat-label">Inscrits</div>
              <div className="admin-stat-value">{stats.total}</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <UserCheck size={18} />
              </div>
              <div className="admin-stat-label">Presents</div>
              <div className="admin-stat-value">{stats.present}</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Clock3 size={18} />
              </div>
              <div className="admin-stat-label">Absents</div>
              <div className="admin-stat-value" style={{ color: '#64748b' }}>
                {stats.absent}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Building2 size={18} />
              </div>
              <div className="admin-stat-label">Étudiants ENSA</div>
              <div className="admin-stat-value" style={{ color: 'var(--primary)' }}>
                {stats.internal}
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon">
                <Users size={18} />
              </div>
              <div className="admin-stat-label">Externes</div>
              <div className="admin-stat-value">{stats.external}</div>
            </div>
          </div>
          <div className="admin-dashboard-panels">
            <div className="admin-dashboard-panel">
              <div className="admin-dashboard-panel-header">
                <h3>Derniers check-ins</h3>
                <span>{recentCheckIns.length}</span>
              </div>
              {recentCheckIns.length === 0 ? (
                <div className="admin-list-empty">Aucun participant pointe.</div>
              ) : (
                <div className="admin-list">
                  {recentCheckIns.map((participant) => (
                    <div key={participant.id} className="admin-list-row">
                      <div>
                        <div className="admin-list-title">
                          {participant.firstName} {participant.lastName}
                        </div>
                        <div className="admin-list-subtitle">{participant.id}</div>
                      </div>
                      <div className="admin-list-meta">{formatDateTime(participant.checkedInAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-dashboard-panel">
              <div className="admin-dashboard-panel-header">
                <h3>Vue operationnelle</h3>
                <span>{committeeUsers.length}</span>
              </div>
              <div className="admin-list-row">
                <div>
                  <div className="admin-list-title">Comptes check-in actifs</div>
                  <div className="admin-list-subtitle">Utilisateurs comite autorises</div>
                </div>
                <div className="admin-list-meta">
                  {committeeUsers.filter((user) => user.isActive).length}
                </div>
              </div>
              <div className="admin-list-row">
                <div>
                  <div className="admin-list-title">Comptes check-in revoques</div>
                  <div className="admin-list-subtitle">Acces temporairement bloques</div>
                </div>
                <div className="admin-list-meta">
                  {committeeUsers.filter((user) => !user.isActive).length}
                </div>
              </div>
              <div className="admin-list-row">
                <div>
                  <div className="admin-list-title">Membres comite presents</div>
                  <div className="admin-list-subtitle">Pointage comite deja enregistre</div>
                </div>
                <div className="admin-list-meta">{stats.committeePresent}</div>
              </div>
              <div className="admin-list-row">
                <div>
                  <div className="admin-list-title">Participants absents</div>
                  <div className="admin-list-subtitle">Personnes non encore pointees</div>
                </div>
                <div className="admin-list-meta">{stats.absent}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'participants' && (
        <div className="admin-panel-block">
          <div className="admin-toolbar">
            <div className="admin-search">
              <Search className="admin-search-icon" size={18} />
              <input
                type="text"
                placeholder="Rechercher un participant..."
                className="input-field admin-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="committee-members-toolbar-actions">
              <div className="admin-selection-summary">
                {selectedParticipants.length > 0
                  ? `${selectedParticipants.length} selectionne(s)`
                  : 'Aucune selection'}
              </div>
              <button
                type="button"
                className="btn btn-secondary participant-stats-toolbar-button"
                onClick={() => setIsParticipantStatsModalOpen(true)}
              >
                <Database size={16} /> Statistiques presence
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="btn btn-secondary admin-export-button"
              >
                <Download size={18} /> Exporter
              </button>
            </div>
          </div>
          <div className="admin-committee-bulk-bar">
            <label className="admin-checkbox-row">
              <input
                type="checkbox"
                checked={allFilteredParticipantsSelected}
                onChange={toggleSelectAllFilteredParticipants}
                disabled={filteredRegistrants.length === 0 || isParticipantBatchActionRunning}
              />
              <span>Tout selectionner</span>
            </label>
            <div className="admin-committee-bulk-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  selectedParticipants.length === 0 ||
                  isParticipantBatchActionRunning ||
                  !hasSelectedAbsentParticipants
                }
                onClick={() => void runParticipantPresenceAction(true, selectedParticipantIds)}
              >
                <UserCheck size={16} /> Marquer present
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={
                  selectedParticipants.length === 0 ||
                  isParticipantBatchActionRunning ||
                  !hasSelectedPresentParticipants
                }
                onClick={() => void runParticipantPresenceAction(false, selectedParticipantIds)}
              >
                <X size={16} /> Annuler presence
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={selectedParticipants.length === 0 || isParticipantBatchActionRunning}
                onClick={() => void runParticipantSelectionAction('download')}
              >
                <Download size={16} /> Telecharger le PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={selectedParticipants.length === 0 || isParticipantBatchActionRunning}
                onClick={() => void runParticipantSelectionAction('send')}
              >
                <MailCheck size={16} /> Renvoyer l'email
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={selectedParticipants.length === 0 || isParticipantBatchActionRunning}
                onClick={() => openParticipantDeleteModal()}
              >
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Ticket</th>
                  <th>Participant</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Inscription</th>
                  <th>Presence</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty-cell">
                      {registrants.length === 0
                        ? 'Aucune inscription.'
                        : 'Aucun resultat pour cette recherche.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrants.map((participant) => (
                    <tr key={participant.id}>
                      <td>
                        <label className="admin-checkbox-row">
                          <input
                            type="checkbox"
                            checked={selectedParticipantIds.includes(participant.id)}
                            onChange={() => toggleParticipantSelection(participant.id)}
                            disabled={
                              isParticipantBatchActionRunning ||
                              isParticipantBusy(participant.id)
                            }
                          />
                          <span className="sr-only">
                            Selectionner {participant.firstName} {participant.lastName}
                          </span>
                        </label>
                      </td>
                      <td>
                        <div className="admin-strong">{participant.id}</div>
                        <div className="admin-muted-small">Badge PDF disponible</div>
                      </td>
                      <td>
                        <div className="admin-strong">
                          {participant.firstName} {participant.lastName}
                        </div>
                      </td>
                      <td>
                        <div>{participant.email}</div>
                        <div className="admin-muted-small">{participant.phone}</div>
                      </td>
                      <td>
                        <span
                          className="admin-type-pill"
                          style={{
                            background:
                              participant.type === 'internal'
                                ? 'rgba(255, 194, 34, 0.1)'
                                : 'rgba(15, 23, 42, 0.06)',
                            color:
                              participant.type === 'internal'
                                ? 'var(--primary)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {participant.type === 'internal' ? 'INTERNE' : 'EXTERNE'}
                        </span>
                      </td>
                      <td>{formatDate(participant.createdAt)}</td>
                      <td>
                        <div
                          className="admin-status-pill"
                          style={{
                            color: participant.checkedInAt ? '#047857' : '#64748b',
                            background: participant.checkedInAt
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(148, 163, 184, 0.14)',
                          }}
                        >
                          <UserCheck size={16} />
                          {participant.checkedInAt ? 'Present' : 'Absent'}
                        </div>
                        <div className="admin-status-hint">
                          {participant.checkedInAt
                            ? formatDateTime(participant.checkedInAt)
                            : 'Non pointe'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'presence' && (
        <AdminPresenceManager onLookup={onAdminPresenceLookup} onNotify={onNotify} />
      )}

      {activeTab === 'jour_j' && (
        <JourJMonitor
          dataMode={dataMode}
          registrants={registrants}
          committeeMembers={committeeMembers}
          maxInsideCapacity={maxInsideCapacity}
          logo={logo}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'committee_members' && (
        <CommitteeMembersManager
          committeeMembers={committeeMembers}
          onCreateCommitteeMember={onCreateCommitteeMember}
          onImportCommitteeCsv={onImportCommitteeCsv}
          onDeleteCommitteeMember={onDeleteCommitteeMember}
          onSetCommitteeMemberPresence={onSetCommitteeMemberPresence}
          onSendCommitteeMemberQrs={onSendCommitteeMemberQrs}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'professors' && (
        <ProfessorsManager
          professors={professors}
          onImportProfessorsCsv={onImportProfessorsCsv}
          onCreateProfessor={onCreateProfessor}
          onDeleteProfessor={onDeleteProfessor}
          onSendProfessorEmails={onSendProfessorEmails}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'checkin_accounts' && (
        <div className="admin-panel-block">
            <div className="admin-toolbar">
              <div className="admin-search">
                <Search className="admin-search-icon" size={18} />
                <input type="text" placeholder="Rechercher un utilisateur comité..." className="input-field admin-search-input" value={committeeSearchQuery} onChange={(event) => setCommitteeSearchQuery(event.target.value)} />
              </div>
              <div className="committee-members-toolbar-actions">
                <div className="admin-selection-summary">
                  {selectedCommitteeUsers.length > 0 ? `${selectedCommitteeUsers.length} sélectionné(s)` : 'Aucune sélection'}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!canEditSelectedCommitteeUser}
                  onClick={openEditCommitteeUserModal}
                >
                  <Pencil size={16} /> Modifier
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isCommitteeBatchActionRunning}
                  onClick={openCreateCommitteeUserModal}
                >
                  <UserPlus size={16} /> Ajouter un compte
                </button>
              </div>
            </div>
            <div className="admin-committee-bulk-bar">
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={allFilteredCommitteeUsersSelected}
                  onChange={toggleSelectAllFilteredCommitteeUsers}
                  disabled={filteredCommitteeUsers.length === 0 || isCommitteeBatchActionRunning}
                />
                <span>Tout sélectionner</span>
              </label>
              <div className="admin-committee-bulk-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedCommitteeUsers.length === 0 || isCommitteeBatchActionRunning}
                  onClick={() => void runCommitteeSelectionAction('regenerate_password')}
                >
                  <Pencil size={16} /> Régénérer et envoyer
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={selectedCommitteeUsers.length === 0 || isCommitteeBatchActionRunning}
                  onClick={() => void runCommitteeSelectionAction('authorize')}
                >
                  <ShieldCheck size={16} /> Autoriser
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={selectedCommitteeUsers.length === 0 || isCommitteeBatchActionRunning}
                  onClick={() => void runCommitteeSelectionAction('revoke')}
                >
                  <ShieldOff size={16} /> Revoquer
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={selectedCommitteeUsers.length === 0 || isCommitteeBatchActionRunning}
                  onClick={() => void runCommitteeSelectionAction('delete')}
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              </div>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th></th><th>Nom</th><th>Email</th><th>Accès</th><th>Dernière connexion</th><th>Modifié le</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommitteeUsers.length === 0 ? <tr><td colSpan={6} className="admin-empty-cell">{committeeUsers.length === 0 ? 'Aucun utilisateur comité configuré.' : 'Aucun résultat pour cette recherche.'}</td></tr> : filteredCommitteeUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <label className="admin-checkbox-row">
                          <input
                            type="checkbox"
                            checked={selectedCommitteeUserIds.includes(user.id)}
                            onChange={() => toggleCommitteeUserSelection(user.id)}
                            disabled={isCommitteeBatchActionRunning || isCommitteeUserBusy(user.id)}
                          />
                          <span className="sr-only">Selectionner {user.name}</span>
                        </label>
                      </td>
                      <td className="admin-strong">{user.name}</td>
                      <td>{user.email}</td>
                      <td><span className="admin-type-pill" style={{ background: user.isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.14)', color: user.isActive ? '#047857' : '#64748b' }}>{user.isActive ? 'AUTORISÉ' : 'RÉVOQUÉ'}</span></td>
                      <td>{formatDateTime(user.lastLoginAt)}</td>
                      <td>{formatDateTime(user.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="admin-settings-panel">
          <h2 className="admin-settings-title">Paramètres</h2>
          <div className="admin-settings-grid">
            <form onSubmit={handlePriceSubmit}>
              <label className="input-label">Prix du ticket externe</label>
              <div className="admin-settings-card">
                <p className="admin-settings-copy">Ce montant sera affiché automatiquement dans le message de confirmation des participants externes.</p>
                <div className="admin-price-row">
                  <input type="number" min="0" step="1" className="input-field" value={ticketPriceDraft} onChange={(event) => setTicketPriceDraft(event.target.value)} style={{ margin: 0 }} />
                  <span className="admin-price-unit">DH</span>
                </div>
                <div className="admin-current-price">Tarif actuel : {externalTicketPrice.toLocaleString('fr-FR')} DH</div>
                <button type="submit" className="btn btn-primary admin-save-button">Enregistrer le prix</button>
              </div>
            </form>
            <div className="admin-settings-stack">
              <form onSubmit={handleMaxInsideCapacitySubmit}>
                <label className="input-label">Capacité maximale de la salle</label>
                <div className="admin-settings-card">
                  <p className="admin-settings-copy">
                    Une fois cette capacité atteinte, aucun nouveau check-in ne pourra être
                    enregistré, côté admin comme côté comité.
                  </p>
                  <div className="admin-price-row">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input-field"
                      value={maxInsideCapacityDraft}
                      onChange={(event) => setMaxInsideCapacityDraft(event.target.value)}
                      placeholder="Laisser vide pour désactiver"
                      style={{ margin: 0 }}
                    />
                    <span className="admin-price-unit">places</span>
                  </div>
                  <div className="admin-current-price">
                    Capacité actuelle :{' '}
                    {maxInsideCapacity !== null ? `${maxInsideCapacity} places` : 'non définie'}
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary admin-save-button"
                    disabled={isMaxCapacitySaving}
                  >
                    {isMaxCapacitySaving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Mise à jour...
                      </>
                    ) : (
                      'Enregistrer la capacité'
                    )}
                  </button>
                </div>
              </form>
              <div>
                <label className="input-label">Ouverture publique</label>
                <div className="admin-settings-card">
                  <div className="admin-settings-status-head">
                    <div>
                      <p className="admin-settings-copy">
                        Fermez l'application publique lorsque le quota de tickets a été atteint. La page d'accueil affichera alors automatiquement un message clair pour les visiteurs.
                      </p>
                      <span className={`admin-status-pill ${isRegistrationClosed ? 'is-closed' : 'is-open'}`}>
                        {isRegistrationClosed ? 'Application fermée' : 'Application ouverte'}
                      </span>
                    </div>
                    <span className={`admin-status-icon ${isRegistrationClosed ? 'is-closed' : 'is-open'}`}>
                      {isRegistrationClosed ? <ShieldOff size={18} /> : <ShieldCheck size={18} />}
                    </span>
                  </div>
                  <p className="admin-status-note">
                    {isRegistrationClosed
                      ? "Les nouvelles demandes en ligne sont suspendues. Le message public précise que l'accès le jour de l'événement reste possible dans la limite des places disponibles, avec priorité aux participants déjà munis d'un ticket."
                      : "Le formulaire public reste accessible pour les nouvelles inscriptions."}
                  </p>
                  <button
                    type="button"
                    className={`btn ${isRegistrationClosed ? 'btn-secondary' : 'btn-danger'} admin-save-button`}
                    onClick={() => void handleRegistrationClosureToggle()}
                    disabled={isRegistrationClosureSaving}
                  >
                    {isRegistrationClosureSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Mise à jour...
                      </>
                    ) : isRegistrationClosed ? (
                      <>
                        <ShieldCheck size={16} /> Rouvrir l'application
                      </>
                    ) : (
                      <>
                        <ShieldOff size={16} /> Fermer l'application
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">Logo</label>
                <div className="admin-logo-panel">
                  <div className="admin-logo-preview">{logo ? <img src={logo} alt="Logo" className="admin-logo-image" /> : null}</div>
                  <button type="button" className="btn btn-secondary admin-logo-button" disabled>Logo actuel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isParticipantStatsModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsParticipantStatsModalOpen(false)}>
          <div
            className="admin-modal committee-stats-modal participant-stats-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="committee-stats-topbar">
              <div className="committee-stats-hero">
                <div className="committee-stats-hero-icon participant-stats-hero-icon">
                  <Database size={22} />
                </div>
                <div>
                  <div className="committee-stats-kicker">Suivi participants</div>
                  <h3 className="admin-modal-title">Statistiques des participants</h3>
                  <p className="committee-stats-copy">
                    Visualisez rapidement l’état des présences et corrigez manuellement les
                    participants présents ou absents.
                  </p>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsParticipantStatsModalOpen(false)}
                >
                  <X size={16} /> Fermer
                </button>
              </div>
            </div>

            <div className="committee-stats-grid">
              <div className="committee-stats-card is-present">
                <div className="committee-stats-card-head">
                  <span className="committee-stats-label">Présents</span>
                  <span className="committee-stats-card-icon is-present">
                    <CheckCircle2 size={15} />
                  </span>
                </div>
                <strong className="committee-stats-value">{participantStats.present}</strong>
                <span className="committee-stats-card-note">participants déjà pointés</span>
              </div>
              <div className="committee-stats-card is-absent">
                <div className="committee-stats-card-head">
                  <span className="committee-stats-label">Absents</span>
                  <span className="committee-stats-card-icon is-absent">
                    <X size={15} />
                  </span>
                </div>
                <strong className="committee-stats-value">{participantStats.absent}</strong>
                <span className="committee-stats-card-note">participants non pointés</span>
              </div>
            </div>

            <div className="participant-stats-layout">
              <div className="committee-stats-absent-block participant-stats-section is-absent">
                <div className="committee-stats-absent-header">
                  <div className="committee-stats-absent-header-copy participant-stats-header-copy">
                    <div className="participant-stats-header-row">
                      <span className="participant-stats-header-icon is-absent">
                        <X size={15} />
                      </span>
                      <div>
                        <h4>Absents à marquer présents</h4>
                        <p>Les participants de cette liste peuvent être marqués présents manuellement.</p>
                      </div>
                    </div>
                  </div>
                  <span className="committee-stats-count-badge">{participantStats.absent}</span>
                </div>

                {absentParticipants.length === 0 ? (
                  <div className="committee-stats-empty">
                    <div className="committee-stats-empty-icon">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <strong>Aucun participant absent.</strong>
                      <p>Tous les participants sont actuellement marqués présents.</p>
                    </div>
                  </div>
                ) : (
                  <div className="committee-stats-absent-list">
                    {absentParticipants.map((participant) => {
                      const fullName = `${participant.firstName} ${participant.lastName}`.trim()
                      const initials = `${participant.firstName.charAt(0)}${participant.lastName.charAt(0)}`
                        .trim()
                        .toUpperCase()
                      const isBusy = isParticipantBusy(participant.id)

                      return (
                        <div key={participant.id} className="committee-stats-absent-item participant-stats-item">
                          <div className="committee-stats-absent-avatar" aria-hidden="true">
                            {initials || 'PT'}
                          </div>
                          <div className="committee-stats-absent-copy">
                            <div className="committee-stats-absent-name participant-stats-item-name">
                              {fullName}
                            </div>
                            <div className="committee-stats-absent-meta participant-stats-meta">
                              <span>{participant.email}</span>
                              <span>{participant.phone}</span>
                              <span className="participant-stats-inline-pill">
                                {participant.type === 'internal' ? 'Étudiant ENSA' : 'Externe'}
                              </span>
                              <span className="participant-stats-inline-pill is-ticket">
                                {participant.id}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary committee-stats-absent-action participant-stats-action"
                            disabled={isBusy || isParticipantBatchActionRunning}
                            onClick={() => void runParticipantPresenceAction(true, [participant.id])}
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="animate-spin" size={16} /> Marquage...
                              </>
                            ) : (
                              <>
                                <UserCheck size={16} /> Marquer présent
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="committee-stats-absent-block participant-stats-section is-present">
                <div className="committee-stats-absent-header">
                  <div className="committee-stats-absent-header-copy participant-stats-header-copy">
                    <div className="participant-stats-header-row">
                      <span className="participant-stats-header-icon is-present">
                        <CheckCircle2 size={15} />
                      </span>
                      <div>
                        <h4>Présents à remettre absents</h4>
                        <p>Si un pointage a été fait par erreur, vous pouvez l’annuler ici.</p>
                      </div>
                    </div>
                  </div>
                  <span className="committee-stats-count-badge">{participantStats.present}</span>
                </div>

                {presentParticipants.length === 0 ? (
                  <div className="committee-stats-empty">
                    <div className="committee-stats-empty-icon">
                      <X size={18} />
                    </div>
                    <div>
                      <strong>Aucun participant présent.</strong>
                      <p>Aucune présence enregistrée pour le moment.</p>
                    </div>
                  </div>
                ) : (
                  <div className="committee-stats-absent-list">
                    {presentParticipants.map((participant) => {
                      const fullName = `${participant.firstName} ${participant.lastName}`.trim()
                      const initials = `${participant.firstName.charAt(0)}${participant.lastName.charAt(0)}`
                        .trim()
                        .toUpperCase()
                      const isBusy = isParticipantBusy(participant.id)

                      return (
                        <div key={participant.id} className="committee-stats-absent-item participant-stats-item">
                          <div className="committee-stats-absent-avatar" aria-hidden="true">
                            {initials || 'PT'}
                          </div>
                          <div className="committee-stats-absent-copy">
                            <div className="committee-stats-absent-name participant-stats-item-name">
                              {fullName}
                            </div>
                            <div className="committee-stats-absent-meta participant-stats-meta">
                              <span>{participant.email}</span>
                              <span>{participant.phone}</span>
                              <span className="participant-stats-inline-pill">
                                {participant.type === 'internal' ? 'Étudiant ENSA' : 'Externe'}
                              </span>
                              <span className="participant-stats-inline-pill is-ticket">
                                {participant.id}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary committee-stats-absent-action participant-stats-action"
                            disabled={isBusy || isParticipantBatchActionRunning}
                            onClick={() => void runParticipantPresenceAction(false, [participant.id])}
                          >
                            {isBusy ? (
                              <>
                                <Loader2 className="animate-spin" size={16} /> Annulation...
                              </>
                            ) : (
                              <>
                                <X size={16} /> Annuler présence
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCommitteeUserModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => closeCommitteeUserModal()}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="admin-modal-title">
              {editingCommitteeUser ? 'Modifier un compte check-in' : 'Ajouter un compte check-in'}
            </h3>
            <p className="admin-modal-copy">
              Ces utilisateurs peuvent se connecter à `/check_in`. Le mot de passe est généré
              automatiquement à la création, reste stable par défaut, puis ne change que si vous le
              régénérez explicitement.
            </p>
            {!editingCommitteeUser && (
              <div className="committee-user-source-panel">
                <div className="committee-user-source-header">
                  <h4>Ajouter depuis les membres comité</h4>
                  <span>{availableCommitteeMembersForAccounts.length} disponible(s)</span>
                </div>
                {availableCommitteeMembersForAccounts.length === 0 ? (
                  <div className="committee-user-source-empty">
                    Tous les membres comité ont déjà un compte check-in, ou aucun membre comité
                    n&apos;est encore enregistré.
                  </div>
                ) : (
                  <div className="committee-user-source-list">
                    {availableCommitteeMembersForAccounts.map((member) => {
                      const fullName = `${member.firstName} ${member.lastName}`.trim()
                      const isSelected = selectedCommitteeMemberForAccountId === member.id

                      return (
                        <button
                          key={member.id}
                          type="button"
                          className={`committee-user-source-item ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => handlePrefillCommitteeUserFromMember(member)}
                        >
                          <div className="committee-user-source-name">{fullName}</div>
                          <div className="committee-user-source-email">{member.email}</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleCommitteeSubmit} className="admin-modal-form">
              {editingCommitteeUser ? (
                <>
                  <div className="input-group">
                    <label className="input-label">Nom complet</label>
                    <input
                      type="text"
                      className="input-field"
                      value={committeeName}
                      onChange={(event) => setCommitteeName(event.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      value={committeeEmail}
                      onChange={(event) => setCommitteeEmail(event.target.value)}
                    />
                  </div>
                </>
              ) : selectedCommitteeMemberForAccountId ? (
                <div className="committee-user-source-selected">
                  {(() => {
                    const selectedMember = availableCommitteeMembersForAccounts.find(
                      (member) => member.id === selectedCommitteeMemberForAccountId,
                    )

                    if (!selectedMember) {
                      return null
                    }

                    return (
                      <>
                        <div className="committee-user-source-selected-label">
                          Membre comité sélectionné
                        </div>
                        <div className="committee-user-source-selected-name">
                          {selectedMember.firstName} {selectedMember.lastName}
                        </div>
                        <div className="committee-user-source-selected-email">
                          {selectedMember.email}
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : null}
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeCommitteeUserModal()}
                  disabled={isSavingCommitteeUser}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    isSavingCommitteeUser || (!editingCommitteeUser && !selectedCommitteeMemberForAccountId)
                  }
                >
                  {isSavingCommitteeUser ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Enregistrement...
                    </>
                  ) : editingCommitteeUser ? (
                    <>
                      <Pencil size={16} /> Mettre à jour
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> Ajouter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {participantDeleteTargetIds.length > 0 && (
        <div className="admin-modal-backdrop" onClick={() => !isDeletingParticipant && setParticipantDeleteTargetIds([])}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="admin-modal-title">Supprimer une inscription</h3>
            <p className="admin-modal-copy">
              {participantDeleteTargetIds.length === 1 ? (
                <>Vous êtes sur le point de supprimer définitivement l&apos;inscription de <strong>{participantPendingDelete.firstName} {participantPendingDelete.lastName}</strong>.</>
              ) : (
                <>Vous êtes sur le point de supprimer définitivement <strong>{participantDeleteTargetIds.length} inscriptions sélectionnées</strong>.</>
              )}
            </p>
            <p className="admin-modal-warning">Cette action est irréversible. Entrez le mot de passe de protection pour continuer.</p>
            <form onSubmit={handleDeleteSubmit} className="admin-modal-form">
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Mot de passe de suppression</label>
                <input type="password" className="input-field" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Saisissez le mot de passe" autoFocus />
              </div>
              {deleteError && <p className="admin-modal-error">{deleteError}</p>}
              <div className="admin-modal-actions">
                <button type="button" onClick={() => setParticipantDeleteTargetIds([])} className="btn btn-secondary">Annuler</button>
                <button type="submit" disabled={isDeletingParticipant} className="btn btn-danger">
                  {isDeletingParticipant ? <><Loader2 className="animate-spin" size={16} /> Suppression...</> : 'Supprimer définitivement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel

