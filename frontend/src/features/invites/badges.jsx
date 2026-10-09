import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';

export function BadgeStatut({ statut }) {
  return statut === 'PRESENT' ? <Badge type="PRESENT">Présent</Badge> : <Badge type="INSCRIT">Inscrit</Badge>;
}

/** Statut du dernier envoi d'un email (colonnes Email 1 / Email 2). */
export function EtatEmail({ statut, magazine = false }) {
  const E = {
    ENVOYE: ['text-succes', 'check', 'Envoyé'],
    EN_ATTENTE: ['text-texte-2', 'clock', 'En attente'],
    ECHEC: ['text-avert', 'alert', 'À renvoyer'],
  };
  if (!statut) return <span className="text-[13px] text-texte-2">{magazine ? '—' : 'Non envoyé'}</span>;
  const [c, i, l] = E[statut];
  return (
    <span className={`inline-flex items-center gap-[5px] whitespace-nowrap text-[13px] font-medium ${c}`}>
      <Icon nom={i} className="text-[15px]" />
      {l}
    </span>
  );
}
