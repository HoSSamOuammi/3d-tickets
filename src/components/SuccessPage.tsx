import React from 'react';
import { motion } from 'framer-motion';
import { MailCheck, PhoneCall, ArrowLeft, ExternalLink } from 'lucide-react';

interface SuccessPageProps {
  onClose: () => void;
  externalTicketPrice: number;
  mode: 'created' | 'duplicate';
  badgeEmailStatus: 'sent' | 'failed' | 'rate_limited';
  user: {
    email: string;
    phone: string;
    type: 'internal' | 'external';
  };
}

const formatPrice = (price: number) => `${price.toLocaleString('fr-FR')} DH`;

const SuccessPage: React.FC<SuccessPageProps> = ({
  onClose,
  user,
  externalTicketPrice,
  mode,
  badgeEmailStatus,
}) => {
  const message =
    mode === 'duplicate'
      ? badgeEmailStatus === 'sent'
        ? `Cette adresse email est déjà inscrite, et le badge a été renvoyé sur la même adresse : ${user.email}.`
        : badgeEmailStatus === 'rate_limited'
          ? `Cette adresse email est déjà inscrite. Le badge n'a pas été renvoyé car la limite d'envoi de cet appareil a été atteinte temporairement.`
          : `Cette adresse email est déjà inscrite, mais le badge n'a pas pu être renvoyé automatiquement sur la même adresse : ${user.email}.`
      : user.type === 'internal'
        ? badgeEmailStatus === 'sent'
          ? `Votre badge officiel a été généré avec succès. Nous l'avons envoyé à l'adresse suivante : ${user.email}. Pensez à vérifier vos courriers indésirables.`
          : `Votre inscription a bien été enregistrée, mais l'envoi automatique du badge par email a échoué pour ${user.email}. Vérifiez la configuration EmailJS puis réessayez.`
        : `Merci pour votre demande d'accréditation. En tant que participant externe, notre équipe vous contactera au ${user.phone} pour régler les frais du ticket fixés à ${formatPrice(externalTicketPrice)}.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass container"
      style={{ maxWidth: '580px', textAlign: 'center', padding: '4rem 3rem' }}
    >
      <div style={{ 
        width: '80px', 
        height: '80px', 
        background: 'rgba(255, 194, 34, 0.1)', 
        borderRadius: '50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        margin: '0 auto 2rem',
        color: 'var(--primary)',
        border: '2px solid var(--primary)'
      }}>
        {user.type === 'internal' ? <MailCheck size={40} /> : <PhoneCall size={40} />}
      </div>

      <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 700 }}>
        C'est tout bon !
      </h2>
      
      <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '3rem', lineHeight: '1.6' }}>
        {message}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass" style={{ padding: '1.5rem', textAlign: 'left', background: 'rgba(255,255,255,0.02)' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExternalLink size={16} /> Instructions Importantes
          </h4>
          <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '1.2rem' }}>
            <li>Présentez le QR code reçu par email à l'entrée.</li>
            <li>Le badge est strictement personnel et non transférable.</li>
            <li>En cas de non-réception sous 15 min, contactez le support.</li>
          </ul>
        </div>
      </div>

      <button onClick={onClose} className="btn btn-secondary" style={{ padding: '1rem 2rem' }}>
        <ArrowLeft size={18} /> Retour à l'accueil
      </button>
    </motion.div>
  );
};

export default SuccessPage;
