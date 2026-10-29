import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';
import HeroEditorMock from './HeroEditorMock';

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

          <h1 className="mt-6 font-hero uppercase leading-[1] tracking-tight text-[10vw] sm:text-6xl xl:text-[5.2rem]">
            Снято.
            <br />
            <span className="text-lp-amber">Смонтируй</span>
            <br />
            <span className="relative inline-block">
              здесь
              <span className="absolute -right-5 top-2 w-3.5 h-3.5 rounded-full bg-lp-rec lp-rec-blink" />
            </span>
          </h1>

          <p className="mt-7 max-w-lg text-base sm:text-lg text-lp-text/85 leading-relaxed">
            VideoForge — видеоредактор, который открывается во вкладке браузера. Без
            установки, без мощного компьютера и без курсов по монтажу.
          </p>
          <ul className="mt-5 max-w-lg space-y-2.5 text-sm sm:text-[15px] text-lp-dim">
            {[
              'Отрежь чужую заставку и лишний хвост с точностью до кадра',
              'Поставь свой логотип, титры и подписи спикеров',
              'Получи субтитры по словам автоматически из речи',
              'Выгрузи ролик под сторис, YouTube или сайт — до 4K',
            ].map(item => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-[9px] w-3 h-px bg-lp-amber shrink-0" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>

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
          <div className="relative p-3 sm:p-5">
            <Corner className="top-0 left-0 border-t-2 border-l-2" />
            <Corner className="top-0 right-0 border-t-2 border-r-2" />
            <Corner className="bottom-0 left-0 border-b-2 border-l-2" />
            <Corner className="bottom-0 right-0 border-b-2 border-r-2" />
            <HeroEditorMock />
          </div>

          <div className="hidden sm:block absolute -left-8 -bottom-20 rotate-[-4deg] bg-lp-text text-lp-ink rounded-sm px-4 py-3 shadow-2xl max-w-[220px]">
            <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">Заметка монтажёра</div>
            <div className="mt-1 font-display font-bold text-sm leading-snug">Заставку 0:00–0:07 — в корзину</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;