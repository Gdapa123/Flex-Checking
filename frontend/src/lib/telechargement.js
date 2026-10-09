import { api, requete } from './api';

function enregistrer(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function nomFichier(reponse, defaut) {
  const cd = reponse.headers.get('Content-Disposition') || '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  return m ? m[1] : defaut;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Attend la fin d'une tâche Celery, puis télécharge le fichier si elle en produit un. */
export async function suivreTache(tacheId, { intervalle = 1000, max = 180 } = {}) {
  for (let i = 0; i < max; i++) {
    const t = await api.get(`/taches/${tacheId}/`);
    if (t.statut === 'TERMINEE') {
      if (t.telechargement) {
        const r = await requete(t.telechargement, { brut: true });
        enregistrer(await r.blob(), t.nom || 'export');
      }
      return t;
    }
    if (t.statut === 'ECHEC') throw new Error(t.erreur || 'La tâche a échoué.');
    await attendre(intervalle);
  }
  throw new Error('La tâche prend plus de temps que prévu.');
}

/**
 * Télécharge un export. Au-delà de 50 invités, le serveur répond 202 + tacheId (traitement Celery) :
 * on suit la tâche puis on télécharge le fichier produit.
 * Retourne { nb, asynchrone }.
 */
export async function telecharger(url, { params, methode = 'GET', corps, defaut = 'export' } = {}) {
  const r = await requete(url, { method: methode, params, body: corps, brut: true });
  if (r.status === 202) {
    const { tacheId, nb } = await r.json();
    await suivreTache(tacheId);
    return { nb, asynchrone: true };
  }
  enregistrer(await r.blob(), nomFichier(r, defaut));
  return { asynchrone: false };
}
