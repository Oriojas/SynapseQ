import React, { useEffect } from 'react';
import { m, useMotionValue, useSpring } from 'motion/react';

/**
 * Hero visual: the dual-chromatic concentric eye, drawn as a technical
 * blueprint (dimension lines, callouts, 45° fractures) instead of a portrait.
 * Two cable bundles leave the iris and run down the page (the "pigtails").
 */
export function BlueprintIris({
  labels,
  trackRef,
}: {
  labels: readonly string[];
  trackRef: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 16 });
  const sy = useSpring(py, { stiffness: 120, damping: 16 });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      px.set(((e.clientX - r.left) / r.width - 0.5) * 36);
      py.set(((e.clientY - r.top) / r.height - 0.5) * 36);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [trackRef, px, py]);

  const ticks = Array.from({ length: 48 }, (_, i) => i * 7.5);

  return (
    <svg
      viewBox="0 0 560 640"
      className="w-full h-auto overflow-visible select-none"
      role="img"
      aria-label="Blueprint of a dual-ring iris"
    >
      <defs>
        <radialGradient id="bpCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F4729B" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#E14D79" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0B100E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bpMint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A8F0C6" />
          <stop offset="60%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#3B66E8" />
        </linearGradient>
        <linearGradient id="bpPink" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FACC15" />
          <stop offset="50%" stopColor="#F4729B" />
          <stop offset="100%" stopColor="#E14D79" />
        </linearGradient>
        <linearGradient id="bpCable" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3B66E8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bpCablePink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4729B" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E14D79" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform="translate(280 270)">
        {/* Construction circles + crosshair */}
        <g className="bp-draw" stroke="#23332C" fill="none" strokeWidth="1">
          <circle r="232" pathLength={1} strokeDasharray="0.004 0.012" />
          <circle r="196" pathLength={1} />
          <line x1="-262" y1="0" x2="262" y2="0" pathLength={1} />
          <line x1="0" y1="-262" x2="0" y2="262" pathLength={1} />
          <line x1="-190" y1="-190" x2="190" y2="190" pathLength={1} strokeOpacity="0.6" />
          <line x1="190" y1="-190" x2="-190" y2="190" pathLength={1} strokeOpacity="0.6" />
        </g>

        {/* Degree ticks */}
        <g stroke="#5EEAD4" strokeOpacity="0.35">
          {ticks.map((deg) => (
            <line
              key={deg}
              x1="0"
              y1={-214}
              x2="0"
              y2={deg % 45 === 0 ? -228 : -220}
              transform={`rotate(${deg})`}
              strokeOpacity={deg % 45 === 0 ? 0.8 : 0.35}
            />
          ))}
        </g>

        {/* 45° chrome fractures (tattoo homage) */}
        <g className="bp-draw bp-delay-1" fill="none" strokeWidth="1.4">
          <path d="M -250 -150 L -210 -190 L -150 -190" stroke="#A8F0C6" pathLength={1} />
          <path d="M 250 -150 L 210 -190 L 150 -190" stroke="#F4729B" pathLength={1} />
          <path d="M -250 150 L -210 190 L -150 190" stroke="#F4729B" pathLength={1} />
          <path d="M 250 150 L 210 190 L 150 190" stroke="#A8F0C6" pathLength={1} />
          <path d="M -120 -238 L -96 -214 L -40 -214" stroke="#FACC15" strokeOpacity="0.7" pathLength={1} />
        </g>

        {/* Outer ring: mint → blue (rotating) */}
        <g className="animate-orbit-slow">
          <circle r="168" fill="none" stroke="url(#bpMint)" strokeWidth="2" strokeDasharray="70 16 10 16" strokeOpacity="0.85" />
          <circle r="150" fill="none" stroke="#A8F0C6" strokeWidth="0.8" strokeDasharray="2 9" strokeOpacity="0.55" />
          <polygon points="0,-178 7,-164 -7,-164" fill="#A8F0C6" />
          <polygon points="0,178 7,164 -7,164" fill="#F4729B" />
        </g>

        {/* Inner ring: amber → pink (counter-rotating) */}
        <g className="animate-orbit-reverse">
          <circle r="116" fill="none" stroke="url(#bpPink)" strokeWidth="3" strokeDasharray="84 22 20 22" strokeOpacity="0.92" />
          <circle r="96" fill="none" stroke="#FACC15" strokeWidth="1" strokeDasharray="10 14" strokeOpacity="0.7" />
        </g>

        {/* Core follows the cursor */}
        <m.g style={{ x: sx, y: sy }}>
          <circle r="82" fill="url(#bpCore)" className="animate-pulse-ring" />
          <circle r="58" fill="#0B100E" fillOpacity="0.78" stroke="#F4729B" strokeWidth="2" />
          <circle r="38" fill="none" stroke="#FACC15" strokeWidth="1.5" strokeDasharray="18 7" />
          <circle r="18" fill="#E14D79" />
          <circle r="6" fill="#A8F0C6" />
          <line x1="-70" y1="0" x2="-48" y2="0" stroke="#A8F0C6" strokeWidth="1" />
          <line x1="48" y1="0" x2="70" y2="0" stroke="#A8F0C6" strokeWidth="1" />
        </m.g>

        {/* Dimension line: Ø */}
        <g className="bp-draw bp-delay-2" stroke="#86A798" strokeWidth="0.8" fill="none">
          <line x1="-168" y1="236" x2="168" y2="236" pathLength={1} />
          <line x1="-168" y1="228" x2="-168" y2="244" pathLength={1} />
          <line x1="168" y1="228" x2="168" y2="244" pathLength={1} />
        </g>
        <text x="0" y="254" textAnchor="middle" className="bp-label" fill="#86A798">
          Ø 336 · R 168 / 116 / 58
        </text>

        {/* Callouts */}
        <g className="bp-draw bp-delay-3" fill="none" strokeWidth="0.9">
          <path d="M 120 -118 L 176 -174 L 270 -174" stroke="#5EEAD4" pathLength={1} />
          <path d="M -82 -82 L -150 -150 L -270 -150" stroke="#F4729B" pathLength={1} />
          <path d="M 40 40 L 120 120 L 270 120" stroke="#FACC15" pathLength={1} />
        </g>
        <text x="270" y="-182" textAnchor="end" className="bp-label" fill="#5EEAD4">{labels[0]}</text>
        <text x="-270" y="-158" textAnchor="start" className="bp-label" fill="#F4729B">{labels[1]}</text>
        <text x="270" y="112" textAnchor="end" className="bp-label" fill="#FACC15">{labels[2]}</text>

        {/* Pigtails: two cable bundles leaving the iris downwards */}
        <g className="bp-draw bp-delay-2 bp-cables" fill="none" strokeLinecap="round">
          {[0, 7, 14].map((o) => (
            <path
              key={`l${o}`}
              d={`M ${-150 - o} ${70 + o} C ${-260 - o} 160, ${-200 - o} 300, ${-262 - o} 420`}
              stroke="url(#bpCable)"
              strokeWidth={o === 7 ? 2 : 1}
              pathLength={1}
            />
          ))}
          {[0, 7, 14].map((o) => (
            <path
              key={`r${o}`}
              d={`M ${150 + o} ${70 + o} C ${260 + o} 160, ${200 + o} 300, ${262 + o} 420`}
              stroke="url(#bpCablePink)"
              strokeWidth={o === 7 ? 2 : 1}
              pathLength={1}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
