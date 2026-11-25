import { randomBytes } from "node:crypto";
import { isAddress, verifyMessage, type Address } from "viem";
import { buildGatewayAuthMessage, type GatewayAuthAction } from "../../sdk/src/gatewayClient.js";

const NONCE_TTL_MS = 60_000; // 60 seconds single-use window

interface PendingNonce {
  readonly address: string;
  readonly expiresAt: number;
}

/**
 * Manages single-use authentication nonces and verifies real EVM wallet signatures (SIWE-style)
 * to prevent eth_call spoofing and replay attacks.
 */
export class GatewayAuthService {
  private readonly nonces = new Map<string, PendingNonce>();

  public issueNonce(address: string): { nonce: string; expiresAt: number } {
    if (!isAddress(address)) {
      throw new Error("Invalid EVM wallet address.");
    }
    this.pruneExpired();
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + NONCE_TTL_MS;
    this.nonces.set(nonce, {
      address: address.toLowerCase(),
      expiresAt,
    });
    return { nonce, expiresAt };
  }

  public async verifyAndConsume(params: {
    readonly action: GatewayAuthAction;
    readonly address: string;
    readonly nonce: string;
    readonly signature: `0x${string}`;
    readonly recordId?: `0x${string}`;
  }): Promise<Address> {
    if (!isAddress(params.address)) {
      throw new Error("Invalid wallet address.");
    }

    const pending = this.nonces.get(params.nonce);
    if (!pending) {
      throw new Error("Invalid or already consumed authentication nonce.");
    }
    // Single-use: consume immediately before cryptographic check
    this.nonces.delete(params.nonce);

    if (Date.now() > pending.expiresAt) {
      throw new Error("Authentication nonce has expired.");
    }
    if (pending.address !== params.address.toLowerCase()) {
      throw new Error("Nonce was issued for a different wallet address.");
    }

    const message = buildGatewayAuthMessage({
      action: params.action,
      address: params.address as `0x${string}`,
      nonce: params.nonce,
      recordId: params.recordId,
    });

    const valid = await verifyMessage({
      address: params.address as Address,
      message,
      signature: params.signature,
    });

    if (!valid) {
      throw new Error("Wallet signature verification failed.");
    }

    return params.address as Address;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.nonces.entries()) {
      if (now > entry.expiresAt) {
        this.nonces.delete(key);
      }
    }
  }
}
