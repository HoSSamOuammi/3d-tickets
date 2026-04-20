import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Download, Share2, Mail, CheckCircle2 } from 'lucide-react';

interface BadgeProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    type: 'internal' | 'external';
    id: string;
    photo?: string;
  };
  onDownloadPdf?: () => void;
  onResendEmail?: () => void;
  onClose: () => void;
}

const Badge: React.FC<BadgeProps> = ({ user, onClose, onDownloadPdf, onResendEmail }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        maxWidth: '400px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Graphic Area */}
      <div style={{
        backgroundColor: '#0F172A',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Success Icon overlay */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          color: '#10B981',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'rgba(16, 185, 129, 0.1)',
          padding: '0.4rem 0.8rem',
          borderRadius: '99px'
        }}>
          <CheckCircle2 size={14} /> RÉSERVÉ
        </div>
        
        <img 
          src="/logo/IMG_1853-cropped-alpha.png" 
          alt="3D Impact" 
          style={{ height: '40px', objectFit: 'contain', marginBottom: '1.5rem' }} 
        />
        
        {user.photo && (
          <div style={{
            marginBottom: '1rem',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            padding: '3px',
            background: '#ffffff',
            border: '2px solid #FFC222',
            boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
          }}>
            <img 
              src={user.photo} 
              alt="Participant" 
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          </div>
        )}
        
        <h2 style={{
          color: '#ffffff',
          fontSize: '2rem',
          fontWeight: '800',
          margin: 0,
          textTransform: 'uppercase',
          textAlign: 'center',
          lineHeight: '1.1'
        }}>
          {user.firstName}
        </h2>
        <h3 style={{
          color: '#94A3B8',
          fontSize: '1.25rem',
          fontWeight: '400',
          margin: '0.25rem 0 1rem 0',
          textTransform: 'uppercase',
          textAlign: 'center'
        }}>
          {user.lastName}
        </h3>

        <div style={{
          backgroundColor: '#FFC222',
          color: '#0F172A',
          padding: '0.4rem 1.25rem',
          borderRadius: '99px',
          fontSize: '0.8rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {user.type === 'internal' ? 'DELEGATE / INTERNAL' : 'VISITOR / EXTERNAL'}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#FAFAFA'
      }}>
        
        {/* Centered Large QR Code */}
        <div style={{
          padding: '1rem',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          marginBottom: '1rem',
          border: '1px solid #E2E8F0'
        }}>
          <QRCodeSVG 
            value={user.id} 
            size={180}
            level="H"
            includeMargin={false}
          />
        </div>
        
        <div style={{ 
          fontSize: '0.85rem', 
          color: '#64748B', 
          fontWeight: '600',
          fontFamily: 'monospace',
          marginBottom: '2rem',
          letterSpacing: '0.05em'
        }}>
          ID: {user.id}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginBottom: '1.25rem' }}>
          <button 
            onClick={onDownloadPdf}
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              backgroundColor: '#0F172A',
              color: 'white',
              border: 'none',
              padding: '0.85rem',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            <Download size={18} /> Télécharger PDF
          </button>
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: '3D Impact Ticket',
                  text: `Voici mon ticket pour 3D Impact! (ID: ${user.id})`,
                  url: window.location.href,
                }).catch(console.error);
              }
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              backgroundColor: '#F1F5F9',
              color: '#334155',
              border: '1px solid #E2E8F0',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Partager"
          >
            <Share2 size={18} />
          </button>
        </div>

        {/* Email Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: '#64748B',
          width: '100%',
          justifyContent: 'center'
        }}>
          <Mail size={14} /> <span>Envoyé à <strong>{user.email}</strong></span>
          {onResendEmail && (
            <button 
              onClick={onResendEmail}
              style={{
                background: 'none',
                border: 'none',
                color: '#3B82F6',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textDecoration: 'underline',
                padding: '0'
              }}
            >
              Renvoyer
            </button>
          )}
        </div>
      </div>

      {/* Footer Return */}
      <button 
        onClick={onClose}
        style={{ 
          width: '100%',
          backgroundColor: '#ffffff', 
          border: 'none', 
          borderTop: '1px solid #E2E8F0',
          color: '#64748B', 
          cursor: 'pointer',
          padding: '1.25rem',
          fontSize: '0.9rem',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
      >
        Fermer et retourner à l'accueil
      </button>
    </motion.div>
  );
};

export default Badge;
