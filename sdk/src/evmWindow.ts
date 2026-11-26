/**
 * QoreChain "EVM authorisation window" helpers — browser-safe, no dependencies.
 *
 * On QoreChain (Diana testnet and mainnet) the EVM lane only admits a transaction from an account
 * that (1) has a registered ML-DSA-87 key and (2) has an OPEN window, opened with a hybrid-signed
 * Cosmos message (MsgOpenEVMWindow). A window is bounded by blocks, number of txs and value, and can
 * be narrowed to specific contracts (`allowedTargets`, max 16) — the "ventana EVM acotada".
 *
 * These helpers mirror @qorechain/sdk 0.10 (fetchEvmWindow / classifyEvmWindowRejection) without
 * pulling cosmjs into the browser bundle.
 */

export interface EvmWindowStatus {
  /** A window is stored (it may still be expired or exhausted). */
  readonly found: boolean;
  /** It admits at least one more zero-value transaction right now. */
  readonly live: boolean;
  readonly expiryHeight: bigint;
  readonly remainingBlocks: bigint;
  readonly remainingTxs: bigint;
  /** uqor */
  readonly remainingValue: bigint;
  readonly nativeOnly: boolean;
  /** Lower-cased 0x addresses; empty = any target. */
  readonly allowedTargets: readonly string[];
}

export type EvmWindowRejection = "no-window" | "exhausted" | "invalid" | "no-pqc-key";

const big = (v: unknown): bigint => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
  return 0n;
};

/** Parses the REST body of GET /qorechain/pqc/v1/evm_window/{qor1…} (snake or camel case). */
export function parseEvmWindow(body: unknown): EvmWindowStatus {
  const root = (body ?? {}) as Record<string, unknown>;
  const w = ((root.window ?? root.evm_window ?? root) as Record<string, unknown>) ?? {};
  const found = root.found === true || (root.found === undefined && Object.keys(w).length > 0);
  const targets = (w.allowed_targets ?? w.allowedTargets) as unknown;
  return {
    found,
    live: found && (w.live === true || root.live === true),
    expiryHeight: big(w.expiry_height ?? w.expiryHeight),
    remainingBlocks: big(w.remaining_blocks ?? w.remainingBlocks),
    remainingTxs: big(w.remaining_txs ?? w.remainingTxs),
    remainingValue: big(w.remaining_value ?? w.remainingValue),
    nativeOnly: (w.native_only ?? w.nativeOnly) === true,
    allowedTargets: Array.isArray(targets)
      ? targets.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
      : [],
  };
}

/** Why the current window cannot be used to call `target`, or null if it can. */
export function windowBlocksTarget(win: EvmWindowStatus, target: string): EvmWindowRejection | "out-of-scope" | null {
  if (!win.found) return "no-window";
  if (!win.live || win.remainingTxs <= 0n) return "exhausted";
  if (win.nativeOnly) return "out-of-scope";
  if (win.allowedTargets.length > 0 && !win.allowedTargets.includes(target.toLowerCase())) {
    return "out-of-scope";
  }
  return null;
}

/** Same text-first, code-fallback rules as @qorechain/sdk's classifyEvmWindowRejection. */
const REJECTION_TEXTS: readonly (readonly [RegExp, EvmWindowRejection])[] = [
  [/has no registered post-quantum key/i, "no-pqc-key"],
  [/does not admit this transaction/i, "exhausted"],
  [/EVM authorisation window exhausted/i, "exhausted"],
  [/no open EVM authorisation window/i, "no-window"],
  [/invalid EVM authorisation window/i, "invalid"],
  [/EVM sender is not established/i, "invalid"],
];

export function classifyEvmWindowRejection(x: unknown): EvmWindowRejection | undefined {
  if (x === null || x === undefined) return undefined;
  const texts: string[] = [];
  const collect = (v: unknown, depth: number) => {
    if (depth > 4 || v === null || v === undefined) return;
    if (typeof v === "string") texts.push(v);
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of ["log", "rawLog", "message", "details", "shortMessage", "cause", "data"]) collect(o[k], depth + 1);
    }
  };
  collect(x, 0);
  for (const t of texts) for (const [re, kind] of REJECTION_TEXTS) if (re.test(t)) return kind;
  const o = x as { codespace?: unknown; code?: unknown };
  if (o.codespace === "pqc") {
    if (Number(o.code) === 26) return "no-window";
    if (Number(o.code) === 27) return "exhausted";
    if (Number(o.code) === 28) return "invalid";
  }
  return undefined;
}

/** User-facing remedy (Spanish UI). */
export function describeEvmWindowProblem(kind: EvmWindowRejection | "out-of-scope", contract?: string): string {
  const scope = contract ? ` restringida al contrato ${contract}` : "";
  switch (kind) {
    case "no-pqc-key":
      return "Tu cuenta no tiene una clave ML-DSA-87 registrada en QoreChain. Regístrala primero en QoreX (Ajustes → Seguridad).";
    case "no-window":
      return `No tienes una ventana EVM abierta. Ábrela en QoreX (Ajustes → Seguridad → Ventana de acceso EVM)${scope}, o con \`npm run evm:open-window\`.`;
    case "exhausted":
      return `Tu ventana EVM expiró o agotó sus transacciones/valor. Abre una nueva${scope}.`;
    case "invalid":
      return "La red rechazó los límites de la ventana EVM (bloques 1–17280, tx 1–1000, valor > 0, máx. 16 contratos).";
    case "out-of-scope":
      return `Tu ventana EVM no incluye este contrato. Ábrela${scope || " incluyendo el contrato de SynapseQ"}.`;
  }
}
