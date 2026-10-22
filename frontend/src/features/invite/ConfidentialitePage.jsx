import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';

/** Politique de confidentialité (page publique) : traitement des données des invités. Contact et durée de
 * conservation viennent des paramètres réglés par la direction des événements. */
export default function ConfidentialitePage() {
  useTitre('Politique de confidentialité');
  const { data } = useQuery({
    queryKey: ['confidentialite'],
    queryFn: () => api.get('/public/confidentialite/'),
    staleTime: 5 * 60_000,
  });
  const duree = data?.dureeConservationMois;
  const contact = data?.contact;

  return (
    <div className="univers-mde min-h-[100dvh] border-t-[6px] border-mde-bordeaux bg-mde-surface text-mde-texte">
      <div className="entete-mde px-5 pb-14 pt-[22px]">
        <div className="mx-auto max-w-[720px]">
          <Logo variante="blanc" hauteur={40} />
        </div>
      </div>
      <main className="mx-auto -mt-8 max-w-[720px] px-3 pb-12">
        <article className="flex animate-in-up flex-col gap-5 rounded-carte border border-mde-bordure bg-surface px-6 py-8 text-[15.5px] leading-[1.6] shadow-carte-mde sm:px-9">
          <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Politique de confidentialité</h1>
          <p className="m-0 text-mde-texte-2">
            Cette page explique comment MDE Business School traite les données personnelles des invités de ses
            cérémonies de graduation, conformément à la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la
            protection des données à caractère personnel.
          </p>

          <Section titre="Responsable du traitement">
            MDE Business School, Abidjan, Côte d’Ivoire. Service : direction des événements.
          </Section>

          <Section titre="Données collectées">
            Civilité, nom, prénom, adresse email, téléphone, entreprise et fonction, saisis lors de l’inscription ; puis
            l’heure de votre passage à l’accueil le jour de la cérémonie. Les avis du questionnaire de satisfaction sont
            enregistrés de façon anonyme, sans lien avec votre identité.
          </Section>

          <Section titre="Finalités">
            Gérer votre inscription, vous envoyer votre invitation (QR code et code de secours), enregistrer votre
            présence à l’accueil, vous adresser le magazine de la promotion et, le lendemain, le questionnaire de
            satisfaction. Vos données ne sont ni vendues ni utilisées à des fins publicitaires.
          </Section>

          <Section titre="Base légale">
            Votre consentement, donné en cochant la case du formulaire d’inscription. Vous pouvez le retirer à tout
            moment en écrivant à l’adresse ci-dessous ; votre inscription est alors supprimée.
          </Section>

          <Section titre="Destinataires">
            Uniquement les personnes de MDE Business School chargées de la cérémonie (direction des événements et hôtes
            d’accueil), chacune limitée aux cérémonies qui la concernent. Les emails sont acheminés par le service de
            messagerie de MDE.
          </Section>

          <Section titre="Durée de conservation">
            {duree
              ? `Vos données sont conservées ${duree} mois après la date de la cérémonie. Elles sont ensuite anonymisées automatiquement : seuls des chiffres (nombre d’inscrits et de présents) sont gardés pour les bilans.`
              : 'Vos données sont conservées pour une durée limitée après la date de la cérémonie, puis anonymisées automatiquement.'}
          </Section>

          <Section titre="Sécurité">
            Connexion chiffrée (HTTPS), accès réservé aux comptes autorisés et journalisé, aucune donnée personnelle
            dans les QR codes ni dans les journaux techniques, sauvegardes chiffrées.
          </Section>

          <Section titre="Vos droits">
            Vous pouvez demander l’accès à vos données, leur rectification, leur suppression ou vous opposer à leur
            traitement
            {contact ? (
              <>
                {' '}
                en écrivant à{' '}
                <a href={`mailto:${contact}`} className="font-semibold text-mde-bordeaux">
                  {contact}
                </a>
                .
              </>
            ) : (
              ' en contactant la direction des événements de MDE Business School.'
            )}{' '}
            Vous pouvez aussi saisir l’Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire (ARTCI),
            autorité de protection des données personnelles.
          </Section>
        </article>
      </main>
    </div>
  );
}

function Section({ titre, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="m-0 text-[17px] font-semibold">{titre}</h2>
      <p className="m-0 text-mde-texte-2 [text-wrap:pretty]">{children}</p>
    </section>
  );
}
