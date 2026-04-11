import React, { useState, useRef } from 'react';
import { Mail, Phone, School, Users, ArrowRight, ShieldCheck, Loader2, Camera, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { RegistrationPayload } from '../types';
import type { PopupTone } from './InAppPopup';

interface RegistrationFormProps {
  onRegister: (data: RegistrationPayload) => Promise<void>;
  isSubmitting: boolean;
  logo: string;
  onNotify: (message: string, tone?: PopupTone) => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  onRegister,
  isSubmitting,
  logo,
  onNotify,
}) => {
  const [formData, setFormData] = useState<RegistrationPayload>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    type: 'internal' as 'internal' | 'external',
    photo: '' as string,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 5MB limit
      if (file.size > 5 * 1024 * 1024) {
        onNotify("La photo est trop lourde. Veuillez choisir une image de moins de 5 Mo.", 'warning');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compression using Canvas
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Use JPEG to reduce size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setFormData({ ...formData, photo: dataUrl });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setFormData({ ...formData, photo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onRegister(formData);
  };

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
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Badge officiel avec identification photo</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Photo Upload Section */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <label className="input-label" style={{ textAlign: 'center' }}>Votre Photo de Profil (Badge)</label>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {formData.photo ? (
              <div style={{ position: 'relative' }}>
                <img 
                  src={formData.photo} 
                  alt="Prévisualisation" 
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} 
                />
                <button 
                  type="button" 
                  onClick={removePhoto}
                  style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--bg-dark)', borderRadius: '50%', padding: '0.2rem', color: 'white', border: '1px solid var(--glass-border)' }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  width: '120px', 
                  height: '120px', 
                  borderRadius: '50%', 
                  border: '2px dashed var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: 'var(--text-muted)',
                  background: 'rgba(0,0,0,0.02)',
                  transition: 'all 0.3s ease'
                }}
              >
                <Camera size={28} />
                <span style={{ fontSize: '0.75rem' }}>Cliquez ici</span>
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              hidden 
              accept="image/*" 
              onChange={handlePhotoUpload}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Statut du Participant</label>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '0.75rem',
            padding: '0.35rem',
            background: 'rgba(0,0,0,0.03)',
            borderRadius: '1rem'
          }}>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'internal' })}
              className={`btn ${formData.type === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', borderRadius: '0.75rem' }}
            >
              <School size={18} /> Interne
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'external' })}
              className={`btn ${formData.type === 'external' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', borderRadius: '0.75rem' }}
            >
              <Users size={18} /> Externe
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
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Numéro de Téléphone</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Phone size={18} />
            </span>
            <input
              type="text"
              className="input-field"
              placeholder="+212 6XX XX XX XX"
              style={{ paddingLeft: '3rem' }}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Email Personnel ou Académique</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Mail size={18} />
            </span>
            <input
              type="text"
              className="input-field"
              placeholder="votre@email.com"
              inputMode="email"
              style={{ paddingLeft: '3rem' }}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
          ) : (
            <>
              Confirmer l'inscription <ArrowRight size={20} />
            </>
          )}
        </button>

        <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '6px', color: 'var(--primary)' }} />
          En cliquant, vous acceptez de recevoir votre badge 3D Impact par email incluant votre photo et votre QR code sécurisé.
        </p>
      </form>
    </motion.div>
  );
};

export default RegistrationForm;
