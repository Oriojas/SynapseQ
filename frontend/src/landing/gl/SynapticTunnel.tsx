import React, { useEffect, useRef } from 'react';
import { Renderer, Camera, Transform, Geometry, Program, Mesh } from 'ogl';
import type { DeviceTier } from '../hooks/useMotionPrefs';
import type { Tone } from '../copy';
import { POINT_VERTEX, POINT_FRAGMENT, LINE_VERTEX, LINE_FRAGMENT } from './shaders';

/** Two-colour palette per act (mint/blue = today, amber = Q-Day, pink = 2045). */
const TONES: Record<Tone, readonly [string, string]> = {
  mint: ['#5EEAD4', '#A8F0C6'],
  blue: ['#A8F0C6', '#3B66E8'],
  amber: ['#FACC15', '#E14D79'],
  pink: ['#F4729B', '#5EEAD4'],
};

const TUNNEL_LENGTH = 140;
const TUNNEL_RADIUS = 9;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function buildPoints(count: number) {
  const position = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Bias particles toward the tunnel wall, keep a clear corridor for the camera
    const r = TUNNEL_RADIUS * (0.45 + 0.55 * Math.sqrt(Math.random()));
    position[i * 3] = Math.cos(angle) * r;
    position[i * 3 + 1] = Math.sin(angle) * r * 0.78;
    position[i * 3 + 2] = -Math.random() * TUNNEL_LENGTH;
    rand[i] = Math.random();
  }
  return { position, rand };
}

/** Short filaments between nearby synapses (GL_LINES pairs). */
function buildFilaments(count: number) {
  const position = new Float32Array(count * 2 * 3);
  const rand = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = TUNNEL_RADIUS * (0.55 + 0.45 * Math.random());
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r * 0.78;
    const z = -Math.random() * TUNNEL_LENGTH;
    const len = 0.6 + Math.random() * 2.2;
    // Angular 45° segments echo the chrome / tattoo geometry
    const dir = Math.floor(Math.random() * 4);
    const dx = dir === 0 ? len : dir === 1 ? len * 0.7 : 0;
    const dy = dir === 2 ? len : dir === 1 ? len * 0.7 : 0;
    const dz = dir === 3 ? -len * 1.6 : 0;
    const k = Math.random();
    position.set([x, y, z, x + dx, y + dy, z + dz], i * 6);
    rand[i * 2] = k;
    rand[i * 2 + 1] = k;
  }
  return { position, rand };
}

/**
 * Fixed WebGL background: an endless synaptic tunnel the camera travels through
 * as the page scrolls. The palette follows the act on screen (data-tone).
 */
export function SynapticTunnel({ tier }: { tier: DeviceTier }): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || tier === 'static') return;

    const isHigh = tier === 'high';
    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, isHigh ? 1.75 : 1.25),
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const camera = new Camera(gl, { fov: 62, near: 0.1, far: 200 });
    camera.position.set(0, 0, 0);
    const scene = new Transform();

    const uniforms = {
      uTime: { value: 0 },
      uOffset: { value: 0 },
      uLength: { value: TUNNEL_LENGTH },
      uColorA: { value: hexToRgb(TONES.mint[0]) },
      uColorB: { value: hexToRgb(TONES.mint[1]) },
      uGlitch: { value: 0 },
      uPixelRatio: { value: renderer.dpr },
    };

    const pts = buildPoints(isHigh ? 9000 : 4200);
    const points = new Mesh(gl, {
      mode: gl.POINTS,
      geometry: new Geometry(gl, {
        position: { size: 3, data: pts.position },
        aRand: { size: 1, data: pts.rand },
      }),
      program: new Program(gl, {
        vertex: POINT_VERTEX,
        fragment: POINT_FRAGMENT,
        uniforms,
        transparent: true,
        depthTest: false,
      }),
    });
    points.setParent(scene);

    const fil = buildFilaments(isHigh ? 1400 : 600);
    const lines = new Mesh(gl, {
      mode: gl.LINES,
      geometry: new Geometry(gl, {
        position: { size: 3, data: fil.position },
        aRand: { size: 1, data: fil.rand },
      }),
      program: new Program(gl, {
        vertex: LINE_VERTEX,
        fragment: LINE_FRAGMENT,
        uniforms,
        transparent: true,
        depthTest: false,
      }),
    });
    lines.setParent(scene);

    // Additive glow for both layers
    points.program.setBlendFunc(gl.SRC_ALPHA, gl.ONE);
    lines.program.setBlendFunc(gl.SRC_ALPHA, gl.ONE);

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.perspective({ aspect: window.innerWidth / window.innerHeight });
    };
    resize();
    window.addEventListener('resize', resize);

    // Cache act boundaries (absolute tops) from [data-tone] sections
    let stops: { top: number; tone: Tone }[] = [];
    const measure = () => {
      stops = Array.from(document.querySelectorAll<HTMLElement>('[data-tone]')).map((el) => ({
        top: el.getBoundingClientRect().top + window.scrollY,
        tone: (el.dataset.tone as Tone) ?? 'mint',
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const colA = hexToRgb(TONES.mint[0]);
    const colB = hexToRgb(TONES.mint[1]);
    let glitch = 0;
    let travel = 0;
    let lastScroll = window.scrollY;
    let raf = 0;
    let visible = !document.hidden;
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Scroll drives the camera; a slow drift keeps it alive at rest
      const sy = window.scrollY;
      const delta = sy - lastScroll;
      lastScroll = sy;
      travel += delta * 0.018 + dt * 0.9;

      const probe = sy + window.innerHeight * 0.5;
      let tone: Tone = 'mint';
      for (const s of stops) if (s.top <= probe) tone = s.tone;
      const [ta, tb] = TONES[tone];
      const targetA = hexToRgb(ta);
      const targetB = hexToRgb(tb);
      const k = 1 - Math.exp(-dt * 2.2);
      for (let i = 0; i < 3; i++) {
        colA[i] = (colA[i] ?? 0) + ((targetA[i] ?? 0) - (colA[i] ?? 0)) * k;
        colB[i] = (colB[i] ?? 0) + ((targetB[i] ?? 0) - (colB[i] ?? 0)) * k;
      }
      const speed = Math.min(Math.abs(delta) / 60, 1);
      const targetGlitch = tone === 'amber' ? 0.55 + speed * 0.45 : speed * 0.15;
      glitch += (targetGlitch - glitch) * (1 - Math.exp(-dt * 6));

      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
      camera.rotation.y = -pointer.x * 0.08;
      camera.rotation.x = -pointer.y * 0.05;
      camera.rotation.z = Math.sin(now * 0.00012) * 0.04;

      uniforms.uTime.value = now * 0.001;
      uniforms.uOffset.value = travel;
      uniforms.uColorA.value = colA;
      uniforms.uColorB.value = colB;
      uniforms.uGlitch.value = glitch;

      renderer.render({ scene, camera });
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      visible = !document.hidden;
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [tier]);

  return (
    <div
      ref={hostRef}
      className={`landing-tunnel ${tier === 'static' ? 'landing-tunnel--static' : ''}`}
      aria-hidden="true"
    />
  );
}
