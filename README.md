# Gestionnaire de Régate de Windsurf & Wingfoil

Cette application est un **Gestionnaire de Régate** complet, conçu pour simplifier l'organisation, le suivi et le classement des compétitions de windsurf et de wingfoil. Elle offre une interface claire, des outils efficaces pour la gestion des participants, le déroulement des courses, et l'enregistrement des résultats en temps réel.

L'application est conçue comme une **Progressive Web App (PWA)**, ce qui signifie qu'elle peut être installée sur n'importe quel appareil (ordinateur, tablette, mobile) et fonctionner de manière fiable **hors ligne**, une caractéristique essentielle pour une utilisation sur le terrain.

---

## Interface Utilisateur (UI)

L'interface est moderne, claire et entièrement responsive, s'adaptant parfaitement aux ordinateurs de bureau pour la préparation et aux tablettes pour la gestion sur l'eau.

*   **Navigation Mobile Intuitive** : Sur mobile, une barre de navigation située en bas de l'écran permet un accès rapide aux sections principales : **Régates**, **Coureurs** et **Tableau de Bord**.
*   **Composants Modernes** : L'interface est construite avec des composants **ShadCN/UI** et stylée via **Tailwind CSS**, garantissant une apparence professionnelle et cohérente.

---

## Fonctionnalités Principales

### 1. Gestion des Régates (Page d'accueil)

C'est le point central de l'organisation.
*   **Création de Régate** : Créez une nouvelle régate en spécifiant simplement son nom et sa date.
*   **Liste des Régates** : Visualisez toutes vos régates passées, présentes et futures.
*   **Suppression Sécurisée** : Supprimez une régate avec une boîte de dialogue de confirmation pour éviter les erreurs.
*   **Données de Démonstration** : Un bouton "Réinitialiser" permet de charger des données d'exemple (une régate et une liste de coureurs) pour tester rapidement l'application.

### 2. Base de Données des Coureurs

Centralisez la liste de tous les coureurs pour les réutiliser facilement dans différentes régates.
*   **Ajout Manuel** : Un formulaire simple permet d'ajouter de nouveaux compétiteurs en renseignant :
    *   Nom et Prénom
        *   Club
            *   Numéro de Licence
                *   Catégorie (`Jeune`, `Confirmé`, `Vétéran`)
                    *   Type de Voile (`Windsurf` ou `Wingfoil`) via un sélecteur à boutons rapide.
                    *   **Modification et Suppression** : Mettez à jour les informations d'un coureur ou supprimez-le de la base de données à tout moment.
                    *   **Importation par Fichier CSV** : Gagnez un temps précieux en important une liste complète de coureurs depuis un fichier CSV. Le fichier doit contenir les en-têtes suivants : `name,club,licenseNumber,category,sailType`.
                        *   **`name`**: Nom complet du coureur.
                        *   **`club`**: Nom du club.
                        *   **`licenseNumber`**: Numéro de licence (doit être unique).
                        *   **`category`**: Catégorie du coureur. Valeurs possibles : `Jeune`, `Confirmé`, `Vétéran`, `Catamaran`, `Dériveur`.
                        *   **`sailType`**: Type de support. Valeurs possibles : `Windsurf`, `Wingfoil`, `Catamaran`, `Dinghy`.

                    ### 3. Gestion de Course (pour une régate spécifique)

                    C'est le cœur opérationnel de l'application, divisé en deux onglets : **Participants** et **Manches**.

                    #### Onglet Participants
                    *   **Inscription à la Régate** : Inscrivez les coureurs à la régate en cours depuis votre base de données centrale.
                    *   **Attribution des Dossards** : Assignez un numéro de dossard unique à chaque participant pour la durée de la régate. L'application vérifie que les numéros de dossard ne sont pas dupliqués.

                    #### Onglet Manches & Classement
                    *   **Création de Manches** : Créez autant de manches que nécessaire.
                    *   **Lancement de Course** :
                        *   **Séquence de Départ Configurable** : Lancez un chronomètre de départ (durée modifiable, par ex. 3 minutes) visible par tous pour synchroniser le début de la course.
                            *   Le statut de la manche passe automatiquement à "En cours" à la fin du décompte.
                            *   **Enregistrement des Arrivées** :
                                *   Une interface optimisée pour le terrain liste tous les concurrents avec leur numéro de dossard.
                                    *   Cliquez sur "Arrivée" pour enregistrer l'heure de passage d'un concurrent.
                                        *   **Correction d'Erreur** : Si vous cliquez par erreur, un second clic sur le même bouton **annule l'arrivée**, offrant une flexibilité essentielle sur l'eau.
                                            *   **Gestion des Pénalités** : Appliquez une pénalité (statut `PEN`) à un concurrent si nécessaire.
                                            *   **Calcul des Résultats de Manche** : Une fois toutes les arrivées enregistrées, cliquez sur "Terminer et Calculer" pour clôturer la manche, calculer les points et afficher un classement détaillé.
                                            *   **Classement Général et Filtres** :
                                                *   Accédez à un classement général qui compile les résultats de toutes les manches terminées.
                                                    *   **Filtres puissants** : Affinez le classement par **type de voile** (`Windsurf`/`Wingfoil`) et par **catégorie** (`Jeune`, `Confirmé`, `Vétéran`).
                                                        *   **Règle de Retrait (Discard)** : Saisissez le nombre de moins bonnes manches à retirer du calcul final (par exemple, retirer la plus mauvaise manche sur 4 courues). Les scores retirés apparaissent barrés pour plus de clarté.
                                                        *   **Export des Résultats en CSV** :
                                                            *   Exportez le classement général affiché (en tenant compte des filtres et des retraits) dans un fichier CSV en un seul clic. Idéal pour l'archivage, le partage et la publication officielle des résultats.

                                                            ## Stack Technique

                                                            *   **Framework** : Next.js 15 (avec App Router et Turbopack)
                                                            *   **Langage** : TypeScript
                                                            *   **UI** : React
                                                            *   **Bibliothèque de composants** : ShadCN/UI
                                                            *   **Styling** : Tailwind CSS
                                                            *   **Icônes** : Lucide React
                                                            *   **Fonctionnalité PWA/Hors-ligne** : `next-pwa`
                                                            *   **Analyse CSV** : `papaparse`
