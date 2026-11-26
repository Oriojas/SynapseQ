import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadGsap, type GsapKit } from '../motion/gsap';

/**
 * Runs a GSAP/ScrollTrigger setup scoped to `scope`, only when `enabled`.
 * Everything created inside is reverted on unmount or when `deps` change.
 */
export function useScene(
  scope: RefObject<HTMLElement | null>,
  enabled: boolean,
  setup: (kit: GsapKit, root: HTMLElement) => void,
  deps: readonly unknown[] = []
): void {
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    if (!enabled || !scope.current) return;
    let cancelled = false;
    let revert: (() => void) | undefined;

    loadGsap().then((kit) => {
      if (cancelled || !scope.current) return;
      const root = scope.current;
      const ctx = kit.gsap.context(() => setupRef.current(kit, root), root);
      revert = () => ctx.revert();
      kit.ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      revert?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}

/** Adds `is-in` once the element enters the viewport (used for CSS reveals). */
export function useInView<T extends HTMLElement>(
  threshold = 0.25
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView];
}
