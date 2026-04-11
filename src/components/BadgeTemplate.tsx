import React from 'react';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, MapPin, Calendar } from 'lucide-react';

interface BadgeTemplateProps {
  user: {
    firstName: string;
    lastName: string;
    id: string;
    type: string;
    photo?: string;
  };
}

const BadgeTemplate: React.FC<BadgeTemplateProps> = ({ user }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass"
      style={{ 
        width: '380px', 
        padding: '0', 
        overflow: 'hidden', 
        borderRadius: '24px',
        border: '1px solid rgba(255, 194, 34, 0.3)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        margin: '2rem auto',
        background: 'white',
        color: '#070D0D'
      }}
    >
      {/* Header with Pattern */}
      <div style={{ 
        height: '140px', 
        background: 'linear-gradient(45deg, #FFC222 0%, #C88A12 100%)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, background: 'radial-gradient(circle, #000 10%, transparent 10%)', backgroundSize: '10px 10px' }}></div>
        <div style={{ 
          background: 'white', 
          padding: '0.8rem', 
          borderRadius: '50%', 
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
          zIndex: 1
        }}>
          <ShieldCheck size={48} color="#070D0D" />
        </div>
      </div>

      {/* Profile Photo - Floating Overlay */}
      <div style={{ textAlign: 'center', marginTop: '-60px', position: 'relative', zIndex: 10 }}>
        {user.photo ? (
          <img 
            src={user.photo} 
            alt="Participant" 
            style={{ 
              width: '120px', 
              height: '120px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '4px solid white',
              boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
            }} 
          />
        ) : (
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            background: '#F0F0F0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '4px solid white',
            boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
          }}>
            <Star size={48} color="#ccc" />
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem 2rem 2.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {user.firstName} {user.lastName}
        </h2>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          background: 'rgba(255, 194, 34, 0.1)', 
          color: 'var(--primary-hover)',
          padding: '0.4rem 1rem',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: 700,
          marginBottom: '2rem',
          border: '1px solid rgba(255, 194, 34, 0.2)'
        }}>
          <Star size={14} fill="currentColor" /> {user.type === 'internal' ? 'DELEGATE / INTERNAL' : 'VISITOR / EXTERNAL'}
        </div>

        {/* Event Details */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', opacity: 0.6, fontSize: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={14} /> 2026
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={14} /> 3D Impact
          </div>
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          VALIDATION ID: {user.id}
        </div>
      </div>

      {/* Footer Branding */}
      <div style={{ 
        background: '#F8FAFC', 
        padding: '1rem', 
        textAlign: 'center', 
        fontSize: '0.8rem', 
        fontWeight: 600,
        color: '#515356',
        borderTop: '1px solid #E2E8F0'
      }}>
        3D IMPACT - EXCELLENCE IN ACTION
      </div>
    </motion.div>
  );
};

export default BadgeTemplate;
