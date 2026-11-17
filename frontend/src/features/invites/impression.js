import { api } from '../../lib/api';
import { heure, jour, jourHeure, MODES, nombre } from '../../lib/format';

/** Lignes imprimables au plus (20 pages de 100) : au-delà, filtrer avant d'imprimer. */
export const MAX_IMPRESSION = 2000;
const TAILLE_PAGE = 100;

const echapper = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/**
 * Récupère toute la liste filtrée (mêmes filtres que l'export), dans l'ordre alphabétique : première page, puis les
 * suivantes, 3 à la fois au plus (le serveur sert aussi les postes de scan). Une inscription arrivée pendant le
 * chargement peut décaler les pages : les doublons sont retirés.
 */
const PARALLELE = 3;
export async function chargerListe(base, filtres) {
  const page = (n) =>
    api
      .get(base, { ...filtres, tri: 'nom', page: n, taille: TAILLE_PAGE })
      .catch((e) => (e?.status === 404 ? { resultats: [] } : Promise.reject(e)));
  const premiere = await page(1);
  const total = premiere.total ?? 0;
  const pages = Math.min(Math.ceil(total / TAILLE_PAGE), MAX_IMPRESSION / TAILLE_PAGE);
  const suivantes = [];
  for (let n = 2; n <= pages; n += PARALLELE) {
    const lot = Array.from({ length: Math.min(PARALLELE, pages - n + 1) }, (_, i) => page(n + i));
    suivantes.push(...(await Promise.all(lot)));
  }
  const vus = new Set();
  const lignes = [premiere, ...suivantes]
    .flatMap((r) => r.resultats || [])
    .filter((r) => !vus.has(r.id) && vus.add(r.id));
  return { lignes: lignes.slice(0, MAX_IMPRESSION), total };
}

/** Page HTML autonome de la liste (styles en ligne, aucun script). */
export function htmlListe({ titre, sousTitre, lignes, total, avecEvenement }) {
  const tronque = total > lignes.length;
  const corps = lignes
    .map((r, i) => {
      const presence = r.presentLe
        ? `${echapper(heure(r.presentLe))}${r.modeEmargement ? ` · ${echapper(MODES[r.modeEmargement] || '')}` : ''}`
        : '<span class="case"></span>';
      return `<tr>
<td class="n">${i + 1}</td>
<td><strong>${echapper(r.nomComplet)}</strong></td>
<td>${echapper(r.fonction)}</td>
<td>${echapper(r.entreprise)}</td>
${avecEvenement ? `<td>${echapper(r.evenementNom)}</td>` : ''}
<td class="p">${presence}</td>
</tr>`;
    })
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title>
<style>
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.35 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 2pt; }
.meta { color: #444; margin: 0 0 10pt; font-size: 9.5pt; }
.alerte { border: 1px solid #111; padding: 4pt 6pt; margin: 0 0 8pt; font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th, td { text-align: left; padding: 4pt 5pt; border-bottom: 0.6pt solid #999; vertical-align: top; }
th { font-size: 9pt; text-transform: uppercase; letter-spacing: .03em; border-bottom: 1.2pt solid #111; }
tr { break-inside: avoid; }
.n { width: 2.2em; color: #555; font-variant-numeric: tabular-nums; }
.p { width: 7.5em; white-space: nowrap; font-variant-numeric: tabular-nums; }
.case { display: inline-block; width: 11pt; height: 11pt; border: 1pt solid #111; }
</style></head><body>
<h1>${echapper(titre)}</h1>
<p class="meta">${echapper(sousTitre)}</p>
${tronque ? `<p class="alerte">Liste limitée aux ${nombre(lignes.length)} premiers sur ${nombre(total)} : filtrez pour imprimer le reste.</p>` : ''}
<table><thead><tr><th class="n">N°</th><th>Nom</th><th>Fonction</th><th>Entreprise</th>${avecEvenement ? '<th>Cérémonie</th>' : ''}<th class="p">Présence</th></tr></thead>
<tbody>${corps || `<tr><td colspan="${avecEvenement ? 6 : 5}">Aucun invité.</td></tr>`}</tbody></table>
</body></html>`;
}

/** Description lisible des filtres actifs, imprimée sous le titre (`portee` : cérémonie ou programme filtré). */
export function decrireFiltres(filtres, total, portee = '') {
  const morceaux = [];
  if (portee) morceaux.push(portee);
  if (filtres.statut === 'PRESENT') morceaux.push('présents');
  else if (filtres.statut === 'INSCRIT') morceaux.push('non présents');
  else morceaux.push('tous les invités');
  if (filtres.mode) morceaux.push(`émargement : ${MODES[filtres.mode] || filtres.mode}`);
  if (filtres.q) morceaux.push(`recherche « ${filtres.q} »`);
  if (filtres.magazine) morceaux.push(filtres.magazine === 'ENVOYE' ? 'email 2 envoyé' : 'email 2 non envoyé');
  if (filtres.email1) morceaux.push('email 1 en échec');
  const maintenant = new Date().toISOString();
  return `${morceaux.join(' · ')} · ${nombre(total)} ${total > 1 ? 'personnes' : 'personne'} · ordre alphabétique · imprimé le ${jourHeure(maintenant) || jour(maintenant)}`;
}

/**
 * Prépare l'impression : liste chargée et mise en page dans un cadre invisible (rien n'est ajouté au serveur : mêmes
 * requêtes que le tableau). Rend `imprimer()` (à appeler depuis un geste de l'utilisateur : iPad et Safari refusent
 * l'impression déclenchée après des chargements), `fermer()` et les nombres de lignes.
 */
export async function preparerImpression({ base, filtres, titre, avecEvenement, portee }) {
  const { lignes, total } = await chargerListe(base, filtres);
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  cadre.tabIndex = -1;
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  cadre.srcdoc = htmlListe({
    titre,
    sousTitre: decrireFiltres(filtres, total, portee),
    lignes,
    total,
    avecEvenement,
  });
  await new Promise((ok) => {
    cadre.onload = ok;
    document.body.appendChild(cadre);
  });
  const fermer = () => cadre.remove();
  // filet : fenêtre abandonnée ou navigateur sans « afterprint »
  setTimeout(() => cadre.isConnected && fermer(), 10 * 60_000);
  return {
    imprimes: lignes.length,
    total,
    fermer,
    imprimer: () => {
      const fenetre = cadre.contentWindow;
      fenetre.addEventListener('afterprint', () => setTimeout(fermer, 1000), { once: true });
      fenetre.focus();
      fenetre.print();
    },
  };
}

/** Geste de l'utilisateur encore valable (clic récent) : impression directe, sinon bouton de confirmation. */
export const gesteActif = () => navigator.userActivation?.isActive === true;
