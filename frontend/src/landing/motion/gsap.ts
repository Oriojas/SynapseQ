/**
 * Lazy GSAP loader: the ~40 KB of GSAP + ScrollTrigger is split into its own
 * chunk and only fetched when the cinematic mode is enabled.
 */
import type { gsap as GsapType } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';

export interface GsapKit {
  readonly gsap: typeof GsapType;
  readonly ScrollTrigger: typeof ScrollTriggerType;
}

let kitPromise: Promise<GsapKit> | null = null;

export function loadGsap(): Promise<GsapKit> {
  if (!kitPromise) {
    kitPromise = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([g, st]) => {
        g.gsap.registerPlugin(st.ScrollTrigger);
        return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger };
      }
    );
  }
  return kitPromise;
}
