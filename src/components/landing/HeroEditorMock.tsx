import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { toTimecode } from './useScrollProgress';

const LOOP = 12;
const CUT = 2;

const words = ['Сегодня', 'покажу,', 'как', 'смонтировать', 'ролик', 'за', 'вечер'];

const tracks = [
  { id: 'V1', color: 'bg-lp-cyan', clips: [[CUT, 7.5, 'interview.mp4'], [7.5, 12, 'b-roll.mov']] as const },
  { id: 'T1', color: 'bg-lp-amber', clips: [[3, 6.5, 'Титр'], [8.5, 11, 'Лого']] as const },
  { id: 'A1', color: 'bg-lp-green', clips: [[CUT, 12, 'voice.wav']] as const },
];

const pct = (v: number) => `${(v / LOOP) * 100}%`;

const HeroEditorMock = () => {
  const [t, setT] = useState(CUT);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT(prev => {
        const next = prev + dt;
        return next >= LOOP ? CUT : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const local = t - CUT;
  const wordIdx = Math.min(words.length - 1, Math.floor((local / (LOOP - CUT)) * words.length));
  const onBroll = t >= 7.5;
  const showTitle = t >= 3 && t < 6.5;
  const showLogo = t >= 8.5 && t < 11;

  return (
    <div className="relative rounded-lg border border-lp-line bg-lp-panel overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
      <div className="h-9 px-3 flex items-center justify-between border-b border-lp-line font-mono text-[10px]">
        <div className="flex items-center gap-2 text-lp-dim">
          <Icon name="Clapperboard" size={12} className="text-lp-amber" />
          <span className="uppercase tracking-wider">Проект · Рецепт дня</span>
        </div>
        <span className="flex items-center gap-1.5 text-lp-text tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-lp-rec lp-rec-blink" />
          {toTimecode(t)}
        </span>
      </div>

      <div className="p-3">
        <div
          className={`relative aspect-video rounded overflow-hidden transition-colors duration-700 ${
            onBroll ? 'bg-[hsl(200_45%_16%)]' : 'bg-[hsl(28_40%_15%)]'
          }`}
        >
          <div className="absolute inset-0 hero-grid opacity-60" />
          {onBroll ? (
            <>
              <div className="absolute left-[12%] bottom-[22%] w-[30%] h-[38%] rounded-full bg-lp-cyan/25 blur-sm" />
              <div className="absolute right-[14%] top-[18%] w-[22%] h-[30%] rounded bg-lp-cyan/20" />
              <div className="absolute right-[10%] bottom-[18%] w-[40%] h-[10%] rounded-full bg-lp-cyan/15" />
            </>
          ) : (
            <>
              <div className="absolute left-1/2 -translate-x-1/2 top-[22%] w-[17%] aspect-square rounded-full bg-lp-amber/35" />
              <div className="absolute left-1/2 -translate-x-1/2 top-[50%] w-[34%] h-[50%] rounded-t-[999px] bg-lp-amber/25" />
            </>
          )}

          <div
            className={`absolute left-3 bottom-[30%] bg-lp-ink/90 border-l-2 border-lp-amber px-2.5 py-1 transition-all duration-500 ${
              showTitle ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'
            }`}
          >
            <div className="font-display font-bold text-[11px] text-lp-text leading-tight">Анна Петрова</div>
            <div className="font-mono text-[8px] uppercase tracking-wider text-lp-amber">шеф-повар</div>
          </div>

          <div
            className={`absolute top-2.5 right-2.5 w-7 h-7 rounded bg-lp-amber flex items-center justify-center transition-opacity duration-500 ${
              showLogo ? 'opacity-90' : 'opacity-0'
            }`}
          >
            <Icon name="ChefHat" size={14} className="text-lp-ink" />
          </div>

          <div className="absolute inset-x-0 bottom-2.5 flex justify-center px-3">
            <div className="bg-lp-ink/85 rounded px-2 py-1 font-display font-bold text-[10px] sm:text-xs text-center leading-snug">
              {words.map((w, i) => (
                <span key={i} className={i === wordIdx ? 'text-lp-amber' : i < wordIdx ? 'text-lp-text' : 'text-lp-text/40'}>
                  {w}{' '}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-lp-line">
        <div className="relative h-5 ml-8 lp-ruler" />
        {tracks.map(tr => (
          <div key={tr.id} className="flex items-center h-8 border-t border-lp-line">
            <span className="w-8 shrink-0 text-center font-mono text-[9px] font-bold text-lp-dim">{tr.id}</span>
            <div className="relative flex-1 h-full">
              {tr.clips.map(([from, to, name]) => (
                <div
                  key={name}
                  className={`absolute top-1.5 bottom-1.5 rounded-sm ${tr.color} text-lp-ink px-1.5 flex items-center overflow-hidden`}
                  style={{ left: pct(from), width: `calc(${pct(to - from)} - 2px)` }}
                >
                  {tr.id === 'A1' ? (
                    <span className="absolute inset-x-1 inset-y-1 lp-wave text-lp-ink/50" />
                  ) : (
                    <span className="font-mono text-[8px] font-bold truncate">{name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute left-8 right-0 top-0 bottom-0">
          <div className="absolute inset-y-0 left-0 lp-hatch border-r border-lp-rec" style={{ width: pct(CUT) }} />
          <div className="absolute inset-y-0 w-px bg-lp-rec" style={{ left: pct(t) }}>
            <span className="absolute -top-0 -left-[4px] w-[9px] h-2.5 bg-lp-rec [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroEditorMock;