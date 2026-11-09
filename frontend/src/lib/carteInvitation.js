/**
 * Carte d'invitation du programme (SA5) : préparation du fichier avant envoi.
 * Miroir de `backend/apps/noyau/cartes_invitation.py` (mêmes types, même taille maximale) ; le serveur reste
 * l'arbitre (il reconnaît le format au contenu et réencode les images).
 */

export const TAILLE_MAX = 1_800_000;
export const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'application/pdf'];
// px : largement assez pour une carte affichée sur un téléphone ou imprimée en A5 (miroir de `COTE_MAX` serveur)
export const COTE_MAX = 2400;

export const tailleLisible = (octets) =>
  octets >= 1_000_000 ? `${(octets / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.round(octets / 1000)} ko`;

function enBase64(blob) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(',', 2)[1] || '');
    lecteur.onerror = () => rejeter(new Error('Fichier illisible.'));
    lecteur.readAsDataURL(blob);
  });
}

/** Image trop lourde ou trop grande : réduite (côté le plus long 2400 px) et réencodée en JPEG. */
async function reduireImage(image) {
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const toile = document.createElement('canvas');
  toile.width = Math.round(image.width * echelle);
  toile.height = Math.round(image.height * echelle);
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; // fond blanc : la transparence d'un PNG deviendrait noire en JPEG
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.drawImage(image, 0, 0, toile.width, toile.height);
  for (const qualite of [0.88, 0.8, 0.7, 0.6]) {
    const blob = await new Promise((r) => toile.toBlob(r, 'image/jpeg', qualite));
    if (blob && blob.size <= TAILLE_MAX) return blob;
  }
  throw new Error('Image trop lourde, même réduite : 1,8 Mo au plus.');
}

/** `{nom, contenu}` (contenu en base64) prêt pour `PUT evenements/<id>/carte-invitation/`. */
export async function preparerCarte(fichier) {
  if (!TYPES_ACCEPTES.includes(fichier.type)) throw new Error('Format non accepté : image JPEG ou PNG, ou PDF.');
  let blob = fichier;
  let nom = fichier.name;
  if (fichier.type !== 'application/pdf' && typeof createImageBitmap === 'function') {
    // même règle que le serveur (`cartes_invitation.COTE_MAX`) : réduite si trop lourde ou trop grande en pixels
    const image = await createImageBitmap(fichier).catch(() => {
      throw new Error('Image illisible.');
    });
    if (fichier.size > TAILLE_MAX || Math.max(image.width, image.height) > COTE_MAX) {
      blob = await reduireImage(image);
      nom = nom.replace(/\.[^.]+$/, '') + '.jpg';
    }
    image.close?.();
  }
  if (blob.size > TAILLE_MAX) throw new Error('Fichier trop lourd : 1,8 Mo au plus.');
  return { nom, contenu: await enBase64(blob) };
}
