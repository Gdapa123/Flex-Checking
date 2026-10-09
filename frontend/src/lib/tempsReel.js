/** Horodatage de la dernière mise à jour des données temps réel (indicateur de l'en-tête admin). */
let derniere = Date.now();
export const marquerMaj = (t = Date.now()) => {
  derniere = t;
};
export const lireMaj = () => derniere;
