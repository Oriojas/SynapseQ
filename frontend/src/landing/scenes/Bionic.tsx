import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Cpu } from 'lucide-react';
import type { BionicPartCopy, LandingCopy } from '../copy';
import { useInView, useScene } from '../hooks/useScene';
import { HudTag, Reveal, RevealText, TONE_BG, TONE_BORDER, TONE_TEXT } from '../ui';

/** Anchor on the body (%), callout side offset (px) and explode depth (px). */
const LAYOUT: Record<BionicPartCopy['id'], { x: number; y: number; ox: number; z: number }> = {
  cortex: { x: 50, y: 7, ox: -170, z: 190 },
  retina: { x: 56, y: 11.5, ox: 150, z: 120 },
  heart: { x: 45, y: 33, ox: -190, z: 150 },
  arm: { x: 79, y: 42, ox: 120, z: 230 },
};

/** Generic cyber-human silhouette built only from lines and nodes. */
function BodyWireframe() {
  return (
    <svg viewBox="0 0 300 560" className="absolute inset-0 w-full h-full" aria-hidden="true" fill="none">
      <g stroke="#23332C" strokeDasharray="3 6">
        <line x1="150" y1="0" x2="150" y2="560" />
        <line x1="0" y1="190" x2="300" y2="190" />
        <line x1="0" y1="330" x2="300" y2="330" />
      </g>
      {/* Head: faceted, no features */}
      <polygon points="150,18 178,34 176,72 150,88 124,72 122,34" stroke="#5EEAD4" strokeWidth="1.3" fill="rgba(94,234,212,0.05)" />
      <path d="M 132 52 L 146 52 M 156 52 L 170 52" stroke="#F4729B" strokeWidth="1.6" />
      <path d="M 140 88 L 140 104 M 160 88 L 160 104" stroke="#5B7569" />
      {/* Torso */}
      <polygon points="104,106 196,106 214,170 194,272 106,272 86,170" stroke="#A8F0C6" strokeOpacity="0.55" strokeWidth="1.2" fill="rgba(23,34,30,0.45)" />
      <path d="M 150 88 L 150 272 M 118 150 L 182 150 M 122 200 L 178 200" stroke="#3B66E8" strokeOpacity="0.6" />
      <circle cx="135" cy="184" r="16" stroke="#F4729B" strokeOpacity="0.7" />
      {/* Organic left arm */}
      <path d="M 104 106 L 66 150 L 56 238 L 60 300" stroke="#86A798" strokeWidth="1.3" strokeDasharray="5 4" />
      {/* Bionic right arm: angular, segmented */}
      <path d="M 196 106 L 236 148 L 244 214 L 234 286" stroke="#F4729B" strokeWidth="2.2" />
      <polygon points="230,176 256,176 252,222 230,222" stroke="#F4729B" fill="rgba(244,114,155,0.12)" />
      <path d="M 228 290 L 240 290 L 246 306 M 232 296 L 236 312" stroke="#FACC15" />
      {/* Legs */}
      <path d="M 118 272 L 108 420 L 112 540 M 182 272 L 192 420 L 188 540" stroke="#5B7569" strokeWidth="1.4" />
      <path d="M 108 420 L 122 420 M 192 420 L 178 420" stroke="#5EEAD4" strokeOpacity="0.6" />
      {/* Circuit traces at 45° */}
      <path d="M 150 230 L 170 250 L 170 300 L 196 326" stroke="#5EEAD4" strokeOpacity="0.45" />
      <path d="M 150 130 L 130 110 L 100 110" stroke="#FACC15" strokeOpacity="0.5" />
    </svg>
  );
}

function PartInspector({ part, labels }: { part: BionicPartCopy; labels: LandingCopy['bionic']['inspectorLabels'] }) {
  return (
    <AnimatePresence mode="wait">
      <m.div
        key={part.id}
        initial={{ opacity: 0, x: 24, filter: 'blur(6px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: -24, filter: 'blur(6px)' }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="landing-glass chamfer-card p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${TONE_TEXT[part.statusTone]}`}>[ {part.code} ]</span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border font-mono text-[11px] font-semibold ${TONE_BORDER[part.statusTone]} ${TONE_TEXT[part.statusTone]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${TONE_BG[part.statusTone]}`} />
            {part.status}
          </span>
        </div>
        <h3 className="font-display text-2xl sm:text-3xl font-bold text-reb-text-light mt-4 flex items-center gap-3">
          <Cpu className="w-6 h-6 text-reb-pink shrink-0" />
          {part.name}
        </h3>
        <p className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted mt-1">{part.zone}</p>
        <p className="text-reb-text-muted text-base leading-relaxed mt-4">{part.story}</p>
        <dl className="mt-6 pt-5 border-t border-reb-border grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">{labels.oem}</dt>
            <dd className="text-sm text-reb-text-light font-medium mt-1">{part.oem}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">{labels.pass}</dt>
            <dd className="text-sm text-reb-mint font-medium mt-1">{part.passWindow}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-reb-text-muted">{labels.firmware}</dt>
            <dd className="font-mono text-xs text-reb-pink mt-1.5">{part.firmwareHash} · ML-DSA-87</dd>
          </div>
        </dl>
      </m.div>
    </AnimatePresence>
  );
}

/**
 * Act II: the augmented body as a 3D exploded blueprint. In cinematic mode the
 * stage rotates and every part plate travels out along Z (with a stem back to
 * its anchor) as the user scrolls.
 */
export function Bionic({ t, cinematic }: { t: LandingCopy['bionic']; cinematic: boolean }) {
  const root = useRef<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const part = t.parts[selectedIndex] ?? t.parts[0]!;
  const selected = part.id;

  // Calm mode (mobile / reduced motion): the scanner cycles on its own while visible
  const [runwayRef, runwayIn] = useInView<HTMLDivElement>(0.3);
  useEffect(() => {
    if (cinematic || !runwayIn) return;
    const id = window.setInterval(() => setSelectedIndex((i) => (i + 1) % t.parts.length), 3200);
    return () => window.clearInterval(id);
  }, [cinematic, runwayIn, t.parts.length]);

  useScene(root, cinematic, ({ gsap }) => {
    const count = t.parts.length;
    const st = {
      trigger: '[data-bionic-runway]',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      // Cinematic mode: scroll position decides which part the scanner inspects
      onUpdate: (self: { progress: number }) => {
        const idx = Math.min(count - 1, Math.floor(self.progress * count));
        setSelectedIndex((prev) => (prev === idx ? prev : idx));
      },
    };
    const tl = gsap.timeline({ scrollTrigger: st });
    tl.fromTo('[data-stage]', { rotateY: 0, rotateX: 4 }, { rotateY: -40, rotateX: 14, ease: 'none' }, 0);
    gsap.utils.toArray<HTMLElement>('[data-part]').forEach((el) => {
      const z = Number(el.dataset.z ?? 150);
      tl.fromTo(el, { '--z': 0, '--reach': 0 }, { '--z': z, '--reach': 1, ease: 'power2.out' }, 0.05);
    });
    tl.fromTo('[data-body-scan]', { yPercent: -10 }, { yPercent: 960, ease: 'none' }, 0);
  });

  return (
    <section id="future" ref={root} data-tone="pink" className="relative pt-24 sm:pt-32">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-3xl">
          <HudTag tone="pink">{t.hudTag}</HudTag>
          <RevealText
            as="h2"
            text={t.title}
            className="block font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mt-4 text-reb-text-light"
          />
          <Reveal delay={120}>
            <p className="mt-6 text-base sm:text-lg text-reb-text-muted leading-relaxed">{t.lead}</p>
          </Reveal>
        </div>
      </div>

      <div ref={runwayRef} data-bionic-runway className={cinematic ? 'relative h-[230vh]' : 'relative py-14'}>
        <div className={cinematic ? 'sticky top-0 h-[100svh] flex items-center' : ''}>
          <div className="max-w-7xl w-full mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 perspective-stage-deep">
              <div
                data-stage
                className="bionic-stage relative mx-auto preserve-3d"
                style={cinematic ? undefined : { transform: 'rotateY(-22deg) rotateX(10deg)' }}
              >
                <BodyWireframe />
                <span data-body-scan className="absolute inset-x-[18%] top-0 h-[10%] bg-gradient-to-b from-transparent via-reb-pink/25 to-transparent pointer-events-none" aria-hidden="true" />
                {t.parts.map((p) => {
                  const L = LAYOUT[p.id];
                  const active = p.id === selected;
                  return (
                    <div
                      key={p.id}
                      data-part
                      data-z={L.z}
                      className="bionic-part preserve-3d"
                      style={
                        {
                          left: `${L.x}%`,
                          top: `${L.y}%`,
                          '--z': cinematic ? 0 : L.z * 0.7,
                          '--reach': cinematic ? 0 : 1,
                          '--ox': L.ox,
                        } as React.CSSProperties
                      }
                    >
                      <span className={`bionic-anchor ${TONE_BG[p.statusTone]}`} />
                      <span className="bionic-stem" />
                      <div className="bionic-plate-layer preserve-3d">
                        <span className={`bionic-leader ${L.ox < 0 ? 'is-left' : ''}`} />
                        <span
                          className={`bionic-plate chamfer-btn text-left ${L.ox < 0 ? 'is-left' : ''} ${
                            active ? `is-active ${TONE_BORDER[p.statusTone]}` : 'border-reb-border'
                          }`}
                        >
                          <span className={`block font-mono text-[10px] tracking-[0.12em] ${TONE_TEXT[p.statusTone]}`}>{p.code}</span>
                          <span className="block font-display text-sm font-bold text-reb-text-light mt-0.5">{p.name}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-center font-mono text-[11px] text-reb-text-muted">{t.hint}</p>
            </div>
            <div className="lg:col-span-5">
              <PartInspector part={part} labels={t.inspectorLabels} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-24 sm:pb-32">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-reb-pink">{t.lifecycleTitle}</p>
        <ol className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {t.lifecycle.map((step, i) => (
            <li key={step.code}>
              <Reveal delay={i * 120} className="relative h-full landing-glass chamfer-card p-6">
                <span className="font-mono text-[11px] font-bold tracking-[0.16em] text-reb-yellow">
                  0{i + 1} · {step.code}
                </span>
                <h3 className="font-display text-lg font-bold text-reb-text-light mt-2">{step.title}</h3>
                <p className="text-sm text-reb-text-muted leading-relaxed mt-2">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="mt-6 font-mono text-[11px] leading-relaxed text-reb-yellow/90 border-l-2 border-reb-yellow/60 pl-3 max-w-3xl">
          {t.honestNote}
        </p>
      </div>
    </section>
  );
}
