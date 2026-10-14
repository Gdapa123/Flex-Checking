/**
 * File des scans hors ligne (IndexedDB). Chaque scan est rejoué au retour du réseau avec sa
 * dateClient ; le serveur reste l'arbitre (idempotence) et envoie l'email n°2 à la synchronisation.
 */
import { openDB } from 'idb';

const BASE = 'flex-checking-scan';
let promesse = null;

function base() {
  promesse =
    promesse ||
    openDB(BASE, 1, {
      upgrade(db) {
        const s = db.createObjectStore('file', { keyPath: 'id' });
        s.createIndex('evenement', 'evenementId');
      },
    });
  return promesse;
}

export async function ajouter(evenementId, payload) {
  const item = { id: crypto.randomUUID(), evenementId, payload, cree: Date.now() };
  await (await base()).put('file', item);
  return item;
}

export async function lister(evenementId) {
  return (await base()).getAllFromIndex('file', 'evenement', evenementId);
}

export async function retirer(id) {
  await (await base()).delete('file', id);
}

export async function compter(evenementId) {
  return (await base()).countFromIndex('file', 'evenement', evenementId);
}

/** Tous événements confondus (avertissement avant déconnexion). */
export async function compterTout() {
  try {
    return await (await base()).count('file');
  } catch {
    return 0;
  }
}

const CONSERVATION_MS = 7 * 24 * 3600 * 1000;

/** Passages hors ligne de plus de 7 jours (cérémonie passée, compte retiré) : supprimés de l'appareil. */
export async function purgerAnciens(maintenant = Date.now()) {
  const db = await base();
  const items = await db.getAll('file');
  await Promise.all(items.filter((i) => maintenant - i.cree > CONSERVATION_MS).map((i) => db.delete('file', i.id)));
}

/**
 * Rejoue la file. `envoyer(payload)` renvoie le résultat serveur ou lève une erreur réseau
 * (TypeError) : dans ce cas on s'arrête et on réessaiera plus tard.
 */
const enCours = new Map();

export function synchroniser(evenementId, envoyer) {
  // une seule synchronisation à la fois par événement (événement « online » + intervalle)
  if (enCours.has(evenementId)) return Promise.resolve([]);
  const p = rejouer(evenementId, envoyer).finally(() => enCours.delete(evenementId));
  enCours.set(evenementId, p);
  return p;
}

async function rejouer(evenementId, envoyer) {
  const items = (await lister(evenementId)).sort((a, b) => a.cree - b.cree);
  const resultats = [];
  for (const item of items) {
    try {
      const r = await envoyer(item.payload);
      await retirer(item.id);
      resultats.push({ id: item.id, resultat: r });
    } catch (e) {
      const s = e?.status;
      // réseau coupé, limitation, session expirée ou CSRF : on garde la file et on réessaiera plus tard
      if (e instanceof TypeError || s === 0 || s === 429 || s === 401 || s === 403) break;
      if (s >= 500) continue; // erreur serveur : conservé, sans bloquer les passages suivants
      await retirer(item.id); // requête invalide : inutile de la rejouer
    }
  }
  return resultats;
}
