import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  BarChart3,
  Check,
  Loader2,
  MailCheck,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { DEFAULT_COMMITTEE_BADGE_TYPE, getCommitteeBadgeProfile } from '../lib/committeeBadge'
import type { CommitteeBadgeType, CommitteeMember } from '../types'
import type { PopupTone } from './InAppPopup'

interface CommitteeMembersManagerProps {
  committeeMembers: CommitteeMember[]
  onCreateCommitteeMember: (payload: {
    firstName: string
    lastName: string
    email: string
    phone: string
    badgeType: CommitteeBadgeType
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
  onNotify: (message: string, tone?: PopupTone) => void
}

const CommitteeMembersManager = ({
  committeeMembers,
  onCreateCommitteeMember,
  onImportCommitteeCsv,
  onDeleteCommitteeMember,
  onSetCommitteeMemberPresence,
  onSendCommitteeMemberQrs,
  onNotify,
}: CommitteeMembersManagerProps) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [badgeType, setBadgeType] = useState<CommitteeBadgeType>(DEFAULT_COMMITTEE_BADGE_TYPE)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false)
  const [busyMemberIds, setBusyMemberIds] = useState<string[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const filteredMembers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return committeeMembers
    }

    return committeeMembers.filter((member) =>
      [
        member.firstName,
        member.lastName,
        member.email,
        member.phone,
        getCommitteeBadgeProfile(member.badgeType).label,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [committeeMembers, searchQuery])

  const allFilteredSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((member) => selectedMemberIds.includes(member.id))

  const selectedMembers = useMemo(
    () => committeeMembers.filter((member) => selectedMemberIds.includes(member.id)),
    [committeeMembers, selectedMemberIds],
  )

  const hasSelectedAbsentMembers = selectedMembers.some((member) => !member.checkedInAt)
  const hasSelectedPresentMembers = selectedMembers.some((member) => Boolean(member.checkedInAt))
  const committeeStats = useMemo(
    () => ({
      present: committeeMembers.filter((member) => Boolean(member.checkedInAt)).length,
      absent: committeeMembers.filter((member) => !member.checkedInAt).length,
    }),
    [committeeMembers],
  )
  const absentMembers = useMemo(
    () => committeeMembers.filter((member) => !member.checkedInAt),
    [committeeMembers],
  )

  const isMemberBusy = (memberId: string) => busyMemberIds.includes(memberId)

  const markMembersBusy = (memberIds: string[]) => {
    setBusyMemberIds((currentIds) =>
      Array.from(new Set([...currentIds, ...memberIds.filter(Boolean)])),
    )
  }

  const clearMembersBusy = (memberIds: string[]) => {
    setBusyMemberIds((currentIds) => currentIds.filter((id) => !memberIds.includes(id)))
  }

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setBadgeType(DEFAULT_COMMITTEE_BADGE_TYPE)
  }

  const closeCreateModal = (force = false) => {
    if (isSavingMember && !force) {
      return
    }

    resetForm()
    setIsCreateModalOpen(false)
  }

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSavingMember(true)

    try {
      await onCreateCommitteeMember({
        firstName,
        lastName,
        email,
        phone,
        badgeType,
      })
      onNotify('Membre comité ajouté.', 'success')
      closeCreateModal(true)
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Ajout comité impossible.', 'error')
    } finally {
      setIsSavingMember(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsBulkActionRunning(true)

    try {
      const rawCsv = await file.text()
      const result = await onImportCommitteeCsv(rawCsv)
      onNotify(
        `${result.importedCount} membres comité importés, ${result.skippedCount} lignes ignorées.`,
        result.skippedCount > 0 ? 'warning' : 'success',
      )
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Import comité impossible.', 'error')
    } finally {
      event.target.value = ''
      setIsBulkActionRunning(false)
    }
  }

  const toggleSelection = (memberId: string) => {
    if (isBulkActionRunning || isMemberBusy(memberId)) {
      return
    }

    setSelectedMemberIds((currentIds) =>
      currentIds.includes(memberId)
        ? currentIds.filter((id) => id !== memberId)
        : [...currentIds, memberId],
    )
  }

  const toggleSelectAll = () => {
    if (isBulkActionRunning) {
      return
    }

    const filteredIds = filteredMembers.map((member) => member.id)

    setSelectedMemberIds((currentIds) => {
      if (filteredIds.every((id) => currentIds.includes(id))) {
        return currentIds.filter((id) => !filteredIds.includes(id))
      }

      return Array.from(new Set([...currentIds, ...filteredIds]))
    })
  }

  const runSendQrAction = async (memberIds?: string[]) => {
    const targetIds = memberIds && memberIds.length > 0 ? memberIds : selectedMemberIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un membre comité.', 'warning')
      return
    }

    markMembersBusy(targetIds)
    setIsBulkActionRunning(true)

    try {
      const result = await onSendCommitteeMemberQrs(targetIds)

      if (result.sentCount > 0 && result.failedMembers.length === 0) {
        onNotify(
          result.sentCount === 1
            ? 'Le QR comité a été envoyé.'
            : `${result.sentCount} emails QR comité ont été envoyés.`,
          'success',
        )
      } else if (result.sentCount > 0) {
        onNotify(
          `${result.sentCount} emails envoyés, ${result.failedMembers.length} membres restent en échec.`,
          'warning',
        )
      } else {
        onNotify("Aucun email QR comité n'a pu être envoyé.", 'error')
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Envoi des QR comité impossible.', 'error')
    } finally {
      clearMembersBusy(targetIds)
      setIsBulkActionRunning(false)
    }
  }

  const runDeleteAction = async (memberIds?: string[]) => {
    const targetIds = memberIds && memberIds.length > 0 ? memberIds : selectedMemberIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un membre comité.', 'warning')
      return
    }

    markMembersBusy(targetIds)
    setIsBulkActionRunning(true)

    try {
      let deletedCount = 0

      for (const memberId of targetIds) {
        try {
          await onDeleteCommitteeMember(memberId)
          deletedCount += 1
        } catch (error) {
          onNotify(error instanceof Error ? error.message : 'Suppression comité impossible.', 'error')
        }
      }

      if (deletedCount > 0) {
        onNotify(
          deletedCount === 1
            ? 'Le membre comité a été supprimé.'
            : `${deletedCount} membres comité ont été supprimés.`,
          'success',
        )
      }

      setSelectedMemberIds((currentIds) => currentIds.filter((id) => !targetIds.includes(id)))
    } finally {
      clearMembersBusy(targetIds)
      setIsBulkActionRunning(false)
    }
  }

  const runSetPresenceAction = async (present: boolean, memberIds?: string[]) => {
    const targetIds = memberIds && memberIds.length > 0 ? memberIds : selectedMemberIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un membre comité.', 'warning')
      return
    }

    const targetMembers = committeeMembers.filter(
      (member) => targetIds.includes(member.id) && Boolean(member.checkedInAt) !== present,
    )

    if (targetMembers.length === 0) {
      onNotify(
        present
          ? 'Tous les membres sélectionnés sont déjà présents.'
          : 'Tous les membres sélectionnés sont déjà absents.',
        'warning',
      )
      return
    }

    const targetMemberIds = targetMembers.map((member) => member.id)
    markMembersBusy(targetMemberIds)
    setIsBulkActionRunning(true)

    try {
      let updatedCount = 0

      for (const member of targetMembers) {
        try {
          await onSetCommitteeMemberPresence(member.id, present)
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
          updatedCount === 1
            ? present
              ? 'La présence du membre comité a été marquée.'
              : 'La présence du membre comité a été annulée.'
            : present
              ? `${updatedCount} présences comité ont été marquées.`
              : `${updatedCount} présences comité ont été annulées.`,
          'success',
        )
      }
    } finally {
      clearMembersBusy(targetMemberIds)
      setIsBulkActionRunning(false)
    }
  }

  return (
    <>
      <div className="committee-members-shell">
        <div className="admin-panel-block committee-members-panel">
          <div className="admin-toolbar committee-members-toolbar">
            <div className="admin-search">
              <Search className="admin-search-icon" size={18} />
              <input
                type="text"
                placeholder="Rechercher un membre comité..."
                className="input-field admin-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="committee-members-toolbar-actions">
              <div className="admin-selection-summary">
                {selectedMemberIds.length > 0
                  ? `${selectedMemberIds.length} sélectionné(s)`
                  : 'Aucune sélection'}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsStatsModalOpen(true)}
              >
                <BarChart3 size={16} /> Statistiques
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleImportClick}
                disabled={isBulkActionRunning}
              >
                <Upload size={16} /> Importer un CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
                disabled={isBulkActionRunning}
              >
                <UserPlus size={16} /> Ajouter un membre
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={handleImportFile}
              />
            </div>
          </div>

          <div className="admin-committee-bulk-bar">
            <label className="admin-checkbox-row">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                disabled={filteredMembers.length === 0 || isBulkActionRunning}
              />
              <span>Tout sélectionner</span>
            </label>
            <div className="admin-committee-bulk-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={selectedMemberIds.length === 0 || isBulkActionRunning || !hasSelectedAbsentMembers}
                onClick={() => void runSetPresenceAction(true)}
              >
                <UserCheck size={16} /> Marquer presence
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={selectedMemberIds.length === 0 || isBulkActionRunning || !hasSelectedPresentMembers}
                onClick={() => void runSetPresenceAction(false)}
              >
                <X size={16} /> Annuler presence
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedMemberIds.length === 0 || isBulkActionRunning}
                onClick={() => void runSendQrAction()}
              >
                <MailCheck size={16} /> Envoyer le QR
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={selectedMemberIds.length === 0 || isBulkActionRunning}
                onClick={() => void runDeleteAction()}
              >
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          </div>

          <div className="admin-table-wrapper committee-members-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nom complet</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Badge</th>
                  <th>Présence</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-empty-cell">
                      {committeeMembers.length === 0
                        ? 'Aucun membre comité.'
                        : 'Aucun résultat pour cette recherche.'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const isBusy = isMemberBusy(member.id)
                    const fullName = `${member.firstName} ${member.lastName}`.trim()
                    const badgeProfile = getCommitteeBadgeProfile(member.badgeType)

                    return (
                      <tr key={member.id}>
                        <td>
                          <label className="admin-checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(member.id)}
                              onChange={() => toggleSelection(member.id)}
                              disabled={isBulkActionRunning || isBusy}
                            />
                            <span className="sr-only">Sélectionner {fullName}</span>
                          </label>
                        </td>
                        <td className="admin-strong">{fullName}</td>
                        <td>{member.email}</td>
                        <td>{member.phone || '—'}</td>
                        <td>
                          <span
                            className={`committee-badge-pill ${
                              member.badgeType === 'ensatpress' ? 'is-ensatpress' : 'is-default'
                            }`}
                          >
                            {badgeProfile.label}
                          </span>
                        </td>
                        <td>
                          <div
                            className={`committee-presence-toggle ${
                              member.checkedInAt ? 'is-present' : ''
                            }`}
                          >
                            <span
                              className={`committee-presence-checkbox ${
                                member.checkedInAt ? 'is-present' : ''
                              }`}
                              aria-hidden="true"
                            >
                              {isBusy ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : member.checkedInAt ? (
                                <Check size={14} />
                              ) : null}
                            </span>
                            <span className="committee-presence-toggle-copy">
                              <strong>{member.checkedInAt ? 'Présent' : 'Absent'}</strong>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => closeCreateModal()}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="committee-member-modal-header">
              <div>
                <h3 className="admin-modal-title">Ajouter un membre comité</h3>
                <p className="admin-modal-copy">
                  Ajoutez un membre manuellement, puis envoyez-lui son QR code d’identification
                  comité.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeCreateModal()}
                disabled={isSavingMember}
              >
                <X size={16} /> Fermer
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="admin-modal-form">
              <div className="input-group">
                <label className="input-label">Prénom</label>
                <input
                  type="text"
                  className="input-field"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Nom</label>
                <input
                  type="text"
                  className="input-field"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Téléphone</label>
                <input
                  type="text"
                  className="input-field"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Badge attribué</label>
                <select
                  className="input-field"
                  value={badgeType}
                  onChange={(event) => setBadgeType(event.target.value as CommitteeBadgeType)}
                >
                  <option value="committee">Membre du comité</option>
                  <option value="ensatpress">ENSATPRESS</option>
                </select>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeCreateModal()}
                  disabled={isSavingMember}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingMember}>
                  {isSavingMember ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Enregistrement...
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

      {isStatsModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsStatsModalOpen(false)}>
          <div
            className="admin-modal committee-stats-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="committee-stats-topbar">
              <div className="committee-stats-hero">
                <div className="committee-stats-hero-icon">
                  <BarChart3 size={22} />
                </div>
                <div>
                  <div className="committee-stats-kicker">Suivi comité</div>
                  <h3 className="admin-modal-title">Statistiques du comité</h3>
                  <p className="committee-stats-copy">
                    Visualisez rapidement l’état des présences et régularisez les absents en un
                    clic.
                  </p>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsStatsModalOpen(false)}
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
                    <Check size={15} />
                  </span>
                </div>
                <strong className="committee-stats-value">{committeeStats.present}</strong>
                <span className="committee-stats-card-note">membres déjà pointés</span>
              </div>
              <div className="committee-stats-card is-absent">
                <div className="committee-stats-card-head">
                  <span className="committee-stats-label">Absents</span>
                  <span className="committee-stats-card-icon is-absent">
                    <X size={15} />
                  </span>
                </div>
                <strong className="committee-stats-value">{committeeStats.absent}</strong>
                <span className="committee-stats-card-note">membres à régulariser</span>
              </div>
            </div>

            <div className="committee-stats-absent-block">
              <div className="committee-stats-absent-header">
                <div className="committee-stats-absent-header-copy">
                  <h4>Absents à traiter</h4>
                  <p>
                    Ces membres n’ont pas encore été marqués présents. Vous pouvez corriger leur
                    statut directement depuis cette fenêtre.
                  </p>
                </div>
                <span className="committee-stats-count-badge">{committeeStats.absent}</span>
              </div>

              {absentMembers.length === 0 ? (
                <div className="committee-stats-empty">
                  <div className="committee-stats-empty-icon">
                    <Check size={18} />
                  </div>
                  <div>
                    <strong>Tout le comité est présent.</strong>
                    <p>Aucune action manuelle n’est nécessaire pour le moment.</p>
                  </div>
                </div>
              ) : (
                <div className="committee-stats-absent-list">
                  {absentMembers.map((member) => {
                    const fullName = `${member.firstName} ${member.lastName}`.trim()
                    const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`
                      .trim()
                      .toUpperCase()
                    const isBusy = isMemberBusy(member.id)

                    return (
                      <div key={member.id} className="committee-stats-absent-item">
                        <div className="committee-stats-absent-avatar" aria-hidden="true">
                          {initials || 'CM'}
                        </div>
                        <div className="committee-stats-absent-copy">
                          <div className="committee-stats-absent-name">{fullName}</div>
                          <div className="committee-stats-absent-meta">
                            <span>{member.email}</span>
                            {member.phone ? <span>{member.phone}</span> : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary committee-stats-absent-action"
                          disabled={isBusy || isBulkActionRunning}
                          onClick={() => void runSetPresenceAction(true, [member.id])}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="animate-spin" size={16} /> Marquage...
                            </>
                          ) : (
                            <>
                              <UserCheck size={16} /> Rendre présent
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
      )}
    </>
  )
}

export default CommitteeMembersManager
