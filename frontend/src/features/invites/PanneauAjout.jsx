import { useState } from 'react';
import { api, messageErreur } from '../../lib/api';
import { erreursParChamp, formaterTelephone, schemaInvite } from '../../lib/schemas';
import Bouton from '../../components/ui/Bouton';
import Champ from '../../components/ui/Champ';
import Icon from '../../components/ui/Icon';
import PanneauLateral from '../../components/ui/PanneauLateral';
import Segmente from '../../components/ui/Segmente';

const CHAMPS = [
  ['nom', 'Nom *', 'Kouassi'],
  ['prenom', 'Prénom *', 'Aya'],
  ['email', 'Email *', 'nom@entreprise.ci'],
  ['telephone', 'Téléphone (+225) *', '07 12 34 56 78'],
  ['entreprise', 'Entreprise · facultatif', ''],
  ['fonction', 'Fonction · facultatif', ''],
];

/** A6 · Ajout manuel d'un invité (source MANUEL, email n°1 envoyé sauf si décoché). */
export default function PanneauAjout({ evenement, onFermer, onAjoute }) {
  const [v, setV] = useState({
    civilite: '',
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    entreprise: '',
    fonction: '',
  });
  const [envoyer, setEnvoyer] = useState(true);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async () => {
    const er = erreursParChamp(schemaInvite.safeParse(v));
    setErreurs(er);
    if (Object.keys(er).length) return;
    setEnvoi(true);
    try {
      const inv = await api.post(`/evenements/${evenement.id}/invites/`, { ...v, envoyerInvitation: envoyer });
      onAjoute(inv, envoyer);
    } catch (e) {
      setEnvoi(false);
      if (e.code === 'DEJA_INSCRIT') setErreurs({ email: 'Cette adresse est déjà inscrite à cet événement.' });
      else if (e.status === 400)
        setErreurs(Object.fromEntries(Object.entries(e.data).map(([k, x]) => [k, Array.isArray(x) ? x[0] : x])));
      else setErreurs({ general: messageErreur(e) });
    }
  };

  return (
    <PanneauLateral ouvert label="Ajouter un invité" onFermer={onFermer}>
      <div className="flex items-center gap-3 border-b border-t-[6px] border-b-bordure border-t-p px-6 py-5">
        <h2 className="m-0 flex-1 text-[20px] font-bold tracking-[-0.02em]">Ajouter un invité</h2>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[22px] text-texte"
        >
          <Icon nom="x" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
        {erreurs.general && (
          <p role="alert" className="m-0 rounded-moyen bg-erreur-doux p-3 text-[14px] text-erreur-texte">
            {erreurs.general}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <span id="aj-civ" className="text-[15px] font-medium">
            Civilité *
          </span>
          <Segmente
            labelledBy="aj-civ"
            grille
            className="max-w-[220px]"
            valeur={v.civilite || null}
            onChange={(c) => setV({ ...v, civilite: c })}
            options={[
              { value: 'MME', label: 'Mme' },
              { value: 'M', label: 'M.' },
            ]}
          />
          {erreurs.civilite && (
            <span className="flex items-center gap-1.5 text-[14px] text-erreur">
              <Icon nom="alertCircle" className="text-[15px]" />
              {erreurs.civilite}
            </span>
          )}
        </div>
        {CHAMPS.map(([k, l, ph]) => (
          <Champ
            key={k}
            label={l}
            placeholder={ph}
            hauteur={46}
            autoFocus={k === 'nom'}
            value={v[k]}
            erreur={erreurs[k]}
            onChange={(e) =>
              setV({ ...v, [k]: k === 'telephone' ? formaterTelephone(e.target.value) : e.target.value })
            }
          />
        ))}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={envoyer}
            onChange={(e) => setEnvoyer(e.target.checked)}
            className="h-[18px] w-[18px] accent-p"
          />
          Envoyer l’email n°1 (invitation) maintenant
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-bordure px-6 py-4">
        <Bouton variante="secondaire" onClick={onFermer}>
          Annuler
        </Bouton>
        <Bouton chargement={envoi} onClick={soumettre}>
          Ajouter l’invité
        </Bouton>
      </div>
    </PanneauLateral>
  );
}
