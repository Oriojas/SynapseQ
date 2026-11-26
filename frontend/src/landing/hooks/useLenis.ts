import { useEffect } from 'react';
import { loadGsap } from '../motion/gsap';

type LenisLike = {
  raf: (time: number) => void;
  on: (event: 'scroll', cb: () => void) => void;
  scrollTo: (target: Element | number, opts?: { offset?: number; duration?: number }) => void;
  destroy: () => void;
};

let activeLenis: LenisLike | null = null;

/** Smooth-scroll to an in-page anchor, through Lenis when it is active. */
export function scrollToAnchor(hash: string): void {
  const el = document.querySelector(hash);
  if (!el) return;
  if (activeLenis) activeLenis.scrollTo(el, { offset: -64, duration: 1.6 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Lenis smooth scroll, driven by the GSAP ticker so ScrollTrigger scrubs stay
 * perfectly in sync. Disabled when cinematic mode is off (reduced motion / mobile).
 */
export function useLenis(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    Promise.all([import('lenis'), loadGsap()]).then(([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
      if (cancelled) return;
      const lenis = new Lenis({ duration: 1.25, smoothWheel: true }) as unknown as LenisLike;
      activeLenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        activeLenis = null;
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enabled]);
}
