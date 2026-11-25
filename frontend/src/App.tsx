import React from 'react';
import { TacticalGpsBackground } from '@/components/layout/TacticalGpsBackground';
import { getFrontendEnvConfig } from '@/config/env';

export function App(): React.JSX.Element {
  const env = getFrontendEnvConfig();

  return (
    <div className="min-h-screen flex flex-col justify-between relative bg-reb-bg text-reb-text-light">
      <TacticalGpsBackground />

      <header className="sticky top-0 z-50 w-full bg-reb-bg/90 backdrop-blur-xl border-b border-reb-border">
        <div className="max-w-[1480px] mx-auto h-16 px-6 lg:px-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-reb-surface-card border border-reb-border flex items-center justify-center relative overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-reb-mint shadow-[0_0_10px_#A8F0C6] animate-pulse" />
              <div className="absolute -right-1 -bottom-1 w-2 h-2 rounded-full bg-reb-pink" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-lg tracking-tight text-reb-text-light">
                  Synapse<span className="text-reb-mint">Q</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-reb-pink" />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-reb-text-muted">
                POST-QUANTUM BIO-HUD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-reb-surface border border-reb-border text-reb-text-muted font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-reb-mint shadow-[0_0_6px_#A8F0C6]" />
              <span className="text-reb-text-light">Diana</span>
              <span className="text-reb-text-dim">
                [{env.qorechainChainId || 'UNCONFIGURED'}]
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1480px] mx-auto px-6 lg:px-10 py-8 flex-1 relative z-10">
        <div className="reb-glass rounded-xl p-6">
          <h1 className="font-display text-xl font-bold text-reb-mint">
            SynapseQ Bio-HUD Initialized
          </h1>
          <p className="font-mono text-xs text-reb-text-muted mt-2">
            Tactical GPS layer active — Ready for Patient Vault, Cyber-Human HBOM, and Specialist Portal views.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
