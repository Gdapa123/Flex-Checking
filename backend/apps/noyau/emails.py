"""Rendu et envoi des emails n°1 (invitation) et n°2 (magazine).

Les modèles (objet + corps) sont éditables par le super admin (Parametres). Le corps est du
texte avec des variables {…}. Le gabarit HTML (templates/emails/) reprend la structure en cartes
du design : le texte avant {qr_code} (ou {lien_magazine}) va dans la carte message, la variable
est remplacée par la carte QR (ou magazine), le texte après dans une carte suivante.
"""

import base64
import logging
import re
from email.mime.image import MIMEImage
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.mail.message import SafeMIMEMultipart
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import escape
from django.utils.safestring import mark_safe

from . import dates
from .icones_email import icone_png
from .ics import ics_evenement, lien_pratique
from .models import EmailEnvoye, Parametres, StatutEmail, TypeEmail
from .qr import qr_png
from .theme import deriver_tokens

ASSETS = Path(__file__).resolve().parent / "assets"
VARIABLES = [
    "civilite",
    "prenom",
    "nom",
    "programme",
    "annee",
    "date",
    "lieu",
    "qr_code",
    "code",
    "lien_magazine",
    "lien_sondage",
]


class EmailAvecImagesInline(EmailMultiAlternatives):
    """multipart/mixed [ multipart/related [ alternative(texte, html), images CID ], pièces jointes ]"""

    def __init__(self, *args, images_inline=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.images_inline = images_inline or []

    def _create_alternatives(self, msg):
        msg = super()._create_alternatives(msg)
        if not self.images_inline:
            return msg
        related = SafeMIMEMultipart(_subtype="related", encoding=self.encoding)
        related.attach(msg)
        for cid, donnees in self.images_inline:
            image = MIMEImage(donnees, _subtype="png")
            image.add_header("Content-ID", f"<{cid}>")
            image.add_header("Content-Disposition", "inline", filename=f"{cid}.png")
            related.attach(image)
        return related


def _remplacer(texte, valeurs):
    for cle, valeur in valeurs.items():
        texte = texte.replace("{" + cle + "}", valeur)
    return texte


def _paragraphes_html(texte, valeurs):
    """Texte du modèle → liste de paragraphes HTML (valeurs échappées, sauts de ligne en <br>)."""
    texte = _remplacer(escape(texte), {k: escape(v) for k, v in valeurs.items()})
    blocs = [b.strip() for b in re.split(r"\n\s*\n", texte) if b.strip()]
    return [mark_safe(b.replace("\n", "<br>")) for b in blocs]


class Source:
    """Données d'un email, issues d'un invité réel ou d'un exemple (aperçu)."""

    def __init__(
        self,
        evenement,
        civilite,
        prenom,
        nom,
        code,
        qr_token,
        present_le=None,
        jeton_sondage="",
        sondage_expire_le=None,
    ):
        self.evenement, self.civilite, self.prenom, self.nom = evenement, civilite, prenom, nom
        self.code, self.qr_token, self.present_le = code, qr_token, present_le
        self.jeton_sondage, self.sondage_expire_le = jeton_sondage, sondage_expire_le

    @classmethod
    def depuis_invite(cls, invite, avec_sondage=False):
        from .models import InvitationSondage

        sondage = InvitationSondage.objects.filter(invite=invite).first() if avec_sondage else None
        return cls(
            invite.evenement,
            invite.civilite_affichee,
            invite.prenom,
            invite.nom,
            invite.code,
            invite.qr_token,
            invite.present_le,
            jeton_sondage=sondage.jeton if sondage else "",
            sondage_expire_le=sondage.expire_le if sondage else None,
        )


def lien_sondage(jeton):
    return f"{settings.APP_PUBLIC_URL}/sondage/{jeton}"


def _valeurs(source):
    ev, prog = source.evenement, source.evenement.programme
    return {
        "civilite": source.civilite,
        "prenom": source.prenom,
        "nom": source.nom,
        "programme": prog.nom,
        "annee": str(ev.annee),
        "date": dates.date_longue(ev.date),
        "lieu": ev.lieu,
        "code": source.code,
        "lien_magazine": prog.lien_magazine or "",
        "lien_sondage": lien_sondage(source.jeton_sondage) if source.jeton_sondage else "",
    }


def rendre(type_email, source, *, parametres=None, objet=None, corps=None, apercu=False):
    """Retourne {objet, html, texte, images_inline, pieces_jointes}.

    En aperçu, les images sont intégrées en data URI (affichage dans un iframe).
    """
    p = parametres or Parametres.charger()
    ev, prog = source.evenement, source.evenement.programme
    t = deriver_tokens(prog.couleur_principale, prog.couleur_secondaire)
    valeurs = _valeurs(source)
    est_invitation = type_email == TypeEmail.INVITATION
    # type → (objet, corps, marqueur du bloc central, gabarit, titre du bandeau)
    modele = {
        TypeEmail.INVITATION: (p.objet_email_1, p.corps_email_1, "{qr_code}", "invitation", ev.nom_affiche),
        TypeEmail.MAGAZINE: (
            p.objet_email_2,
            p.corps_email_2,
            "{lien_magazine}",
            "magazine",
            f"Bienvenue à la {ev.nom_affiche}",
        ),
        TypeEmail.SONDAGE: (
            p.objet_email_3,
            p.corps_email_3,
            "{lien_sondage}",
            "sondage",
            f"Votre avis sur la {ev.nom_affiche}",
        ),
    }[type_email]
    objet = objet if objet is not None else modele[0]
    corps = corps if corps is not None else modele[1]
    marqueur = modele[2]
    avant, _, apres = corps.partition(marqueur)
    if marqueur not in corps:
        avant, apres = corps, ""

    images = {}

    def image(cid, donnees):
        images[cid] = donnees
        if apercu:
            return "data:image/png;base64," + base64.b64encode(donnees).decode()
        return f"cid:{cid}"

    logo_blanc = t["on_primary"] == "#FFFFFF"
    logo = (ASSETS / ("logo-blanc.png" if logo_blanc else "logo-rouge.png")).read_bytes()
    lien_public = f"{settings.APP_PUBLIC_URL}/i/{ev.slug_inscription}"
    contexte = {
        "t": t,
        "titre": modele[4],
        "nom_affiche": ev.nom_affiche,
        "programme": prog.nom,
        "annee": ev.annee,
        "logo_src": image("logo", logo),
        "paragraphes_avant": _paragraphes_html(avant, valeurs),
        "paragraphes_apres": _paragraphes_html(apres, valeurs),
        "date_longue": dates.date_longue_majuscule(ev.date),
        "heure_debut": dates.heure(ev.heure_debut),
        "heure_accueil": dates.heure(ev.heure_accueil),
        "lieu": ev.lieu,
        "lien_carte": ev.lien_carte,
        # page « Infos pratiques » : choix de l'agenda (Google, Outlook, Apple…) et de l'application d'itinéraire
        "lien_agenda": lien_pratique(ev, "agenda"),
        "lien_itineraire": lien_pratique(ev, "itineraire"),
        "lien_public": lien_public,
        "lien_magazine": prog.lien_magazine,
        "lien_sondage": valeurs["lien_sondage"],
        "expire_texte": (
            f"{dates.date_longue(timezone.localtime(source.sondage_expire_le).date())} à "
            f"{dates.heure_dt(source.sondage_expire_le)}"
            if source.sondage_expire_le
            else ""
        ),
        "code": source.code,
        "badge_present": f"Présent·e · {dates.heure_dt(source.present_le)}" if source.present_le else "Présent·e",
        "expediteur": p.expediteur,
        "ic": {
            nom: image(f"ic-{nom}-{c.strip('#')}", icone_png(nom, c))
            for nom, c in [
                ("calendar", t["primary"]),
                ("clock", t["primary"]),
                ("mapPin", t["primary"]),
                ("calendarPlus", t["on_primary"]),
                ("navigation", "#1B1D20"),
                ("check", "#18794E"),
                ("external", t["on_primary"]),
            ]
        },
    }
    if est_invitation:
        contexte["qr_src"] = image("qr", qr_png(source.qr_token))
    gabarit = modele[3]
    html = render_to_string(f"emails/{gabarit}.html", contexte)

    texte_valeurs = dict(valeurs)
    texte_valeurs["qr_code"] = (
        "Votre QR code est joint à cet email (qr-code.png). "
        f"Code de secours à donner à l'accueil si le QR code ne peut pas être lu : {source.code}"
    )
    texte = render_to_string(
        f"emails/{gabarit}.txt",
        {**contexte, "corps": _remplacer(corps, texte_valeurs)},
    )
    pieces = []
    if est_invitation:
        pieces = [
            ("qr-code.png", images["qr"], "image/png"),
            ("graduation.ics", ics_evenement(ev), "text/calendar"),
        ]
    return {
        "objet": _remplacer(objet, valeurs),
        "html": html,
        "texte": texte,
        "images_inline": list(images.items()),
        "pieces_jointes": pieces,
    }


def construire_message(email_envoye):
    invite = email_envoye.invite
    p = Parametres.charger()
    source = Source.depuis_invite(invite, avec_sondage=email_envoye.type == TypeEmail.SONDAGE)
    rendu = rendre(email_envoye.type, source, parametres=p)
    return message_depuis_rendu(rendu, invite.email, p)


def message_depuis_rendu(rendu, destinataire, parametres, *, prefixe_objet=""):
    message = EmailAvecImagesInline(
        subject=prefixe_objet + rendu["objet"],
        body=rendu["texte"],
        from_email=f"{parametres.expediteur} <{settings.DEFAULT_FROM_EMAIL}>",
        to=[destinataire],
        images_inline=rendu["images_inline"],
    )
    message.attach_alternative(rendu["html"], "text/html")
    for nom, contenu, mime in rendu["pieces_jointes"]:
        message.attach(nom, contenu, mime)
    return message


def planifier(invite, type_email):
    """Crée la ligne EmailEnvoye et déclenche l'envoi Celery après le commit."""
    from .tasks import envoyer_email

    email = EmailEnvoye.objects.create(invite=invite, type=type_email, statut=StatutEmail.EN_ATTENTE)
    transaction.on_commit(lambda: _lancer(envoyer_email, email.pk))
    return email


def _lancer(tache, email_id):
    """Met l'envoi en file sans jamais faire échouer l'action de l'utilisateur (inscription, scan) :
    si la file est indisponible, l'email reste « en attente » et la tâche planifiée le relancera."""
    try:
        tache.delay(email_id)
    except Exception as exc:  # noqa: BLE001
        from .erreurs import enregistrer_exception
        from .models import SourceErreur

        logging.getLogger(__name__).warning("File d'envoi indisponible : email %s relancé plus tard.", email_id)
        enregistrer_exception(SourceErreur.TACHE, exc, lieu="Mise en file d'un email")


def magazine_deja_parti(invite):
    """Email n°2 déjà déclenché pour cet invité (envoyé, en cours ou en échec définitif) :
    il ne repart jamais automatiquement, même après une annulation suivie d'un ré-émargement."""
    return EmailEnvoye.objects.filter(invite=invite, type=TypeEmail.MAGAZINE).exists()
