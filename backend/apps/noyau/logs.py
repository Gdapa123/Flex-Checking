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
