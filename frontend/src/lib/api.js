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

let csrfPret = null;
async function assurerCsrf() {
  if (lireCookie('fc_csrftoken')) return;
  csrfPret = csrfPret || fetch('/api/auth/csrf/', { credentials: 'same-origin' });
  await csrfPret;
  csrfPret = null;
}

let rafraichissement = null;
async function rafraichir() {
  rafraichissement =
    rafraichissement ||
    fetch('/api/auth/rafraichir/', { method: 'POST', credentials: 'same-origin' }).finally(() => {
      setTimeout(() => (rafraichissement = null), 0);
    });
  const r = await rafraichissement;
  return r.ok;
}

/** Rafraîchit la session (cookie d'accès) ; utilisé aussi par la connexion temps réel. */
export const rafraichirSession = () => rafraichir().catch(() => false);

const ECRITURE = ['POST', 'PUT', 'PATCH', 'DELETE'];

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
    await assurerCsrf();
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
  const authUrl = cible.startsWith('/api/auth/');
  if (reponse.status === 401 && reessai && !authUrl) {
    if (await rafraichir()) return requete(url, { method, body, params, brut, signal, reessai: false });
    window.dispatchEvent(new CustomEvent('fc:session-expiree'));
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
