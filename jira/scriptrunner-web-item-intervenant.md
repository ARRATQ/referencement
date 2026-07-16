# Bouton Jira → App d'évaluation : « Évaluer l'intervenant »

Web Item ScriptRunner (Jira Server/DC — https://jisr.marocpme.gov.ma/jira) qui ouvre
l'application d'évaluation (https://test.marocpme.gov.ma) avec le ticket pré-chargé.

Le bouton apparaît dans la barre d'actions du ticket, uniquement sur les tickets
de type **Intervenant**, et ouvre `/intervenants?key=<CLÉ>` dans un nouvel onglet.
Côté app, la page charge automatiquement le ticket ; si l'utilisateur n'est pas
connecté, il est redirigé vers le login puis revient sur la page avec le ticket.

## Configuration du Web Item

| Champ | Valeur |
|---|---|
| Type de fragment | **Custom web item** |
| Key | `eval-intervenant-web-item` |
| Section | `operations-top-level` |
| Weight | `10` |
| Link text | `Évaluer l'intervenant` |
| What should the link do? | **Navigate to a link** |
| Navigate to | `https://test.marocpme.gov.ma/intervenants?key=${issue.key}` |
| How should the link open? | **Open in a new window/tab** (target `_blank`) |
| Icon (optionnel) | laisser vide |

**Condition** (champ *Condition* du fragment, Groovy) :

```groovy
issue.projectObject.key == 'PTC' && issue.issueType.name == 'Intervenant'
```

> Adapter `'Intervenant'` si le nom exact du type de demande diffère
> (vérifier dans ⚙ → Problèmes → Types de tickets).
> Retirer `issue.projectObject.key == 'PTC' &&` pour étendre à tous les projets.

## Installation pas à pas (admin Jira)

1. Se connecter à Jira avec un compte administrateur.
2. Aller dans **⚙ (Administration) → Gérer les applications (Manage apps)**.
3. Dans le menu latéral, section **ScriptRunner**, cliquer sur **UI Fragments**
   (ou **Fragments** selon la version).
4. Cliquer sur **Create Fragment** et choisir **Custom web item**.
5. Remplir les champs avec les valeurs du tableau ci-dessus :
   - **Key** : `eval-intervenant-web-item`
   - **Section** : taper `operations-top-level` (proposé dans l'autocomplétion)
   - **Weight** : `10` (plus le poids est faible, plus le bouton est à gauche)
   - **Link text** : `Évaluer l'intervenant`
   - **What should the link do?** : *Navigate to a link*, puis coller
     `https://test.marocpme.gov.ma/intervenants?key=${issue.key}`
   - **How should the link open?** : *Open in a new window/tab*
6. Dans le champ **Condition**, coller le script Groovy ci-dessus.
   Utiliser le bouton de vérification (✓) pour valider la compilation.
7. Cliquer sur **Add** / **Update** pour enregistrer. Aucun redémarrage ni
   réindexation nécessaire — le fragment est actif immédiatement.

## Vérification

1. Ouvrir un ticket de type Intervenant du projet PTC, par ex.
   `https://jisr.marocpme.gov.ma/jira/browse/PTC-32538`
   (rafraîchir la page si elle était déjà ouverte).
2. Le bouton **Évaluer l'intervenant** apparaît dans la barre d'actions du ticket.
3. Cliquer : un nouvel onglet s'ouvre sur
   `https://test.marocpme.gov.ma/intervenants?key=PTC-32538`
   et le ticket est chargé automatiquement (bloc « 2. CV source »).
4. Contre-test : ouvrir un ticket d'un autre type — le bouton ne doit pas apparaître.

## Dépannage

- **Le bouton n'apparaît pas** : vérifier le nom exact du type de ticket dans la
  condition (sensible à la casse), et que le fragment est bien **enabled** dans
  la liste des UI Fragments.
- **Le bouton apparaît partout** : la condition est vide ou a une erreur de
  compilation — la re-valider avec le ✓.
- **L'app s'ouvre mais sans ticket** : vérifier que l'URL contient bien
  `?key=PTC-…` (le `${issue.key}` doit être copié tel quel, sans espace).
