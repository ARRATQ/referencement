# Commission de Référencement — Plateforme d'Évaluation v2

Plateforme web complète pour la gestion et l'instruction des dossiers de référencement des solutions informatiques et actions de renforcement de capacités proposées par les prestataires, avec intégration Jira Data Center et assistance IA multimodale via OpenRouter.

---

## Sommaire

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Fonctionnalités par rôle](#fonctionnalités-par-rôle)
   - [Rôle ADMIN](#rôle-admin)
   - [Rôle GESTIONNAIRE](#rôle-gestionnaire)
   - [Rôle PARTICIPANT](#rôle-participant)
4. [Formulaire d'évaluation multi-étapes](#formulaire-dévaluation-multi-étapes)
5. [Système de notation et décision](#système-de-notation-et-décision)
6. [Intégration Jira](#intégration-jira)
7. [Assistance IA](#assistance-ia)
8. [Prompts IA personnalisables](#prompts-ia-personnalisables)
9. [Rôles et permissions](#rôles-et-permissions)
10. [Programmes disponibles](#programmes-disponibles)
11. [API Backend](#api-backend)
12. [Prérequis](#prérequis)
13. [Installation](#installation)
14. [Configuration](#configuration)
15. [Démarrage](#démarrage)
16. [Comptes par défaut](#comptes-par-défaut)
17. [Premiers pas après installation](#premiers-pas-après-installation)
18. [Dépannage](#dépannage)
19. [Structure du projet](#structure-du-projet)

---

## Vue d'ensemble

La Commission de Référencement instruit les dossiers des prestataires souhaitant faire certifier leurs solutions ou actions. La plateforme couvre l'intégralité du cycle d'évaluation :

1. **Chargement des dossiers** depuis Jira (prestataires, intervenants, compétences)
2. **Notation multi-critères pondérée** (critères solution 60 % + critères intégrateur 40 %)
3. **Analyse documentaire assistée par IA** (CV, attestations, fiches techniques, certificats éditeur)
4. **Génération du procès-verbal** officiel de la commission
5. **Synchronisation des résultats** vers les tickets Jira

Deux types de référencement sont supportés :

| Type | Description | Exemples |
|------|-------------|---------|
| **Solutions informatiques** | Logiciels métier évalués par catégorie | ERP, CRM, Comptabilité, BI, GMAO, RH |
| **Actions** | Formations et accompagnements évalués par domaine | Formation, Normalisation, Productivité, Numérique |

---

## Architecture

```
Navigateur (Vue.js :8090)
        │
        ▼ HTTP / JWT (httpOnly cookie)
  Backend Express (:3002)
        │              │
        ▼              ▼
  PostgreSQL 16    Proxy CORS (:3001)
  (Prisma ORM)         │         │
                       ▼         ▼
                 Jira Data   OpenRouter
                 Center      (IA vision)
```

**Services Docker :**

| Service      | Conteneur      | Port exposé | Rôle                              |
|--------------|----------------|-------------|-----------------------------------|
| `db`         | `ref-db`       | —           | PostgreSQL 16 (données internes)  |
| `proxy`      | `ref-proxy`    | —           | Proxy CORS Jira + OpenRouter      |
| `backend`    | `ref-backend`  | 3002        | API REST Express + Prisma         |
| `frontend`   | `ref-frontend` | 8090        | SPA Vue.js 3 servie par nginx     |

**Stack technique :**
- Backend : Node.js 20 + Express.js + Prisma ORM
- Frontend : Vue.js 3 + Vite + Pinia + Vue Router
- Auth : JWT (access 15 min + refresh 7 jours, httpOnly cookie)
- Base de données : PostgreSQL 16
- Conteneurisation : Docker Compose

---

## Fonctionnalités par rôle

### Rôle ADMIN

#### Gestion des utilisateurs

- Créer, modifier et désactiver des comptes utilisateurs
- Attribuer et changer les rôles (`ADMIN`, `GESTIONNAIRE`, `PARTICIPANT`)
- Réinitialiser les mots de passe
- Activer / désactiver un compte sans le supprimer

#### Gestion des programmes

Un **programme** est le référentiel d'évaluation utilisé pour noter un dossier. L'admin peut :

- Créer et versionner des programmes (code unique, nom, version)
- Configurer pour chaque programme :
  - **Catégories de solutions IT** et leurs **critères pondérés** (libellé, poids, score max 0–2)
  - **Types d'actions** et leurs **domaines d'évaluation**
  - **Critères intégrateurs** fixes (niveau d'études, expérience, équipe, etc.)
  - **Texte AMI** (Appel à Manifestation d'Intérêt) injecté comme contexte dans les analyses IA
  - **Canevas CV de référence** utilisé par l'IA pour comparer les profils intervenants
- Activer / désactiver des programmes
- Désactiver individuellement des critères non applicables à certains dossiers

#### Configuration système

Depuis **Admin > Configuration**, toutes les intégrations sont paramétrables sans redéploiement :

**Connexion Jira**

| Clé | Description |
|-----|-------------|
| `jira_url` | URL de l'instance Jira Data Center |
| `jira_pat` | Personal Access Token (authentification recommandée) |
| `jira_user` / `jira_pass` | Authentification Basic (alternative au PAT) |
| `jira_project` | Clé du projet Jira (ex. `REF`) |
| `jira_jql` | Filtre JQL pour la liste des dossiers prestataires |
| `jira_cf_score_sol` | Identifiant du champ custom "score solution" |
| `jira_cf_score_int` | Identifiant du champ custom "score intégrateur" |
| `jira_type_intervenant` | Type de ticket pour les intervenants |

**Intelligence Artificielle**

| Clé | Description |
|-----|-------------|
| `ai_key` | Clé API OpenRouter (`sk-or-v1-...`) |
| `ai_model` | Modèle utilisé (ex. `anthropic/claude-sonnet-4-6`) |
| `ai_temp` | Température (0.0–1.0, défaut : 0.3) |
| `ai_lang` | Langue des réponses IA (`fr` ou `ar`) |

Un bouton **"Tester la connexion Jira"** valide immédiatement la configuration sans quitter la page.

#### Prompts IA

Depuis **Admin > Prompts IA**, chaque gabarit de prompt est éditable individuellement. Voir la section [Prompts IA personnalisables](#prompts-ia-personnalisables).

#### Statistiques et tableau de bord

- Nombre total d'évaluations, répartition par **statut** (Brouillon / Soumis / Archivé)
- Répartition par **programme** et par **type** (Solution / Action)
- Répartition par **décision** (Référencé / Conditionnel / Rejeté)

#### Journal d'audit

- Historique complet de toutes les actions utilisateurs
- Filtrage par utilisateur, type d'action, évaluation et plage de dates
- Chaque entrée contient : horodatage, adresse IP, utilisateur, action, détails

---

### Rôle GESTIONNAIRE

#### Tableau de bord

- Vue d'ensemble de ses propres évaluations en cours
- Accès direct à la création d'une nouvelle évaluation

#### Gestion des évaluations

- Créer une évaluation (brouillon)
- Modifier une évaluation en cours (statut DRAFT)
- Supprimer un brouillon
- Archiver une évaluation soumise
- Filtrer la liste par programme, statut, prestataire et date

#### Navigation des dossiers Jira

Depuis la page **Dossiers**, le gestionnaire peut :

- Parcourir les tickets prestataires filtrés par le JQL configuré
- Chercher un dossier par mot-clé
- Voir la liste des intervenants et compétences associés à chaque prestataire
- Accéder aux pièces jointes (CV, attestations, fiches techniques) directement depuis Jira
- Lancer une nouvelle évaluation à partir d'un dossier Jira

#### Génération du briefing pré-commission

Disponible depuis le formulaire d'évaluation, génère automatiquement un document de synthèse destiné à préparer la présentation en commission, à partir des informations du dossier et du texte AMI du programme.

---

### Rôle PARTICIPANT

- Consulter la liste complète des évaluations soumises
- Accéder au détail d'une évaluation :
  - Informations dossier (prestataire, solution, modules, dates)
  - Scores et verdicts (solution, intégrateur, global)
  - Décision finale et conditions éventuelles
  - Textes générés par l'IA (briefing, analyse CV, attestations, PV)
- Accès en **lecture seule** — aucune création ni modification possible

---

## Formulaire d'évaluation multi-étapes

Le formulaire guide le gestionnaire à travers 5 étapes séquentielles avec sauvegarde automatique.

### Étape 0 — Type et catégorie

- Sélectionner le **type de référencement** : Solution informatique ou Action
- Choisir la **catégorie** (ERP, CRM, BI, etc.) ou le **type d'action** (Formation, Normalisation, etc.)
- Le programme détermine les critères d'évaluation disponibles

### Étape 1 — Informations dossier

**Chargement depuis Jira**
- Saisir la clé du ticket prestataire et cliquer "↓ Charger"
- La hiérarchie complète (prestataire → intervenant → compétences) est résolue automatiquement
- Les champs personnalisés Jira sont extraits : CNSS, ICE, coordonnées de contact

**Champs manuels**
- Intitulé de la solution ou de l'action, modules couverts, dates, notes libres

**Génération du briefing pré-commission**
- Disponible dès que les informations de base sont renseignées
- Document IA généré affiché dans la vue et stocké dans l'évaluation

### Étape 2 — Grille d'évaluation

**Critères Solution (60 % du score final)**
- Note de **0** (absent), **1** (partiel) ou **2** (satisfaisant) par critère
- Possibilité de **désactiver** un critère non applicable (exclu du calcul)
- Champ commentaire libre par critère
- Score et mention calculés en temps réel

**Critères Intégrateur (40 % du score final)**
- 6 critères fixes : niveau d'études, expérience générale, expérience solution, composition équipe, formation initiale, formation continue
- Même échelle 0–2 avec commentaires
- Pré-remplissage possible depuis l'analyse IA du CV

### Étape 3 — Documents et analyses IA

**Sélection des fichiers**
- Depuis **Jira** : pièces jointes des tickets intervenant et compétence (CV, diplômes, attestations)
- Depuis **l'ordinateur** : upload par glisser-déposer (PDF, images, Word)
- Combinaison possible des deux sources

**Analyses IA disponibles**

| Analyse | Description |
|---------|-------------|
| Analyse CV | Extraction compétences, diplômes, années d'expérience, adéquation au poste |
| Analyse attestations | Vérification cohérence et validité des certifications et références |
| Contrôle de cohérence | Croisement CV ↔ attestations ↔ critères fonctionnels |
| Analyse fiche technique | Évaluation des spécifications fonctionnelles et techniques |
| Certificat éditeur | Validation des accréditations et partenariats éditeur |
| Scénario de démonstration | Proposition d'un parcours de démonstration adapté |
| Recherche web | Analyse marché, positionnement de l'éditeur, maturité de la solution |

**Suggestion automatique de scores**
- Après une analyse CV, proposer des notes (0–2) pour chaque critère intégrateur
- Accepter toutes les suggestions en un clic ou ajuster critère par critère

### Étape 4 — Procès-verbal

- Récapitulatif complet des scores, pourcentages et verdicts
- Génération assistée du **PV officiel** par IA (structure formelle, conditions, décision motivée)
- Éditeur libre pour personnaliser le PV généré

### Étape 5 — Décision et soumission

- Sélection de la **décision finale** : RÉFÉRENCÉ / CONDITIONNEL / REJETÉ
- Saisie des conditions éventuelles
- **Soumission définitive** : statut SUBMITTED + synchronisation vers Jira (commentaire + champs custom)

---

## Système de notation et décision

### Critères Solution (poids 60 %)

Chaque critère noté **0**, **1** ou **2** ; critères pondérés et désactivables individuellement.

| Mention | Seuil |
|---------|-------|
| FAVORABLE | ≥ 60 % |
| CONDITIONNEL | 45 % ≤ score < 60 % |
| DÉFAVORABLE | < 45 % |

### Critères Intégrateur (poids 40 %)

6 critères fixes notés 0–2.

| Mention | Seuil |
|---------|-------|
| FAVORABLE | ≥ 55 % |
| CONDITIONNEL | 40 % ≤ score < 55 % |
| DÉFAVORABLE | < 40 % |

### Score global et décision

```
Score global = 60 % × Score Solution + 40 % × Score Intégrateur
```

| Décision | Conditions cumulatives |
|----------|------------------------|
| **RÉFÉRENCÉ** | Global ≥ 60 % ET Solution ≥ 60 % ET Intégrateur ≥ 55 % |
| **CONDITIONNEL** | Global ≥ 48 % (sans satisfaire toutes les conditions RÉFÉRENCÉ) |
| **REJETÉ** | Global < 48 % |

La décision automatique est une suggestion — le gestionnaire peut la modifier avant soumission.

---

## Prérequis

- **Docker** ≥ 24 et **Docker Compose** ≥ 2.20
- Accès réseau à Jira Data Center (pour la synchronisation des dossiers)
- Clé API OpenRouter (pour les fonctions IA)

Vérification :
```bash
docker --version
docker compose version
```

---

## Installation

### 1. Récupérer le projet

```bash
git clone <url-du-repo> referencement
cd referencement
```

Ou décompresser l'archive :
```bash
unzip commission-referencement-deploy.zip -d referencement
cd referencement
```

### 2. Créer le fichier de configuration

```bash
cp .env.example .env
```

Ouvrez `.env` et renseignez **toutes** les variables (voir section [Configuration](#configuration)).

### 3. Générer les secrets JWT

```bash
openssl rand -hex 32   # copier dans JWT_SECRET
openssl rand -hex 32   # copier dans JWT_REFRESH_SECRET
```

### 4. Construire et démarrer

```bash
docker compose up --build -d
```

Au premier démarrage, le backend exécute automatiquement :
1. Les migrations Prisma (création des tables)
2. Le seed (programmes par défaut + comptes définis dans `.env`)

Suivre l'avancement :
```bash
docker compose logs -f backend
```

Attendre le message :
```
[entrypoint] ✅ Seed terminé !
[entrypoint] Starting backend...
```

### 5. Accéder à l'application

Ouvrez **http://localhost:8090** dans votre navigateur.

---

## Configuration

Toutes les variables sont dans `.env`. **Aucune valeur par défaut dangereuse n'existe** — le démarrage échoue si une variable obligatoire est absente.

```env
# === BASE DE DONNÉES ===
DB_NAME=referencement
DB_USER=refuser
DB_PASSWORD=<mot de passe robuste>
DATABASE_URL=postgresql://refuser:<DB_PASSWORD>@localhost:5432/referencement

# === SÉCURITÉ JWT ===
# Générer avec : openssl rand -hex 32
JWT_SECRET=<64 caractères hex>
JWT_REFRESH_SECRET=<64 caractères hex>

# === JIRA DATA CENTER ===
JIRA_URL=https://votre-jira.exemple.com/jira

# === APPLICATION ===
APP_PORT=8090
BACKEND_PORT=3002
APP_ORIGIN=http://localhost:8090
VITE_API_URL=http://localhost:3002
NODE_ENV=production

# === COMPTES INITIAUX (créés au premier démarrage) ===
ADMIN_EMAIL=admin@votre-domaine.com
ADMIN_PASSWORD=<mot de passe robuste>
GESTIONNAIRE_EMAIL=gestionnaire@votre-domaine.com
GESTIONNAIRE_PASSWORD=<mot de passe robuste>
PARTICIPANT_EMAIL=participant@votre-domaine.com
PARTICIPANT_PASSWORD=<mot de passe robuste>
```

> **Important :** `DATABASE_URL` doit contenir le même mot de passe que `DB_PASSWORD`. En Docker Compose, remplacez `localhost` par `db` dans `DATABASE_URL`.
> Le fichier `.env` ne doit **jamais** être commité. Il est dans `.gitignore`.

### Configuration Jira et IA (dans l'interface Admin)

Après connexion en tant qu'admin, allez dans **Admin > Configuration** :

| Section | Clé                     | Description                                      |
|---------|-------------------------|--------------------------------------------------|
| Jira    | `jira_url`              | URL base Jira (ex. `https://jira.exemple.com`)   |
| Jira    | `jira_pat`              | Personal Access Token Jira                       |
| Jira    | `jira_project`          | Clé du projet Jira (ex. `REF`)                   |
| Jira    | `jira_cf_score_sol`     | Champ custom score solution (ex. `customfield_10020`) |
| Jira    | `jira_cf_score_int`     | Champ custom score intégrateur                   |
| IA      | `ai_key`                | Clé API OpenRouter (`sk-or-v1-...`)              |
| IA      | `ai_model`              | Modèle (ex. `google/gemini-2.0-flash-001`)       |
| IA      | `ai_temp`               | Température (0.0–1.0, défaut : 0.3)              |
| IA      | `ai_lang`               | Langue des réponses IA (`fr` ou `ar`)            |

---

## Démarrage

```bash
# Démarrer tous les services
docker compose up -d

# Arrêter
docker compose down

# Arrêter et supprimer toutes les données (reset complet)
docker compose down -v

# Logs en temps réel
docker compose logs -f
docker compose logs -f backend

# Redémarrer un service
docker compose restart backend

# Reconstruire après modification du code
docker compose up --build -d
```

---

## Comptes par défaut

Les comptes sont créés **une seule fois**, au premier démarrage, depuis les variables `.env` :

| Variable env            | Rôle         |
|-------------------------|--------------|
| `ADMIN_EMAIL`           | ADMIN        |
| `ADMIN_PASSWORD`        | ADMIN        |
| `GESTIONNAIRE_EMAIL`    | GESTIONNAIRE |
| `GESTIONNAIRE_PASSWORD` | GESTIONNAIRE |
| `PARTICIPANT_EMAIL`     | PARTICIPANT  |
| `PARTICIPANT_PASSWORD`  | PARTICIPANT  |

> Toutes ces variables sont **obligatoires** — le seed échoue explicitement si l'une est absente.
>
> Modifier les mots de passe après le premier démarrage : utilisez **Admin > Utilisateurs** (le seed ne se réexécute pas au redémarrage).

---

## Premiers pas après installation

1. **Connectez-vous** sur http://localhost:8090 avec le compte ADMIN.
2. Allez dans **Admin > Configuration** → renseignez la clé OpenRouter et l'URL Jira.
3. Testez la connexion Jira avec le bouton "Tester connexion".
4. Créez les utilisateurs supplémentaires dans **Admin > Utilisateurs**.
5. Vérifiez les programmes dans **Admin > Programmes** (4 programmes seed disponibles).
6. (Optionnel) Personnalisez les prompts IA dans **Admin > Prompts IA**.
7. Passez en compte GESTIONNAIRE et lancez une première évaluation via **Dossiers → Nouvelle évaluation**.

---

## Utilisation

### Workflow standard (GESTIONNAIRE)

1. **Connexion** → http://localhost:8090
2. **Dossiers** → synchroniser avec Jira pour charger les prestataires
3. **Nouvelle évaluation** → choisir un dossier Jira et un programme
4. **Étape 0** — Type de référencement : Solution IT ou Action (formation, normalisation, productivité, numérique)
5. **Étape 1** — Informations dossier
   - Renseignez le ticket Jira du prestataire et cliquez "↓ Charger" pour récupérer la hiérarchie
   - **Analyse CV** : sélectionnez les fichiers CV + diplômes, depuis Jira ou depuis votre ordinateur (multi-fichiers, drag & drop)
   - **Analyse attestations** : sélectionnez les pièces jointes du ticket Compétence
   - **Briefing IA** : génère un résumé pré-commission automatique
6. **Étape 2** — Grille d'évaluation fonctionnelle (scores 0/1/2 par critère, IA propose et vérifie la cohérence)
7. **Étape 3** — Grille intégrateur/intervenant (auto-score depuis l'analyse CV possible)
8. **Étape 4** — Décision finale + génération PV IA + soumission vers Jira
9. **Consultation** accessible aux PARTICIPANTS en lecture seule

### Analyse CV multi-fichiers

Lors de l'étape 1, cliquez sur **"↓ Sélectionner les fichiers CV"** :

- **Depuis Jira** : sélection multiple parmi les pièces jointes de l'intervenant (CV + diplômes dans le même ticket)
- **Depuis l'ordinateur** : glissez-déposez ou cliquez pour choisir plusieurs fichiers (PDF, images, Word)

L'IA reçoit tous les fichiers en une seule analyse et produit un rapport consolidé.

### Fonctions IA disponibles

| Fonction             | Description                                              |
|----------------------|----------------------------------------------------------|
| Briefing dossier     | Résumé automatique du dossier Jira                       |
| Analyse CV           | Extraction compétences, diplômes, expériences (multi-fichiers) |
| Analyse attestations | Vérification cohérence références clients                |
| Contrôle cohérence   | Croisement CV ↔ attestations ↔ grille fonctionnelle      |
| Génération PV        | Rédaction procès-verbal de la commission                 |
| Auto-remplissage     | Proposition scores intégrateur depuis analyse CV         |

---

## Prompts IA personnalisables

Les instructions envoyées à l'IA pour chaque fonction sont entièrement éditables dans **Admin > Prompts IA**.

Chaque prompt utilise des variables `{{variable}}` substituées dynamiquement :

| Prompt                  | Variables disponibles                                              |
|-------------------------|--------------------------------------------------------------------|
| Briefing pré-commission | `lang`, `ami`, `prestataire`, `solution`, `category`, `modules`   |
| Procès-verbal (PV)      | `lang`, `programName`, `prestataire`, `solution`, `solScorePct`, `intScorePct`, `finalScorePct`, `finalDecision`, … |
| Analyse CV              | `lang`, `ami`, `canvas`, `prestataire`, `solution`, `programName` |
| Analyse attestations    | `lang`, `intervenant`, `solution`                                  |
| Contrôle cohérence      | `lang`, `category`, `noteDetails`                                  |
| Suggestion scores       | `lang`, `category`, `dossierContext`, `criteriaList`               |

Le bouton **"Réinitialiser"** supprime la customisation et revient au prompt par défaut.

---

## API Backend

Base URL : `http://localhost:3002`

### Authentification
```
POST /api/auth/login          Corps : { email, password }
POST /api/auth/refresh        Renouvelle l'access token
POST /api/auth/logout
GET  /api/auth/me             Profil utilisateur connecté
```

### Programmes
```
GET  /api/programs            Liste des programmes actifs
GET  /api/programs/:code      Détail programme (catégories, critères)
POST /api/programs            Créer un programme         [ADMIN]
PUT  /api/programs/:code      Modifier un programme      [ADMIN]
```

### Dossiers Jira
```
GET  /api/dossiers                       Liste + sync Jira        [GESTIONNAIRE+]
GET  /api/dossiers/:key                  Détail dossier
GET  /api/dossiers/:key/intervenants     Arbre Prestataire → Intervenant → Compétence
GET  /api/dossiers/:key/attachments      Pièces jointes
```

### Évaluations
```
POST /api/evaluations                    Créer               [GESTIONNAIRE]
GET  /api/evaluations                    Liste               [GESTIONNAIRE+]
GET  /api/evaluations/:id               Détail              [GESTIONNAIRE+]
PUT  /api/evaluations/:id               Modifier            [GESTIONNAIRE]
POST /api/evaluations/:id/submit        Soumettre → Jira    [GESTIONNAIRE]
GET  /api/evaluations/:id/pdf           Export PDF          [PARTICIPANT+]
```

### IA
```
POST /api/ai/briefing              Briefing dossier                      [GESTIONNAIRE]
POST /api/ai/analyze-cv            Analyse CV multi-fichiers             [GESTIONNAIRE]
POST /api/ai/analyze-attestations  Analyse attestations                  [GESTIONNAIRE]
POST /api/ai/check-coherence       Contrôle cohérence                    [GESTIONNAIRE]
POST /api/ai/generate-pv           Génération PV                         [GESTIONNAIRE]
POST /api/ai/auto-fill             Auto-score intégrateur                [GESTIONNAIRE]
GET  /api/ai/prompts               Prompts actifs (DB ou défauts)        [GESTIONNAIRE+]
```

### Administration
```
GET    /api/admin/users           Liste utilisateurs          [ADMIN]
POST   /api/admin/users           Créer utilisateur           [ADMIN]
PUT    /api/admin/users/:id       Modifier utilisateur        [ADMIN]
GET    /api/admin/audit-log       Journal des actions         [ADMIN]
GET    /api/admin/stats           Statistiques                [ADMIN]
GET    /api/admin/config          Configuration               [ADMIN]
PUT    /api/admin/config          Modifier config             [ADMIN]
PUT    /api/admin/prompts         Modifier prompts IA         [ADMIN]
DELETE /api/admin/prompts/:key    Réinitialiser un prompt     [ADMIN]
```

### Santé
```
GET  /api/health    { db: "ok", jira: "ok"|"error" }
```

---

## Rôles et permissions

| Fonctionnalité                    | PARTICIPANT | GESTIONNAIRE | ADMIN |
|-----------------------------------|:-----------:|:------------:|:-----:|
| Tableau de bord                   | ✓           | ✓            | ✓     |
| Consulter évaluations (lecture)   | ✓           | ✓            | ✓     |
| Créer / modifier évaluation       | ✗           | ✓            | ✓     |
| Utiliser les fonctions IA         | ✗           | ✓            | ✓     |
| Soumettre vers Jira               | ✗           | ✓            | ✓     |
| Synchroniser dossiers Jira        | ✗           | ✓            | ✓     |
| Gérer les programmes              | ✗           | ✗            | ✓     |
| Gérer les utilisateurs            | ✗           | ✗            | ✓     |
| Voir le journal d'audit           | ✗           | ✗            | ✓     |
| Configurer Jira / IA              | ✗           | ✗            | ✓     |
| Modifier les prompts IA           | ✗           | ✗            | ✓     |

---

## Programmes disponibles

Quatre programmes sont chargés au démarrage (seed) :

| Code               | Nom             |
|--------------------|-----------------|
| `GO_SIYAHA_V04`    | GO SIYAHA v4    |
| `POWER_EXPORT_V01` | POWER EXPORT v1 |
| `SUPPLY_CHAIN_V01` | SUPPLY CHAIN v1 |
| `PACTE_TPME_V01`   | PACTE TPME v1   |

Chaque programme définit ses propres catégories de solutions IT, critères d'évaluation et types d'actions. Un ADMIN peut modifier ou ajouter des programmes via l'interface ou l'API.

### Types d'actions non-IT

| Type            | Description                              |
|-----------------|------------------------------------------|
| `formation`     | Formation professionnelle                |
| `normalisation` | Normalisation & certification ISO/NM     |
| `productivite`  | Productivité & organisation (Lean, 5S…) |
| `numerique`     | Transformation numérique                 |

---

## Intégration Jira

### Hiérarchie via issue links

L'outil résout automatiquement la hiérarchie à 3 niveaux via les liens Jira :

```
Ticket Prestataire
    └── [has intervenant] → Ticket Intervenant
            ├── Attachments : CV + diplômes  ← analysés par IA
            └── [has competence] → Ticket Compétence
                    └── Attachments : attestations + grille fonctionnelle
```

### Générer un Personal Access Token Jira

1. Connectez-vous à Jira Data Center
2. Cliquez sur votre avatar → **Profil**
3. Menu gauche → **Personal Access Tokens**
4. Cliquez **Créer un token**, donnez-lui un nom
5. Copiez le token immédiatement (affiché une seule fois)
6. Collez-le dans **Admin > Configuration > `jira_pat`**

### Ce que l'outil écrit sur Jira (lors de la soumission)

- Mise à jour des champs custom du ticket Prestataire (score, verdict, décision)
- Ajout d'un commentaire contenant le procès-verbal complet

---

## Intégration IA

L'IA est fournie via [OpenRouter](https://openrouter.ai) qui donne accès à plusieurs modèles.

**Modèles recommandés :**

| Modèle                          | Usage recommandé            |
|---------------------------------|-----------------------------|
| `google/gemini-2.0-flash-001`   | Rapide, vision, économique  |
| `anthropic/claude-sonnet-4-6`   | Qualité maximale            |
| `openai/gpt-4o-mini`            | Bon rapport qualité/prix    |

Les analyses de CV et attestations utilisent la **vision** (lecture de PDF/images). Choisissez un modèle qui supporte la vision.

### Obtenir une clé OpenRouter

1. Créez un compte sur https://openrouter.ai
2. Allez dans **Keys** → **Create Key**
3. Copiez la clé (`sk-or-v1-...`)
4. Collez-la dans **Admin > Configuration > `ai_key`**

---

## Dépannage

### Le backend ne démarre pas

```bash
docker compose logs backend
```

**`Variables manquantes`** → vérifiez que toutes les variables obligatoires sont dans `.env` (ADMIN_EMAIL, ADMIN_PASSWORD, GESTIONNAIRE_EMAIL, GESTIONNAIRE_PASSWORD, PARTICIPANT_EMAIL, PARTICIPANT_PASSWORD, DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET).

**`@prisma/client did not initialize`** → rebuild complet :
```bash
docker compose down && docker compose up --build
```

**`ECONNREFUSED db:5432`** → la base n'est pas encore prête, attendez quelques secondes et relancez.

### Page blanche ou erreur 502

```bash
docker compose ps                        # vérifier que les 4 services tournent
curl http://localhost:3002/api/health    # vérifier le backend
```

### Erreur de connexion (401)

- Vérifiez l'email et le mot de passe dans `.env`
- Si les comptes ont été modifiés après le premier démarrage, utilisez **Admin > Utilisateurs** pour changer le mot de passe (le seed ne se réexécute pas)

### Réinitialiser complètement la base de données

```bash
docker compose down -v        # supprime le volume PostgreSQL
docker compose up --build -d  # recrée + reseed depuis .env
```

### Jira inaccessible

**Erreur 401 Jira** → Token PAT expiré ou invalide, régénérez-en un dans Jira.
**Erreur 502 Jira** → L'URL Jira est inaccessible depuis Docker. Vérifiez `JIRA_URL` dans **Admin > Configuration**.

```bash
curl http://localhost:3002/api/health    # vérifier le statut Jira
```

---

## Structure du projet

```
referencement/
├── backend/
│   ├── src/
│   │   ├── routes/        # auth, programs, dossiers, evaluations, ai, admin
│   │   ├── middleware/    # auth.js, roles.js
│   │   ├── services/      # jira.js, ai.js (prompts éditables), scoring.js
│   │   ├── prisma/        # schema.prisma, migrations/, seed.js
│   │   └── app.js
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/         # Login, Dashboard, Dossiers, Evaluation, Consultation, Admin
│   │   ├── components/    # AppShell
│   │   ├── stores/        # auth.js (Pinia)
│   │   ├── services/      # api.js (axios + refresh interceptor)
│   │   └── router/        # index.js (guards par rôle)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.js
├── proxy/                 # Proxy CORS Jira + OpenRouter (Node.js)
├── docker-compose.yml
├── .env                   # variables locales — NE PAS COMMITTER
├── .env.example           # template à copier
└── README.md
```
