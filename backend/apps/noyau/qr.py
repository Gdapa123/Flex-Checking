"""QR codes : ils n'encodent que le qrToken (ou l'URL publique d'inscription), jamais de
donnée personnelle."""

import io

import qrcode
import qrcode.image.svg
from qrcode.constants import ERROR_CORRECT_M


def _qr(donnee):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(donnee)
    qr.make(fit=True)
    return qr


def qr_png(donnee, couleur="#141414", fond="#FFFFFF", taille_module=10):
    qr = _qr(donnee)
    qr.box_size = taille_module
    image = qr.make_image(fill_color=couleur, back_color=fond)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def qr_svg(donnee):
    qr = _qr(donnee)
    image = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
    tampon = io.BytesIO()
    image.save(tampon)
    return tampon.getvalue()
