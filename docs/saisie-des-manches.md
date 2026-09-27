# Saisie des manches : parcours cible

## Situation de terrain

- Un seul appareil sert à reporter et calculer les résultats.
- Le cas habituel est une feuille portant les dossards dans leur ordre d'arrivée. Elle contient rarement des temps, mais ceux-ci doivent pouvoir être reportés lorsqu'ils ont été notés.
- Le mode papier sert à reporter les données après la fin de la manche. Le mode direct sert à piloter la manche dans l'application pendant son déroulement, depuis le bateau comité ou à terre avec les informations reçues par radio.
- Un dossard ne représente qu'une arrivée par manche. Les corrections après validation sont fréquentes.
- Le rang et les points doivent rester cohérents avec les pénalités et les manches déjà calculées.

## Diagnostic de l'écran actuel

| Avant | Après proposé | Pourquoi |
| --- | --- | --- |
| Une carte et deux actions pour chaque coureur | Un champ de dossard et un journal d'arrivées | La source de l'information est un numéro, pas un nom à retrouver dans une liste. |
| Les coureurs saisis remontent dans la liste | Journal stable dans l'ordre saisi | Une cible qui se déplace entre deux gestes provoque des erreurs. |
| Le même écran de cartes sert au papier et au direct | Deux parcours de travail utilisant les mêmes arrivées | Le papier est reporté après la manche ; le direct pilote la manche au fur et à mesure. Les deux peuvent contenir des temps. |
| Une arrivée déclenche l'écriture du tableau complet des manches dans Firebase | Mise à jour immédiate à l'écran, enregistrée localement puis synchronisée | La capture doit rester utilisable si la connexion est lente ou absente. |
| Les absents sont initialement `DNS` | État « non renseigné » jusqu'à la revue | Une absence d'arrivée ne prouve pas que le coureur n'a pas pris le départ. |
| Une heure saisie peut déterminer le rang | Le rang suit l'ordre confirmé ; l'heure est une information complémentaire | Un message radio reçu en retard ne doit pas modifier le classement. |

## Écran 1 — Reporter la feuille (mode par défaut)

1. Après la manche, l'ouvrir et choisir **Reporter la feuille**. Aucun compte à rebours n'est requis. On peut commencer la transcription même si l'heure de départ n'a pas été notée.
2. Le champ **Dossard** reste disponible en bas de l'écran, près du pouce. Le pavé numérique s'ouvre ; Entrée ou **Ajouter** place le dossard au rang suivant et remet le champ à vide.
3. Les dernières arrivées restent visibles juste au-dessus du champ. La liste complète se consulte en faisant défiler, sans déplacer le champ de saisie.
4. **Annuler le dernier** est accessible à côté de la saisie et restaure immédiatement l'état précédent.
5. Un dossard déjà saisi affiche « déjà enregistré au rang N » sans créer une deuxième arrivée. Un dossard absent de la liste peut être enregistré provisoirement, avec un repère « fiche à rattacher », afin de ne pas interrompre la transcription.
6. Si la feuille comporte des temps, l'opérateur peut afficher un champ **Temps noté** à côté du dossard et saisir les deux avant **Ajouter**. Ce champ reste facultatif et se vide après chaque arrivée. On peut aussi reporter toute la suite de dossards d'abord, puis ajouter ou corriger les temps en touchant les lignes du journal. Quelques temps seulement dans une manche sont donc acceptés.
7. L'interface distingue clairement une **heure d'arrivée** au format 24 h d'une **durée depuis le départ** ; la donnée choisie reste identifiable et ne change jamais de sens implicitement. Si une durée doit être calculée depuis l'heure de départ, l'heure de départ peut être saisie après coup.
8. Toucher une ligne ouvre une feuille d'édition : remplacer le dossard, le placer au rang N, le déplacer d'un rang, ajouter ou corriger un temps, retirer l'arrivée ou définir un statut/pénalité. L'édition ne demande pas de recommencer toute la saisie.

Disposition mobile envisagée :

```text
Manche 2                         7 / 12 arrivés
Dernières arrivées
#5  08  Jeanne Martin
#6  42  Paul Durand       14:32:08
#7  13  Léa Petit

[ Annuler le dernier ]

┌─────────────────────────────────────┐
│ Dossard  [  24  ]      [ Ajouter ] │
└─────────────────────────────────────┘
[ Ajouter un temps à cette arrivée ]
```

Le journal conserve l'ordre de la feuille. La saisie reste fixe quand une nouvelle ligne apparaît. La validation se trouve sur un écran de revue distinct de l'action répétée **Ajouter**. Le temps affiché sur une ligne est une donnée facultative ; il ne commande pas l'ordre saisi.

## Écran 2 — Piloter la manche en direct (optionnel)

1. Avant le départ, l'opérateur prépare la manche et lance la séquence de départ depuis l'application. Le départ et la durée écoulée restent visibles dans un panneau compact.
2. À chaque arrivée, il indique le dossard et touche **Arrivée maintenant** : l'application ajoute l'arrivée et l'heure de l'appareil en format 24 h. Le geste doit rester possible d'une seule main sur le bateau comité.
3. Si l'information arrive en retard par radio, **Heure annoncée** permet de noter l'heure effective. L'interface indique clairement si l'heure vient de l'appareil ou de la radio.
4. Le journal et les contrôles de doublon sont les mêmes que pour la feuille. Le mode direct peut être quitté sans perdre les données ; une erreur se corrige sur la ligne concernée.
5. Le rang suit l'ordre confirmé. L'heure reste consultable et corrigeable ; elle ne devient une règle de classement que si la régate la prévoit explicitement.

## Revue et validation

- L'écran de revue montre les arrivés dans l'ordre, les dossards à rattacher, les inscrits sans arrivée et les pénalités.
- Chaque inscrit sans arrivée reçoit une décision explicite : **DNS**, **DNF** ou correction de l'arrivée. Aucune valeur n'est devinée à partir d'une ligne absente.
- La validation calcule les rangs et points, puis publie une version du classement.
- Une correction ultérieure se fait dans une copie de travail. **Republier le classement** remplace la version affichée par OBS ou un autre écran du club une fois la revue terminée. L'historique garde la version précédente et les changements.

## Données et fiabilité

Chaque arrivée doit porter au minimum : manche, dossard, coureur lié si connu, rang de saisie, temps éventuel avec son type (`heure` ou `durée`), origine (`papier` ou `direct`) et état de synchronisation. Pour le direct, la provenance de l'heure (`appareil` ou `radio`) doit aussi être conservée. Le journal de capture est conservé localement dès l'action de l'utilisateur. Firebase sert à la synchronisation et à la publication du classement.

Le modèle actuel range toutes les manches et leurs résultats dans un tableau du document de régate. Chaque geste réécrit ce tableau entier. Pour une capture rapide, il faut isoler les arrivées d'une manche et sérialiser les écritures, tout en lisant les anciennes régates par un adaptateur pendant la transition.

## Critères de réussite sur téléphone

- Reporter une suite de 20 dossards sans chercher de nom ni faire défiler la liste des inscrits.
- Reporter des temps pour toutes les arrivées, pour quelques-unes seulement ou après la saisie des dossards, sans ressaisir l'ordre.
- Saisir avec un seul pouce, avec des cibles tactiles d'au moins 44–48 px et sans déplacement du champ principal.
- Voir immédiatement le numéro, le rang et le statut de sauvegarde de la dernière action.
- Corriger un dossard ou un rang en quelques gestes, même après validation.
- Continuer à saisir sans réseau et retrouver les arrivées après fermeture puis réouverture de l'application.
- Vérifier sur un téléphone réel l'ouverture du clavier, la place du champ de saisie, la zone sûre en bas de l'écran et la lisibilité au soleil.

## Ordre de réalisation

1. Remplacer la liste de cartes par la saisie numérique et le journal stable du mode papier.
2. Ajouter la revue explicite des absents, les fiches provisoires, les corrections et l'annulation.
3. Rendre la capture locale durable et la synchronisation Firebase visible.
4. Permettre l'ajout facultatif des temps du papier, pendant ou après la transcription, puis décliner la capture pour le pilotage en direct avec l'heure de l'appareil ou celle de la radio et le compte à rebours compact.
5. Séparer brouillon et classement publié pour les écrans du club et OBS.
