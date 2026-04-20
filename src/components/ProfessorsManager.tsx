import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Loader2, MailCheck, Search, Trash2, Upload, UserPlus, X } from 'lucide-react'
import type { Professor } from '../types'
import type { PopupTone } from './InAppPopup'

interface ProfessorsManagerProps {
  professors: Professor[]
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
  onNotify: (message: string, tone?: PopupTone) => void
}

const formatDateTime = (value: string) => {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Inconnue'
  }

  return parsedDate.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const ProfessorsManager = ({
  professors,
  onImportProfessorsCsv,
  onCreateProfessor,
  onDeleteProfessor,
  onSendProfessorEmails,
  onNotify,
}: ProfessorsManagerProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProfessorIds, setSelectedProfessorIds] = useState<string[]>([])
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false)
  const [busyProfessorIds, setBusyProfessorIds] = useState<string[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSavingProfessor, setIsSavingProfessor] = useState(false)
  const [professorName, setProfessorName] = useState('')
  const [primaryEmail, setPrimaryEmail] = useState('')
  const [secondaryEmail, setSecondaryEmail] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const filteredProfessors = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return professors
    }

    return professors.filter((professor) =>
      [professor.name, professor.primaryEmail, professor.secondaryEmail ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [professors, searchQuery])

  const allFilteredSelected =
    filteredProfessors.length > 0 &&
    filteredProfessors.every((professor) => selectedProfessorIds.includes(professor.id))

  const isProfessorBusy = (professorId: string) => busyProfessorIds.includes(professorId)

  const markProfessorsBusy = (professorIds: string[]) => {
    setBusyProfessorIds((currentIds) =>
      Array.from(new Set([...currentIds, ...professorIds.filter(Boolean)])),
    )
  }

  const clearProfessorsBusy = (professorIds: string[]) => {
    setBusyProfessorIds((currentIds) => currentIds.filter((id) => !professorIds.includes(id)))
  }

  const resetCreateForm = () => {
    setProfessorName('')
    setPrimaryEmail('')
    setSecondaryEmail('')
  }

  const closeCreateModal = (force = false) => {
    if (isSavingProfessor && !force) {
      return
    }

    resetCreateForm()
    setIsCreateModalOpen(false)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSavingProfessor(true)

    try {
      await onCreateProfessor({
        name: professorName,
        primaryEmail,
        secondaryEmail,
      })
      onNotify('Professeur ajouté.', 'success')
      closeCreateModal(true)
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Ajout professeur impossible.', 'error')
    } finally {
      setIsSavingProfessor(false)
    }
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsBulkActionRunning(true)

    try {
      const rawCsv = await file.text()
      const result = await onImportProfessorsCsv(rawCsv)
      onNotify(
        `${result.importedCount} professeur(s) importé(s), ${result.skippedCount} ligne(s) ignorée(s).`,
        result.skippedCount > 0 ? 'warning' : 'success',
      )
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Import professeurs impossible.', 'error')
    } finally {
      event.target.value = ''
      setIsBulkActionRunning(false)
    }
  }

  const toggleSelection = (professorId: string) => {
    if (isBulkActionRunning || isProfessorBusy(professorId)) {
      return
    }

    setSelectedProfessorIds((currentIds) =>
      currentIds.includes(professorId)
        ? currentIds.filter((id) => id !== professorId)
        : [...currentIds, professorId],
    )
  }

  const toggleSelectAll = () => {
    if (isBulkActionRunning) {
      return
    }

    const filteredIds = filteredProfessors.map((professor) => professor.id)

    setSelectedProfessorIds((currentIds) => {
      if (filteredIds.every((id) => currentIds.includes(id))) {
        return currentIds.filter((id) => !filteredIds.includes(id))
      }

      return Array.from(new Set([...currentIds, ...filteredIds]))
    })
  }

  const runSendAction = async (professorIds?: string[]) => {
    const targetIds = professorIds && professorIds.length > 0 ? professorIds : selectedProfessorIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un professeur.', 'warning')
      return
    }

    markProfessorsBusy(targetIds)
    setIsBulkActionRunning(true)

    try {
      const result = await onSendProfessorEmails(targetIds)

      if (result.sentCount > 0 && result.failedProfessors.length === 0) {
        onNotify(
          result.sentCount === 1
            ? 'L’email a été envoyé au professeur sélectionné.'
            : `${result.sentCount} emails ont été envoyés aux professeurs sélectionnés.`,
          'success',
        )
      } else if (result.sentCount > 0) {
        onNotify(
          `${result.sentCount} email(s) envoyé(s), ${result.failedProfessors.length} professeur(s) en échec.`,
          'warning',
        )
      } else {
        onNotify("Aucun email n'a pu être envoyé aux professeurs sélectionnés.", 'error')
      }
    } catch (error) {
      onNotify(
        error instanceof Error ? error.message : "Envoi d'email professeurs impossible.",
        'error',
      )
    } finally {
      clearProfessorsBusy(targetIds)
      setIsBulkActionRunning(false)
    }
  }

  const runDeleteAction = async (professorIds?: string[]) => {
    const targetIds = professorIds && professorIds.length > 0 ? professorIds : selectedProfessorIds

    if (targetIds.length === 0) {
      onNotify('Sélectionnez au moins un professeur.', 'warning')
      return
    }

    markProfessorsBusy(targetIds)
    setIsBulkActionRunning(true)

    try {
      let deletedCount = 0

      for (const professorId of targetIds) {
        try {
          await onDeleteProfessor(professorId)
          deletedCount += 1
        } catch (error) {
          onNotify(
            error instanceof Error ? error.message : 'Suppression professeur impossible.',
            'error',
          )
        }
      }

      if (deletedCount > 0) {
        onNotify(
          deletedCount === 1
            ? 'Le professeur a été supprimé.'
            : `${deletedCount} professeurs ont été supprimés.`,
          'success',
        )
        setSelectedProfessorIds((currentIds) =>
          currentIds.filter((id) => !targetIds.includes(id)),
        )
      }
    } finally {
      clearProfessorsBusy(targetIds)
      setIsBulkActionRunning(false)
    }
  }

  return (
    <div className="committee-members-shell">
      <div className="admin-panel-block committee-members-panel">
        <div className="admin-toolbar committee-members-toolbar">
          <div className="admin-search">
            <Search className="admin-search-icon" size={18} />
            <input
              type="text"
              placeholder="Rechercher un professeur..."
              className="input-field admin-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="committee-members-toolbar-actions">
            <div className="admin-selection-summary">
              {selectedProfessorIds.length > 0
                ? `${selectedProfessorIds.length} sélectionné(s)`
                : 'Aucune sélection'}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
              disabled={isBulkActionRunning}
            >
              <UserPlus size={16} /> Ajouter manuellement
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleImportClick}
              disabled={isBulkActionRunning}
            >
              <Upload size={16} /> Importer un CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(event) => void handleImportFile(event)}
            />
          </div>
        </div>

        <p className="admin-settings-copy" style={{ marginBottom: '1rem' }}>
          Import attendu : nom, email personnel, email institutionnel. Si les deux adresses sont
          présentes, l&apos;email institutionnel est utilisé en priorité.
        </p>

        <div className="admin-committee-bulk-bar">
          <label className="admin-checkbox-row">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              disabled={filteredProfessors.length === 0 || isBulkActionRunning}
            />
            <span>Tout sélectionner</span>
          </label>
          <div className="admin-committee-bulk-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedProfessorIds.length === 0 || isBulkActionRunning}
              onClick={() => void runSendAction()}
            >
              <MailCheck size={16} /> Envoyer l&apos;email
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={selectedProfessorIds.length === 0 || isBulkActionRunning}
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
                <th>Professeur</th>
                <th>Email prioritaire</th>
                <th>Email secondaire</th>
                <th>Importé le</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfessors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty-cell">
                    {professors.length === 0
                      ? 'Aucun professeur importé.'
                      : 'Aucun résultat pour cette recherche.'}
                  </td>
                </tr>
              ) : (
                filteredProfessors.map((professor) => (
                  <tr key={professor.id}>
                    <td>
                      <label className="admin-checkbox-row">
                        <input
                          type="checkbox"
                          checked={selectedProfessorIds.includes(professor.id)}
                          onChange={() => toggleSelection(professor.id)}
                          disabled={isBulkActionRunning || isProfessorBusy(professor.id)}
                        />
                        <span className="sr-only">Sélectionner {professor.name}</span>
                      </label>
                    </td>
                    <td>
                      <div className="admin-strong">{professor.name}</div>
                    </td>
                    <td>
                      <div>{professor.primaryEmail}</div>
                    </td>
                    <td>
                      {professor.secondaryEmail ? (
                        <div>{professor.secondaryEmail}</div>
                      ) : (
                        <div className="admin-muted-small">Aucune adresse secondaire</div>
                      )}
                    </td>
                    <td>
                      {isProfessorBusy(professor.id) ? (
                        <div className="admin-status-pill" style={{ color: '#1d4ed8', background: 'rgba(59, 130, 246, 0.12)' }}>
                          <Loader2 className="animate-spin" size={14} />
                          Traitement...
                        </div>
                      ) : (
                        <div className="admin-muted-small">{formatDateTime(professor.createdAt)}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => closeCreateModal()}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="committee-member-modal-header">
              <div>
                <h3 className="admin-modal-title">Ajouter un professeur</h3>
                <p className="admin-modal-copy">
                  Renseignez un email principal. L&apos;email secondaire reste facultatif.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeCreateModal()}
                disabled={isSavingProfessor}
              >
                <X size={16} /> Fermer
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="admin-modal-form">
              <div className="input-group">
                <label className="input-label">Nom complet</label>
                <input
                  type="text"
                  className="input-field"
                  value={professorName}
                  onChange={(event) => setProfessorName(event.target.value)}
                  placeholder="Ex: Pr. Ahmed Alaoui"
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Email principal</label>
                <input
                  type="email"
                  className="input-field"
                  value={primaryEmail}
                  onChange={(event) => setPrimaryEmail(event.target.value)}
                  placeholder="prenom.nom@universite.ma"
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Email secondaire</label>
                <input
                  type="email"
                  className="input-field"
                  value={secondaryEmail}
                  onChange={(event) => setSecondaryEmail(event.target.value)}
                  placeholder="email secondaire facultatif"
                />
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeCreateModal()}
                  disabled={isSavingProfessor}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingProfessor}>
                  {isSavingProfessor ? (
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
    </div>
  )
}

export default ProfessorsManager
