import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'
import emailjs from '@emailjs/browser'
import QRCode from 'qrcode'
import RegistrationForm from './components/RegistrationForm'
import SuccessPage from './components/SuccessPage'
import AdminPanel from './components/AdminPanel'
import InAppPopup, { type PopupItem, type PopupTone } from './components/InAppPopup'
import { isAdminAccessAttempt } from './security/adminAccess'
import { reserveDeviceEmailSend, type DeviceEmailAllowance } from './security/deviceRateLimit'
import type { Participant, RegistrationPayload } from './types'

type Page = 'home' | 'success' | 'admin'
type SuccessMode = 'created' | 'duplicate'
type BadgeEmailStatus = 'sent' | 'failed' | 'rate_limited'

const STORAGE_KEY = '3d_impact_registrants_v1'
const LEGACY_STORAGE_KEY = 'enactus_registrants_v1'
const EXTERNAL_TICKET_PRICE_STORAGE_KEY = '3d_impact_external_ticket_price_v1'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_EXTERNAL_TICKET_PRICE = 50
const EVENT_LOGO_PATH = '/logo/IMG_1853-cropped-alpha.png'
const LEGACY_CREATED_AT_FALLBACK = '1970-01-01T00:00:00.000Z'

const normalizeStoredParticipant = (participant: Partial<Participant>): Participant => ({
  firstName: participant.firstName ?? '',
  lastName: participant.lastName ?? '',
  email: participant.email ?? '',
  phone: participant.phone ?? '',
  type: participant.type === 'external' ? 'external' : 'internal',
  photo: participant.photo ?? '',
  id: participant.id ?? '',
  createdAt: participant.createdAt ?? LEGACY_CREATED_AT_FALLBACK,
})

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
      ? "Cette adresse email est déjà inscrite, mais EmailJS ne peut pas renvoyer le badge car le template n'a pas de destinataire configuré. Dans EmailJS, ouvre le template et mets le champ destinataire sur {{to_email}}."
      : "L'inscription est enregistrée, mais EmailJS rejette l'envoi car le template n'a pas de destinataire configuré. Dans EmailJS, ouvre le template et mets le champ destinataire sur {{to_email}}."
  }

  return duplicate
    ? `Cette adresse email est déjà inscrite, mais le badge n'a pas pu être renvoyé automatiquement. Détail EmailJS : ${details}`
    : `L'inscription est enregistrée, mais EmailJS a rejeté l'envoi. Détail : ${details}`
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [currentUser, setCurrentUser] = useState<Participant | null>(null)
  const [registrants, setRegistrants] = useState<Participant[]>(() => {
    const saved =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)

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
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [successMode, setSuccessMode] = useState<SuccessMode>('created')
  const [badgeEmailStatus, setBadgeEmailStatus] = useState<BadgeEmailStatus>('sent')
  const [popups, setPopups] = useState<PopupItem[]>([])
  const [externalTicketPrice, setExternalTicketPrice] = useState<number>(() => {
    const savedPrice = localStorage.getItem(EXTERNAL_TICKET_PRICE_STORAGE_KEY)
    const parsedPrice = savedPrice ? Number(savedPrice) : Number.NaN

    if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
      return parsedPrice
    }

    return DEFAULT_EXTERNAL_TICKET_PRICE
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registrants))
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }, [registrants])

  useEffect(() => {
    localStorage.setItem(EXTERNAL_TICKET_PRICE_STORAGE_KEY, String(externalTicketPrice))
  }, [externalTicketPrice])

  const showPopup = (message: string, tone: PopupTone = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setPopups(current => [...current, { id, message, tone }])
  }

  const dismissPopup = (id: number) => {
    setPopups(current => current.filter(item => item.id !== id))
  }

  const normalizeEmail = (value: string) => value.trim().toLowerCase()

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
        ? `Cette adresse email est déjà inscrite, mais le renvoi du badge est temporairement bloqué sur cet appareil. Réessayez dans ${waitTime}.`
        : `Veuillez patienter ${waitTime} avant une nouvelle inscription depuis cet appareil.`
    }

    return duplicate
      ? `Cette adresse email est déjà inscrite, mais la limite quotidienne d'envoi de badges a été atteinte sur cet appareil. Réessayez dans ${waitTime}.`
      : `La limite quotidienne d'inscriptions et d'envois a été atteinte sur cet appareil. Réessayez dans ${waitTime}.`
  }

  const buildQrCodeDataUrl = (ticketId: string) =>
    QRCode.toDataURL(ticketId, {
      width: 300,
      margin: 2,
      color: {
        dark: '#070D0D',
        light: '#FFFFFF',
      },
    })

  const sendBadgeEmail = async (
    participant: Participant,
    duplicate = false,
  ): Promise<BadgeEmailStatus> => {
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
          ? `Cette adresse email est déjà inscrite, mais le badge n'a pas pu être renvoyé automatiquement car la configuration EmailJS est incomplète : ${missingConfig.join(', ')}.`
          : `Configuration EmailJS incomplète : ${missingConfig.join(', ')}.`,
        'error',
      )
      return 'failed'
    }

    const allowance = reserveDeviceEmailSend()

    if (!allowance.allowed) {
      showPopup(getRateLimitMessage(allowance, duplicate), 'warning')
      return 'rate_limited'
    }

    try {
      const qrCodeDataUrl = await buildQrCodeDataUrl(participant.id)

      await emailjs.send(
        serviceId,
        templateId,
        {
          to_name: `${participant.firstName} ${participant.lastName}`,
          to_email: participant.email,
          ticket_id: participant.id,
          type: participant.type === 'internal' ? 'Étudiant/Interne' : 'Externe',
          participant_photo: participant.photo,
          qr_code_image: qrCodeDataUrl,
        },
        publicKey,
      )

      return 'sent'
    } catch (mailError) {
      console.error('EmailJS Error:', mailError)
      showPopup(getEmailJsGuidanceMessage(mailError, duplicate), 'error')
      return 'failed'
    }
  }

  const handleRegister = async (data: RegistrationPayload) => {
    setIsSubmitting(true)

    try {
      if (await isAdminAccessAttempt(data)) {
        setIsAdminAuthenticated(true)
        setCurrentUser(null)
        setCurrentPage('admin')
        return
      }

      const normalizedParticipant: RegistrationPayload = {
        ...data,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
      }

      if (
        !normalizedParticipant.firstName ||
        !normalizedParticipant.lastName ||
        !normalizedParticipant.email ||
        !normalizedParticipant.phone
      ) {
        showPopup('Veuillez remplir tous les champs obligatoires pour une inscription participant.', 'warning')
        return
      }

      if (!EMAIL_PATTERN.test(normalizedParticipant.email)) {
        showPopup("Veuillez saisir une adresse email valide pour l'inscription.", 'warning')
        return
      }

      const existingParticipant = registrants.find(
        participant => normalizeEmail(participant.email) === normalizeEmail(normalizedParticipant.email),
      )

      if (existingParticipant) {
        const emailStatus = await sendBadgeEmail(existingParticipant, true)
        setCurrentUser(existingParticipant)
        setSuccessMode('duplicate')
        setBadgeEmailStatus(emailStatus)
        setCurrentPage('success')
        return
      }

      if (!normalizedParticipant.photo) {
        showPopup('Veuillez télécharger votre photo pour continuer.', 'warning')
        return
      }

      const ticketId = 'ENA-' + Math.random().toString(36).substr(2, 6).toUpperCase()
      const newParticipant: Participant = {
        ...normalizedParticipant,
        id: ticketId,
        createdAt: new Date().toISOString(),
      }
      const emailStatus = await sendBadgeEmail(newParticipant)

      if (emailStatus === 'rate_limited') {
        return
      }

      setRegistrants(prev => [...prev, newParticipant])
      setCurrentUser(newParticipant)
      setSuccessMode('created')
      setBadgeEmailStatus(emailStatus)
      setCurrentPage('success')
    } catch (error) {
      console.error("Erreur critique d'inscription:", error)
      showPopup('Une erreur technique est survenue. Veuillez réessayer.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false)
    setCurrentUser(null)
    setCurrentPage('home')
  }

  return (
    <div className="App">
      <nav
        style={{
          padding: '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setCurrentPage('home')}
        >
          <img
            src={EVENT_LOGO_PATH}
            alt="Logo 3D Impact"
            style={{
              width: 'clamp(118px, 22vw, 156px)',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>

        {isAdminAuthenticated && (
          <button onClick={logoutAdmin} className="btn btn-secondary">
            <LogOut size={18} /> Quitter l'admin
          </button>
        )}
      </nav>

      <main
        style={{
          paddingTop: '6rem',
          minHeight: 'calc(100vh - 4rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <RegistrationForm
              key="form"
              onRegister={handleRegister}
              isSubmitting={isSubmitting}
              logo={EVENT_LOGO_PATH}
              onNotify={showPopup}
            />
          )}

          {currentPage === 'success' && currentUser && (
            <SuccessPage
              key="success"
              user={currentUser}
              mode={successMode}
              badgeEmailStatus={badgeEmailStatus}
              externalTicketPrice={externalTicketPrice}
              onClose={() => setCurrentPage('home')}
            />
          )}

          {currentPage === 'admin' && isAdminAuthenticated && (
            <AdminPanel
              key="admin"
              registrants={registrants}
              externalTicketPrice={externalTicketPrice}
              onExternalTicketPriceChange={setExternalTicketPrice}
              logo={EVENT_LOGO_PATH}
              onNotify={showPopup}
            />
          )}
        </AnimatePresence>
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
        © 2026 3D Impact - Excellence in Action.
      </footer>
    </div>
  )
}

export default App
