import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, Loader2, X } from 'lucide-react'

interface QrScannerModalProps {
  isOpen: boolean
  title: string
  description: string
  onClose: () => void
  onScan: (decodedValue: string) => Promise<void> | void
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
      default:
        return 'Impossible de lancer la caméra pour le scan du QR code.'
    }
  }

  return 'Impossible de lancer la caméra pour le scan du QR code.'
}

const QrScannerModal = ({
  isOpen,
  title,
  description,
  onClose,
  onScan,
}: QrScannerModalProps) => {
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRequestRef = useRef<number | null>(null)
  const isCameraActiveRef = useRef(false)
  const isProcessingScanRef = useRef(false)
  const lastScannedValueRef = useRef('')
  const lastScannedAtRef = useRef(0)

  const stopCamera = () => {
    isCameraActiveRef.current = false
    isProcessingScanRef.current = false
    lastScannedValueRef.current = ''
    lastScannedAtRef.current = 0

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

    setIsStartingCamera(false)
  }

  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      setCameraError('')
      return
    }

    let isCancelled = false

    const scheduleNextFrame = () => {
      if (!isCameraActiveRef.current) {
        return
      }

      frameRequestRef.current = window.requestAnimationFrame(processFrame)
    }

    const processFrame = async () => {
      if (!isCameraActiveRef.current) {
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas) {
        scheduleNextFrame()
        return
      }

      if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || isProcessingScanRef.current) {
        scheduleNextFrame()
        return
      }

      const frameWidth = video.videoWidth
      const frameHeight = video.videoHeight

      if (!frameWidth || !frameHeight) {
        scheduleNextFrame()
        return
      }

      canvas.width = frameWidth
      canvas.height = frameHeight

      const context = canvas.getContext('2d', { willReadFrequently: true })

      if (!context) {
        scheduleNextFrame()
        return
      }

      context.drawImage(video, 0, 0, frameWidth, frameHeight)
      const imageData = context.getImageData(0, 0, frameWidth, frameHeight)
      const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (!qrResult?.data) {
        scheduleNextFrame()
        return
      }

      const normalizedValue = qrResult.data.trim()
      const now = Date.now()

      if (
        normalizedValue &&
        normalizedValue === lastScannedValueRef.current &&
        now - lastScannedAtRef.current < 2000
      ) {
        scheduleNextFrame()
        return
      }

      lastScannedValueRef.current = normalizedValue
      lastScannedAtRef.current = now
      isProcessingScanRef.current = true

      try {
        await onScan(normalizedValue)
      } finally {
        window.setTimeout(() => {
          isProcessingScanRef.current = false
        }, 500)
        scheduleNextFrame()
      }
    }

    const startCamera = async () => {
      setIsStartingCamera(true)
      setCameraError('')

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        })

        if (isCancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = mediaStream

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play()
        }

        isCameraActiveRef.current = true
        setIsStartingCamera(false)
        scheduleNextFrame()
      } catch (error) {
        if (!isCancelled) {
          setCameraError(getCameraErrorMessage(error))
          setIsStartingCamera(false)
          stopCamera()
        }
      }
    }

    void startCamera()

    return () => {
      isCancelled = true
      stopCamera()
    }
  }, [isOpen, onScan])

  if (!isOpen) {
    return null
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal qr-scanner-modal" onClick={(event) => event.stopPropagation()}>
        <div className="qr-scanner-modal-header">
          <div>
            <h3 className="admin-modal-title">{title}</h3>
            <p className="admin-modal-copy">{description}</p>
          </div>
          <button type="button" className="btn btn-secondary qr-scanner-close" onClick={onClose}>
            <X size={16} />
            Fermer
          </button>
        </div>

        <div className="qr-scanner-stage">
          <video ref={videoRef} className="qr-scanner-video" playsInline muted />
          <div className="qr-scanner-frame" aria-hidden="true" />
          <canvas ref={canvasRef} className="qr-scanner-canvas" />
          {isStartingCamera && (
            <div className="qr-scanner-overlay">
              <Loader2 className="animate-spin" size={20} />
              <span>Ouverture de la caméra...</span>
            </div>
          )}
          {!isStartingCamera && cameraError && (
            <div className="qr-scanner-overlay qr-scanner-error">
              <Camera size={20} />
              <span>{cameraError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default QrScannerModal
