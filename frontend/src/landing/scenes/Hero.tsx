import { useRef } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { LandingCopy } from '../copy';
import { BlueprintIris } from '../blueprint/BlueprintIris';
import { useScene } from '../hooks/useScene';
import { scrollToAnchor } from '../hooks/useLenis';
import { DAPP_BASE_URL, MagneticCta, RevealText } from '../ui';

export function Hero({ t, cinematic }: { t: LandingCopy['hero']; cinematic: boolean }) {
  const root = useRef<HTMLElement | null>(null);

  // Scroll-out: the iris dives toward the camera while the copy lifts away
  useScene(root, cinematic, ({ gsap }) => {
    const st = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('[data-hero-iris]', { scale: 2.1, opacity: 0, rotate: 12, ease: 'none', scrollTrigger: st });
    gsap.to('[data-hero-copy]', { yPercent: -35, opacity: 0, ease: 'none', scrollTrigger: st });
    gsap.to('[data-hero-strip]', { y: -40, opacity: 0, ease: 'none', scrollTrigger: st });
  });

  return (
    <section
      id="vision"
      ref={root}
      data-tone="mint"
      className="relative min-h-[100svh] flex flex-col justify-center pt-24 pb-10 overflow-hidden"
    >
      <div className="max-w-7xl w-full mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
        <div data-hero-copy className="lg:col-span-6 relative z-10">
          <div className="hero-enter inline-flex items-center gap-2 px-3 py-1 rounded-full bg-reb-bg/70 border border-reb-mint/30 font-mono text-[11px] uppercase tracking-[0.16em] text-reb-mint mb-7 backdrop-blur">
            <Sparkles className="w-3 h-3 text-reb-pink" />
            <span>{t.hudBadge}</span>
          </div>

          <h1 className="font-display font-bold tracking-tight leading-[1.02] text-[2.6rem] sm:text-6xl xl:text-7xl">
            <RevealText text={t.headlineA} className="block text-reb-text-light" />
            <RevealText text={t.headlineB} className="block text-gradient-rebel mt-1" delay={260} />
          </h1>

          <p className="hero-enter hero-enter-2 mt-7 text-base sm:text-lg text-reb-text-muted leading-relaxed max-w-xl">
            {t.subtitle}
          </p>

          <div className="hero-enter hero-enter-3 mt-9 flex flex-wrap items-center gap-4">
            <MagneticCta href={DAPP_BASE_URL}>{t.ctaPrimary}</MagneticCta>
            <MagneticCta
              href="#present"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                scrollToAnchor('#present');
              }}
            >
              {t.ctaSecondary}
              <ChevronDown className="w-4 h-4 text-reb-mint" />
            </MagneticCta>
          </div>
        </div>

        <div className="lg:col-span-6 relative">
          <div data-hero-iris className="relative mx-auto max-w-[560px] will-change-transform">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-reb-text-muted mb-2 px-2">
              <span className="text-reb-mint">{t.irisTop}</span>
              <span className="inline-flex items-center gap-1.5 text-reb-pink">
                <span className="w-1.5 h-1.5 rounded-full bg-reb-pink animate-pulse" />
                {t.irisStatus}
              </span>
            </div>
            <BlueprintIris labels={t.irisLabels} trackRef={root} />
            <p className="hidden sm:block text-center font-mono text-[11px] text-reb-text-muted -mt-6">
              {t.irisCaption}
            </p>
          </div>
        </div>
      </div>

      <div data-hero-strip className="max-w-7xl w-full mx-auto px-5 sm:px-8 mt-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {t.trustItems.map((item) => (
            <div
              key={item.label}
              className="px-4 py-3 bg-reb-bg/55 backdrop-blur border border-reb-border flex items-center justify-between gap-2 chamfer-btn"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-reb-text-muted">
                {item.label}
              </span>
              <span className="font-mono text-xs font-semibold text-reb-mint">{item.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-reb-text-muted">
          <span className="scroll-cue" aria-hidden="true" />
          {t.scrollHint}
        </p>
      </div>
    </section>
  );
}
