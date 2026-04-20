import React, { useState } from 'react'
import { Mail, Phone, School, Users, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { RegistrationPayload } from '../types'

interface RegistrationFormProps {
  onRegister: (data: RegistrationPayload) => Promise<void>
  initialData?: RegistrationPayload | null
  isEditing?: boolean
  isSubmitting: boolean
  isRegistrationClosed: boolean
  registrationClosedMessage: string
  logo: string
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  onRegister,
  initialData,
  isEditing,
  isSubmitting,
  isRegistrationClosed,
  registrationClosedMessage,
  logo,
}) => {
  const [formData, setFormData] = useState<RegistrationPayload>(
    initialData
      ? {
          ...initialData,
          photo: '',
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          type: 'internal',
          photo: '',
        },
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onRegister(formData)
  }

  const showClosedNoticeOnly = isRegistrationClosed && !isEditing

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass container"
      style={{ maxWidth: '560px', margin: '2rem auto', padding: '3rem' }}
    >
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div
          style={{
            width: 'clamp(180px, 38vw, 260px)',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={logo}
            alt="Logo 3D Impact"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Inscription officielle 3D Impact
        </p>
      </div>

      {showClosedNoticeOnly ? (
        <div className="registration-closed-banner">
          <div className="registration-closed-kicker">Information importante</div>
          <h2 className="registration-closed-title">Inscriptions en ligne clôturées</h2>
          <p className="registration-closed-copy">{registrationClosedMessage}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Êtes-vous étudiant à l'ENSA ?</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                padding: '0.35rem',
                background: 'rgba(0,0,0,0.03)',
                borderRadius: '1rem',
              }}
            >
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, type: 'internal' }))}
                className={`btn ${formData.type === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', borderRadius: '0.75rem' }}
              >
                <School size={18} /> Oui
              </button>
              <button
                type="button"
                onClick={() => setFormData((current) => ({ ...current, type: 'external' }))}
                className={`btn ${formData.type === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', borderRadius: '0.75rem' }}
              >
                <Users size={18} /> Non
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Prénom</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ex: Omar"
                value={formData.firstName}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, firstName: event.target.value }))
                }
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Nom</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ex: Alaoui"
                value={formData.lastName}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, lastName: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Numéro de téléphone</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              >
                <Phone size={18} />
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="+212 6XX XX XX XX"
                style={{ paddingLeft: '3rem' }}
                value={formData.phone}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Email personnel ou académique</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              >
                <Mail size={18} />
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="votre@email.com"
                inputMode="email"
                style={{ paddingLeft: '3rem' }}
                value={formData.email}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', height: '3.5rem', fontSize: '1.1rem' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Traitement...
              </>
            ) : isEditing ? (
              <>
                Mettre à jour mes informations <ArrowRight size={20} />
              </>
            ) : (
              <>
                Confirmer l'inscription <ArrowRight size={20} />
              </>
            )}
          </button>

          <p
            style={{
              marginTop: '2rem',
              textAlign: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              lineHeight: '1.5',
            }}
          >
            <ShieldCheck
              size={14}
              style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }}
            />
            En cliquant, vous acceptez de recevoir un email de confirmation 3D Impact avec votre QR
            code sécurisé. Votre badge PDF restera ensuite disponible en téléchargement.
          </p>
        </form>
      )}
    </motion.div>
  )
}

export default RegistrationForm
