import React, { useState } from 'react';
import {
  Users,
  Settings,
  Download, 
  Search, 
  Image as ImageIcon,
  CheckCircle2,
  ShieldCheck,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Participant } from '../types';
import type { PopupTone } from './InAppPopup';

interface AdminPanelProps {
  registrants: Participant[];
  externalTicketPrice: number;
  onExternalTicketPriceChange: (price: number) => void;
  logo: string;
  onNotify: (message: string, tone?: PopupTone) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  registrants,
  externalTicketPrice,
  onExternalTicketPriceChange,
  logo,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [ticketPriceDraft, setTicketPriceDraft] = useState(String(externalTicketPrice));
  const [searchQuery, setSearchQuery] = useState('');

  const stats = {
    total: registrants.length,
    internal: registrants.filter(r => r.type === 'internal').length,
    external: registrants.filter(r => r.type === 'external').length,
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRegistrants = normalizedQuery
    ? registrants.filter((participant) =>
        [
          participant.createdAt,
          participant.firstName,
          participant.lastName,
          participant.email,
          participant.phone,
          participant.id,
          participant.type,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : registrants;

  const formatRegistrationDate = (createdAt: string) => {
    if (createdAt === '1970-01-01T00:00:00.000Z') {
      return 'Ancienne donnée';
    }

    const parsedDate = new Date(createdAt);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Inconnue';
    }

    return parsedDate.toLocaleDateString('fr-FR');
  };

  const formatRegistrationTime = (createdAt: string) => {
    if (createdAt === '1970-01-01T00:00:00.000Z') {
      return '--:--';
    }

    const parsedDate = new Date(createdAt);

    if (Number.isNaN(parsedDate.getTime())) {
      return '--:--';
    }

    return parsedDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(ticketPriceDraft);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      onNotify('Veuillez saisir un montant valide supérieur ou égal à 0.', 'warning');
      return;
    }

    onExternalTicketPriceChange(parsedPrice);
    setTicketPriceDraft(String(parsedPrice));
    onNotify('Le prix du ticket externe a été mis à jour.', 'success');
  };

  const handleExport = () => {
    if (filteredRegistrants.length === 0) {
      onNotify('Aucune inscription à exporter.', 'info');
      return;
    }

    const escapeCsvValue = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;

    const rows = filteredRegistrants.map((participant) =>
      [
        participant.id,
        participant.firstName,
        participant.lastName,
        participant.email,
        participant.phone,
        participant.type === 'internal' ? 'INTERNE' : 'EXTERNE',
        formatRegistrationDate(participant.createdAt),
        formatRegistrationTime(participant.createdAt),
        participant.createdAt === '1970-01-01T00:00:00.000Z' ? '' : participant.createdAt,
        participant.photo ? 'OUI' : 'NON',
        'OK',
      ]
        .map(escapeCsvValue)
        .join(';'),
    );

    const csvContent = [
      [
        'Ticket ID',
        'Prenom',
        'Nom',
        'Email',
        'Telephone',
        'Type',
        'Date inscription',
        'Heure inscription',
        'Horodatage ISO',
        'Photo',
        'Statut',
      ]
        .map(escapeCsvValue)
        .join(';'),
      ...rows,
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `3d-impact-inscriptions-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(`Export terminé : ${filteredRegistrants.length} inscription(s).`, 'success');
  };

  return (
    <div className="container" style={{ maxWidth: '1100px', paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            <ShieldCheck size={20} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Portail Administratif Sécurisé</span>
          </div>
          <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: 700 }}>3D Impact Admin</h1>
        </div>
        <div className="glass" style={{ padding: '0.4rem', display: 'flex', gap: '0.4rem', borderRadius: '12px' }}>
          <button onClick={() => setActiveTab('users')} className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px' }}>
            <Users size={18} /> Participants
          </button>
          <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px' }}>
            <Settings size={18} /> Configuration
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Inscriptions</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div className="glass" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Internes</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.internal}</div>
        </div>
        <div className="glass" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Externes</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>{stats.external}</div>
        </div>
      </div>

      {activeTab === 'users' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '350px' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input
                type="text"
                placeholder="Rechercher..."
                className="input-field"
                style={{ paddingLeft: '40px', margin: 0, height: '44px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={handleExport} className="btn btn-secondary" style={{ gap: '0.75rem' }}>
              <Download size={18} /> Exporter
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Photo</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Ticket</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Prénom</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Nom</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Téléphone</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Heure</th>
                  <th style={{ padding: '1.2rem 2rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrants.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {registrants.length === 0 ? 'Aucune inscription.' : 'Aucun résultat pour cette recherche.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrants.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        {r.photo ? (
                          <img src={r.photo} alt="Profil" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={20} color="var(--text-muted)" />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontWeight: 600 }}>{r.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Badge actif</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontWeight: 600 }}>{r.firstName}</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontWeight: 600 }}>{r.lastName}</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontSize: '0.9rem' }}>{r.email}</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{r.phone}</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <span style={{ 
                          padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                          background: r.type === 'internal' ? 'rgba(255, 194, 34, 0.1)' : 'rgba(0,0,0,0.05)',
                          color: r.type === 'internal' ? 'var(--primary)' : 'var(--text-muted)',
                        }}>
                          {r.type === 'internal' ? 'INTERNE' : 'EXTERNE'}
                        </span>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontSize: '0.9rem' }}>{formatRegistrationDate(r.createdAt)}</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ fontSize: '0.9rem' }}>{formatRegistrationTime(r.createdAt)}</div>
                      </td>
                      <td style={{ padding: '1.2rem 2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={16} /> OK
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: '3rem' }}>
          <h2 style={{ marginBottom: '2rem' }}>Paramètres</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
            <form onSubmit={handlePriceSubmit}>
              <label className="input-label">Prix du ticket externe</label>
              <div className="glass" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.3)' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
                  Ce montant sera affiché automatiquement dans le message de confirmation des participants externes.
                </p>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input-field"
                    value={ticketPriceDraft}
                    onChange={(e) => setTicketPriceDraft(e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>DH</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                  Tarif actuel : {externalTicketPrice.toLocaleString('fr-FR')} DH
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
                  Enregistrer le prix
                </button>
              </div>
            </form>
            <div>
              <label className="input-label">Identité Visuelle (Logo)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <div style={{ width: '220px', minHeight: '150px', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(0,0,0,0.1)' }}>
                  {logo ? (
                    <img
                      src={logo}
                      alt="Logo"
                      style={{ width: '180px', height: 'auto', display: 'block' }}
                    />
                  ) : (
                    <ImageIcon size={48} style={{ opacity: 0.3 }} />
                  )}
                </div>
                <button className="btn btn-secondary">Changer</button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AdminPanel;
