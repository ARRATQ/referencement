FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

RUN npx prisma generate --schema=./src/prisma/schema.prisma

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3002
CMD ["./entrypoint.sh"]
