#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy --schema=src/prisma/schema.prisma

echo "[entrypoint] Generating Prisma client..."
npx prisma generate --schema=src/prisma/schema.prisma

echo "[entrypoint] Running seed..."
node src/prisma/seed.js

echo "[entrypoint] Starting backend..."
exec node src/app.js
