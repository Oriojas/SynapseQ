import { randomBytes } from "node:crypto";
import { isAddress, verifyMessage, type Address } from "viem";
import { buildGatewayAuthMessage, type GatewayAuthAction } from "../../sdk/src/gatewayClient.js";

const NONCE_TTL_MS = 60_000; // 60 seconds single-use window
const MAX_PENDING_PER_ADDRESS = 5;
const MAX_PENDING_TOTAL = 10_000;

interface PendingNonce {
  readonly address: string;
  readonly expiresAt: number;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 429 = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Manages single-use authentication nonces and verifies EVM wallet signatures over a message bound
 * to action, wallet, chain ID, nonce and recordId (prevents eth_call spoofing and replays).
 * Pending nonces are capped per address and globally so the endpoint cannot exhaust memory.
 */
export class GatewayAuthService {
  private readonly nonces = new Map<string, PendingNonce>();
  private readonly pendingByAddress = new Map<string, number>();

  constructor(private readonly chainId: number) {}

  public issueNonce(address: string): { nonce: string; expiresAt: number; chainId: number } {
    if (!isAddress(address)) {
      throw new AuthError("Invalid EVM wallet address.");
    }
    this.pruneExpired();
    const normalized = address.toLowerCase();
    if ((this.pendingByAddress.get(normalized) ?? 0) >= MAX_PENDING_PER_ADDRESS) {
      throw new AuthError("Too many pending nonces for this address. Retry in a minute.", 429);
    }
    if (this.nonces.size >= MAX_PENDING_TOTAL) {
      throw new AuthError("Gateway is busy. Retry in a minute.", 429);
    }
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + NONCE_TTL_MS;
    this.nonces.set(nonce, { address: normalized, expiresAt });
    this.pendingByAddress.set(normalized, (this.pendingByAddress.get(normalized) ?? 0) + 1);
    return { nonce, expiresAt, chainId: this.chainId };
  }

  public async verifyAndConsume(params: {
    readonly action: GatewayAuthAction;
    readonly address: string;
    readonly nonce: string;
    readonly signature: `0x${string}`;
    readonly recordId?: `0x${string}`;
  }): Promise<Address> {
    if (typeof params.address !== "string" || !isAddress(params.address)) {
      throw new AuthError("Invalid wallet address.");
    }
    if (typeof params.nonce !== "string" || typeof params.signature !== "string") {
      throw new AuthError("Missing nonce or signature.");
    }

    const pending = this.nonces.get(params.nonce);
    if (!pending) {
      throw new AuthError("Invalid or already consumed authentication nonce.");
    }
    // Single-use: consume immediately before the cryptographic check
    this.consume(params.nonce, pending);

    if (Date.now() > pending.expiresAt) {
      throw new AuthError("Authentication nonce has expired.");
    }
    if (pending.address !== params.address.toLowerCase()) {
      throw new AuthError("Nonce was issued for a different wallet address.");
    }

    const message = buildGatewayAuthMessage({
      action: params.action,
      address: params.address as `0x${string}`,
      nonce: params.nonce,
      chainId: this.chainId,
      recordId: params.recordId,
    });

    let valid = false;
    try {
      valid = await verifyMessage({
        address: params.address as Address,
        message,
        signature: params.signature,
      });
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new AuthError("Wallet signature verification failed.");
    }
    return params.address as Address;
  }

  private consume(nonce: string, entry: PendingNonce): void {
    this.nonces.delete(nonce);
    const left = (this.pendingByAddress.get(entry.address) ?? 1) - 1;
    if (left <= 0) this.pendingByAddress.delete(entry.address);
    else this.pendingByAddress.set(entry.address, left);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.nonces.entries()) {
      if (now > entry.expiresAt) this.consume(key, entry);
    }
  }
}
