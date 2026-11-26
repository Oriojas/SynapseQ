import React, { useRef } from 'react';
import type { LandingCopy } from '../copy';
import { useScene } from '../hooks/useScene';
import { HudTag } from '../ui';

/**
 * Q-Day transition. A tall runway with a sticky frame: scrolling drives the
 * year (2026 → 2045), reveals the three lines and fractures the grid. The WebGL
 * tunnel reads data-tone="amber" and switches to its glitch palette.
 */
export function QDay({ t, cinematic }: { t: LandingCopy['qday']; cinematic: boolean }) {
  const root = useRef<HTMLElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const yearRef = useRef<HTMLSpanElement | null>(null);

  useScene(root, cinematic, ({ ScrollTrigger }) => {
    ScrollTrigger.create({
      trigger: root.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        frame.current?.style.setProperty('--p', p.toFixed(4));
        frame.current?.classList.toggle('is-glitching', p > 0.42 && p < 0.62);
        if (yearRef.current) yearRef.current.textContent = String(2026 + Math.round(p * 19));
      },
    });
  });

  return (
    <section
      id="qday"
      ref={root}
      data-tone="amber"
      className={cinematic ? 'relative h-[280vh]' : 'relative py-28'}
      aria-label="Q-Day"
    >
      <div
        ref={frame}
        className={`qday-frame ${cinematic ? 'sticky top-0 h-[100svh]' : 'qday-static'} overflow-hidden flex items-center`}
        style={{ '--p': cinematic ? 0 : 1 } as React.CSSProperties}
      >
        {/* Fracturing blueprint grid */}
        <svg className="qday-grid absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1="0" x2="100" y1={(i + 1) * 10} y2={(i + 1) * 10} className="qday-line" style={{ '--d': (i % 3) - 1 } as React.CSSProperties} />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} y1="0" y2="100" x1={(i + 1) * 10} x2={(i + 1) * 10} className="qday-line" style={{ '--d': ((i + 1) % 3) - 1 } as React.CSSProperties} />
          ))}
        </svg>

        <div className="relative max-w-7xl w-full mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <HudTag tone="amber">{t.hudTag}</HudTag>
            <div className="mt-6 flex items-end gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-reb-text-muted">
              <span>{t.fromLabel} · 2026</span>
              <span className="flex-1 h-px bg-reb-border relative overflow-hidden mb-1.5">
                <span className="qday-bar absolute inset-y-0 left-0 bg-gradient-to-r from-reb-mint via-reb-yellow to-reb-pink" />
              </span>
              <span>{t.toLabel} · 2045</span>
            </div>
            <p className="qday-year font-display font-bold tabular-nums leading-none mt-4" aria-hidden="true">
              <span ref={yearRef}>{cinematic ? '2026' : '2045'}</span>
            </p>
            <p className="qday-warning mt-5 inline-flex items-center gap-2 px-3 py-1.5 border border-reb-crimson/70 bg-reb-crimson/10 font-mono text-xs font-bold tracking-[0.16em] text-reb-pink">
              <span className="w-2 h-2 bg-reb-crimson animate-pulse" />
              {t.warning}
            </p>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {t.lines.map((line, i) => (
              <p
                key={line}
                className="qday-text font-display text-3xl sm:text-5xl font-bold leading-[1.1]"
                style={{ '--i': i } as React.CSSProperties}
                data-text={line}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
