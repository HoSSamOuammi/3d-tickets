import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import {
  Camera,
  CheckCircle2,
  Loader2,
  QrCode,
  Search,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import type { AdminPresenceLookupResult } from '../types'
import type { PopupTone } from './InAppPopup'

interface AdminPresenceManagerProps {
  onLookup: (mode: 'qr' | 'contact', query: string) => Promise<AdminPresenceLookupResult>
  onNotify: (message: string, tone?: PopupTone) => void
}

interface PresenceResultModalState {
  tone: 'success' | 'warning' | 'error'
  title: string
  description: string
  primaryLine?: string
  secondaryLine?: string
}

const getCameraErrorMessage = (error: unknown) => {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Le scan camera demande une connexion securisee en HTTPS.'
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return "L'acces a la camera a ete refuse. Autorisez la camera puis reessayez."
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return "Aucune camera compatible n'a ete detectee sur cet appareil."
      case 'NotReadableError':
      case 'TrackStartError':
        return 'La camera est deja utilisee par une autre application.'
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return "Impossible d'utiliser la camera arriere. Reessayez avec un autre appareil."
      default:
        return 'Impossible de lancer la camera pour le scan du QR code.'
    }
  }

  return 'Impossible de lancer la camera pour le scan du QR code.'
}

const AdminPresenceManager = ({ onLookup, onNotify }: AdminPresenceManagerProps) => {
  const [contactQuery, setContactQuery] = useState('')
  const [searchingMode, setSearchingMode] = useState<'qr' | 'contact' | null>(null)
  const [resultModal, setResultModal] = useState<PresenceResultModalState | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const isCameraActiveRef = useRef(false)
  const isLookupInFlightRef = useRef(false)
  const lastScannedValueRef = useRef('')
  const emptyFrameCountRef = useRef(0)
  const startCameraRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!resultModal) {
      return
    }

    const timerId = window.setTimeout(() => {
      setResultModal(null)
    }, 3000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [resultModal])

  const stopCamera = () => {
    isCameraActiveRef.current = false
    isLookupInFlightRef.current = false
    emptyFrameCountRef.current = 0
    lastScannedValueRef.current = ''

    if (frameRequestRef.current !== null) {
      window.cancelAnimationFrame(frameRequestRef.current)
      frameRequestRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setIsCameraOpen(false)
    setIsStartingCamera(false)
  }

  useEffect(() => () => stopCamera(), [])

  const openResult = (result: AdminPresenceLookupResult) => {
    if (!result.found) {
      setResultModal({
        tone: 'error',
        title: 'Aucun profil trouve',
        description: "Aucun participant ni membre du comite ne correspond a cette recherche.",
      })
      return
    }

    if (result.entityType === 'committee_member') {
      const fullName = `${result.committeeMember.firstName} ${result.committeeMember.lastName}`.trim()
      setResultModal({
        tone: result.alreadyPresent ? 'warning' : 'success',
        title: result.alreadyPresent ? 'Membre comite deja present' : 'Membre comite marque present',
        description: result.alreadyPresent
          ? "La presence de ce membre du comite etait deja enregistree."
          : "La presence du membre du comite vient d'etre enregistree.",
        primaryLine: fullName,
        secondaryLine: result.committeeMember.email,
      })
      return
    }

    const fullName = `${result.participant.firstName} ${result.participant.lastName}`.trim()
    setResultModal({
      tone: result.alreadyPresent ? 'warning' : 'success',
      title: result.alreadyPresent ? 'Participant deja present' : 'Participant marque present',
      description: result.alreadyPresent
        ? 'La presence de ce participant etait deja enregistree.'
        : 'La presence du participant vient d etre enregistree.',
      primaryLine: fullName,
      secondaryLine: result.participant.id,
    })
  }

  const runLookup = async (mode: 'qr' | 'contact', rawQuery: string, clearContact = false) => {
    const query = rawQuery.trim()

    if (!query) {
      onNotify(
        mode === 'contact'
          ? 'Veuillez saisir un email ou un numero de telephone.'
          : 'Veuillez scanner un QR code valide.',
        'warning',
      )
      return
    }

    setSearchingMode(mode)

    try {
      const result = await onLookup(mode, query)
      openResult(result)

      if (clearContact) {
        setContactQuery('')
      }
    } catch (error) {
      onNotify(
        error instanceof Error ? error.message : 'Marquage de presence impossible pour le moment.',
        'error',
      )
    } finally {
      setSearchingMode(null)
    }
  }

  const scheduleNextScanFrame = () => {
    if (!isCameraActiveRef.current) {
      return
    }

    frameRequestRef.current = window.requestAnimationFrame(processVideoFrame)
  }

  const processVideoFrame = () => {
    if (!isCameraActiveRef.current) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      scheduleNextScanFrame()
      return
    }

    if (
      video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
      searchingMode !== null ||
      resultModal !== null ||
      isLookupInFlightRef.current
    ) {
      scheduleNextScanFrame()
      return
    }

    const frameWidth = video.videoWidth
    const frameHeight = video.videoHeight

    if (!frameWidth || !frameHeight) {
      scheduleNextScanFrame()
      return
    }

    const context = canvas.getContext('2d', { willReadFrequently: true })

    if (!context) {
      stopCamera()
      setCameraError("Impossible d'initialiser le lecteur camera sur ce navigateur.")
      return
    }

    canvas.width = frameWidth
    canvas.height = frameHeight
    context.drawImage(video, 0, 0, frameWidth, frameHeight)
    const imageData = context.getImageData(0, 0, frameWidth, frameHeight)
    const detectedCode = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (!detectedCode?.data?.trim()) {
      emptyFrameCountRef.current += 1

      if (emptyFrameCountRef.current > 12) {
        lastScannedValueRef.current = ''
      }

      scheduleNextScanFrame()
      return
    }

    emptyFrameCountRef.current = 0
    const scannedValue = detectedCode.data.trim()

    if (scannedValue === lastScannedValueRef.current) {
      scheduleNextScanFrame()
      return
    }

    lastScannedValueRef.current = scannedValue
    isLookupInFlightRef.current = true

    void runLookup('qr', scannedValue).finally(() => {
      isLookupInFlightRef.current = false
      scheduleNextScanFrame()
    })
  }

  const startCamera = async () => {
    if (isStartingCamera || isCameraOpen || searchingMode !== null) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "La camera n'est pas disponible sur ce navigateur."
      setCameraError(message)
      return
    }

    if (window.isSecureContext === false) {
      const message = 'Le scan camera demande une connexion securisee en HTTPS.'
      setCameraError(message)
      return
    }

    setCameraError('')
    setIsStartingCamera(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
      })

      streamRef.current = stream
      isCameraActiveRef.current = true
      setIsCameraOpen(true)
      const video = videoRef.current

      if (video) {
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        video.muted = true
        await video.play()
      }

      scheduleNextScanFrame()
    } catch (error) {
      stopCamera()
      const message = getCameraErrorMessage(error)
      setCameraError(message)
    } finally {
      setIsStartingCamera(false)
    }
  }

  startCameraRef.current = startCamera

  useEffect(() => {
    if (isCameraOpen || isStartingCamera || streamRef.current || cameraError) {
      return
    }

    void startCameraRef.current()
  }, [cameraError, isCameraOpen, isStartingCamera])

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await runLookup('contact', contactQuery, true)
  }

  return (
    <>
      <div className="admin-presence-grid">
        <section className="admin-presence-panel">
          <div className="admin-presence-panel-header">
            <QrCode size={20} />
            <div>
              <h2>Lecteur QR unique</h2>
              <p className="admin-presence-copy">
                Ce lecteur detecte automatiquement les QR comite et les badges participants.
              </p>
            </div>
          </div>

          {cameraError && <div className="checkin-camera-error">{cameraError}</div>}

          <div className="checkin-camera-panel admin-presence-camera-panel">
            <div className="checkin-camera-preview admin-presence-camera-preview">
              <video ref={videoRef} className="checkin-camera-video" playsInline muted />
              <div className="checkin-camera-guide" aria-hidden="true" />
              {(isStartingCamera || (!isCameraOpen && !cameraError)) && (
                <div className="checkin-camera-overlay">
                  {isStartingCamera ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Ouverture de la camera...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={20} />
                      <span>Preparation du lecteur QR...</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="checkin-camera-hint">
              Presentez un badge participant ou un QR membre comite devant la camera. La presence
              sera enregistree sans recharger la page.
            </p>
            {!isCameraOpen && !isStartingCamera && (
              <button
                type="button"
                className="btn btn-secondary admin-presence-submit admin-presence-camera-action"
                onClick={() => {
                  setCameraError('')
                  void startCamera()
                }}
              >
                <Camera size={16} /> Relancer la camera
              </button>
            )}
          </div>
          <canvas ref={canvasRef} className="checkin-camera-canvas" />
        </section>

        <section className="admin-presence-panel">
          <div className="admin-presence-panel-header">
            <Search size={20} />
            <div>
              <h2>Recherche par email ou telephone</h2>
              <p className="admin-presence-copy">
                Utilisez ce champ quand le QR n est pas disponible. Le systeme decide s il s agit
                d un participant ou d un membre comite.
              </p>
            </div>
          </div>

          <form className="admin-presence-form" onSubmit={handleContactSubmit}>
            <div className="input-group">
              <label className="input-label">Email ou numero de telephone</label>
              <input
                type="text"
                className="input-field"
                placeholder="exemple@email.com ou 06XXXXXXXX"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary admin-presence-submit"
              disabled={searchingMode === 'contact'}
            >
              {searchingMode === 'contact' ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Recherche...
                </>
              ) : (
                <>
                  <UserCheck size={16} /> Marquer presence
                </>
              )}
            </button>
          </form>

          <div className="admin-presence-hint">
            <Users size={18} />
            <span>
              Un participant ne peut pas etre membre du comite, et un membre du comite ne peut pas
              etre participant. Les conflits sont bloques a la source.
            </span>
          </div>
        </section>
      </div>

      {resultModal && (
        <div className="checkin-result-backdrop" aria-live="polite">
          <div
            className={`checkin-result-modal ${
              resultModal.tone === 'success'
                ? 'checkin-result-success'
                : resultModal.tone === 'warning'
                  ? 'checkin-result-warning'
                  : 'checkin-result-error'
            }`}
          >
            <div className="checkin-result-icon">
              {resultModal.tone === 'error' ? (
                <XCircle size={30} />
              ) : resultModal.tone === 'warning' ? (
                <Camera size={30} />
              ) : (
                <CheckCircle2 size={30} />
              )}
            </div>
            <h3>{resultModal.title}</h3>
            <p>{resultModal.description}</p>
            {(resultModal.primaryLine || resultModal.secondaryLine) && (
              <div className="checkin-result-meta">
                {resultModal.primaryLine && (
                  <div className="checkin-result-name">{resultModal.primaryLine}</div>
                )}
                {resultModal.secondaryLine && <div>{resultModal.secondaryLine}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default AdminPresenceManager
