SHELL := /bin/bash

ANVIL_PID    := /tmp/synapseq-anvil.pid
FRONTEND_PID := /tmp/synapseq-frontend.pid
GATEWAY_PID  := /tmp/synapseq-gateway.pid
GATEWAY_LOG  := /tmp/synapseq-gateway.log
ANVIL_LOG    := /tmp/synapseq-anvil.log
FRONTEND_LOG := /tmp/synapseq-frontend.log
INIT_TIMEOUT ?= 60

FOUNDRY_PATH := $(HOME)/.foundry/bin
export PATH := $(FOUNDRY_PATH):$(PATH)

.DEFAULT_GOAL := help
.PHONY: help build init down lint audit test test-contracts test-sdk test-gateway test-front test-quantum cbom demo deploy-local deploy-diana clean

# Dirección del último despliegue local (leída del broadcast de Foundry)
VAULT_ADDR_CMD = grep -m1 -o '"contractAddress": *"0x[0-9a-fA-F]*"' contracts/broadcast/DeploySynapseVault.s.sol/$${QORECHAIN_CHAIN_ID:-9800}/run-latest.json | grep -o '0x[0-9a-fA-F]*'

# Carga segura y desacoplada de .env desde la raíz del proyecto (funciona con o sin archivo .env)
ENV_EXPORTS = set -a; [ -f .env ] && source .env; set +a; \
              export ANVIL_PORT="$${ANVIL_PORT:-8545}"; \
              export FRONTEND_PORT="$${FRONTEND_PORT:-5173}"; \
              export GATEWAY_PORT="$${GATEWAY_PORT:-4000}"; \
              export LOCAL_RPC_URL="$${LOCAL_RPC_URL:-http://127.0.0.1:$${ANVIL_PORT:-8545}}"

# ── Ayuda ──────────────────────────────────────────────────────────────────────

help: ## Mostrar comandos disponibles
	@grep -ahE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/^([a-zA-Z0-9_-]+):.*## (.*)$$/\1\t\2/' | \
	  while IFS=$$'\t' read -r target desc; do printf "  \033[36m%-18s\033[0m %s\n" "$$target" "$$desc"; done

# ── Comandos principales ───────────────────────────────────────────────────────

build: ## ⚙️  Primera vez: instalar forge-std + compilar contratos Foundry + dependencias SDK & Frontend + build
	@echo "→ 1/5 Instalando librería forge-std y compilando contratos Solidity (Foundry)..."
	@cd contracts && ([ -d lib/forge-std ] || forge install foundry-rs/forge-std --no-git) && forge build
	@echo "→ 2/5 Instalando dependencias del SDK Post-Cuántico (@synapseq/sdk)..."
	@cd sdk && npm install --silent
	@echo "→ 3/5 Instalando dependencias del Key-Release Gateway (@synapseq/gateway)..."
	@cd gateway && npm install --silent
	@echo "→ 4/5 Instalando dependencias del Frontend React + Tailwind v4 (@synapseq/frontend)..."
	@cd frontend && npm install --silent
	@echo "→ 5/5 Verificando build de producción del Frontend..."
	@cd frontend && npm run build
	@echo ""
	@echo "✅ Build completo — ejecuta 'make init' para levantar el stack local o 'make test' para correr la suite."

init: ## 🚀 Levantar el stack local (Anvil QoreChain 9800 :8545 · Deploy SynapseVaultRegistry · Frontend :5173)
	@$(ENV_EXPORTS) && \
	  echo "→ 1/3 Levantando nodo local Anvil (Chain ID $${QORECHAIN_CHAIN_ID:-9800}) en :$$ANVIL_PORT..." && \
	  nohup anvil --chain-id "$${QORECHAIN_CHAIN_ID:-9800}" --port "$$ANVIL_PORT" --host 127.0.0.1 \
	    $$([ -n "$$QORECHAIN_RPC_URL" ] && ! echo "$$QORECHAIN_RPC_URL" | grep -q '<' && echo "--fork-url $$QORECHAIN_RPC_URL") \
	    > $(ANVIL_LOG) 2>&1 & echo $$! > $(ANVIL_PID)
	@echo "→ Verificando que el nodo EVM Anvil responda..."
	@$(ENV_EXPORTS) && \
	  end=$$((SECONDS + $(INIT_TIMEOUT))); \
	  while [ $$SECONDS -lt $$end ]; do \
	    code=$$(curl -s -o /dev/null -m 2 -w '%{http_code}' -X POST -H "Content-Type: application/json" \
	      --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$$LOCAL_RPC_URL" 2>/dev/null); \
	    if [ "$$code" = "200" ]; then echo "   ✅ Anvil EVM (Chain ID $${QORECHAIN_CHAIN_ID:-9800}) → $$LOCAL_RPC_URL"; break; fi; \
	    sleep 1; \
	  done
	@echo "→ 2/4 Desplegando SynapseVaultRegistry.sol en el nodo local..."
	@$(MAKE) --no-print-directory deploy-local
	@echo "→ 3/4 Levantando Key-Release Gateway..."
	@$(ENV_EXPORTS) && \
	  vault=$$($(VAULT_ADDR_CMD)); \
	  cd gateway && SYNAPSE_VAULT_ADDRESS="$$vault" QORECHAIN_RPC_URL="$$LOCAL_RPC_URL" \
	    nohup npx tsx src/index.ts > $(GATEWAY_LOG) 2>&1 & echo $$! > $(GATEWAY_PID)
	@echo "→ 4/4 Levantando Frontend React + Tailwind v4 en :5173..."
	@$(ENV_EXPORTS) && \
	  vault=$$($(VAULT_ADDR_CMD)); \
	  cd frontend && VITE_SYNAPSE_VAULT_ADDRESS="$$vault" VITE_QORECHAIN_RPC_URL="$$LOCAL_RPC_URL" \
	    VITE_GATEWAY_URL="http://127.0.0.1:$$GATEWAY_PORT" \
	    nohup npm run dev -- --host 127.0.0.1 --port "$$FRONTEND_PORT" --strictPort \
	    > $(FRONTEND_LOG) 2>&1 & echo $$! > $(FRONTEND_PID)
	@echo ""
	@echo "→ Verificando que cada servicio responda (máx. $(INIT_TIMEOUT) s)..."
	@$(ENV_EXPORTS) && \
	check() { \
	  name="$$1"; url="$$2"; pidf="$$3"; log="$$4"; end=$$((SECONDS + $(INIT_TIMEOUT))); \
	  while [ $$SECONDS -lt $$end ]; do \
	    code=$$(curl -s -o /dev/null -m 2 -w '%{http_code}' "$$url" 2>/dev/null); \
	    if [ -n "$$code" ] && [ "$$code" != "000" ]; then echo "   ✅ $$name → $$url"; return 0; fi; \
	    if [ -n "$$pidf" ] && ! kill -0 "$$(cat "$$pidf" 2>/dev/null)" 2>/dev/null; then break; fi; \
	    if [ -n "$$log" ] && grep -qE 'exited with code|Script not found|Address already in use|EADDRINUSE' "$$log" 2>/dev/null; then break; fi; \
	    sleep 1; \
	  done; \
	  echo "   ❌ $$name NO responde en $$url"; \
	  if [ -n "$$log" ]; then echo "      Últimas líneas de $$log:"; tail -n 15 "$$log" | sed 's/^/      │ /'; fi; \
	  return 1; \
	}; \
	fail=0; \
	check "Key-Release Gateway" "http://127.0.0.1:$$GATEWAY_PORT/health" "$(GATEWAY_PID)" "$(GATEWAY_LOG)" || fail=1; \
	check "Frontend Bio-HUD" "http://127.0.0.1:$$FRONTEND_PORT" "$(FRONTEND_PID)" "$(FRONTEND_LOG)" || fail=1; \
	echo ""; \
	if [ $$fail -ne 0 ]; then \
	  echo "❌ El stack NO quedó completo: revisa los errores y ejecuta 'make down' antes de reintentar."; \
	  exit 1; \
	fi; \
	echo "✅ Stack SynapseQ arriba:"; \
	echo "   Frontend Bio-HUD → http://localhost:$$FRONTEND_PORT"; \
	echo "   Gateway          → http://127.0.0.1:$$GATEWAY_PORT"; \
	echo "   Anvil EVM (9800) → $$LOCAL_RPC_URL"; \
	echo ""; \
	echo "   Logs:  tail -f $(ANVIL_LOG)"; \
	echo "          tail -f $(GATEWAY_LOG)"; \
	echo "          tail -f $(FRONTEND_LOG)"

down: ## 🛑 Detener SOLO los procesos que lanzó 'make init' (PID files)
	@echo "→ Deteniendo Anvil, Gateway y Frontend de SynapseQ..."
	@for pidf in $(ANVIL_PID) $(GATEWAY_PID) $(FRONTEND_PID); do \
	  if [ -f $$pidf ]; then \
	    pid=$$(cat $$pidf); \
	    pkill -TERM -P "$$pid" 2>/dev/null || true; \
	    kill -TERM "$$pid" 2>/dev/null || true; \
	    unlink $$pidf; \
	  fi; \
	done
	@echo "✅ Stack SynapseQ detenido (no se tocan otros procesos Vite/Anvil de la máquina)."

# ── Calidad, Linting y Auditoría ───────────────────────────────────────────────

lint: ## 🔍 Linting y validación de tipos estricta (forge fmt + ESLint/tsc SDK, Gateway & Frontend)
	@echo "→ 1/5 Verificando formato de Smart Contracts con forge fmt..."
	@cd contracts && forge fmt --check
	@echo "→ 2/5 Verificando tipado estricto del SDK con tsc..."
	@cd sdk && npm run typecheck
	@echo "→ 3/5 Verificando SDK con ESLint..."
	@cd sdk && npm run lint
	@echo "→ 4/5 Verificando Gateway (tsc + ESLint)..."
	@cd gateway && npm run typecheck && npm run lint
	@echo "→ 5/5 Verificando tipado estricto del Frontend con tsc..."
	@cd frontend && npm run typecheck
	@echo "✅ Verificación de código limpia (0 errores de lint y tipado)."

audit: ## 🛡️ Auditoría de dependencias de seguridad (npm audit en SDK y Frontend)
	@echo "→ 1/3 Auditando dependencias del SDK (npm audit)..."
	@cd sdk && npm audit --audit-level=moderate
	@echo "→ 2/3 Auditando dependencias del Gateway (npm audit)..."
	@cd gateway && npm audit --audit-level=moderate
	@echo "→ 3/3 Auditando dependencias del Frontend (npm audit)..."
	@cd frontend && npm audit --audit-level=moderate
	@echo "✅ Auditoría de dependencias sin vulnerabilidades conocidas."

# ── Tests y Demos ──────────────────────────────────────────────────────────────

test: ## 🧪 Suite completa acumulada (Lint + Contratos Foundry + SDK + Build Frontend)
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Ejecutando suite completa acumulada SynapseQ"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@$(MAKE) lint
	@$(MAKE) test-contracts
	@$(MAKE) test-sdk
	@$(MAKE) test-gateway
	@$(MAKE) test-front
	@echo ""
	@echo "✅ Toda la suite acumulada de SynapseQ ha finalizado con éxito."

test-contracts: ## ⛓️  Smart Contracts: tests unitarios, timelocks, Kill-Switch, HBOM, PKI y fuzzing en Foundry
	@echo "→ Ejecutando suite de tests en Foundry (forge test -vvv)..."
	@cd contracts && forge test -vvv

test-sdk: ## 🔐 SDK Post-Cuántico: validación de tipos, linting y simulación anti-cuántica (ML-KEM-1024 + ML-DSA-87 + SHAKE-256 + StorageRouter)
	@echo "→ Verificando SDK Post-Cuántico y simulación de defensa Q-Day..."
	@cd sdk && npm run typecheck && npm run lint && npm run test:quantum-defense

test-quantum: ## 🛡️ Ejecutar simulación de 5 vectores de ataque post-cuántico (HNDL, Tampering, SHAKE-256, ML-DSA-87, x/rdk)
	@cd sdk && npm run test:quantum-defense

cbom: ## 📋 Auditar y validar el reporte CycloneDX CBOM v1.6 (cbom-report.json)
	@echo "→ Verificando reporte CycloneDX CBOM v1.6 (cbom-report.json)..."
	@node -e 'const fs=require("fs"); const b=JSON.parse(fs.readFileSync("cbom-report.json","utf8")); console.log("   ✅ CBOM Formato:", b.bomFormat, "v"+b.specVersion, "| Activos PQC:", b.components.map(c=>c.name).join(", "));'

test-gateway: ## 🛡️  Gateway: firma de wallet, release condicionado, tokens de descarga, cuotas, CORS y crypto-shredding
	@echo "→ Ejecutando tests del Key-Release Gateway..."
	@cd gateway && npm test

test-front: ## ⚛️  Frontend: validación de tipos y compilación de producción (Vite + React 19 + Tailwind v4)
	@echo "→ Verificando tipado y build de producción del Frontend..."
	@cd frontend && npm run typecheck && npm run build

demo: ## 🎯 Demo end-to-end (PKI on-chain, HBOM, gateway, grant solo-hashes, release, Kill-Switch) contra 'make init'
	@$(ENV_EXPORTS) && \
	  vault=$$($(VAULT_ADDR_CMD)); \
	  cd sdk && QORECHAIN_RPC_URL="$$LOCAL_RPC_URL" SYNAPSE_VAULT_ADDRESS="$$vault" \
	    GATEWAY_URL="http://127.0.0.1:$$GATEWAY_PORT" npm run demo

# ── Despliegue On-Chain ────────────────────────────────────────────────────────

deploy-local: ## 📦 Desplegar SynapseVaultRegistry.sol en el nodo Anvil local (:8545)
	@$(ENV_EXPORTS) && \
	  anvil_key="$${DEPLOYER_PRIVATE_KEY}"; \
	  if [ -z "$$anvil_key" ] || echo "$$anvil_key" | grep -q '<'; then \
	    anvil_key=$$(grep -A 5 "Private Keys" $(ANVIL_LOG) 2>/dev/null | grep -m 1 "(0)" | awk '{print $$2}'); \
	  fi; \
	  if [ -z "$$anvil_key" ]; then \
	    echo "❌ No se detectó DEPLOYER_PRIVATE_KEY en .env ni un nodo Anvil activo en $(ANVIL_LOG)."; exit 1; \
	  fi; \
	  cd contracts && DEPLOYER_PRIVATE_KEY="$$anvil_key" forge script script/DeploySynapseVault.s.sol:DeploySynapseVault \
	    --rpc-url "$$LOCAL_RPC_URL" --broadcast

deploy-diana: ## 🌐 Desplegar SynapseVaultRegistry.sol en QoreChain Diana Testnet real (Chain ID 9800) usando .env
	@test -f .env || { echo "❌ Falta .env — copia .env.example → .env y configura DEPLOYER_PRIVATE_KEY y QORECHAIN_RPC_URL."; exit 1; }
	@$(ENV_EXPORTS) && \
	  : "$${QORECHAIN_RPC_URL:?Define QORECHAIN_RPC_URL en .env}" && \
	  : "$${DEPLOYER_PRIVATE_KEY:?Define DEPLOYER_PRIVATE_KEY en .env}" && \
	  cd contracts && forge script script/DeploySynapseVault.s.sol:DeploySynapseVault \
	    --rpc-url "$$QORECHAIN_RPC_URL" --broadcast

# ── Limpieza ───────────────────────────────────────────────────────────────────

clean: ## 🗑️  Limpiar entornos, temporales, artefactos de compilación y PIDs
	@echo "→ Deteniendo stack si está activo..."
	@$(MAKE) down 2>/dev/null || true
	@echo "→ Limpiando caches, artefactos y logs temporales..."
	@rm -rf contracts/out contracts/cache frontend/dist sdk/.local-ipfs
	@rm -f /tmp/synapseq-*.pid /tmp/synapseq-*.log
	@echo "✅ Limpieza completada."
