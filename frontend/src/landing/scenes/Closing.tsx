import React from 'react';
import { ArrowUpRight, Cpu, ExternalLink, KeyRound, ShieldCheck, Stethoscope, Factory, UserRound } from 'lucide-react';
import type { LandingCopy, ModuleCardCopy, Tone } from '../copy';
import { SmileWink } from '../blueprint/SmileWink';
import { buildModuleUrl, DAPP_BASE_URL, GITHUB_REPO_URL, HudTag, MagneticCta, Reveal, RevealText, TONE_BG, TONE_BORDER, TONE_TEXT } from '../ui';

const AUDIENCE_ICON = [UserRound, Stethoscope, Factory];

export function Audience({ t }: { t: LandingCopy['audience'] }) {
  return (
    <section data-tone="blue" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <HudTag tone="blue">{t.hudTag}</HudTag>
        <RevealText
          as="h2"
          text={t.title}
          className="block font-display text-3xl sm:text-5xl font-bold leading-[1.08] mt-4 text-reb-text-light max-w-3xl"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {t.items.map((item, i) => {
            const Icon = AUDIENCE_ICON[i] ?? UserRound;
            return (
              <Reveal key={item.code} delay={i * 110} className="h-full">
                <article className={`group h-full landing-glass chamfer-card p-6 sm:p-7 border ${TONE_BORDER[item.tone]} transition-transform duration-500 hover:-translate-y-1.5`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${TONE_TEXT[item.tone]}`}>{item.code}</span>
                    <Icon className={`w-5 h-5 ${TONE_TEXT[item.tone]}`} />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-reb-text-light mt-6">{item.title}</h3>
                  <p className="text-sm sm:text-base text-reb-text-muted leading-relaxed mt-3">{item.body}</p>
                  <p className="mt-6 pt-4 border-t border-reb-border flex items-center gap-2 font-mono text-xs text-reb-text-light">
                    <span className={`w-1.5 h-1.5 rounded-full ${TONE_BG[item.tone]}`} />
                    {item.gain}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const MODULE_STYLE: Record<ModuleCardCopy['accent'], { tone: Tone; icon: React.ReactNode; button: string }> = {
  mint: {
    tone: 'mint',
    icon: <ShieldCheck className="w-5 h-5 text-reb-mint" />,
    button: 'bg-reb-mint/15 hover:bg-reb-mint text-reb-mint hover:text-reb-bg border-reb-mint/50',
  },
  pink: {
    tone: 'pink',
    icon: <Cpu className="w-5 h-5 text-reb-pink" />,
    button: 'bg-reb-pink/15 hover:bg-reb-pink text-reb-pink hover:text-reb-bg border-reb-pink/50',
  },
  blue: {
    tone: 'blue',
    icon: <KeyRound className="w-5 h-5 text-reb-periwinkle" />,
    button: 'bg-reb-blue/20 hover:bg-reb-periwinkle text-reb-periwinkle hover:text-reb-bg border-reb-periwinkle/50',
  },
};

export function Modules({ t }: { t: LandingCopy['modules'] }) {
  return (
    <section id="modules" data-tone="blue" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-3xl">
          <HudTag tone="mint">{t.hudTag}</HudTag>
          <RevealText
            as="h2"
            text={t.title}
            className="block font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mt-4 text-reb-text-light"
          />
          <p className="mt-5 text-base sm:text-lg text-reb-text-muted leading-relaxed">{t.lead}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {t.cards.map((card, i) => {
            const st = MODULE_STYLE[card.accent];
            return (
              <Reveal key={card.tabParam} delay={i * 120} className="h-full">
                <article className={`module-card h-full landing-glass chamfer-card p-6 sm:p-7 flex flex-col border ${TONE_BORDER[st.tone]}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${TONE_TEXT[st.tone]}`}>[ {card.hudTag} ]</span>
                    <span className="p-2 bg-reb-surface-code border border-reb-border-subtle">{st.icon}</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-reb-text-light mt-5">{card.title}</h3>
                  <p className={`text-xs font-mono uppercase tracking-wider mt-1 ${TONE_TEXT[st.tone]}`}>{card.tagline}</p>
                  <p className="text-sm text-reb-text-muted leading-relaxed mt-4">{card.description}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-reb-border pt-4">
                    {card.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-xs text-reb-text-light/90">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${TONE_BG[st.tone]}`} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={buildModuleUrl(card.tabParam)}
                    className={`mt-auto pt-0 chamfer-btn w-full inline-flex items-center justify-center gap-2 px-4 py-3 border font-mono text-xs font-bold tracking-wider transition-all ${st.button}`}
                    style={{ marginTop: '1.75rem' }}
                  >
                    {card.cta}
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </article>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-reb-text-muted">{t.proofTitle}</p>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            {t.proof.map((p) => (
              <div key={p.label} className="px-4 py-3 bg-reb-bg/60 backdrop-blur border border-reb-border chamfer-btn">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-reb-text-muted">{p.label}</p>
                <p className="font-mono text-xs font-semibold text-reb-mint mt-1">{p.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Manifesto({ t }: { t: LandingCopy['manifesto'] }) {
  return (
    <section data-tone="mint" className="relative py-28 sm:py-40 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 rebecca-aura-mint opacity-60" aria-hidden="true" />
      <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center relative">
        <HudTag tone="pink" className="justify-center">{t.hudTag}</HudTag>
        <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] mt-6 text-reb-text-light">
          <RevealText text={t.quoteA} />{' '}
          <RevealText text={t.quoteB} className="text-reb-mint" delay={200} />{' '}
          <RevealText text={t.quoteC} className="text-reb-pink" delay={420} />
        </h2>
        <p className="mt-7 text-base sm:text-lg text-reb-text-muted max-w-2xl mx-auto leading-relaxed">{t.subcopy}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <MagneticCta href={DAPP_BASE_URL}>{t.ctaPrimary}</MagneticCta>
          <MagneticCta href={GITHUB_REPO_URL} variant="ghost" external>
            {t.ctaGithub}
            <ExternalLink className="w-4 h-4 text-reb-mint" />
          </MagneticCta>
        </div>
      </div>
    </section>
  );
}

export function Footer({ t }: { t: LandingCopy['footer'] }) {
  return (
    <footer className="relative z-10 border-t border-reb-border bg-reb-bg/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <p className="font-display font-bold text-lg text-reb-text-light">
            Synapse<span className="text-reb-mint">Q</span>
          </p>
          <p className="text-xs text-reb-text-muted mt-1">{t.tagline}</p>
          <p className="font-mono text-[11px] text-reb-text-muted mt-2">{t.teamLabel}</p>
        </div>
        <SmileWink caption={t.wink} />
        <div className="flex flex-col sm:items-end gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-reb-surface-code border border-reb-border font-mono text-[11px] text-reb-mint">
            <span className="w-1.5 h-1.5 rounded-full bg-reb-mint animate-pulse" />
            {t.builtFor}
          </span>
          <span className="font-mono text-[11px] text-reb-text-muted">CHAIN ID 9800 · ML-KEM-1024 · ML-DSA-87 · MIT</span>
        </div>
      </div>
    </footer>
  );
}
