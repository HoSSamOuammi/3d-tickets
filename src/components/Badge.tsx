import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Download, Share2, Mail } from 'lucide-react';

interface BadgeProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    type: 'internal' | 'external';
    id: string;
  };
  onClose: () => void;
}

const Badge: React.FC<BadgeProps> = ({ user, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass badge-container"
      style={{ border: '2px solid var(--primary)', margin: '0 auto' }}
    >
      <div className="badge-header">
        <div style={{ 
          width: '60px', 
          height: '60px', 
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          color: 'white',
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{user.firstName} {user.lastName}</h2>
        <span style={{ 
          background: 'rgba(99, 102, 241, 0.2)', 
          color: 'var(--primary)', 
          padding: '0.2rem 0.75rem', 
          borderRadius: '1rem',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}>
          {user.type === 'internal' ? 'Étudiant / Staff' : 'Invité'}
        </span>
      </div>

      <div className="qr-wrapper">
        <QRCodeSVG 
          value={user.id} 
          size={160}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: "/vite.svg",
            x: undefined,
            y: undefined,
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
      </div>

      <div className="badge-id">
        Ticket ID: {user.id}
      </div>

      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <button className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
          <Download size={16} /> Badge PDF
        </button>
        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
          <Share2 size={16} /> Partager
        </button>
      </div>

      <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
        <Mail size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
        Un exemplaire a été envoyé à {user.email}
      </p>

      <button 
        onClick={onClose}
        style={{ 
          marginTop: '1.5rem', 
          background: 'transparent', 
          border: 'none', 
          color: 'var(--text-muted)', 
          cursor: 'pointer',
          textDecoration: 'underline'
        }}
      >
        Retour à l'accueil
      </button>
    </motion.div>
  );
};

export default Badge;
