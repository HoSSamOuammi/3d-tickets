import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2, Users } from 'lucide-react'
import {
  buildBrowserJourJSnapshot,
  buildLocalJourJSnapshot,
  LOCAL_JOURJ_ADJUSTMENT_STORAGE_KEY,
  readStoredJourJAdjustment,
} from '../lib/jourj'
import { remoteAdjustJourJ, remoteFetchJourJSnapshot } from '../lib/remoteApi'
import type { CommitteeMember, JourJSnapshot, Participant } from '../types'
import type { PopupTone } from './InAppPopup'

type DataMode = 'checking' | 'local' | 'remote'

interface JourJMonitorProps {
  dataMode: DataMode
  registrants: Participant[]
  committeeMembers: CommitteeMember[]
  maxInsideCapacity: number | null
  logo: string
  onNotify: (message: string, tone?: PopupTone) => void
  isPublic?: boolean
}

const POLL_INTERVAL_MS = 1000

const formatSnapshotTime = (value: string) => {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return "a l'instant"
  }

  return parsedDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const JourJMonitor = ({
  dataMode,
  registrants,
  committeeMembers,
  maxInsideCapacity,
  logo,
  onNotify,
  isPublic = false,
}: JourJMonitorProps) => {
  const localSnapshot = useMemo(
    () =>
      buildLocalJourJSnapshot(
        registrants,
        committeeMembers,
        readStoredJourJAdjustment(),
        maxInsideCapacity,
      ),
    [committeeMembers, maxInsideCapacity, registrants],
  )
  const [snapshot, setSnapshot] = useState<JourJSnapshot>(localSnapshot)
  const [deltaInput, setDeltaInput] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false)

  useEffect(() => {
    if (dataMode !== 'local') {
      return
    }

    const refreshLocalSnapshot = () => {
      setSnapshot(buildBrowserJourJSnapshot(maxInsideCapacity))
    }

    refreshLocalSnapshot()

    const handleStorage = () => {
      refreshLocalSnapshot()
    }

    window.addEventListener('storage', handleStorage)
    const intervalId = window.setInterval(() => {
      refreshLocalSnapshot()
    }, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.clearInterval(intervalId)
    }
  }, [dataMode, maxInsideCapacity])

  useEffect(() => {
    if (dataMode !== 'remote') {
      return
    }

    let isDisposed = false

    const refreshSnapshot = async (showLoader = false) => {
      if (showLoader && !isDisposed) {
        setIsRefreshing(true)
      }

      try {
        const nextSnapshot = await remoteFetchJourJSnapshot()

        if (!isDisposed) {
          setSnapshot(nextSnapshot)
        }
      } catch (error) {
        if (!isDisposed) {
          console.error('Synchronisation Jour J impossible :', error)
        }
      } finally {
        if (showLoader && !isDisposed) {
          setIsRefreshing(false)
        }
      }
    }

    void refreshSnapshot(true)

    const intervalId = window.setInterval(() => {
      void refreshSnapshot()
    }, POLL_INTERVAL_MS)

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
    }
  }, [dataMode])

  useEffect(() => {
    if (dataMode === 'checking') {
      return
    }

    if (dataMode === 'local') {
      setSnapshot(buildBrowserJourJSnapshot(maxInsideCapacity))
    }
  }, [dataMode, localSnapshot, maxInsideCapacity])

  const handleApplyAdjustment = async () => {
    const trimmedDelta = deltaInput.trim()

    if (!/^[+-]?\d+$/.test(trimmedDelta)) {
      onNotify(
        "Saisissez n'importe quel entier signe ou non signe, par exemple +12, -3 ou 5.",
        'warning',
      )
      return
    }

    const parsedDelta = Number(trimmedDelta)

    if (!Number.isInteger(parsedDelta) || parsedDelta === 0) {
      onNotify(
        'Saisissez un nombre entier different de 0, par exemple +12, -3 ou 5.',
        'warning',
      )
      return
    }

    setIsSubmittingAdjustment(true)

    try {
      if (dataMode === 'remote') {
        const nextSnapshot = await remoteAdjustJourJ(parsedDelta)
        setSnapshot(nextSnapshot)
      } else {
        const nextManualAdjustment = readStoredJourJAdjustment() + parsedDelta
        window.localStorage.setItem(
          LOCAL_JOURJ_ADJUSTMENT_STORAGE_KEY,
          String(nextManualAdjustment),
        )
        setSnapshot(buildBrowserJourJSnapshot(maxInsideCapacity))
      }

      setDeltaInput('')
      onNotify('Ajustement Jour J enregistre.', 'success')
    } catch (error) {
      console.error('Ajustement Jour J impossible :', error)
      onNotify(
        error instanceof Error ? error.message : "Impossible d'enregistrer cet ajustement.",
        'error',
      )
    } finally {
      setIsSubmittingAdjustment(false)
    }
  }

  const handleAdjustmentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleApplyAdjustment()
  }

  if (dataMode === 'checking') {
    return (
      <div className={`jourj-shell ${isPublic ? 'is-public' : 'is-admin'}`}>
        <div className="jourj-card glass">
          <div className="jourj-loading">
            <Loader2 className="animate-spin" size={28} />
            <span>Chargement des donnees...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`jourj-shell ${isPublic ? 'is-public' : 'is-admin'}`}>
      <section className={`jourj-card glass ${isPublic ? 'is-public' : 'is-admin'}`}>
        <div className="jourj-card-header">
          <div className="jourj-card-brand">
            {isPublic && <img src={logo} alt="Logo 3D Impact" className="jourj-logo" />}
            <div>
              <div className="jourj-kicker">Jour J</div>
              <h1 className="jourj-title">Effectif en salle</h1>
            </div>
          </div>

          <div className="jourj-live-status" aria-live="polite">
            {isRefreshing ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Synchronisation...
              </>
            ) : dataMode === 'remote' ? (
              <>Synchronisation en temps reel</>
            ) : (
              <>Suivi actif</>
            )}
          </div>
        </div>

        <div className="jourj-big-number-wrap">
          <div className="jourj-count-label">
            <Users size={18} />
            <span>Personnes presentes</span>
          </div>
          <div className="jourj-big-number">{snapshot.insideCount}</div>
          {snapshot.isCapacityReached ? (
            <div className="jourj-capacity-alert">Capacite maximale atteinte</div>
          ) : null}
          <div className="jourj-meta">
            <span>Check-in : {snapshot.checkedInCount}</span>
            <span>
              Ajustement : {snapshot.manualAdjustment >= 0 ? '+' : ''}
              {snapshot.manualAdjustment}
            </span>
            <span>Capacite : {snapshot.maxInsideCapacity !== null ? snapshot.maxInsideCapacity : '-'}</span>
            <span>Maj : {formatSnapshotTime(snapshot.updatedAt)}</span>
          </div>
        </div>

        <div className="jourj-adjust-panel">
          <div className="jourj-adjust-copy">
            <h2>Ajustement manuel</h2>
          </div>

          <form className="jourj-adjust-form" onSubmit={handleAdjustmentSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="jourj-adjustment-input">
                Valeur signee
              </label>
              <input
                id="jourj-adjustment-input"
                type="text"
                inputMode="text"
                className="input-field"
                placeholder="Ex. +12 / -3 / 5"
                value={deltaInput}
                onChange={(event) => setDeltaInput(event.target.value)}
                disabled={isSubmittingAdjustment}
              />
            </div>

            <div className="jourj-adjust-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmittingAdjustment}
              >
                {isSubmittingAdjustment ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Enregistrement...
                  </>
                ) : (
                  <>Enregistrer</>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

export default JourJMonitor
