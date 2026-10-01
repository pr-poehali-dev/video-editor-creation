import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { toTimecode } from './useScrollProgress';

const SOURCE = 60;

const tracks = [
  { name: 'V1', label: 'Видео', color: 'bg-lp-cyan', clips: [[0, 34, 'interview.mp4'], [34, 60, 'b-roll.mov']] as const },
  { name: 'T1', label: 'Текст', color: 'bg-lp-amber', clips: [[12, 28, 'Титр: Анна, повар'], [40, 52, 'Подпишись']] as const },
  { name: 'A1', label: 'Звук', color: 'bg-lp-green', clips: [[0, 60, 'voice.wav']] as const },
];

const steps = [
  { n: '01', title: 'Кинь исходники', text: 'Видео, фото, музыку — перетаскиванием или по ссылке.' },
  { n: '02', title: 'Режь и клей', text: 'Двигай клипы по дорожкам, подрезай края, ставь переходы.' },
  { n: '03', title: 'Подпиши', text: 'Титры, нижние трети и автосубтитры по словам.' },
];

const LandingHowItWorks = () => {
  const [cut, setCut] = useState(7);
  const pct = (v: number) => `${(v / SOURCE) * 100}%`;

  return (
    <section id="cut" className="relative py-20 sm:py-28 px-4 sm:px-6 bg-lp-panel border-y border-lp-line scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-lp-amber">Сцена 02</div>
            <h2 className="mt-4 font-display font-black uppercase text-4xl sm:text-5xl leading-[0.95] tracking-tight">
              Попробуй
              <br />
              прямо тут
            </h2>
          </div>
          <p className="max-w-md text-lp-dim leading-relaxed">
            Это кусочек настоящего таймлайна. Потяни ползунок — и посмотри, как уходит заставка.
            В редакторе всё работает точно так же, только дорожек сколько угодно.
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-lp-line bg-lp-ink overflow-hidden">
          <div className="h-10 px-4 flex items-center justify-between border-b border-lp-line font-mono text-[11px]">
            <div className="flex items-center gap-3 text-lp-dim">
              <Icon name="Scissors" size={13} className="text-lp-amber" />
              <span className="uppercase tracking-wider">Обрезка начала</span>
            </div>
            <div className="flex items-center gap-4 tabular-nums">
              <span className="text-lp-dim">IN <span className="text-lp-amber">{toTimecode(cut)}</span></span>
              <span className="hidden sm:inline text-lp-dim">DUR <span className="text-lp-text">{toTimecode(SOURCE - cut)}</span></span>
            </div>
          </div>

          <div className="grid grid-cols-[56px_1fr] sm:grid-cols-[88px_1fr]">
            <div className="border-r border-lp-line">
              <div className="h-7 border-b border-lp-line" />
              {tracks.map(t => (
                <div key={t.name} className="h-14 flex flex-col justify-center px-2 sm:px-3 border-b border-lp-line last:border-b-0">
                  <span className="font-mono text-[11px] font-bold">{t.name}</span>
                  <span className="hidden sm:block text-[10px] text-lp-dim">{t.label}</span>
                </div>
              ))}
            </div>

            <div className="relative">
              <div className="h-7 border-b border-lp-line lp-ruler relative">
                {[0, 10, 20, 30, 40, 50].map(s => (
                  <span key={s} className="absolute top-1 font-mono text-[9px] text-lp-dim" style={{ left: `calc(${pct(s)} + 3px)` }}>
                    0:{String(s).padStart(2, '0')}
                  </span>
                ))}
              </div>

              {tracks.map(t => (
                <div key={t.name} className="relative h-14 border-b border-lp-line last:border-b-0">
                  {t.clips.map(([from, to, name]) => {
                    const start = Math.max(from, cut);
                    if (start >= to) return null;
                    return (
                      <div
                        key={name}
                        className={`absolute top-2 bottom-2 rounded-sm ${t.color} text-lp-ink px-2 flex items-center overflow-hidden transition-[left,width] duration-150`}
                        style={{ left: pct(start), width: `calc(${pct(to - start)} - 2px)` }}
                      >
                        {t.name === 'A1' ? (
                          <span className="absolute inset-x-1 inset-y-2 lp-wave text-lp-ink/50" />
                        ) : (
                          <span className="relative font-mono text-[10px] font-bold truncate">{name}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="absolute top-0 bottom-0 left-0 lp-hatch border-r-2 border-lp-rec pointer-events-none transition-[width] duration-150" style={{ width: pct(cut) }}>
                {cut > 4 && (
                  <span className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-wider text-lp-rec">вырезано</span>
                )}
              </div>
              <div className="absolute -top-0 bottom-0 w-px bg-lp-amber pointer-events-none" style={{ left: pct(cut) }}>
                <span className="absolute -top-0 -left-[5px] w-[11px] h-3 bg-lp-amber [clip-path:polygon(0_0,100%_0,50%_100%)]" />
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5 border-t border-lp-line flex flex-col sm:flex-row sm:items-center gap-4">
            <label htmlFor="lp-trim" className="font-mono text-[11px] uppercase tracking-wider text-lp-dim shrink-0">
              Тяни, чтобы отрезать →
            </label>
            <input
              id="lp-trim"
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={cut}
              onChange={e => setCut(parseFloat(e.target.value))}
              className="flex-1 accent-[hsl(40_100%_56%)] h-2 cursor-pointer"
            />
            <button
              onClick={() => setCut(0)}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-lp-dim hover:text-lp-amber transition-colors"
            >
              <Icon name="RotateCcw" size={12} />
              Сброс
            </button>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-px bg-lp-line border border-lp-line rounded-lg overflow-hidden">
          {steps.map(s => (
            <div key={s.n} className="bg-lp-panel p-6 sm:p-7">
              <div className="font-display font-black text-5xl text-lp-line">{s.n}</div>
              <h3 className="mt-3 font-display font-bold text-lg uppercase tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-lp-dim leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LandingHowItWorks;
