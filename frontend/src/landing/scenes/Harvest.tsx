import React, { useEffect, useRef, useState } from 'react';
import type { LandingCopy } from '../copy';
import { useInView, useScene } from '../hooks/useScene';
import { HudTag, Reveal, RevealText } from '../ui';

function CountUp({ value, suffix, run }: { value: number; suffix: string; run: boolean }) {
  const [n, setN] = useState(run ? 0 : value);
  useEffect(() => {
    if (!run) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, value]);
  return (
    <>
      {n}
      {suffix}
    </>
  );
}

/** Harvest-Now-Decrypt-Later archive: packets flow into a sealed classical vault. */
function HarvestArchive({ t, yearRef }: { t: LandingCopy['harvest']; yearRef: React.RefObject<HTMLSpanElement | null> }) {
  const packets = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="relative landing-glass chamfer-card p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] border-b border-reb-border pb-3">
        <span className="text-reb-text-muted">{t.archiveLabel}</span>
        <span className="inline-flex items-center gap-1.5 text-reb-yellow">
          <span className="w-1.5 h-1.5 rounded-full bg-reb-yellow animate-pulse" />
          {t.archiveStatus}
        </span>
      </div>

      <svg viewBox="0 0 520 280" className="w-full h-auto mt-4" aria-hidden="true">
        {/* Data streams */}
        {[60, 110, 160, 210].map((y) => (
          <line key={y} x1="0" y1={y} x2="300" y2={140} stroke="#23332C" strokeDasharray="3 6" />
        ))}
        {packets.map((i) => {
          const lane = [60, 110, 160, 210][i % 4] ?? 140;
          return (
            <rect
              key={i}
              width="14"
              height="8"
              rx="1"
              fill={i % 3 === 0 ? '#F4729B' : '#5EEAD4'}
              className="hndl-packet"
              style={
                {
                  '--lane': `${lane - 140}px`,
                  animationDelay: `${(i * 0.37) % 4.2}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
        {/* Vault */}
        <g transform="translate(300 40)">
          <polygon
            points="20,0 200,0 220,20 220,200 200,200 0,200 0,20"
            fill="rgba(250,204,21,0.04)"
            stroke="#FACC15"
            strokeOpacity="0.6"
          />
          {Array.from({ length: 8 }, (_, r) => (
            <g key={r}>
              {Array.from({ length: 10 }, (_, c) => (
                <rect
                  key={c}
                  x={18 + c * 19}
                  y={22 + r * 21}
                  width="13"
                  height="13"
                  fill={(r * 10 + c) % 7 === 0 ? '#E14D79' : '#5EEAD4'}
                  fillOpacity={0.12 + ((r * 7 + c * 3) % 10) / 30}
                  className="hndl-cell"
                  style={{ animationDelay: `${((r * 10 + c) * 0.13) % 3}s` }}
                />
              ))}
            </g>
          ))}
          <text x="110" y="226" textAnchor="middle" className="bp-label" fill="#FACC15">
            RSA-2048 · ECC P-256
          </text>
        </g>
      </svg>

      <div className="mt-3 pt-4 border-t border-reb-border flex items-end justify-between gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-reb-text-muted">{t.yearLabel}</span>
        <span ref={yearRef} className="font-display text-4xl sm:text-5xl font-bold text-reb-yellow tabular-nums">
          2026
        </span>
      </div>
    </div>
  );
}

export function Harvest({ t, cinematic }: { t: LandingCopy['harvest']; cinematic: boolean }) {
  const root = useRef<HTMLElement | null>(null);
  const yearRef = useRef<HTMLSpanElement | null>(null);
  const [statsRef, statsIn] = useInView<HTMLDivElement>(0.4);

  // The 70-year clock runs with the scroll
  useScene(root, cinematic, ({ ScrollTrigger }) => {
    ScrollTrigger.create({
      trigger: root.current,
      start: 'top 75%',
      end: 'bottom 40%',
      scrub: true,
      onUpdate: (self) => {
        if (yearRef.current) yearRef.current.textContent = String(2026 + Math.round(self.progress * 70));
      },
    });
  });

  useEffect(() => {
    if (!cinematic && yearRef.current) yearRef.current.textContent = '2096';
  }, [cinematic]);

  return (
    <section id="present" ref={root} data-tone="mint" className="relative py-24 sm:py-36">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <HudTag tone="pink">{t.hudTag}</HudTag>
            <RevealText
              as="h2"
              text={t.title}
              className="block font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mt-4 text-reb-text-light"
            />
            <Reveal delay={150}>
              <p className="mt-6 text-base sm:text-lg text-reb-text-muted leading-relaxed max-w-xl">{t.lead}</p>
            </Reveal>
          </div>
          <Reveal className="lg:col-span-6" delay={100}>
            <HarvestArchive t={t} yearRef={yearRef} />
          </Reveal>
        </div>

        <div ref={statsRef} className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {t.stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 120}>
              <div className="h-full border-l-2 border-reb-mint/50 pl-5 py-2">
                <p className="font-display text-5xl sm:text-6xl font-bold text-reb-text-light tabular-nums">
                  <CountUp value={s.value} suffix={s.suffix} run={statsIn && cinematic} />
                </p>
                <p className="mt-2 text-sm text-reb-text-muted leading-relaxed max-w-xs">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
