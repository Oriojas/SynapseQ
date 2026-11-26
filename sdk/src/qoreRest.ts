/**
 * Minimal QoreChain REST (LCD) reads used by SynapseQ. The public REST API sends no CORS headers,
 * so browsers must go through the Key-Release Gateway, which calls these functions server-side.
 */
import { parseAddress } from "@qorechain/qoresign";
import { parseEvmWindow, type EvmWindowStatus } from "./evmWindow.js";

export const DIANA_REST_URL = "https://api-testnet.qore.host";

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

/** Accepts `0x…` or `qor1…` (same 20 bytes) and returns the `qor1…` form the PQC module expects. */
export function toQorAddress(address: string): string {
  return parseAddress(address).bech32;
}

/** Reads the account's EVM authorisation window (GET /qorechain/pqc/v1/evm_window/{qor1…}). */
export async function fetchEvmWindowStatus(
  restUrl: string,
  address: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike
): Promise<EvmWindowStatus> {
  const url = `${restUrl.replace(/\/+$/, "")}/qorechain/pqc/v1/evm_window/${toQorAddress(address)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return parseEvmWindow({ found: false });
  if (!res.ok) throw new Error(`QoreChain REST ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return parseEvmWindow(await res.json());
}
