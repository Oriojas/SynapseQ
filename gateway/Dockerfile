# SynapseQ Key-Release Gateway — built from the repo root (it imports ../sdk/src).
# Railway: builder DOCKERFILE, dockerfilePath gateway/Dockerfile (see .railway/railway.ts).
FROM node:22-alpine

WORKDIR /app

# Install SDK + gateway deps first for layer caching. tsx (devDependency) runs the TS sources.
COPY sdk/package.json sdk/package-lock.json sdk/
COPY gateway/package.json gateway/package-lock.json gateway/
RUN npm ci --prefix sdk --ignore-scripts --no-audit --no-fund \
 && npm ci --prefix gateway --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

COPY sdk/src sdk/src
COPY sdk/tsconfig.json sdk/
COPY gateway/src gateway/src
COPY gateway/tsconfig.json gateway/

WORKDIR /app/gateway
ENV NODE_ENV=production \
    GATEWAY_HOST=0.0.0.0
# Envelope store (gateway/data) lives on a Railway volume mounted at /app/gateway/data.
CMD ["node_modules/.bin/tsx", "src/index.ts"]
