# Commission de Référencement — Maroc PME v2

Outil de gestion des référencements de prestataires (solutions IT et actions non-IT) pour les programmes Maroc PME. Interface multi-rôles avec persistance PostgreSQL, intégration Jira Data Center et assistance IA via OpenRouter.

---

## Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Démarrage](#démarrage)
6. [Comptes par défaut](#comptes-par-défaut)
7. [Utilisation](#utilisation)
8. [API Backend](#api-backend)
9. [Rôles et permissions](#rôles-et-permissions)
10. [Programmes disponibles](#programmes-disponibles)
11. [Intégration Jira](#intégration-jira)
12. [Intégration IA](#intégration-ia)
13. [Dépannage](#dépannage)

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

Éditez `.env` (voir section [Configuration](#configuration)).

### 3. Construire et démarrer

```bash
docker compose up --build -d
```

Au premier démarrage, le backend exécute automatiquement :
1. Les migrations Prisma (création des tables)
2. Le seed (programmes + comptes par défaut)

Suivre les logs :
```bash
docker compose logs -f backend
```

Attendre le message :
```
[entrypoint] Starting backend...
Server running on port 3002
```

### 4. Accéder à l'application

Ouvrez **http://localhost:8090** dans votre navigateur.

---

## Configuration

Copiez `.env.example` en `.env` et renseignez les valeurs :

```env
# === BASE DE DONNÉES ===
DB_NAME=referencement
DB_USER=refuser
DB_PASSWORD=refpass2025
DATABASE_URL=postgresql://refuser:refpass2025@localhost:5432/referencement

# === SÉCURITÉ JWT ===
# Générer avec : openssl rand -hex 32
JWT_SECRET=changeme_jwt_secret_32chars_minimum_here
JWT_REFRESH_SECRET=changeme_refresh_secret_32chars_min

# === JIRA DATA CENTER ===
JIRA_URL=https://jisr.marocpme.gov.ma/jira

# === APPLICATION ===
APP_PORT=8090          # port frontend
BACKEND_PORT=3002      # port API backend
APP_ORIGIN=http://localhost:8090
VITE_API_URL=http://localhost:3002
NODE_ENV=production

# === COMPTE ADMIN INITIAL ===
ADMIN_PASSWORD=Admin@2025!
```

**En production**, générez des secrets robustes :
```bash
openssl rand -hex 32   # pour JWT_SECRET
openssl rand -hex 32   # pour JWT_REFRESH_SECRET
```

### Configuration Jira et IA (dans l'interface Admin)

Après connexion en tant qu'admin, allez dans **Admin > Configuration** pour renseigner :

| Clé                  | Description                                      |
|----------------------|--------------------------------------------------|
| `jira_url`           | URL Jira (ex. `https://jisr.marocpme.gov.ma/jira`) |
| `jira_pat`           | Personal Access Token Jira                       |
| `jira_project`       | Clé du projet Jira (ex. `REF`)                   |
| `openrouter_key`     | Clé API OpenRouter (`sk-or-v1-...`)              |
| `openrouter_model`   | Modèle IA (ex. `google/gemini-2.0-flash-001`)   |

---

## Démarrage

### Démarrer tous les services
```bash
docker compose up -d
```

### Arrêter
```bash
docker compose down
```

### Arrêter et supprimer les données (reset complet)
```bash
docker compose down -v
```

### Voir les logs
```bash
docker compose logs -f              # tous les services
docker compose logs -f backend      # backend uniquement
docker compose logs -f frontend     # frontend uniquement
```

### Redémarrer un service
```bash
docker compose restart backend
```

### Mettre à jour après modification du code
```bash
docker compose up --build -d
```

---

## Comptes par défaut

| Rôle          | Email                              | Mot de passe  |
|---------------|------------------------------------|---------------|
| ADMIN         | `admin@marocpme.gov.ma`            | `Admin@2025!` |
| GESTIONNAIRE  | `gestionnaire@marocpme.gov.ma`     | `Gest@2025!`  |
| PARTICIPANT   | `participant@marocpme.gov.ma`      | `Part@2025!`  |

> Le mot de passe admin peut être changé via la variable `ADMIN_PASSWORD` dans `.env` avant le premier démarrage.

---

## Utilisation

### Workflow standard (GESTIONNAIRE)

1. **Connexion** → http://localhost:8090
2. **Dossiers** → synchroniser avec Jira pour charger les prestataires
3. **Nouvelle évaluation** → choisir un dossier Jira et un programme
4. **Étape 0** — Type de référencement : Solution IT ou Action (formation, normalisation, productivité, numérique)
5. **Étape 1** — Informations dossier + analyse IA des CV et attestations
6. **Étape 2** — Grille d'évaluation solution/action (scores automatiques)
7. **Étape 3** — Grille intégrateur/intervenant (auto-score depuis CV possible)
8. **Étape 4** — Décision finale + génération PV + soumission vers Jira
9. **Consultation** accessible aux PARTICIPANTS en lecture seule

### Fonctions IA disponibles

| Fonction             | Description                                              |
|----------------------|----------------------------------------------------------|
| Briefing dossier     | Résumé automatique du dossier Jira                       |
| Analyse CV           | Extraction compétences, diplômes, expériences            |
| Analyse attestations | Vérification cohérence références clients                |
| Contrôle cohérence   | Croisement CV ↔ attestations ↔ grille fonctionnelle      |
| Génération PV        | Rédaction procès-verbal de la commission                 |
| Auto-remplissage     | Proposition scores intégrateur depuis analyse CV         |

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
GET  /api/dossiers                       Liste + sync Jira  [GESTIONNAIRE+]
GET  /api/dossiers/:key                  Détail dossier
GET  /api/dossiers/:key/intervenants     Arbre hiérarchique Prestataire → Intervenant → Compétence
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
POST /api/ai/briefing              Briefing dossier       [GESTIONNAIRE]
POST /api/ai/analyze-cv            Analyse CV             [GESTIONNAIRE]
POST /api/ai/analyze-attestations  Analyse attestations   [GESTIONNAIRE]
POST /api/ai/check-coherence       Contrôle cohérence     [GESTIONNAIRE]
POST /api/ai/generate-pv           Génération PV          [GESTIONNAIRE]
POST /api/ai/auto-fill             Auto-score intégrateur [GESTIONNAIRE]
```

### Administration
```
GET  /api/admin/users         Liste utilisateurs    [ADMIN]
POST /api/admin/users         Créer utilisateur     [ADMIN]
PUT  /api/admin/users/:id     Modifier utilisateur  [ADMIN]
GET  /api/admin/audit-log     Journal des actions   [ADMIN]
GET  /api/admin/stats         Statistiques          [ADMIN]
GET  /api/admin/config        Configuration         [ADMIN]
PUT  /api/admin/config        Modifier config       [ADMIN]
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

---

## Programmes disponibles

Quatre programmes sont chargés au démarrage (seed) :

| Code               | Nom                          |
|--------------------|------------------------------|
| `GO_SIYAHA_V04`    | GO SIYAHA v4                 |
| `POWER_EXPORT_V01` | POWER EXPORT v1              |
| `SUPPLY_CHAIN_V01` | SUPPLY CHAIN v1              |
| `PACTE_TPME_V01`   | PACTE TPME v1                |

Chaque programme définit ses propres catégories de solutions IT, critères d'évaluation et types d'actions. Un ADMIN peut modifier ou ajouter des programmes via l'interface ou l'API.

### Types d'actions non-IT

| Type          | Icône | Description                              |
|---------------|-------|------------------------------------------|
| `formation`   | 🎓    | Formation professionnelle                |
| `normalisation` | 📋  | Normalisation & certification ISO/NM     |
| `productivite` | ⚡   | Productivité & organisation (Lean, 5S…) |
| `numerique`   | 🌐    | Transformation numérique                 |

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
| `anthropic/claude-3.5-sonnet`   | Qualité maximale            |
| `openai/gpt-4o-mini`            | Bon rapport qualité/prix    |

Les analyses de CV et attestations utilisent la **vision** (lecture de PDF/images joints dans Jira). Choisissez un modèle qui supporte la vision.

### Obtenir une clé OpenRouter

1. Créez un compte sur https://openrouter.ai
2. Allez dans **Keys** → **Create Key**
3. Copiez la clé (`sk-or-v1-...`)
4. Collez-la dans **Admin > Configuration > `openrouter_key`**

---

## Dépannage

### Le backend ne démarre pas

```bash
docker compose logs backend
```

**`@prisma/client did not initialize`** → rebuild complet :
```bash
docker compose down
docker compose up --build
```

**`ECONNREFUSED db:5432`** → la DB n'est pas prête, attendez quelques secondes et relancez.

### Page blanche ou erreur 502

```bash
# Vérifier que tous les services tournent
docker compose ps

# Vérifier la santé du backend
curl http://localhost:3002/api/health
```

### Erreur de connexion (401)

- Vérifiez l'email et le mot de passe
- Si vous avez changé `ADMIN_PASSWORD` après le premier démarrage, le seed ne se réexécute pas. Utilisez Admin > Utilisateurs pour changer le mot de passe.

### Réinitialiser complètement la base de données

```bash
docker compose down -v        # supprime le volume PostgreSQL
docker compose up --build -d  # recrée + reseed
```

### Jira inaccessible

```bash
# Tester le proxy depuis l'hôte
curl http://localhost:3002/api/health
# Vérifier la config dans Admin > Configuration
```

**Erreur 401 Jira** → Token PAT expiré ou invalide, régénérez-en un dans Jira.  
**Erreur 502 Jira** → L'URL Jira est inaccessible depuis le réseau Docker. Vérifiez `JIRA_URL` dans `.env`.

### Voir les logs en temps réel

```bash
docker compose logs -f
```

---

## Structure du projet

```
referencement/
├── backend/
│   ├── src/
│   │   ├── routes/          # auth, programs, dossiers, evaluations, ai, admin
│   │   ├── middleware/       # auth.js, roles.js
│   │   ├── services/         # jira.js, ai.js, scoring.js
│   │   ├── prisma/           # schema.prisma, migrations/, seed.js
│   │   └── app.js
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, Dashboard, Dossiers, Evaluation, Consultation, Admin
│   │   ├── components/       # EvalSteps, AIPanel, ScoringGrid…
│   │   ├── stores/           # auth.js (Pinia)
│   │   ├── services/         # api.js (axios + refresh interceptor)
│   │   └── router/           # index.js (guards par rôle)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.js
├── proxy/                    # Proxy CORS Jira + OpenRouter (Node.js)
├── docker-compose.yml
├── .env                      # variables locales (ne pas committer)
├── .env.example              # template
└── README.md
```
