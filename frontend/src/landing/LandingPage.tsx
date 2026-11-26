import React, { useEffect, useRef, useState } from 'react';
import { domAnimation, LazyMotion, m, MotionConfig } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { LANDING_COPY, type Locale } from './copy';
import { SynapticTunnel } from './gl/SynapticTunnel';
import { useMotionPrefs } from './hooks/useMotionPrefs';
import { scrollToAnchor, useLenis } from './hooks/useLenis';
import { loadGsap } from './motion/gsap';
import { Hero } from './scenes/Hero';
import { Harvest } from './scenes/Harvest';
import { Pipeline } from './scenes/Pipeline';
import { KillSwitch } from './scenes/KillSwitch';
import { QDay } from './scenes/QDay';
import { Bionic } from './scenes/Bionic';
import { Audience, Footer, Manifesto, Modules } from './scenes/Closing';
import { DAPP_BASE_URL } from './ui';

function detectLocale(): Locale {
  const saved = window.localStorage.getItem('synapseq.locale');
  if (saved === 'es' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Thin HUD rail showing how far through the journey the visitor is. */
function JourneyRail() {
  const bar = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      bar.current?.style.setProperty('transform', `scaleX(${p})`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <span className="absolute left-0 right-0 bottom-0 h-px bg-reb-border/60 overflow-hidden" aria-hidden="true">
      <span ref={bar} className="block h-full origin-left bg-gradient-to-r from-reb-mint via-reb-yellow to-reb-pink" style={{ transform: 'scaleX(0)' }} />
    </span>
  );
}

export function LandingPage(): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>(() => detectLocale());
  const t = LANDING_COPY[locale];
  const prefs = useMotionPrefs();

  useLenis(prefs.cinematic);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem('synapseq.locale', locale);
    // Text length changes the layout: let ScrollTrigger re-measure
    if (prefs.cinematic) loadGsap().then(({ ScrollTrigger }) => requestAnimationFrame(() => ScrollTrigger.refresh()));
  }, [locale, prefs.cinematic]);

  const navLinks: { href: string; label: string }[] = [
    { href: '#vision', label: t.nav.vision },
    { href: '#present', label: t.nav.present },
    { href: '#future', label: t.nav.future },
    { href: '#modules', label: t.nav.modules },
  ];

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className={`relative min-h-screen bg-reb-bg text-reb-text-light overflow-x-clip ${prefs.cinematic ? 'is-cinematic' : 'is-calm'}`}>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:bg-reb-mint focus:text-reb-bg font-mono text-xs">
            {t.nav.skip}
          </a>

          <SynapticTunnel tier={prefs.tier} />
          <div className="pointer-events-none fixed inset-0 z-[1] landing-vignette" aria-hidden="true" />
          <div className="pointer-events-none fixed inset-0 z-[1] synapse-grid-bg opacity-40" aria-hidden="true" />

          <header className="fixed top-0 inset-x-0 z-50">
            <div className="relative border-b border-reb-border/60 bg-reb-bg/55 backdrop-blur-xl">
              <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
                <a
                  href="#vision"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToAnchor('#vision');
                  }}
                  className="flex items-center gap-3 group"
                >
                  <span className="relative flex items-center justify-center w-9 h-9 bg-reb-surface-card border border-reb-mint/40 group-hover:border-reb-mint transition-colors chamfer-btn">
                    <span className="w-4 h-4 rounded-full border-2 border-reb-mint flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-reb-pink" />
                    </span>
                  </span>
                  <span className="leading-none">
                    <span className="font-display font-bold text-lg tracking-tight text-reb-text-light">
                      Synapse<span className="text-reb-mint">Q</span>
                    </span>
                    <span className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.16em] text-reb-text-muted mt-0.5">PQC · HBOM VAULT</span>
                  </span>
                </a>

                <nav className="hidden md:flex items-center gap-7 font-mono text-xs uppercase tracking-[0.14em] text-reb-text-muted" aria-label="Main">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToAnchor(l.href);
                      }}
                      className="hover:text-reb-mint transition-colors"
                    >
                      {l.label}
                    </a>
                  ))}
                </nav>

                <div className="flex items-center gap-3">
                  <div role="group" aria-label="Language" className="relative inline-flex items-center p-0.5 bg-reb-surface border border-reb-border font-mono text-[11px] rounded-full">
                    {(['es', 'en'] as const).map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLocale(code)}
                        aria-pressed={locale === code}
                        className={`relative px-2.5 py-1 rounded-full cursor-pointer transition-colors ${locale === code ? 'text-reb-bg font-bold' : 'text-reb-text-muted hover:text-reb-text-light'}`}
                      >
                        {locale === code && (
                          <m.span layoutId="lang-pill" className="absolute inset-0 rounded-full bg-reb-mint" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                        )}
                        <span className="relative">{code.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                  <a
                    href={DAPP_BASE_URL}
                    className="chamfer-btn hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-reb-mint hover:bg-reb-mint-bright text-reb-bg font-mono text-xs font-bold tracking-wider transition-colors shadow-[0_0_20px_rgba(168,240,198,0.28)]"
                  >
                    {t.nav.launchDapp}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
              <JourneyRail />
            </div>
          </header>

          <main id="main" className="relative z-10">
            <Hero t={t.hero} cinematic={prefs.cinematic} />
            <Harvest t={t.harvest} cinematic={prefs.cinematic} />
            <Pipeline t={t.pipeline} cinematic={prefs.cinematic} />
            <KillSwitch t={t.killSwitch} />
            <QDay t={t.qday} cinematic={prefs.cinematic} />
            <Bionic t={t.bionic} cinematic={prefs.cinematic} />
            <Audience t={t.audience} />
            <Modules t={t.modules} />
            <Manifesto t={t.manifesto} />
          </main>
          <Footer t={t.footer} />
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
