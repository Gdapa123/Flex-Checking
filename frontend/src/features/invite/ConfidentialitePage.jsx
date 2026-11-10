import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';

/** Politique de confidentialité (page publique) : traitement des données des invités (texte fourni par MDE le
 * 2026-11-10). */
export default function ConfidentialitePage() {
  useTitre('Politique de confidentialité');

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
            événements, conformément à la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des
            données à caractère personnel.
          </p>

          <Section titre="1. Responsable du traitement">
            <p>Le responsable du traitement est MDE Business School, située à Abidjan, en Côte d’Ivoire.</p>
          </Section>

          <Section titre="2. Données collectées">
            <p>
              Lors de votre inscription, nous recueillons votre civilité, vos nom et prénom, votre adresse email, votre
              numéro de téléphone, ainsi que le nom de votre entreprise et votre fonction. Le jour de l’événement, nous
              enregistrons également l’heure de votre passage à l’accueil. Enfin, les réponses que vous apportez au
              questionnaire de satisfaction, qu’il s’agisse des notes ou du commentaire libre, sont enregistrées sans
              aucun lien avec votre identité.
            </p>
          </Section>

          <Section titre="3. Finalités">
            <p>
              Vos données nous permettent de gérer votre inscription et de vous envoyer votre invitation, qui comprend
              un QR code et un code de secours. Elles servent ensuite à enregistrer votre présence à l’accueil, puis à
              vous adresser les documents de l’événement et le questionnaire de satisfaction.
            </p>
            <p>
              Nous pouvons également les utiliser pour vous informer de nos prochains événements et de nos actualités.
              Vous restez libre de refuser ces envois à tout moment en contactant MDE Business School.
            </p>
            <p>Vos données ne sont en aucun cas vendues ni cédées à des tiers à des fins publicitaires.</p>
          </Section>

          <Section titre="4. Base légale">
            <p>
              Ce traitement repose sur votre consentement, que vous exprimez en cochant la case prévue à cet effet dans
              le formulaire d’inscription.
            </p>
          </Section>

          <Section titre="5. Destinataires">
            <p>
              L’accès à vos données est réservé au personnel de MDE Business School strictement concerné par leur
              traitement. Elles peuvent également être confiées à des prestataires explicitement mandatés par MDE pour
              assurer la gestion technique de l’application ou l’envoi de nos communications. Ces prestataires peuvent
              être établis hors de Côte d’Ivoire ; ces transferts s’effectuent alors dans le strict respect de la
              réglementation en vigueur.
            </p>
          </Section>

          <Section titre="6. Sécurité">
            <p>
              Nous mettons en œuvre plusieurs mesures pour protéger vos données. Les échanges avec notre application
              passent par une connexion chiffrée (HTTPS). L’accès aux données est réservé aux comptes autorisés, et
              chaque connexion est enregistrée. Aucune donnée personnelle ne figure dans les QR codes ni dans les
              journaux techniques. Enfin, nos sauvegardes sont elles aussi chiffrées.
            </p>
          </Section>

          <Section titre="7. Vos droits">
            <p>
              Vous disposez à tout moment d’un droit d’accès à vos données, ainsi que du droit de les faire rectifier ou
              supprimer. Vous pouvez également vous opposer à leur traitement, y compris à l’envoi d’informations sur
              nos événements et nos actualités. Pour exercer ces droits, il vous suffit de contacter MDE Business
              School.
            </p>
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
      <div className="flex flex-col gap-2 text-mde-texte-2 [text-wrap:pretty] [&_p]:m-0">{children}</div>
    </section>
  );
}
