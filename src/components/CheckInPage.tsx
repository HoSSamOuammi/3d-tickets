import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import {
  Camera,
  Loader2,
  LogIn,
  LogOut,
  LockKeyhole,
  QrCode,
  Search,
  ShieldCheck,
  User,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react'
import type { Participant } from '../types'
import type { PopupTone } from './InAppPopup'

type CheckInSearchMode = 'ticket' | 'contact'
type CheckInCredentials = {
  username: string
  password: string
}

interface CheckInLookupResult {
  found: boolean
  participant?: Participant
  presenceRecorded?: boolean
  alreadyPresent?: boolean
}

interface CheckInPageProps {
  logo: string
  isAuthenticated: boolean
  canOpenAdminSpace: boolean
  isLoggingIn: boolean
  onLogin: (credentials: CheckInCredentials) => Promise<boolean>
  onLogout: () => void
  onOpenAdminSpace: () => void
  onSearch: (mode: CheckInSearchMode, query: string) => Promise<CheckInLookupResult>
  onNotify: (message: string, tone?: PopupTone) => void
}

interface ResultModalState {
  tone: 'success' | 'warning' | 'error'
  title: string
  description: string
  participant?: Participant
}

interface SearchOptions {
  clearInput?: boolean
}

const emptyCredentials: CheckInCredentials = {
  username: '',
  password: '',
}

const getCameraErrorMessage = (error: unknown) => {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Le scan caméra demande une connexion sécurisée en HTTPS.'
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return "L'accès à la caméra a été refusé. Autorisez la caméra puis réessayez."
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Aucune caméra compatible n’a été détectée sur cet appareil.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'La caméra est déjà utilisée par une autre application.'
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return "Impossible d'utiliser la caméra arrière. Réessayez avec un autre appareil."
      case 'SecurityError':
        return 'Le navigateur bloque la caméra. Ouvrez la page en HTTPS.'
      default:
        return 'Impossible de lancer la caméra pour le scan du QR code.'
    }
  }

  return 'Impossible de lancer la caméra pour le scan du QR code.'
}

const CheckInPage = ({
  logo,
  isAuthenticated,
  canOpenAdminSpace,
  isLoggingIn,
  onLogin,
  onLogout,
  onOpenAdminSpace,
  onSearch,
  onNotify,
}: CheckInPageProps) => {
  const [credentials, setCredentials] = useState<CheckInCredentials>(emptyCredentials)
  const [ticketQuery, setTicketQuery] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [searchingMode, setSearchingMode] = useState<CheckInSearchMode | null>(null)
  const [resultModal, setResultModal] = useState<ResultModalState | null>(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const isCameraActiveRef = useRef(false)
  const isSearchInFlightRef = useRef(false)
  const lastScannedTicketRef = useRef('')
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
    isSearchInFlightRef.current = false
    emptyFrameCountRef.current = 0
    lastScannedTicketRef.current = ''

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

  useEffect(() => {
    if (!isAuthenticated) {
      stopCamera()
    }
  }, [isAuthenticated])

  const openResult = (result: CheckInLookupResult) => {
    if (!result.found || !result.participant) {
      setResultModal({
        tone: 'error',
        title: 'Aucune inscription trouvée',
        description: "Aucun participant ne correspond à cette recherche.",
      })
      return
    }
    setResultModal({
      tone: result.alreadyPresent ? 'warning' : 'success',
      title: result.alreadyPresent
        ? 'Participant deja pointe'
        : result.presenceRecorded
          ? 'Participant present'
          : 'Participant trouve',
      description: result.alreadyPresent
        ? "Le participant etait deja marque present."
        : result.presenceRecorded
          ? "La presence du participant vient d'etre enregistree."
          : "Le participant peut acceder a l'evenement.",
      participant: result.participant,
    })
  }

  const runSearch = async (
    mode: CheckInSearchMode,
    rawQuery: string,
    options: SearchOptions = {},
  ) => {
    const query = rawQuery.trim()

    if (!query) {
      onNotify(
        mode === 'ticket'
          ? 'Veuillez scanner un QR code ou saisir un ID ticket.'
          : 'Veuillez saisir un email ou un numéro de téléphone.',
        'warning',
      )
      return
    }

    setSearchingMode(mode)

    try {
      const result = await onSearch(mode, query)
      openResult(result)

      if (mode === 'ticket') {
        setTicketQuery(options.clearInput === false ? query : '')
      } else {
        setContactQuery('')
      }
    } catch (error) {
      onNotify(
        error instanceof Error
          ? error.message
          : 'Marquage de présence impossible pour le moment.',
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
      isSearchInFlightRef.current
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
      setCameraError("Impossible d'initialiser le lecteur caméra sur ce navigateur.")
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
        lastScannedTicketRef.current = ''
      }

      scheduleNextScanFrame()
      return
    }

    emptyFrameCountRef.current = 0
    const scannedTicketId = detectedCode.data.trim()

    if (scannedTicketId === lastScannedTicketRef.current) {
      scheduleNextScanFrame()
      return
    }

    lastScannedTicketRef.current = scannedTicketId
    isSearchInFlightRef.current = true
    setTicketQuery(scannedTicketId)
    void runSearch('ticket', scannedTicketId, { clearInput: false }).finally(() => {
      isSearchInFlightRef.current = false
      scheduleNextScanFrame()
    })
  }

  const startCamera = async () => {
    if (isStartingCamera || isCameraOpen || searchingMode !== null) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "La caméra n'est pas disponible sur ce navigateur."
      setCameraError(message)
      return
    }

    if (window.isSecureContext === false) {
      const message = 'Le scan caméra demande une connexion sécurisée en HTTPS.'
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
    if (!isAuthenticated || isCameraOpen || isStartingCamera || streamRef.current || cameraError) {
      return
    }

    void startCameraRef.current()
  }, [cameraError, isAuthenticated, isCameraOpen, isStartingCamera])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    const success = await onLogin(credentials)

    if (success) {
      setCredentials(emptyCredentials)
    }
  }

  const handleSearch = async (mode: CheckInSearchMode) => {
    await runSearch(mode, mode === 'ticket' ? ticketQuery : contactQuery)
  }

  return (
    <div className="checkin-page">
      <div className="checkin-shell">
        <div className="checkin-brand">
          <img src={logo} alt="3D Impact" className="checkin-logo" />
          <div>
            <div className="checkin-eyebrow">
              <ShieldCheck size={16} />
              <span>Check-in Console</span>
            </div>
            <h1 className="checkin-title">3D Impact Check-in</h1>
            <p className="checkin-copy">
              Vérification rapide des participants par QR code, email ou téléphone.
            </p>
          </div>
          {isAuthenticated && (
            <div className="checkin-header-actions">
              {canOpenAdminSpace && (
                <button
                  type="button"
                  className="btn btn-primary checkin-admin-entry"
                  onClick={onOpenAdminSpace}
                >
                  <ShieldCheck size={18} /> Ouvrir l&apos;espace admin
                </button>
              )}
              <button type="button" className="btn btn-secondary checkin-logout" onClick={onLogout}>
                <LogOut size={18} /> Déconnexion
              </button>
            </div>
          )}
        </div>

        {!isAuthenticated ? (
          <section className="checkin-card">
            <div className="checkin-card-header">
              <LogIn size={20} />
              <h2>Connexion</h2>
            </div>

            <p className="checkin-card-copy">
              Connectez-vous avec `Admin` ou avec l&apos;email d&apos;un utilisateur comité autorisé
              pour ouvrir la console de vérification.
            </p>

            <form className="checkin-login-form" onSubmit={handleLogin}>
              <div className="input-group">
                <label className="input-label">Utilisateur ou email</label>
                <input
                  type="text"
                  className="input-field"
                  value={credentials.username}
                  onChange={(event) =>
                    setCredentials((current: CheckInCredentials) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  placeholder="Admin ou email@exemple.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Mot de passe</label>
                <input
                  type="password"
                  className="input-field"
                  value={credentials.password}
                  onChange={(event) =>
                    setCredentials((current: CheckInCredentials) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Mot de passe"
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary checkin-submit" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Connexion...
                  </>
                ) : (
                  <>
                    <LogIn size={18} /> Ouvrir la page de check-in
                  </>
                )}
              </button>
            </form>
          </section>
        ) : (
          <section className="checkin-search-layout">
            <article className="checkin-card">
              <div className="checkin-card-header">
                <QrCode size={20} />
                <h2>Recherche QR code</h2>
              </div>
              <p className="checkin-card-copy">
                La caméra reste ouverte en continu pour lire directement le QR code du badge. La
                recherche manuelle reste disponible en secours.
              </p>
              <div className="checkin-camera-panel">
                <div className="checkin-camera-preview">
                  <video
                    ref={videoRef}
                    className="checkin-camera-video"
                    autoPlay
                    muted
                    playsInline
                  />
                  <div className="checkin-camera-guide" aria-hidden="true" />
                  {!isCameraOpen && !cameraError && (
                    <div className="checkin-camera-overlay">
                      {isStartingCamera ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          <span>Ouverture de la caméra...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={20} />
                          <span>Caméra en attente</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <p className="checkin-camera-hint">
                  Placez le QR code du badge dans le cadre. La recherche se lance automatiquement
                  dès qu'il est détecté, puis le scan reprend sans fermer la caméra.
                </p>
                {!isCameraOpen && !isStartingCamera && (
                  <button
                    type="button"
                    className="btn btn-secondary checkin-submit"
                    onClick={() => {
                      setCameraError('')
                      void startCamera()
                    }}
                  >
                    <Camera size={18} /> Relancer la caméra
                  </button>
                )}
              </div>

              {cameraError && <p className="checkin-camera-error">{cameraError}</p>}

              <div className="checkin-divider">
                <span>Ou saisir l’ID ticket</span>
              </div>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">QR code / ID ticket</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ex: ENA-ABC123"
                  value={ticketQuery}
                  onChange={(event) => setTicketQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary checkin-submit"
                disabled={searchingMode !== null}
                onClick={() => void handleSearch('ticket')}
              >
                {searchingMode === 'ticket' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Vérification...
                  </>
                ) : (
                  <>
                    <Search size={18} /> Vérifier le QR code
                  </>
                )}
              </button>
            </article>

            <article className="checkin-card">
              <div className="checkin-card-header">
                <LockKeyhole size={20} />
                <User size={20} />
                <h2>Recherche téléphone / email</h2>
              </div>
              <p className="checkin-card-copy">
                Recherchez un participant avec son email ou son numéro de téléphone.
              </p>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label className="input-label">Email ou téléphone</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="email@exemple.com ou 06XXXXXXXX"
                  value={contactQuery}
                  onChange={(event) => setContactQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary checkin-submit"
                disabled={searchingMode !== null}
                onClick={() => void handleSearch('contact')}
              >
                {searchingMode === 'contact' ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Recherche...
                  </>
                ) : (
                  <>
                    <Search size={18} /> Verifier le participant
                  </>
                )}
              </button>
            </article>
          </section>
        )}
      </div>

      {resultModal && (
        <div className="checkin-result-backdrop" onClick={() => setResultModal(null)}>
          <div
            className={`checkin-result-modal checkin-result-${resultModal.tone}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="checkin-result-icon">
              {resultModal.tone === 'success' ? (
                <UserRoundCheck size={34} />
              ) : resultModal.tone === 'warning' ? (
                <ShieldCheck size={34} />
              ) : (
                <UserRoundX size={34} />
              )}
            </div>
            <h3>{resultModal.title}</h3>
            <p>{resultModal.description}</p>

            {resultModal.participant && (
              <div className="checkin-result-meta">
                <div className="checkin-result-name">
                  {resultModal.participant.firstName} {resultModal.participant.lastName}
                </div>
                <div>{resultModal.participant.id}</div>
                <div>{resultModal.participant.type === 'internal' ? 'Étudiant ENSA' : 'Externe'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="checkin-camera-canvas" aria-hidden="true" />
    </div>
  )
}

export default CheckInPage
