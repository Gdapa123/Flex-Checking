// Test de charge Flex'Checking : node charge.mjs <base> <slug> <evenementId> <email admin> <mot de passe>
const [base, slug, evId, email, mdp] = process.argv.slice(2);

function stats(nom, durees, statuts, totalMs) {
  const tri = [...durees].sort((a, b) => a - b);
  const p = (q) => tri[Math.min(tri.length - 1, Math.floor(q * tri.length))]?.toFixed(0);
  const parStatut = statuts.reduce((acc, s) => ((acc[s] = (acc[s] || 0) + 1), acc), {});
  console.log(
    `${nom.padEnd(42)} n=${durees.length}  statuts=${JSON.stringify(parStatut)}  ` +
      `médiane=${p(0.5)}ms  p95=${p(0.95)}ms  p99=${p(0.99)}ms  max=${tri.at(-1)?.toFixed(0)}ms  ` +
      `débit=${((durees.length / totalMs) * 1000).toFixed(0)} req/s`,
  );
}

async function salve(nom, n, requete) {
  const durees = [];
  const statuts = [];
  const debut = performance.now();
  await Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const t = performance.now();
      try {
        const r = await requete(i);
        await r.arrayBuffer();
        statuts.push(r.status);
      } catch (e) {
        statuts.push(`erreur:${e.cause?.code || e.name}`);
      }
      durees.push(performance.now() - t);
    }),
  );
  stats(nom, durees, statuts, performance.now() - debut);
}

// session admin (cookies httpOnly récupérés par l'en-tête Set-Cookie)
const csrf = await fetch(`${base}/api/auth/csrf/`);
let cookies = csrf.headers.getSetCookie().map((c) => c.split(';')[0]);
const jetonCsrf = cookies.find((c) => c.startsWith('fc_csrftoken=')).split('=')[1];
const connexion = await fetch(`${base}/api/auth/connexion/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': jetonCsrf,
    Cookie: cookies.join('; '),
    Referer: `${base}/connexion`,
  },
  body: JSON.stringify({ email, motDePasse: mdp }),
});
cookies = [...cookies, ...connexion.headers.getSetCookie().map((c) => c.split(';')[0])];
console.log('connexion admin :', connexion.status);
const session = cookies.join('; ');
const marque = Date.now();

await salve('1 000 invités ouvrent le lien', 1000, () => fetch(`${base}/api/public/evenements/${slug}/`));
await salve('500 inscriptions simultanées', 500, (i) =>
  fetch(`${base}/api/public/evenements/${slug}/inscription/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      civilite: i % 2 ? 'M' : 'MME',
      nom: 'Charge',
      prenom: `Test${i}`,
      email: `charge.${marque}.${i}@test.ci`,
      telephone: `07${String(10000000 + i).slice(-8)}`,
      entreprise: 'Test de charge',
      fonction: 'Testeur',
      consentementDonnees: true,
    }),
  }),
);
await salve('300 tableaux de bord admin (statistiques)', 300, () =>
  fetch(`${base}/api/evenements/${evId}/statistiques/`, { headers: { Cookie: session } }),
);
await salve('Mixte : 1 000 lectures + 300 admin + 200 listes', 1500, (i) =>
  i < 1000
    ? fetch(`${base}/api/public/evenements/${slug}/`)
    : i < 1300
      ? fetch(`${base}/api/evenements/${evId}/statistiques/`, { headers: { Cookie: session } })
      : fetch(`${base}/api/evenements/${evId}/invites/?taille=25`, { headers: { Cookie: session } }),
);
