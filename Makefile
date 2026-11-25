SHELL := /bin/bash

ANVIL_PID    := /tmp/synapseq-anvil.pid
FRONTEND_PID := /tmp/synapseq-frontend.pid
ANVIL_LOG    := /tmp/synapseq-anvil.log
FRONTEND_LOG := /tmp/synapseq-frontend.log
INIT_TIMEOUT ?= 60

FOUNDRY_PATH := $(HOME)/.foundry/bin
export PATH := $(FOUNDRY_PATH):$(PATH)

.DEFAULT_GOAL := help
.PHONY: help build init down lint audit test test-contracts test-sdk test-front test-quantum cbom demo deploy-local deploy-diana clean

# Carga segura y desacoplada de .env desde la raíz del proyecto
ENV_EXPORTS = set -a && [ -f .env ] && source .env && set +a && \
              export ANVIL_PORT="$${ANVIL_PORT:-8545}" && \
              export FRONTEND_PORT="$${FRONTEND_PORT:-5173}" && \
              export LOCAL_RPC_URL="$${LOCAL_RPC_URL:-http://127.0.0.1:$${ANVIL_PORT:-8545}}"

# ── Ayuda ──────────────────────────────────────────────────────────────────────

help: ## Mostrar comandos disponibles
	@grep -ahE '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | sed -E 's/^([a-zA-Z0-9_-]+):.*## (.*)$$/\1\t\2/' | \
	  while IFS=$$'\t' read -r target desc; do printf "  \033[36m%-18s\033[0m %s\n" "$$target" "$$desc"; done

# ── Comandos principales ───────────────────────────────────────────────────────

build: ## ⚙️  Primera vez: instalar forge-std + compilar contratos Foundry + dependencias SDK & Frontend + build
	@echo "→ 1/4 Instalando librería forge-std y compilando contratos Solidity (Foundry)..."
	@cd contracts && ([ -d lib/forge-std ] || forge install foundry-rs/forge-std --no-git) && forge build
	@echo "→ 2/4 Instalando dependencias del SDK Post-Cuántico (@synapseq/sdk)..."
	@cd sdk && npm install --silent
	@echo "→ 3/4 Instalando dependencias del Frontend React + Tailwind v4 (@synapseq/frontend)..."
	@cd frontend && npm install --silent
	@echo "→ 4/4 Verificando build de producción del Frontend..."
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
	@echo "→ 2/3 Desplegando SynapseVaultRegistry.sol en el nodo local..."
	@$(MAKE) --no-print-directory deploy-local
	@echo "→ 3/3 Levantando Frontend React + Tailwind v4 en :5173..."
	@$(ENV_EXPORTS) && \
	  cd frontend && nohup npm run dev -- --host 0.0.0.0 --port "$$FRONTEND_PORT" \
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
	check "Frontend Bio-HUD" "http://127.0.0.1:$$FRONTEND_PORT" "$(FRONTEND_PID)" "$(FRONTEND_LOG)" || fail=1; \
	echo ""; \
	if [ $$fail -ne 0 ]; then \
	  echo "❌ El stack NO quedó completo: revisa los errores y ejecuta 'make down' antes de reintentar."; \
	  exit 1; \
	fi; \
	echo "✅ Stack SynapseQ arriba:"; \
	echo "   Frontend Bio-HUD → http://localhost:$$FRONTEND_PORT"; \
	echo "   Anvil EVM (9800) → $$LOCAL_RPC_URL"; \
	echo ""; \
	echo "   Logs:  tail -f $(ANVIL_LOG)"; \
	echo "          tail -f $(FRONTEND_LOG)"

down: ## 🛑 Detener el stack local y liberar puertos (:8545, :5173)
	@echo "→ Deteniendo procesos Anvil y Frontend..."
	@if [ -f $(ANVIL_PID) ]; then \
	  kill -9 $$(cat $(ANVIL_PID)) 2>/dev/null || true; rm -f $(ANVIL_PID); fi
	@if [ -f $(FRONTEND_PID) ]; then \
	  kill -9 $$(cat $(FRONTEND_PID)) 2>/dev/null || true; rm -f $(FRONTEND_PID); fi
	@pkill -9 -f "[a]nvil --chain-id" 2>/dev/null || true
	@pkill -9 -f "[v]ite" 2>/dev/null || true
	@$(ENV_EXPORTS) && \
	  (lsof -ti:"$$ANVIL_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true) && \
	  (lsof -ti:"$$FRONTEND_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true)
	@echo "✅ Stack SynapseQ detenido."

# ── Calidad, Linting y Auditoría ───────────────────────────────────────────────

lint: ## 🔍 Linting y validación de tipos estricta (forge fmt + ESLint SDK + tsc SDK & Frontend)
	@echo "→ 1/4 Verificando formato de Smart Contracts con forge fmt..."
	@cd contracts && forge fmt --check
	@echo "→ 2/4 Verificando tipado estricto del SDK con tsc..."
	@cd sdk && npm run typecheck
	@echo "→ 3/4 Verificando SDK con ESLint..."
	@cd sdk && npm run lint
	@echo "→ 4/4 Verificando tipado estricto del Frontend con tsc..."
	@cd frontend && npm run typecheck
	@echo "✅ Verificación de código limpia (0 errores de lint y tipado)."

audit: ## 🛡️ Auditoría de dependencias de seguridad (npm audit en SDK y Frontend)
	@echo "→ 1/2 Auditando dependencias del SDK (npm audit)..."
	@cd sdk && npm audit --audit-level=moderate
	@echo "→ 2/2 Auditando dependencias del Frontend (npm audit)..."
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

test-front: ## ⚛️  Frontend: validación de tipos y compilación de producción (Vite + React 19 + Tailwind v4)
	@echo "→ Verificando tipado y build de producción del Frontend..."
	@cd frontend && npm run typecheck && npm run build

demo: ## 🎯 Ejecutar demo end-to-end post-cuántica (6 pasos reales ML-KEM-1024 + ML-DSA-87 + Kill-Switch) contra nodo local
	@$(ENV_EXPORTS) && \
	  anvil_key=$$(grep -m 1 -A 2 "Private Keys" $(ANVIL_LOG) 2>/dev/null | tail -n 1 | awk '{print $$2}'); \
	  cd sdk && QORECHAIN_RPC_URL="$$LOCAL_RPC_URL" npm run demo

# ── Despliegue On-Chain ────────────────────────────────────────────────────────

deploy-local: ## 📦 Desplegar SynapseVaultRegistry.sol en el nodo Anvil local (:8545)
	@$(ENV_EXPORTS) && \
	  anvil_key="$${DEPLOYER_PRIVATE_KEY}"; \
	  if [ -z "$$anvil_key" ] || echo "$$anvil_key" | grep -q '<'; then \
	    anvil_key=$$(grep -m 1 -A 2 "Private Keys" $(ANVIL_LOG) 2>/dev/null | tail -n 1 | awk '{print $$2}'); \
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
