# ===== Etapa 1: dependencias (deps) =====
# Instala SOLO dependencias de producción con npm ci (reproducible por package-lock.json).
# Las devDependencies (jest, supertest) nunca entran a la imagen final.
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ===== Etapa 2: runtime =====
# Imagen final minimalista: solo node_modules de producción + el código.
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json app.js server.js ./
# Endurecimiento: proceso sin privilegios de root
USER node
EXPOSE 3001
CMD ["node","server.js"]
