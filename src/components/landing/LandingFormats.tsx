import { useState } from 'react';
import Icon from '@/components/ui/icon';

const presets = [
  { id: 'reels', title: 'Рилсы и сторис', spec: '1080 × 1920', fps: '30 fps', ratio: [9, 16], size: '≈ 18 МБ / мин', note: 'Вертикаль под телефон, субтитры крупно по центру.' },
  { id: 'yt', title: 'YouTube', spec: '3840 × 2160', fps: '30 fps', ratio: [16, 9], size: '≈ 150 МБ / мин', note: 'Максимальное качество для длинных роликов и обзоров.' },
  { id: 'sq', title: 'Лента', spec: '1080 × 1080', fps: '30 fps', ratio: [1, 1], size: '≈ 14 МБ / мин', note: 'Квадрат, который одинаково смотрится везде.' },
  { id: 'web', title: 'Сайт', spec: 'WebM · VP9', fps: '30 fps', ratio: [16, 9], size: '≈ 9 МБ / мин', note: 'Лёгкий файл для фоновых видео на лендинге.' },
  { id: 'mail', title: 'Рассылка', spec: '1280 × 720', fps: '24 fps', ratio: [16, 9], size: '≈ 6 МБ / мин', note: 'Компактно, чтобы письмо не застряло в спаме.' },
  { id: 'gif', title: 'GIF', spec: '480 × 270', fps: '12 fps', ratio: [16, 9], size: '≈ 2 МБ / 5 с', note: 'Зацикленная реакция или превью для чата.' },
];

const LandingFormats = () => {
  const [active, setActive] = useState(presets[0].id);
  const current = presets.find(p => p.id === active)!;
  const [rw, rh] = current.ratio;
  const portrait = rh > rw;

  return (
    <section id="export" className="relative py-20 sm:py-28 px-4 sm:px-6 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-lp-amber">Сцена 03</div>
        <h2 className="mt-4 font-display font-black uppercase text-4xl sm:text-5xl leading-[0.95] tracking-tight">
          Куда
          <br />
          выпускаем?
        </h2>

        <div className="mt-12 grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-stretch">
          <div className="flex flex-col gap-2">
            {presets.map((p, i) => {
              const on = p.id === active;
              return (
                <button
                  key={p.id}
                  onClick={() => setActive(p.id)}
                  className={`group relative text-left rounded-md border px-4 sm:px-5 py-4 flex items-center gap-4 transition-colors ${
                    on ? 'border-lp-amber bg-lp-amber text-lp-ink' : 'border-lp-line hover:border-lp-dim'
                  }`}
                >
                  <span className={`font-mono text-[10px] tabular-nums ${on ? 'text-lp-ink/60' : 'text-lp-dim'}`}>
                    R{String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 font-display font-bold uppercase text-sm sm:text-base tracking-tight">{p.title}</span>
                  <span className={`font-mono text-[11px] tabular-nums ${on ? 'text-lp-ink/75' : 'text-lp-dim'}`}>{p.spec}</span>
                  <Icon name="ChevronRight" size={16} className={on ? 'text-lp-ink' : 'text-lp-line group-hover:text-lp-dim'} />
                </button>
              );
            })}
          </div>

          <div className="relative rounded-lg border border-lp-line bg-lp-panel p-6 sm:p-8 flex flex-col">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-lp-dim">
              <span>Превью кадра</span>
              <span className="text-lp-amber">{rw}:{rh}</span>
            </div>

            <div className="flex-1 min-h-[260px] sm:min-h-[320px] flex items-center justify-center py-8">
              <div
                className="relative bg-lp-ink border-2 border-lp-amber rounded-sm transition-all duration-500 ease-out overflow-hidden"
                style={portrait ? { height: 280, aspectRatio: `${rw} / ${rh}` } : { width: '86%', aspectRatio: `${rw} / ${rh}` }}
              >
                <div className="absolute inset-0 hero-grid opacity-70" />
                <div className="absolute inset-[10%] border border-dashed border-lp-dim/40" />
                <div className="absolute inset-x-0 bottom-[12%] flex justify-center px-3">
                  <span className="bg-lp-ink/90 px-2 py-0.5 font-display font-bold text-[10px] sm:text-xs text-lp-text">
                    Ваш <span className="text-lp-amber">ролик</span> здесь
                  </span>
                </div>
                <span className="absolute top-2 left-2 font-mono text-[9px] text-lp-dim">{current.spec}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 border-t border-lp-line pt-5 gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-lp-dim">Кадры</div>
                <div className="mt-1 font-display font-bold">{current.fps}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-lp-dim">Вес</div>
                <div className="mt-1 font-display font-bold text-sm sm:text-base">{current.size}</div>
              </div>
              <div className="col-span-3 sm:col-span-1">
                <div className="font-mono text-[10px] uppercase tracking-wider text-lp-dim">Зачем</div>
                <div className="mt-1 text-sm text-lp-text/85 leading-snug">{current.note}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingFormats;
