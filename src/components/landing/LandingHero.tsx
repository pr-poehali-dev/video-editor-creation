import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';

const HERO_IMG = 'https://cdn.poehali.dev/projects/238a5289-75c3-4972-a2c7-31a94579110e/files/3616a302-8889-4f78-bd5b-b269ff0394c8.jpg';

const Corner = ({ className }: { className: string }) => (
  <span className={`absolute w-6 h-6 border-lp-text/80 ${className}`} />
);

const LandingHero = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative pt-24 sm:pt-28 pb-14 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
        <div className="animate-fade-up">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-lp-dim">
            <span className="text-lp-amber">Дубль 01</span>
            <span className="w-8 h-px bg-lp-line" />
            <span>Сцена: «Ролик за вечер»</span>
          </div>

          <h1 className="mt-6 font-display font-black uppercase leading-[0.95] tracking-tight text-[10.5vw] sm:text-6xl xl:text-[5.4rem]">
            Снято.
            <br />
            <span className="text-lp-amber">Смонтируй</span>
            <br />
            <span className="relative inline-block">
              здесь
              <span className="absolute -right-5 top-2 w-3.5 h-3.5 rounded-full bg-lp-rec lp-rec-blink" />
            </span>
          </h1>

          <p className="mt-7 max-w-md text-base sm:text-lg text-lp-dim leading-relaxed">
            Отрежь скучную заставку, поставь свои титры, получи субтитры за минуту и
            выгрузи ролик под любую площадку. Прямо во вкладке браузера.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link
              to={isAuthenticated ? '/dashboard' : '/demo'}
              className="group inline-flex items-center justify-center gap-3 h-14 pl-6 pr-2 rounded-md bg-lp-amber text-lp-ink font-display font-bold uppercase text-sm tracking-wide hover:brightness-110 transition"
            >
              {isAuthenticated ? 'К моим проектам' : 'Начать монтаж'}
              <span className="w-10 h-10 rounded bg-lp-ink text-lp-amber flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                <Icon name="ArrowRight" size={18} />
              </span>
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 h-14 px-6 rounded-md border border-lp-line text-lp-text font-medium text-sm hover:border-lp-amber hover:text-lp-amber transition-colors"
            >
              <Icon name="MonitorPlay" size={17} />
              Демо без регистрации
            </Link>
          </div>

          <dl className="mt-11 grid grid-cols-3 max-w-md border-y border-lp-line divide-x divide-lp-line">
            {[
              ['1 ГБ', 'исходник'],
              ['4K', 'на выходе'],
              ['0 ₽', 'на старте'],
            ].map(([v, l]) => (
              <div key={l} className="py-3.5 px-3 first:pl-0">
                <dt className="font-display font-bold text-xl sm:text-2xl text-lp-text">{v}</dt>
                <dd className="font-mono text-[10px] uppercase tracking-wider text-lp-dim mt-1">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <div className="relative aspect-[4/5] sm:aspect-[5/6] rounded-lg overflow-hidden border border-lp-line bg-lp-panel">
            <img src={HERO_IMG} alt="Монтаж ролика в VideoForge" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-lp-ink/80 via-transparent to-lp-ink/40" />

            <Corner className="top-4 left-4 border-t-2 border-l-2" />
            <Corner className="top-4 right-4 border-t-2 border-r-2" />
            <Corner className="bottom-4 left-4 border-b-2 border-l-2" />
            <Corner className="bottom-4 right-4 border-b-2 border-r-2" />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10">
              <span className="absolute top-1/2 inset-x-0 h-px bg-lp-text/60" />
              <span className="absolute left-1/2 inset-y-0 w-px bg-lp-text/60" />
            </div>

            <div className="absolute top-7 left-8 right-8 flex items-center justify-between font-mono text-[11px] text-lp-text">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-lp-rec lp-rec-blink" /> REC
              </span>
              <span className="tabular-nums">00:01:27:14</span>
            </div>

            <div className="absolute bottom-7 left-8 right-8 flex items-end justify-between font-mono text-[10px] text-lp-text/85 uppercase tracking-wider">
              <div className="space-y-1">
                <div>ISO 800 · F2.8</div>
                <div>1/50 · 25P</div>
              </div>
              <div className="flex items-end gap-[3px] h-8">
                {[40, 70, 55, 90, 65, 80, 45, 60].map((h, i) => (
                  <span key={i} className={`w-[3px] ${h > 75 ? 'bg-lp-rec' : 'bg-lp-green'}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -left-4 sm:-left-8 bottom-16 rotate-[-4deg] bg-lp-text text-lp-ink rounded-sm px-4 py-3 shadow-2xl max-w-[220px]">
            <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">Заметка монтажёра</div>
            <div className="mt-1 font-display font-bold text-sm leading-snug">Заставку 0:00–0:07 — в корзину</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;