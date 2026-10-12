import { Component } from 'react';
import { signalerErreur } from '../../lib/signalement';

/**
 * Filet de sécurité : une erreur d'affichage montre un message simple et un bouton de rechargement,
 * jamais une page blanche ni un détail technique. L'erreur est signalée au super admin
 * (« Erreurs techniques »).
 */
export default class FiletErreur extends Component {
  state = { erreur: null };

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, info) {
    console.error('Erreur d’affichage', erreur);
    signalerErreur(erreur, info?.componentStack || '');
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div
        role="alert"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 overflow-auto bg-fond p-6 text-center"
      >
        <p className="m-0 text-[20px] font-bold text-texte">Un problème d’affichage est survenu.</p>
        <p className="m-0 max-w-[380px] text-[15px] leading-[1.5] text-texte-2">
          Il a été signalé automatiquement à l’équipe. Rechargez la page : vos informations sont conservées.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-principal h-12 cursor-pointer rounded-bouton border-0 px-6 text-[16px] font-semibold"
        >
          Recharger la page
        </button>
      </div>
    );
  }
}
