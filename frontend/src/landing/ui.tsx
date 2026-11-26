import React, { useRef } from 'react';
import { m, useMotionValue, useSpring } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { Tone } from './copy';
import { useInView } from './hooks/useScene';

export const DAPP_BASE_URL =
  (import.meta.env.VITE_DAPP_URL as string | undefined)?.trim() || '/';
export const GITHUB_REPO_URL =
  (import.meta.env.VITE_GITHUB_URL as string | undefined)?.trim() ||
  'https://github.com/Oriojas/SynapseQ';

export function buildModuleUrl(tab: string): string {
  const separator = DAPP_BASE_URL.includes('?') ? '&' : '?';
  return `${DAPP_BASE_URL}${separator}tab=${encodeURIComponent(tab)}`;
}

export const TONE_TEXT: Record<Tone, string> = {
  mint: 'text-reb-mint',
  pink: 'text-reb-pink',
  amber: 'text-reb-yellow',
  blue: 'text-reb-periwinkle',
};

export const TONE_BORDER: Record<Tone, string> = {
  mint: 'border-reb-mint/40',
  pink: 'border-reb-pink/45',
  amber: 'border-reb-yellow/45',
  blue: 'border-reb-periwinkle/45',
};

export const TONE_BG: Record<Tone, string> = {
  mint: 'bg-reb-mint',
  pink: 'bg-reb-pink',
  amber: 'bg-reb-yellow',
  blue: 'bg-reb-periwinkle',
};

/** Mono HUD micro-label: [ ACT I // ... ] */
export function HudTag({ children, tone = 'mint', className = '' }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <p className={`font-mono text-xs uppercase tracking-[0.18em] ${TONE_TEXT[tone]} ${className}`}>
      <span className="opacity-60">[ </span>
      {children}
      <span className="opacity-60"> ]</span>
    </p>
  );
}

/**
 * Word-by-word reveal driven by CSS (no DOM mutation, so it is safe with the
 * ES/EN switch). Words slide up from a mask when the block enters the viewport.
 */
export function RevealText({
  text,
  as: Tag = 'span',
  className = '',
  delay = 0,
}: {
  text: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
  delay?: number;
}) {
  const [ref, inView] = useInView<HTMLElement>(0.2);
  const words = text.split(' ').filter(Boolean);
  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={`reveal-words ${inView ? 'is-in' : ''} ${className}`}
    >
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="reveal-word" aria-hidden="true">
          <span style={{ transitionDelay: `${delay + i * 38}ms` }}>{w}</span>
        </span>
      ))}
    </Tag>
  );
}

/** Generic fade/slide reveal for blocks. */
export function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      className={`reveal-block ${inView ? 'is-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Chamfered CTA with a magnetic pull toward the cursor. */
export function MagneticCta({
  href,
  children,
  variant = 'primary',
  external = false,
  onClick,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  external?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.22);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.32);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const styles =
    variant === 'primary'
      ? 'bg-reb-mint hover:bg-reb-mint-bright text-reb-bg shadow-[0_0_32px_rgba(94,234,212,0.35)]'
      : 'bg-reb-bg/60 hover:bg-reb-surface-card border border-reb-border hover:border-reb-mint/60 text-reb-text-light backdrop-blur';

  return (
    <m.a
      ref={ref}
      href={href}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={`chamfer-btn group inline-flex items-center gap-2 px-6 py-3.5 font-mono text-xs sm:text-sm font-bold tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-reb-mint ${styles} ${className}`}
    >
      {children}
      {variant === 'primary' && (
        <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      )}
    </m.a>
  );
}
