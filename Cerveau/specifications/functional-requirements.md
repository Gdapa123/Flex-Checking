---
type: specification
statut: implémenté
verifie: 2026-10-26
commit: 2523cbb
sources: [PLAN.md, backend/apps/noyau/donnees_personnelles.py, backend/apps/noyau/tests/test_durcissement.py, backend/apps/noyau/tests/test_donnees_personnelles.py, frontend/src/features/invite/ConfidentialitePage.jsx, backend/apps/noyau/services.py, backend/apps/noyau/vues_scan.py, backend/apps/noyau/sondages.py, backend/apps/noyau/suivi_emails.py, backend/apps/noyau/models.py, backend/apps/noyau/tests/, frontend/src/features/scan/reglages.js, frontend/src/features/scan/ScanPoste.jsx, frontend/tests/]
---

# Exigences fonctionnelles

Reconstituées à partir de `PLAN.md` (le cahier des charges d’origine n’est pas dans le dépôt) et vérifiées dans
le code. Colonne « Preuve » : test automatisé ou fichier qui implémente la règle.

| ID | Exigence | Statut | Preuve |
|---|---|---|---|
| EF-01 | Inscription publique sans compte par un lien unique et régénérable par cérémonie | ✅ | `test_inscription.py`, `Evenement.regenerer_slug` |
| EF-02 | Refus si inscriptions fermées, date limite dépassée ou capacité atteinte, avec écran dédié | ✅ | `test_refus_etat`, `test_refus_date_limite` |
| EF-03 | Tous les champs obligatoires à l’inscription (dont entreprise, fonction) et consentement | ✅ | `test_entreprise_et_fonction_obligatoires`, `test_refus_sans_consentement` |
| EF-04 | Une adresse = une inscription par cérémonie ; la réponse ne révèle pas si l’adresse est inscrite | ✅ | `test_deja_inscrit_meme_reponse_et_invitation_renvoyee` |
| EF-05 | Email n°1 avec QR code, code de secours à 4 chiffres unique par cérémonie, infos pratiques, .ics | ✅ | `test_inscription_reussie_envoie_email_1`, `test_unicite_des_codes` |
| EF-06 | Renvoi de l’invitation par l’invité, réponse identique, limité | ✅ | `test_renvoi_reponse_identique_et_limite` |
| EF-07 | Émargement par QR caméra, douchette, code à 4 chiffres ou recherche manuelle | ✅ | `vues_scan.EmargementView`, `test_emargement.py` |
| EF-08 | Émargement idempotent : un second passage affiche « Déjà émargé » avec l’heure du premier | ✅ | `test_idempotence_deja_emarge`, `test_concurrence_un_seul_emargement` |
| EF-09 | QR d’une autre cérémonie signalé comme tel | ✅ | `test_code_invalide_et_autre_evenement` |
| EF-10 | Annulation d’un émargement (historique conservé), super admin uniquement | ✅ | `test_annulation_puis_reemargement_sans_second_magazine`, `test_annulation_reservee_au_super_admin` |
| EF-11 | Email n°2 (magazine) au premier passage, une seule fois, si activé pour le programme | ✅ | `test_premier_passage_present_et_magazine`, `test_magazine_inactif` |
| EF-12 | Scan hors ligne : mise en file, synchronisation, heure réelle conservée | ✅ | `test_scan_hors_ligne_garde_date_client`, `test_scan_hors_ligne_rejoue_apres_annulation` (`ANNULE_DEPUIS`), `test_c_est_moi_touche_hors_ligne_puis_synchronise` |
| EF-13 | Tableau de bord temps réel par cérémonie (indicateurs, arrivées par 15 min, modes, emails, comparaison annuelle) | ✅ | `statistiques.py`, `test_statistiques` |
| EF-14 | Gestion des invités : recherche, filtres, tri, pagination 25/50/100, fiche avec QR et historique, ajout, modification | ✅ | `test_invites.py` |
| EF-15 | Actions groupées (valider, renvoyer, exporter ; supprimer pour le super admin) | ✅ | `test_actions_groupees_*`, `test_suppression_d_invites_reservee_au_super_admin` |
| EF-16 | Exports CSV et Excel ; rapports PDF | ✅ | `test_export_csv_bom_et_xlsx`, `test_rapport_*` |
| EF-17 | Admin limité à ses cérémonies affectées ; super admin voit tout | ✅ | `test_admin_limite_a_ses_evenements`, `test_super_admin_voit_tout` |
| EF-18 | Programmes : couleurs dérivées en thème, contrôle de contraste, activation, magazine | ✅ | `test_programme_crud_et_protection`, `test_tokens_reference` |
| EF-19 | Comptes admins créés par le super admin avec mot de passe temporaire à changer | ✅ | `test_comptes_admins`, `test_mot_de_passe_temporaire_bloque_l_api` |
| EF-20 | Modèles d’emails éditables avec variables et aperçu réel | ✅ | `test_parametres_et_apercu`, `test_modeles_d_email_enregistres` (enregistrement cassé jusqu'au 2026-10-22, bug `JSON_UNDERSCOREIZE`) |
| EF-21 | Durée d’affichage du résultat, son, vibration : globaux, modifiables par appareil | ✅ | `Parametres` (`son_actif`, `vibration_actif`), `frontend/src/features/scan/reglages.js` |
| EF-22 | Journal d’activité filtrable (auteur, type, période), sans donnée personnelle | ✅ | `test_journal_filtrable` |
| EF-23 | Suivi des erreurs techniques par le super admin | ✅ | `test_erreurs.py` |
| EF-24 | Borne libre-service : recherche réduite (3 caractères par mot, 10 résultats au plus, ni email ni téléphone ni code), session restreinte au scan | ✅ | `vues_scan.RechercheBorneView`, `ScanPoste.rechercheActive`, `test_recherche_de_la_borne_reduite`, `test_borne_ne_donne_acces_qu_au_scan`, `test_borne_emarge_seulement_un_nom_propose_par_la_recherche` |
| EF-25 | Infos pratiques : agenda (Google, Microsoft 365) et itinéraire | ✅ | `test_infos_agenda_publiques`, `frontend/tests/agenda.test.js` |
| EF-26 | Email n°3 : sondage de satisfaction aux seuls présents, le lendemain à partir de 8 h ; lien personnel de 24 h, une réponse par lien et par appareil, réponses anonymes ; résultats admin / super admin et section du rapport PDF ([sondage-satisfaction](../features/sondage-satisfaction.md)) | ✅ | `sondages.py`, `test_sondage.py` (`test_envoi_le_lendemain_aux_seuls_presents`, `test_reponse_unique_par_lien`, `test_un_seul_avis_par_appareil`, `test_lien_expire`, `test_reponse_anonyme_en_base`, `test_cron_protege_par_le_secret`, `test_rapport_pdf_avec_satisfaction`), `frontend/tests/sondage.test.jsx` |
| EF-27 | Écran « Suivi des emails » (A7) : compteurs par email, liste des échecs, renvoi groupé des échecs, email de test au compte connecté ([emails](../features/emails.md)) | ✅ | `suivi_emails.py`, `test_suivi_emails.py`, `frontend/tests/suiviEmails.test.jsx` |
| EF-28 | Données personnelles : politique de confidentialité publique (`/confidentialite`), durée de conservation réglable par le super admin (1–60 mois, défaut 12), anonymisation automatique des invités des cérémonies expirées ([donnees-personnelles](../features/donnees-personnelles.md)) | ✅ | `donnees_personnelles.py`, `test_donnees_personnelles.py` (`test_anonymisation_apres_la_duree_de_conservation`, `test_duree_de_conservation_reglable`, `test_page_de_confidentialite_publique`, `test_invite_ajoute_apres_anonymisation_et_motifs_effaces`), `frontend/tests/confidentialite.test.jsx` |
