/// <reference types="node" />
/**
 * Opens an EVM Authorisation Window (MsgOpenEVMWindow) on QoreChain Diana Testnet
 * signed with the account's hybrid eth_secp256k1 + ML-DSA-87 key.
 *
 * Usage:
 *   DEPLOYER_MNEMONIC="word1 word2 ..." npm run evm:open-window
 *
 * Optional env vars:
 *   OEM_MNEMONIC            Fallback if DEPLOYER_MNEMONIC is not set
 *   DEPLOYER_INDEX          HD account index (default: 0)
 *   EVM_WINDOW_BLOCKS       Blocks the window remains open (default: 500)
 *   EVM_WINDOW_MAX_TXS      Max EVM transactions admitted (default: 50)
 *   EVM_WINDOW_MAX_QOR      Max spend in QOR incl. gas fees (default: 10)
 *   QORECHAIN_COSMOS_RPC    Tendermint RPC (default: https://rpc-testnet.qore.host)
 *   QORECHAIN_REST_URL      Cosmos REST LCD (default: https://api-testnet.qore.host)
 *   QORECHAIN_COSMOS_CHAIN  Chain ID (default: qorechain-diana)
 */
import { webcrypto } from "node:crypto";
import { StargateClient } from "@cosmjs/stargate";
import {
  deriveUnifiedAccount,
  EthNativeSigner,
  fetchEvmWindow,
  openEvmWindowMsg,
} from "@qorechain/sdk";

if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}

interface AuthAccountResponse {
  account?: {
    account_number?: string;
    sequence?: string;
    base_account?: {
      account_number?: string;
      sequence?: string;
    };
  };
}

async function fetchAccountNumbers(
  restUrl: string,
  cosmosAddress: string
): Promise<{ accountNumber: bigint; sequence: bigint }> {
  const base = restUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/cosmos/auth/v1beta1/accounts/${cosmosAddress}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Cosmos account (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as AuthAccountResponse;
  const acct = data.account?.base_account ?? data.account;
  if (!acct?.account_number) {
    throw new Error(`Account ${cosmosAddress} not found on chain (fund it at the faucet first).`);
  }
  return {
    accountNumber: BigInt(acct.account_number),
    sequence: BigInt(acct.sequence ?? "0"),
  };
}

async function main() {
  const mnemonic = (process.env.DEPLOYER_MNEMONIC ?? process.env.OEM_MNEMONIC ?? "").trim();
  if (!mnemonic) {
    throw new Error("Set DEPLOYER_MNEMONIC (or OEM_MNEMONIC) in your environment or .env file.");
  }

  const index = Number(process.env.DEPLOYER_INDEX ?? process.env.OEM_INDEX ?? "0");
  const blocks = BigInt(process.env.EVM_WINDOW_BLOCKS ?? "500");
  const maxTxs = BigInt(process.env.EVM_WINDOW_MAX_TXS ?? "50");
  const maxQor = BigInt(process.env.EVM_WINDOW_MAX_QOR ?? "10");
  const maxValueUqor = maxQor * 1_000_000n;

  const rpcUrl = process.env.QORECHAIN_COSMOS_RPC ?? "https://rpc-testnet.qore.host";
  const restUrl = process.env.QORECHAIN_REST_URL ?? "https://api-testnet.qore.host";
  const chainId = process.env.QORECHAIN_COSMOS_CHAIN ?? "qorechain-diana";

  const account = await deriveUnifiedAccount(mnemonic, index);
  const cosmosAddress = account.cosmos;
  const evmAddress = account.evm;

  console.log("=== QoreChain Open EVM Authorisation Window ===");
  console.log(`Cosmos address: ${cosmosAddress}`);
  console.log(`EVM address:    ${evmAddress}`);
  console.log(`Window params:  ${blocks} blocks · ${maxTxs} txs · max ${maxQor} QOR (${maxValueUqor} uqor)`);

  const { accountNumber, sequence } = await fetchAccountNumbers(restUrl, cosmosAddress);
  const msg = openEvmWindowMsg({
    sender: cosmosAddress,
    blocks,
    maxTxs,
    maxValue: maxValueUqor,
  });

  const signer = new EthNativeSigner(account, {
    rest: restUrl,
  });

  const client = await StargateClient.connect(rpcUrl);
  try {
    const result = await signer.signAndBroadcast(client, {
      chainId,
      accountNumber,
      sequence,
      messages: [msg],
      fee: {
        amount: [{ denom: "uqor", amount: "50000" }],
        gas: "400000",
      },
      memo: "SynapseQ: Open EVM authorisation window",
    });

    if (result.code !== 0) {
      throw new Error(`Broadcast failed with code ${result.code}: ${result.rawLog ?? "unknown error"}`);
    }

    console.log(`\nEVM window opened! Tx hash: ${result.transactionHash} (height ${result.height ?? "?"})`);
  } finally {
    client.disconnect();
  }

  const liveWindow = await fetchEvmWindow({ rest: restUrl, address: cosmosAddress });
  console.log(
    `Verified on-chain: live=${liveWindow.live} · expiryHeight=${liveWindow.expiryHeight} · maxTxs=${liveWindow.maxTxs}`
  );
  console.log("You can now run `make deploy-diana` to deploy SynapseVaultRegistry.");
}

main().catch((err) => {
  console.error(`Failed to open EVM window: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
