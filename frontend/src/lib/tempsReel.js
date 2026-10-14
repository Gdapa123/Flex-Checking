/**
 * Temps réel : une connexion WebSocket par onglet (`/api/ws/`). Le serveur annonce les sujets qui
 * ont changé (« invites », « statistiques »…), sans aucune donnée personnelle ; on recharge alors
 * les requêtes concernées par l'API habituelle. Hors connexion, les écrans reviennent à
 * l'interrogation périodique (`useSecours`).
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { rafraichirSession } from './api';

/** Sujet annoncé par le serveur → clés des requêtes React Query à recharger. */
export const REQUETES_PAR_SUJET = {
  invites: [['invites'], ['invite'], ['historique'], ['scan-recherche']],
  statistiques: [['statistiques'], ['suivi-emails']],
  recents: [['recents']],
  evenements: [['evenements'], ['analytique']],
  evenement: [['evenement']],
  journal: [['journal']],
  admins: [['admins'], ['comptes']],
  programmes: [['programmes']],
  parametres: [['parametres'], ['parametres-scan']],
  'apercu-emails': [['apercu-emails']],
  sondage: [['sondage'], ['sondages-global'], ['suivi-emails']],
  moi: [['moi']],
  erreurs: [['erreurs-techniques'], ['analytique-technique']],
};

const FERMETURE_SESSION = 4001;
const FERMETURE_COMPTE = 4003;
// le serveur n'a pas de temps réel (pas de Redis) : nouvel essai espacé, au cas où il serait réactivé
const FERMETURE_INDISPONIBLE = 4004;
const ESSAI_SI_INDISPONIBLE_MS = 5 * 60_000;
const REGROUPEMENT_MS = 250;

// ------------------------------------------------------------------ état partagé

// 'connexion' | 'connecte' | 'deconnecte' | 'indisponible' (le serveur refuse le temps réel : environnement sans Redis)
let etat = 'deconnecte';
const abonnes = new Set();
function changerEtat(e) {
  if (e === etat) return;
  etat = e;
  abonnes.forEach((f) => f());
}
const sAbonner = (f) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};

export const useEtatTempsReel = () => useSyncExternalStore(sAbonner, () => etat);
export const lireEtatTempsReel = () => etat;

/** Intervalle d'interrogation de secours : désactivé tant que le temps réel est connecté. */
export function useSecours(ms) {
  return useEtatTempsReel() === 'connecte' ? false : ms;
}

/** Horodatage de la dernière mise à jour des données (indicateur de l'en-tête admin). */
let derniere = Date.now();
export const marquerMaj = (t = Date.now()) => {
  derniere = t;
};
export const lireMaj = () => derniere;

// ------------------------------------------------------------------ connexion

/** Ouvre la connexion et la maintient (reconnexion progressive). Rend la fonction d'arrêt. */
export function demarrerTempsReel(qc) {
  if (typeof WebSocket === 'undefined') return () => {};
  let ws = null;
  let arrete = false;
  let essais = 0;
  let minuteur = null;
  let dejaConnecte = false;
  const enAttente = new Set();
  let regroupement = null;

  const recharger = () => {
    regroupement = null;
    enAttente.forEach((sujet) =>
      (REQUETES_PAR_SUJET[sujet] || []).forEach((queryKey) => qc.invalidateQueries({ queryKey })),
    );
    enAttente.clear();
  };

  const planifier = (delai) => {
    clearTimeout(minuteur);
    if (!arrete) minuteur = setTimeout(ouvrir, delai);
  };

  const sessionTerminee = () => {
    arrete = true;
    changerEtat('deconnecte');
    window.dispatchEvent(new CustomEvent('fc:session-expiree'));
  };

  function ouvrir() {
    if (arrete || ws) return;
    // temps réel indisponible : les tentatives suivantes se font en silence (l'interrogation périodique prend le relais)
    if (etat !== 'indisponible') changerEtat('connexion');
    const protocole = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocole}://${window.location.host}/api/ws/`);
    ws = socket;

    socket.onmessage = (e) => {
      let message;
      try {
        message = JSON.parse(e.data);
      } catch {
        return;
      }
      if (message.type === 'pret') {
        essais = 0;
        changerEtat('connecte');
        // après une coupure, des changements ont pu être manqués : tout recharger
        if (dejaConnecte) qc.invalidateQueries();
        dejaConnecte = true;
        marquerMaj();
      } else if (message.type === 'maj' && Array.isArray(message.sujets)) {
        message.sujets.forEach((s) => enAttente.add(s));
        marquerMaj();
        regroupement = regroupement || setTimeout(recharger, REGROUPEMENT_MS);
      }
    };

    socket.onclose = async (e) => {
      if (ws === socket) ws = null;
      if (arrete) return;
      if (e.code === FERMETURE_COMPTE) return sessionTerminee();
      if (e.code === FERMETURE_SESSION) {
        // jeton d'accès expiré : rafraîchir la session puis se reconnecter aussitôt
        changerEtat('deconnecte');
        if (await rafraichirSession()) return planifier(0);
        return sessionTerminee();
      }
      if (e.code === FERMETURE_INDISPONIBLE) {
        changerEtat('indisponible');
        return planifier(ESSAI_SI_INDISPONIBLE_MS);
      }
      changerEtat('deconnecte');
      essais += 1;
      const base = Math.min(30_000, 1000 * 2 ** Math.min(essais - 1, 5));
      planifier(base / 2 + Math.random() * (base / 2));
    };
  }

  const relancer = () => {
    // temps réel indisponible sur ce serveur : pas de nouvel essai anticipé (l'essai espacé reste programmé)
    if (!arrete && !ws && etat !== 'indisponible') planifier(0);
  };
  const visibilite = () => document.visibilityState === 'visible' && relancer();
  window.addEventListener('online', relancer);
  document.addEventListener('visibilitychange', visibilite);
  ouvrir();

  return () => {
    arrete = true;
    clearTimeout(minuteur);
    clearTimeout(regroupement);
    window.removeEventListener('online', relancer);
    document.removeEventListener('visibilitychange', visibilite);
    ws?.close(1000);
    ws = null;
    changerEtat('deconnecte');
  };
}

/** À monter une fois dans les espaces connectés (admin, scan, super admin). */
export function useTempsReel(actif = true) {
  const qc = useQueryClient();
  useEffect(() => (actif ? demarrerTempsReel(qc) : undefined), [qc, actif]);
}
