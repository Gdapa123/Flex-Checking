import logging
import re

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# lien personnel du sondage (page `/sondage/<jeton>` et API `/api/public/sondages/<jeton>/`) : à usage unique
JETON_SONDAGE_RE = re.compile(r"(/sondages?/)[^/?#\s\"']+")


def masquer_jetons(texte):
    return JETON_SONDAGE_RE.sub(r"\1[jeton]", texte)


TEL_RE = re.compile(r"(?:\+225[\s.]?)?\b0[1579](?:[\s.]?\d{2}){4}\b")


class MasquerDonneesPersonnelles(logging.Filter):
    """Masque emails et numéros de téléphone dans les messages de log."""

    def filter(self, record):
        try:
            msg = record.getMessage()
        except Exception:  # noqa: BLE001
            return True
        masque = masquer_jetons(TEL_RE.sub("[tél]", EMAIL_RE.sub("[email]", msg)))
        if masque != msg:
            record.msg, record.args = masque, ()
        # la trace d'une exception est ajoutée par le formateur, après ce filtre : on la calcule et on la masque ici
        # (ex. « Duplicate entry '12-aya@exemple.ci' » d'une IntegrityError)
        if record.exc_info:
            trace = logging.Formatter().formatException(record.exc_info)
            record.exc_text = masquer_jetons(TEL_RE.sub("[tél]", EMAIL_RE.sub("[email]", trace)))
            record.exc_info = None
        return True


class MasquerParametresUrl(logging.Filter):
    """Journal d'accès du serveur (Uvicorn) : retire la chaîne de requête des URL. Les recherches du
    tableau des invités (`?q=` nom, email, téléphone) ne doivent jamais apparaître dans les logs."""

    def filter(self, record):
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            chemin = masquer_jetons(args[2])
            if "?" in chemin:
                chemin = chemin.split("?", 1)[0] + "?[masqué]"
            if chemin != args[2]:
                record.args = (*args[:2], chemin, *args[3:])
        return True
