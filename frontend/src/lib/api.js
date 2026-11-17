/**
 * Client HTTP de l'API Flex’Checking : cookies httpOnly (JWT), en-tête CSRF, rafraîchissement
 * automatique de la session sur 401.
 */
export class ApiError extends Error {
  constructor(status, data) {
    super((data && (data.detail || data.code)) || `Erreur ${status}`);
    this.status = status;
    this.data = data || {};
    this.code = this.data.code;
  }
}

function lireCookie(nom) {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(nom + '='))
    ?.split('=')[1];
}

// délai maximal des requêtes internes (jeton CSRF, rafraîchissement de session) : sur un Wi-Fi qui accepte la
// connexion sans répondre, elles ne bloquent pas l'émargement en cours (qui a son propre délai) indéfiniment
const DELAI_INTERNE_MS = 10_000;
function fetchAvecDelai(url, options) {
  const delai = new AbortController();
  const minuteur = setTimeout(() => delai.abort(), DELAI_INTERNE_MS);
  return fetch(url, { ...options, signal: delai.signal }).finally(() => clearTimeout(minuteur));
}

let csrfPret = null;
async function assurerCsrf() {
  if (lireCookie('fc_csrftoken')) return;
  csrfPret = csrfPret || fetchAvecDelai('/api/auth/csrf/', { credentials: 'same-origin' });
  try {
    await csrfPret;
  } finally {
    // remis à zéro même en cas d'échec : une coupure ponctuelle ne bloque pas toutes les écritures suivantes
    csrfPret = null;
  }
}

let rafraichissement = null;
async function rafraichir() {
  rafraichissement =
    rafraichissement ||
    (async () => {
      // le serveur vérifie le jeton CSRF sur le rafraîchissement, comme sur toute requête modifiante
      await assurerCsrf();
      const jeton = lireCookie('fc_csrftoken');
      const r = await fetchAvecDelai('/api/auth/rafraichir/', {
        method: 'POST',
        credentials: 'same-origin',
        headers: jeton ? { 'X-CSRFToken': decodeURIComponent(jeton) } : {},
      });
      // seul le statut est partagé entre les appelants simultanés (le corps ne se lit qu'une fois)
      return r.status;
    })().finally(() => {
      setTimeout(() => (rafraichissement = null), 0);
    });
  const statut = await rafraichissement;
  // 409 : un autre onglet vient de renouveler la session, ses cookies sont déjà en place
  if ((statut >= 200 && statut < 300) || statut === 409) return true;
  // limite de débit (Wi-Fi partagé de la salle) ou serveur indisponible : la session n'est pas expirée, l'hôte
  // ne doit pas être renvoyé à la connexion en pleine cérémonie ; l'appelant reçoit une erreur réseau
  if (statut === 429 || statut >= 500) throw new ApiError(statut, null);
  return false;
}

/** Attente interrompue par le signal de l'appelant (délai de l'émargement) : le poste n'attend pas au-delà. */
function interrompable(promesse, signal) {
  if (!signal) return promesse;
  return new Promise((ok, ko) => {
    const abandon = () => ko(new DOMException('Délai dépassé', 'AbortError'));
    if (signal.aborted) return abandon();
    signal.addEventListener('abort', abandon, { once: true });
    promesse.then(ok, ko).finally(() => signal.removeEventListener('abort', abandon));
  });
}

/**
 * Rafraîchit la session (cookie d'accès) ; utilisé aussi par la connexion temps réel.
 * Rend true (renouvelée), false (expirée) ou null (serveur limité, indisponible ou injoignable : réessayer).
 */
export const rafraichirSession = () => rafraichir().catch(() => null);

/** Rafraîchissement depuis une requête : une panne passagère du rafraîchissement est rendue telle quelle. */
async function rafraichirOuErreur() {
  try {
    return { ok: await rafraichir() };
  } catch {
    // traité comme une coupure réseau : message « Connexion impossible », scan mis en file hors ligne
    return { erreur: new TypeError('rafraîchissement de session indisponible') };
  }
}

const ECRITURE = ['POST', 'PUT', 'PATCH', 'DELETE'];
// un 401 de ces routes ne signifie pas « cookie d'accès expiré » : pas de rafraîchissement
const SANS_RAFRAICHISSEMENT = [
  '/api/auth/connexion/',
  '/api/auth/rafraichir/',
  '/api/auth/csrf/',
  '/api/auth/deconnexion/',
];

export async function requete(url, { method = 'GET', body, params, brut = false, signal, reessai = true } = {}) {
  method = method.toUpperCase();
  let cible = url.startsWith('/api') ? url : `/api${url}`;
  if (params) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, v);
    });
    const s = q.toString();
    if (s) cible += (cible.includes('?') ? '&' : '?') + s;
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (ECRITURE.includes(method)) {
    await interrompable(assurerCsrf(), signal);
    const jeton = lireCookie('fc_csrftoken');
    if (jeton) headers['X-CSRFToken'] = decodeURIComponent(jeton);
  }
  const reponse = await fetch(cible, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    signal,
  });
  if (reponse.status === 401) {
    // /auth/moi/ compris : rouvrir l'application après l'expiration du cookie d'accès renouvelle la session
    const rafraichissable = !SANS_RAFRAICHISSEMENT.some((p) => cible.startsWith(p));
    if (reessai && rafraichissable) {
      const r = await interrompable(rafraichirOuErreur(), signal);
      if (r.erreur) throw r.erreur; // 429, 5xx ou coupure : pas de déconnexion (le scan bascule en hors ligne)
      if (r.ok) return requete(url, { method, body, params, brut, signal, reessai: false });
    }
    if (!cible.startsWith('/api/auth/')) window.dispatchEvent(new CustomEvent('fc:session-expiree'));
  }
  if (brut) {
    if (!reponse.ok && reponse.status !== 202) throw new ApiError(reponse.status, await lireJson(reponse));
    return reponse;
  }
  const data = await lireJson(reponse);
  if (!reponse.ok) throw new ApiError(reponse.status, data);
  return data;
}

async function lireJson(r) {
  if (r.status === 204) return null;
  const type = r.headers.get('Content-Type') || '';
  if (!type.includes('json')) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

export const api = {
  get: (url, params, opts) => requete(url, { params, ...opts }),
  post: (url, body, opts) => requete(url, { method: 'POST', body, ...opts }),
  patch: (url, body, opts) => requete(url, { method: 'PATCH', body, ...opts }),
  put: (url, body, opts) => requete(url, { method: 'PUT', body, ...opts }),
  delete: (url, opts) => requete(url, { method: 'DELETE', ...opts }),
};

/** Message d'erreur lisible pour un toast. */
export function messageErreur(e, defaut = 'Une erreur est survenue. Réessayez.') {
  if (!e) return defaut;
  if (e.status === 0 || e instanceof TypeError) return 'Connexion impossible. Vérifiez le réseau.';
  if (e.status === 429) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (e.data?.detail) return e.data.detail;
  const premier = e.data && Object.values(e.data).find((v) => Array.isArray(v));
  return premier ? premier[0] : defaut;
}
