/**
 * SynapseQ OEM CLI — sign & publish HBOM firmware attestations verified on-chain by pqcVerify.
 *
 *   npm run oem -- status
 *   npm run oem -- register --serial SN-1 --model "NeuroLink-X9" --bearer 0x… [--zone 0] \
 *                           --firmware ./fw.bin|"text" [--calibration "profile-v1"]
 *   npm run oem -- update --part 0x… --firmware ./fw-v2.bin|"text" [--calibration "profile-v2"]
 *
 * Env: QORECHAIN_RPC_URL, QORECHAIN_CHAIN_ID (9800), SYNAPSE_VAULT_ADDRESS and either
 *      OEM_MNEMONIC [+ OEM_INDEX]   → Diana: canonical ML-DSA-87 key (the one QoreX registers)
 *      OEM_PRIVATE_KEY              → local Anvil + MockQorePqc only (dev-derived ML-DSA key)
 */
import { existsSync, readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { createPublicClient, createWalletClient, defineChain, http, isAddress, type Address } from "viem";
import { computeShake256 } from "./pqc.js";
import {
  inspectPqcKey,
  oemFromDevPrivateKey,
  oemFromMnemonic,
  pushFirmwareWithAttestation,
  registerPartWithAttestation,
  type OemIdentity,
} from "./oem.js";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : fallback;
  if (value === undefined) throw new Error(`Missing --${name}`);
  return value;
}

function hashInput(value: string): `0x${string}` {
  const bytes = existsSync(value) ? new Uint8Array(readFileSync(value)) : new TextEncoder().encode(value);
  return computeShake256(bytes);
}

function loadOem(): OemIdentity {
  if (process.env.OEM_MNEMONIC) {
    return oemFromMnemonic(process.env.OEM_MNEMONIC.trim(), Number(process.env.OEM_INDEX ?? 0));
  }
  if (process.env.OEM_PRIVATE_KEY) {
    return oemFromDevPrivateKey(process.env.OEM_PRIVATE_KEY as `0x${string}`);
  }
  throw new Error("Set OEM_MNEMONIC (Diana) or OEM_PRIVATE_KEY (local dev).");
}

async function main() {
  const command = process.argv[2];
  const rpc = process.env.QORECHAIN_RPC_URL ?? "http://127.0.0.1:8545";
  const chainId = Number(process.env.QORECHAIN_CHAIN_ID ?? 9800);
  const vault = process.env.SYNAPSE_VAULT_ADDRESS as Address;
  if (!vault || !isAddress(vault)) throw new Error("SYNAPSE_VAULT_ADDRESS is missing or invalid.");

  const chain = defineChain({
    id: chainId,
    name: "QoreChain",
    nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
  const oem = loadOem();
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const walletClient = createWalletClient({ account: oem.account, chain, transport: http(rpc) });
  const clients = { publicClient, walletClient, vault };

  const info = await inspectPqcKey(publicClient, oem);
  console.log(`OEM account:      ${oem.account.address}`);
  console.log(`ML-DSA-87 key:    ${oem.pqKeySource} (${oem.pqKey.publicKey.length} B public key)`);
  console.log(
    `Chain PQC:        ${!info.available ? "NOT AVAILABLE (contract will fail closed)" : info.isDevMock ? "MockQorePqc (DEV ONLY)" : "native precompiles"} • registered=${info.registered} • matches=${info.registeredPubkeyMatches} • possessionProven=${info.possessionProven}`
  );
  if (oem.pqKeySource === "dev-derived" && !info.isDevMock) {
    throw new Error("OEM_PRIVATE_KEY mode only works on a local chain with MockQorePqc. Use OEM_MNEMONIC on Diana.");
  }

  if (command === "status") return;

  if (command === "register") {
    const res = await registerPartWithAttestation(clients, oem, {
      bearer: arg("bearer") as Address,
      zone: Number(arg("zone", "0")),
      modelName: arg("model"),
      serialNumber: arg("serial"),
      firmwareHash: hashInput(arg("firmware")),
      calibrationHash: hashInput(arg("calibration", "default-calibration")),
    });
    console.log(`Registered part ${res.partId}`);
    console.log(`  ML-DSA-87 signature ${res.signatureBytes} B verified ON-CHAIN • gas ${res.gasUsed} • tx ${res.hash}`);
    return;
  }

  if (command === "update") {
    const res = await pushFirmwareWithAttestation(
      clients,
      oem,
      arg("part") as `0x${string}`,
      hashInput(arg("firmware")),
      hashInput(arg("calibration", "default-calibration"))
    );
    console.log(`Firmware v${res.version} attested ON-CHAIN • gas ${res.gasUsed} • tx ${res.hash}`);
    return;
  }

  throw new Error("Usage: oem <status|register|update> …");
}

main().catch((err) => {
  console.error(`OEM CLI failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
