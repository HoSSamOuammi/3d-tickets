import React from 'react';
import { motion } from 'framer-motion';

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
        width: '320px', 
        padding: '0', 
        overflow: 'hidden', 
        borderRadius: '16px',
        border: '4px solid #FFC222',
        boxShadow: '0 0 0 1px #E2E8F0',
        margin: '2rem auto',
        background: '#F8FAFC',
        color: '#070D0D',
        position: 'relative'
      }}
    >
      <div style={{ border: '1px solid #E2E8F0', height: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ 
          height: '100px', 
          background: '#0F172A',
          borderBottom: '4px solid #FFC222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
           <img src="/logo/IMG_1853-cropped-alpha.png" alt="3D Impact" style={{ maxHeight: '70px', objectFit: 'contain' }} />
        </div>

        {/* Dynamic Content */}
        <div style={{ 
          padding: user.photo ? '1.5rem 2rem 2.5rem' : '3.5rem 2rem 3.5rem', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {user.photo && (
            <div style={{ marginBottom: '1.25rem' }}>
              <img 
                src={user.photo} 
                alt="Participant" 
                style={{ 
                  width: '110px', 
                  height: '110px', 
                  borderRadius: '50%', 
                  objectFit: 'cover', 
                  border: '3px solid white',
                  boxShadow: '0 0 0 2px #FFC222'
                }} 
              />
            </div>
          )}

          <h2 style={{ 
            fontSize: '1.8rem', 
            fontWeight: 800, 
            margin: '0', 
            textTransform: 'uppercase', 
            lineHeight: 1.1,
            color: '#070D0D'
          }}>
            {user.firstName}
          </h2>
          <h3 style={{
            fontSize: '1.3rem',
            fontWeight: 400,
            margin: '0.25rem 0 1rem 0',
            textTransform: 'uppercase',
            color: '#070D0D'
          }}>
             {user.lastName}
          </h3>

          <div style={{ 
            display: 'inline-block',
            background: '#0F172A', 
            color: '#FFC222',
            padding: '0.4rem 1.25rem',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '1.5rem',
          }}>
            {user.type === 'internal' ? 'DELEGATE / INTERNAL' : 'VISITOR / EXTERNAL'}
          </div>

          <div style={{ 
            fontSize: '0.75rem', 
            color: '#64748B', 
            fontWeight: 700,
            marginTop: user.photo ? '0.5rem' : '1.5rem'
          }}>
            VALIDATION ID: {user.id}
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          background: '#0F172A', 
          padding: '1rem', 
          textAlign: 'center', 
          fontSize: '0.7rem', 
          fontWeight: 700,
          color: '#FFC222',
        }}>
          3D IMPACT - EXCELLENCE IN ACTION
        </div>
      </div>
    </motion.div>
  );
};

export default BadgeTemplate;
