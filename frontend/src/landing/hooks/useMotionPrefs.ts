import { useEffect, useState } from 'react';

export type DeviceTier = 'high' | 'low' | 'static';

export interface MotionPrefs {
  /** User asked the OS for reduced motion. */
  readonly reduced: boolean;
  /** high = full WebGL + pins, low = lighter WebGL + pins off on small screens, static = no WebGL. */
  readonly tier: DeviceTier;
  /** Cinematic scroll (Lenis + pinned scenes) is enabled. */
  readonly cinematic: boolean;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function compute(): MotionPrefs {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 767px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;

  let tier: DeviceTier = 'high';
  if (reduced || !hasWebGL()) tier = 'static';
  else if (small || coarse || cores <= 4) tier = 'low';

  return { reduced, tier, cinematic: !reduced && !small };
}

export function useMotionPrefs(): MotionPrefs {
  const [prefs, setPrefs] = useState<MotionPrefs>(() =>
    typeof window === 'undefined' ? { reduced: true, tier: 'static', cinematic: false } : compute()
  );

  useEffect(() => {
    const queries = ['(prefers-reduced-motion: reduce)', '(max-width: 767px)'].map((q) =>
      window.matchMedia(q)
    );
    const update = () => setPrefs(compute());
    queries.forEach((q) => q.addEventListener('change', update));
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);

  return prefs;
}
