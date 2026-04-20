import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, ExternalLink, Loader2, MailCheck, Edit2 } from 'lucide-react'

interface SuccessPageProps {
  onClose: () => void
  onResendBadge: () => Promise<void>
  onDownloadBadge: () => Promise<void>
  onEditInfo?: () => void
  isResendingBadge: boolean
  isDownloadingBadge: boolean
  externalTicketPrice: number
  mode: 'created' | 'duplicate' | 'updated'
  duplicateMatchType: 'email' | 'phone' | 'email_phone'
  badgeEmailStatus: 'idle' | 'sent' | 'failed' | 'rate_limited'
  user: {
    email: string
    phone: string
    type: 'internal' | 'external'
    isConfirmed: boolean
  }
}

const SuccessPage: React.FC<SuccessPageProps> = ({
  onClose,
  onResendBadge,
  onDownloadBadge,
  onEditInfo,
  isResendingBadge,
  isDownloadingBadge,
  user,
  mode,
  duplicateMatchType,
  badgeEmailStatus,
}) => {
  const duplicateSubject =
    duplicateMatchType === 'phone'
      ? 'Ce numéro de téléphone est déjà inscrit.'
      : duplicateMatchType === 'email_phone'
        ? 'Cette adresse email et ce numéro de téléphone sont déjà inscrits.'
        : 'Cette adresse email est déjà inscrite.'

  const duplicateTarget =
    duplicateMatchType === 'phone'
      ? `à l'adresse email associée : ${user.email}`
      : `à la même adresse : ${user.email}`

  const canAccessBadgePdf = true

  const message =
    mode === 'duplicate'
      ? badgeEmailStatus === 'sent'
        ? `${duplicateSubject} L'email de confirmation a bien été renvoyé ${duplicateTarget}. Vous pouvez aussi retélécharger le badge PDF ci-dessous.`
        : badgeEmailStatus === 'rate_limited'
          ? `${duplicateSubject} Le renvoi de l'email de confirmation est temporairement bloqué sur cet appareil. Vous pouvez toutefois télécharger le badge PDF ci-dessous.`
          : badgeEmailStatus === 'failed'
            ? `${duplicateSubject} L'email de confirmation n'a pas pu être renvoyé automatiquement ${duplicateTarget}. Le badge PDF reste téléchargeable ci-dessous.`
            : `${duplicateSubject} Vous pouvez télécharger de nouveau le badge PDF ci-dessous et renvoyer l'email de confirmation si besoin.`
      : mode === 'updated'
        ? badgeEmailStatus === 'sent'
          ? `Vos informations ont été mises à jour avec succès. Un nouvel email de confirmation a été envoyé à ${user.email}.`
          : `Vos informations ont été mises à jour avec succès. Votre badge PDF reste disponible en téléchargement ci-dessous.`
        : badgeEmailStatus === 'sent'
          ? `Votre inscription a bien été enregistrée. Un email de confirmation a été envoyé à ${user.email}, et votre badge PDF est disponible en téléchargement ci-dessous.`
          : `Votre inscription a bien été enregistrée. L'email de confirmation n'a pas pu être envoyé à ${user.email}, mais votre badge PDF est prêt en téléchargement ci-dessous.`

  const instructions =
    mode === 'duplicate'
      ? [
          'Le badge PDF peut être téléchargé immédiatement depuis cette page.',
          "Utilisez le bouton secondaire pour renvoyer l'email de confirmation si nécessaire.",
          'En cas de non-réception sous 15 min, contactez le support.',
        ]
      : [
          'Téléchargez le badge PDF et conservez-le sur votre téléphone ou votre ordinateur.',
          "Le QR code contenu dans le PDF sera demandé à l'entrée.",
          'Le badge est strictement personnel et non transférable.',
        ]

  const showDeliverySummary = mode === 'created'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass container"
      style={{ maxWidth: '580px', textAlign: 'center', padding: '4rem 3rem' }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          background: 'rgba(255, 194, 34, 0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          color: 'var(--primary)',
          border: '2px solid var(--primary)',
        }}
      >
        <MailCheck size={40} />
      </div>

      <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700 }}>
        {mode === 'duplicate'
          ? 'Inscription existante'
          : mode === 'updated'
            ? 'Informations modifiées'
            : "C'est tout bon !"}
      </h2>

      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: '1.1rem',
          marginBottom: '3rem',
          lineHeight: '1.6',
        }}
      >
        {message}
      </p>

      {showDeliverySummary && (
        <div
          className="glass"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            textAlign: 'left',
            background:
              badgeEmailStatus === 'sent'
                ? 'rgba(237, 252, 242, 0.8)'
                : 'rgba(255, 251, 235, 0.9)',
            border:
              badgeEmailStatus === 'sent'
                ? '1px solid rgba(16,185,129,0.18)'
                : '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
            {badgeEmailStatus === 'sent'
              ? `Email de confirmation envoyé à ${user.email}`
              : `Email de confirmation non envoyé à ${user.email}`}
          </p>
          <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Le badge PDF reste disponible en téléchargement juste en dessous.
          </p>
        </div>
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}
      >
        <div
          className="glass"
          style={{ padding: '1.5rem', textAlign: 'left', background: 'rgba(255,255,255,0.02)' }}
        >
          <h4
            style={{
              color: 'var(--primary)',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ExternalLink size={16} /> Instructions importantes
          </h4>
          <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '1.2rem' }}>
            {instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          alignItems: 'center',
        }}
      >
        {canAccessBadgePdf && (
          <button
            onClick={onDownloadBadge}
            disabled={isDownloadingBadge}
            className="btn btn-primary"
            style={{ padding: '1rem 2rem', minWidth: '280px' }}
          >
            {isDownloadingBadge ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Préparation du PDF...
              </>
            ) : (
              <>
                <Download size={18} /> Télécharger le badge PDF
              </>
            )}
          </button>
        )}

        {mode === 'duplicate' && onEditInfo && (
          <button
            onClick={onEditInfo}
            className="btn btn-primary"
            style={{
              padding: '1rem 2rem',
              minWidth: '280px',
              marginBottom: '0.5rem',
              background: 'var(--text-main)',
              color: '#ffffff',
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
            }}
          >
            <Edit2 size={18} /> Modifier mes informations
          </button>
        )}

        {mode === 'duplicate' && (
          <button
            onClick={onResendBadge}
            disabled={isResendingBadge}
            className="btn btn-secondary"
            style={{ padding: '1rem 2rem', minWidth: '280px' }}
          >
            {isResendingBadge ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Envoi en cours...
              </>
            ) : (
              "Renvoyer l'email de confirmation"
            )}
          </button>
        )}

        <button onClick={onClose} className="btn btn-secondary" style={{ padding: '1rem 2rem' }}>
          <ArrowLeft size={18} /> Retour à l'accueil
        </button>
      </div>
    </motion.div>
  )
}

export default SuccessPage
