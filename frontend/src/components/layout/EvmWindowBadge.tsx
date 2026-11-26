import React from 'react';
import { describeEvmWindowProblem, windowBlocksTarget, type EvmWindowStatus } from '@sdk/evmWindow';

export interface EvmWindowBadgeProps {
  readonly window: EvmWindowStatus | null;
  readonly enforced: boolean;
  readonly contract: string | undefined;
  readonly onRefresh: () => void;
}

/**
 * QoreChain EVM authorisation window of the connected wallet. Green only when the window can call
 * the SynapseQ contract AND is bounded to it ("ventana EVM acotada"); amber when it works but is
 * unbounded; pink when the next transaction would be refused by the EVM lane.
 */
export function EvmWindowBadge({ window: win, enforced, contract, onRefresh }: EvmWindowBadgeProps): React.JSX.Element | null {
  if (!enforced || !contract) return null;

  let tone = 'border-reb-pink/60 text-reb-pink';
  let label = 'Ventana EVM: ?';
  let title = 'No se pudo leer la ventana EVM (se reintenta cada 30 s).';

  if (win) {
    const problem = windowBlocksTarget(win, contract);
    if (problem) {
      label = problem === 'no-window' ? 'Sin ventana EVM' : problem === 'exhausted' ? 'Ventana EVM agotada' : 'Ventana EVM fuera de alcance';
      title = describeEvmWindowProblem(problem, contract);
    } else {
      const bounded = win.allowedTargets.length > 0;
      tone = bounded ? 'border-reb-mint/60 text-reb-mint' : 'border-reb-yellow/60 text-reb-yellow';
      label = `Ventana EVM ${bounded ? 'acotada' : 'SIN ACOTAR'} • ${win.remainingTxs} tx • ${win.remainingBlocks} bloques`;
      title = bounded
        ? `Solo admite llamadas a ${win.allowedTargets.join(', ')}.`
        : `Admite llamadas a cualquier contrato. Recomendado: reabrirla restringida a ${contract}.`;
    }
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      title={title}
      aria-label={`${label}. ${title}`}
      className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-reb-surface/80 border font-mono text-[10px] whitespace-nowrap cursor-pointer ${tone}`}
    >
      {label}
    </button>
  );
}
