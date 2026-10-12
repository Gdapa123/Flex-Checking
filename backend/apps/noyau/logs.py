import logging
import re

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
TEL_RE = re.compile(r"(?:\+225[\s.]?)?\b0[1579](?:[\s.]?\d{2}){4}\b")


class MasquerDonneesPersonnelles(logging.Filter):
    """Masque emails et numéros de téléphone dans les messages de log."""

    def filter(self, record):
        try:
            msg = record.getMessage()
        except Exception:  # noqa: BLE001
            return True
        masque = TEL_RE.sub("[tél]", EMAIL_RE.sub("[email]", msg))
        if masque != msg:
            record.msg, record.args = masque, ()
        return True


class MasquerParametresUrl(logging.Filter):
    """Journal d'accès du serveur (Uvicorn) : retire la chaîne de requête des URL. Les recherches du
    tableau des invités (`?q=` nom, email, téléphone) ne doivent jamais apparaître dans les logs."""

    def filter(self, record):
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str) and "?" in args[2]:
            record.args = (*args[:2], args[2].split("?", 1)[0] + "?[masqué]", *args[3:])
        return True
