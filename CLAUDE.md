# CLAUDE.md

## Stack

- **Frontend**: Vue 3 + Vite + Pinia + Vue Router (`frontend/`)
- **Backend**: Express.js + Prisma ORM + PostgreSQL (`backend/`)
- **Infra**: Docker Compose (db, proxy, backend, frontend/nginx)

## Commandes

### Frontend
```bash
cd frontend && npm run dev      # dev server (port 5173)
cd frontend && npm run build    # build production
```

### Backend
```bash
cd backend && npm run dev       # nodemon (port 3002)
cd backend && npm start         # production
```

### Base de données (Prisma)
```bash
cd backend && npm run db:migrate   # appliquer migrations
cd backend && npm run db:generate  # régénérer client Prisma
cd backend && npm run db:seed      # données initiales
cd backend && npm run db:studio    # Prisma Studio UI
```

### Docker (environnement complet)
```bash
docker compose up -d       # démarrer tous les services
docker compose down        # arrêter
docker compose logs -f     # suivre les logs
```

## Conventions Git

- Ne jamais inclure de signature de modèle IA dans les commits (pas de `Co-Authored-By: Claude ...`)

## Notes

- Variables d'environnement requises : `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL/PASSWORD` — voir `.env.example` si présent
- Le frontend est servi via nginx en production (port `APP_PORT`, défaut 8090)
- L'API backend tourne sur le port `BACKEND_PORT` (défaut 3002)
- Pas de suite de tests configurée actuellement
