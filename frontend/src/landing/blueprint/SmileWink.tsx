import React from 'react';
import { useInView } from '../hooks/useScene';

/**
 * Closing easter egg: a round blueprint badge with a sharp-toothed grin,
 * bicolour concentric eyes (one winking) and two cable tufts. Pure vector,
 * no character art, no names.
 */
export function SmileWink({ caption }: { caption: string }): React.JSX.Element {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const teeth = Array.from({ length: 9 }, (_, i) => 34 + i * 6.5);

  return (
    <div ref={ref} className={`smile-wink ${inView ? 'is-in' : ''} flex items-center gap-3`}>
      <svg viewBox="0 0 120 120" className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 overflow-visible" aria-hidden="true" fill="none">
        {/* Cable tufts */}
        <g className="smile-draw" strokeLinecap="round" strokeWidth="1.6">
          {/* Side bundles hanging from the temples */}
          <path d="M 18 34 C -2 34, -8 56, -2 84" stroke="#F4729B" pathLength={1} />
          <path d="M 20 40 C 4 44, 2 62, 6 88" stroke="#5EEAD4" pathLength={1} />
          <path d="M 102 34 C 122 34, 128 56, 122 84" stroke="#F4729B" pathLength={1} />
          <path d="M 100 40 C 116 44, 118 62, 114 88" stroke="#5EEAD4" pathLength={1} />
        </g>
        {/* Rotating chamfer ring */}
        <g className="smile-ring">
          <circle cx="60" cy="60" r="54" stroke="#5EEAD4" strokeWidth="1.2" strokeDasharray="22 6 4 6" strokeOpacity="0.8" />
        </g>
        <circle cx="60" cy="60" r="46" fill="#0B100E" stroke="#23332C" />
        {/* Eyes: left concentric, right winks */}
        <g>
          <circle cx="44" cy="50" r="8" stroke="#A8F0C6" strokeWidth="1.4" />
          <circle cx="44" cy="50" r="3.2" fill="#E14D79" />
        </g>
        <g className="smile-wink-eye">
          <circle cx="76" cy="50" r="8" stroke="#FACC15" strokeWidth="1.4" />
          <circle cx="76" cy="50" r="3.2" fill="#E14D79" />
        </g>
        <path className="smile-wink-lid" d="M 68 51 Q 76 44 84 51" stroke="#FACC15" strokeWidth="1.6" strokeLinecap="round" />
        {/* Grin with sharp teeth */}
        <path d="M 30 66 Q 60 98 90 66 Z" fill="rgba(225,77,121,0.25)" stroke="#F4729B" strokeWidth="1.4" strokeLinejoin="round" />
        <polyline
          points={teeth.map((x, i) => `${x},${i % 2 === 0 ? 67 : 75}`).join(' ')}
          stroke="#F1F5F9"
          strokeWidth="1.2"
          strokeLinejoin="miter"
        />
        {/* Cheek tick marks, blueprint style */}
        <path d="M 22 70 L 28 70 M 92 70 L 98 70" stroke="#86A798" />
      </svg>
      <p className="font-mono text-xs leading-snug text-reb-text-light">
        <span className="text-reb-pink">{'>'}</span> {caption}
        <span className="smile-caret" aria-hidden="true">_</span>
      </p>
    </div>
  );
}
