# Mehrli qoʻllar — Backend (NestJS + Prisma)
FROM node:20-bookworm-slim

WORKDIR /app

# Prisma engine needs openssl
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (schema needed because postinstall runs `prisma generate`)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# App source + build
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000

# Apply DB migrations on boot, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
