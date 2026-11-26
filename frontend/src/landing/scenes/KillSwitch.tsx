import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Clock, ShieldAlert } from 'lucide-react';
import type { LandingCopy } from '../copy';
import { HudTag, Reveal, RevealText, TONE_TEXT } from '../ui';
import { useInView } from '../hooks/useScene';

const INITIAL_SECONDS = 7182;

function formatTimer(total: number): string {
  const h = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, mm, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Kill-Switch illustration (no controls): while visible it loops by itself
 * pass alive -> O(1) revocation wave -> new pass. The real action lives in the dApp.
 */
function Simulator({ sim }: { sim: LandingCopy['killSwitch']['sim'] }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const [seconds, setSeconds] = useState(INITIAL_SECONDS);
  const [revoked, setRevoked] = useState(false);
  const [epoch, setEpoch] = useState(7);
  const [wave, setWave] = useState(0);

  useEffect(() => {
    if (revoked || !inView) return;
    const id = window.setInterval(() => setSeconds((p) => (p > 1 ? p - 1 : INITIAL_SECONDS)), 1000);
    return () => window.clearInterval(id);
  }, [revoked, inView]);

  // Automatic loop: 4.5 s alive, 3.5 s revoked
  useEffect(() => {
    if (!inView) return;
    const id = window.setTimeout(
      () => {
        if (revoked) {
          setRevoked(false);
          setSeconds(INITIAL_SECONDS);
        } else {
          setRevoked(true);
          setEpoch((e) => e + 1);
          setWave((w) => w + 1);
        }
      },
      revoked ? 3500 : 4500
    );
    return () => window.clearTimeout(id);
  }, [revoked, inView]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`relative chamfer-card p-6 sm:p-7 overflow-hidden select-none transition-colors duration-500 ${
        revoked ? 'landing-glass-pink' : 'landing-glass'
      }`}
    >
      {/* Shockwave */}
      <AnimatePresence>
        {wave > 0 && revoked && (
          <m.span
            key={wave}
            className="pointer-events-none absolute left-1/2 bottom-10 w-40 h-40 -ml-20 rounded-full border-2 border-reb-crimson"
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 7, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-reb-border">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-reb-text-muted">[ {sim.hudTag} ]</span>
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={revoked ? 'off' : 'on'}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold tracking-wider border ${
              revoked ? 'bg-reb-crimson/20 border-reb-crimson text-reb-pink' : 'bg-reb-mint/10 border-reb-mint/40 text-reb-mint'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${revoked ? 'bg-reb-pink' : 'bg-reb-mint animate-pulse'}`} />
            {revoked ? sim.revokedStatus : sim.activeStatus}
          </m.span>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-reb-text-muted">RECORD · 0x9042…</p>
          <p className="font-display text-xl font-semibold text-reb-text-light mt-1">{sim.passTitle}</p>
        </div>
        <div className="sm:text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-reb-text-muted flex items-center sm:justify-end gap-1">
            <Clock className="w-3 h-3 text-reb-yellow" />
            {sim.timerLabel}
          </p>
          <p
            className={`font-mono text-3xl font-bold tracking-wider mt-0.5 tabular-nums transition-all ${
              revoked ? 'text-reb-pink line-through opacity-70' : 'text-reb-yellow'
            }`}
          >
            {revoked ? '00:00:00' : formatTimer(seconds)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-reb-surface-code/80 border border-reb-border-subtle p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">{sim.recipientLabel}</p>
          <p className="text-sm text-reb-text-light mt-1 font-medium">{sim.recipientName}</p>
        </div>
        <div className="bg-reb-surface-code/80 border border-reb-border-subtle p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">{sim.scopeLabel}</p>
          <p className="text-sm text-reb-mint mt-1 font-medium">{sim.scopeValue}</p>
        </div>
      </div>

      {/* Every other pass dies in the same O(1) epoch bump */}
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {sim.otherPasses.map((p, i) => (
          <m.li
            key={p}
            animate={revoked ? { opacity: 0.45, x: 0 } : { opacity: 1, x: 0 }}
            transition={{ delay: revoked ? 0.15 + i * 0.12 : 0 }}
            className={`px-3 py-2 border font-mono text-[11px] flex items-center gap-2 ${
              revoked ? 'border-reb-crimson/50 text-reb-pink line-through' : 'border-reb-border text-reb-text-light'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${revoked ? 'bg-reb-crimson' : 'bg-reb-mint'}`} />
            {p}
          </m.li>
        ))}
      </ul>

      <div className="mt-6 pt-4 border-t border-reb-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-reb-text-muted">
            {sim.epochLabel}{' '}
            <m.span key={epoch} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="inline-block text-reb-yellow font-bold">
              {epoch}
            </m.span>
          </p>
          <p className="text-xs text-reb-text-muted leading-relaxed max-w-sm mt-1">{revoked ? sim.revokedNote : sim.activeNote}</p>
        </div>
        {/* Status indicator, not a control */}
        <div className="shrink-0 flex flex-col sm:items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 border font-mono text-xs font-bold tracking-wider transition-colors duration-300 ${
              revoked ? 'border-reb-crimson bg-reb-crimson/25 text-reb-pink' : 'border-reb-border text-reb-text-muted'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {sim.killLabel}
          </span>
          <span className="font-mono text-[10px] tracking-[0.14em] text-reb-text-muted">{sim.demoLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function KillSwitch({ t }: { t: LandingCopy['killSwitch'] }) {
  return (
    <section data-tone="mint" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-3xl">
          <HudTag tone="pink">{t.hudTag}</HudTag>
          <RevealText
            as="h2"
            text={t.title}
            className="block font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mt-4 text-reb-text-light"
          />
          <p className="mt-5 text-base sm:text-lg text-reb-text-muted leading-relaxed">{t.lead}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-5">
            {t.pillars.map((p, i) => (
              <Reveal key={p.code} delay={i * 120}>
                <div className={`p-6 chamfer-card ${p.tone === 'pink' ? 'landing-glass-pink' : 'landing-glass'}`}>
                  <p className={`font-mono text-[11px] uppercase tracking-[0.14em] ${TONE_TEXT[p.tone]}`}>{p.code}</p>
                  <h3 className="font-display text-xl font-semibold text-reb-text-light mt-2">{p.title}</h3>
                  <p className="text-sm text-reb-text-muted leading-relaxed mt-2.5">{p.body}</p>
                </div>
              </Reveal>
            ))}
            <p className="font-mono text-[11px] leading-relaxed text-reb-yellow/90 border-l-2 border-reb-yellow/60 pl-3">
              {t.honestNote}
            </p>
          </div>
          <Reveal className="lg:col-span-7" delay={150}>
            <Simulator sim={t.sim} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
