# SynapseQ frontend (Vite multi-page SPA) — built from the repo root (it aliases @sdk -> ../sdk/src).
# Railway: builder DOCKERFILE, dockerfilePath frontend/Dockerfile (see .railway/railway.ts).
FROM node:22-alpine AS build

WORKDIR /app

COPY sdk/package.json sdk/package-lock.json sdk/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm ci --prefix sdk --ignore-scripts --no-audit --no-fund \
 && npm ci --prefix frontend --ignore-scripts --no-audit --no-fund

COPY sdk sdk
COPY frontend frontend

# Vite inlines VITE_* at build time. Railway passes service variables to declared ARGs.
# Public values only: never put a secret (e.g. PINATA_JWT) in a VITE_* variable.
ARG VITE_QORECHAIN_RPC_URL
ARG VITE_QORECHAIN_CHAIN_ID
ARG VITE_SYNAPSE_VAULT_ADDRESS
ARG VITE_GATEWAY_URL
ARG VITE_IPFS_GATEWAY_URL
ARG VITE_DAPP_URL
ARG VITE_GITHUB_URL

RUN npm --prefix frontend run build

# Static runtime: Caddy serves dist/ on Railway's $PORT.
FROM caddy:2-alpine
COPY frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv
