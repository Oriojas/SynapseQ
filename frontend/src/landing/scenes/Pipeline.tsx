import { useEffect, useRef } from 'react';
import type { LandingCopy, Tone } from '../copy';
import { useScene } from '../hooks/useScene';
import { HudTag, Reveal, RevealText, TONE_BORDER, TONE_TEXT } from '../ui';

const STROKE: Record<Tone, string> = {
  mint: '#5EEAD4',
  blue: '#60A5FA',
  amber: '#FACC15',
  pink: '#F4729B',
};

/** Small blueprint glyph per layer: lock, envelope, chain anchor, key. */
function StepGlyph({ index, tone }: { index: number; tone: Tone }) {
  const c = STROKE[tone];
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24" aria-hidden="true" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="4" y="4" width="112" height="112" stroke="#23332C" strokeDasharray="2 5" />
      {index === 0 && (
        <>
          <rect x="32" y="54" width="56" height="40" />
          <path d="M 44 54 V 40 a 16 16 0 0 1 32 0 V 54" />
          <circle cx="60" cy="72" r="5" fill={c} />
          <line x1="60" y1="77" x2="60" y2="86" />
        </>
      )}
      {index === 1 && (
        <>
          <rect x="24" y="38" width="72" height="48" />
          <path d="M 24 38 L 60 66 L 96 38" />
          <path d="M 52 86 L 60 98 L 68 86" stroke="#F4729B" />
          <text x="60" y="30" textAnchor="middle" fill={c} stroke="none" fontSize="9" fontFamily="JetBrains Mono">KEM</text>
        </>
      )}
      {index === 2 && (
        <>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={18 + i * 30} y="48" width="24" height="24" transform={`rotate(45 ${30 + i * 30} 60)`} />
          ))}
          <line x1="14" y1="92" x2="106" y2="92" strokeDasharray="4 4" />
          <text x="60" y="108" textAnchor="middle" fill={c} stroke="none" fontSize="8" fontFamily="JetBrains Mono">0x5f3a…e9</text>
        </>
      )}
      {index === 3 && (
        <>
          <circle cx="42" cy="60" r="16" />
          <circle cx="42" cy="60" r="5" fill={c} />
          <path d="M 58 60 H 100 M 86 60 V 72 M 96 60 V 70" />
          <path d="M 20 24 L 34 24 L 34 34" stroke="#A8F0C6" />
          <path d="M 100 96 L 86 96 L 86 86" stroke="#A8F0C6" />
        </>
      )}
    </svg>
  );
}

/**
 * "How it works": 4 crypto layers. In cinematic mode the section is tall and its
 * inner frame is sticky; scrolling moves the cards sideways while each card
 * swings in from depth (rotateY + translateZ).
 */
export function Pipeline({ t, cinematic }: { t: LandingCopy['pipeline']; cinematic: boolean }) {
  const root = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Height of the scroll runway = horizontal travel + one viewport
  useEffect(() => {
    const section = root.current;
    const track = trackRef.current;
    if (!section || !track) return;
    if (!cinematic) {
      section.style.height = '';
      return;
    }
    const size = () => {
      const travel = Math.max(track.scrollWidth - window.innerWidth, 0);
      section.style.height = `${travel + window.innerHeight * 1.4}px`;
    };
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [cinematic, t]);

  useScene(
    root,
    cinematic,
    ({ gsap }) => {
      const track = trackRef.current;
      if (!track) return;
      const slide = gsap.to(track, {
        x: () => -Math.max(track.scrollWidth - window.innerWidth, 0),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
      gsap.utils.toArray<HTMLElement>('[data-step]').forEach((card) => {
        gsap.fromTo(
          card,
          { rotateY: -28, z: -260, opacity: 0.25 },
          {
            rotateY: 0,
            z: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              containerAnimation: slide,
              start: 'left 95%',
              end: 'center 55%',
              scrub: true,
            },
          }
        );
      });
    },
    [t]
  );

  return (
    <section ref={root} data-tone="blue" className="relative" aria-labelledby="pipeline-title">
      <div className={cinematic ? 'sticky top-0 h-[100svh] overflow-hidden flex flex-col justify-center' : 'py-24'}>
        <div className="max-w-7xl w-full mx-auto px-5 sm:px-8">
          <HudTag tone="blue">{t.hudTag}</HudTag>
          <h2 id="pipeline-title" className="font-display text-3xl sm:text-5xl font-bold leading-[1.08] mt-3 text-reb-text-light max-w-3xl">
            <RevealText text={t.title} />
          </h2>
          <p className="mt-4 text-base text-reb-text-muted max-w-2xl">{t.lead}</p>
        </div>

        <div className={cinematic ? 'mt-10 perspective-stage' : 'mt-10'}>
          <div
            ref={trackRef}
            className={
              cinematic
                ? 'flex gap-6 pl-5 sm:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] pr-[20vw] w-max preserve-3d'
                : 'max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-5'
            }
          >
            {t.steps.map((step, i) => (
              <article
                key={step.code}
                data-step
                className={`landing-glass chamfer-card p-6 sm:p-7 flex flex-col gap-5 border ${TONE_BORDER[step.tone]} ${
                  cinematic ? 'w-[min(78vw,420px)] shrink-0 min-h-[360px]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`font-mono text-xs font-bold tracking-[0.16em] ${TONE_TEXT[step.tone]}`}>{step.code}</span>
                  <StepGlyph index={i} tone={step.tone} />
                </div>
                <h3 className="font-display text-2xl font-bold text-reb-text-light">{step.title}</h3>
                <p className="text-sm sm:text-base text-reb-text-muted leading-relaxed">{step.body}</p>
                <span className={`mt-auto self-start px-2.5 py-1 border font-mono text-[11px] ${TONE_BORDER[step.tone]} ${TONE_TEXT[step.tone]}`}>
                  {step.spec}
                </span>
              </article>
            ))}
            <div className={cinematic ? 'w-[min(80vw,520px)] shrink-0 flex items-center' : 'md:col-span-2'}>
              <Reveal>
                <p className="font-display text-3xl sm:text-4xl font-bold leading-tight text-gradient-rebel">{t.tagline}</p>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
