import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';

const LandingCta = () => {
  const { isAuthenticated } = useAuth();
  const today = new Date().toLocaleDateString('ru-RU');

  return (
    <section className="relative py-20 sm:py-28 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="group">
          <div className="relative h-14 sm:h-16 rounded-t-md overflow-hidden lp-clapper-stripes origin-bottom-left -rotate-[6deg] group-hover:rotate-0 transition-transform duration-300 ease-out border-2 border-lp-text" />
          <div className="h-10 sm:h-12 lp-clapper-stripes border-x-2 border-lp-text" />

          <div className="rounded-b-md border-2 border-t-0 border-lp-text bg-lp-ink">
            <div className="grid grid-cols-3 border-b-2 border-lp-text font-mono text-[10px] sm:text-xs uppercase">
              {[
                ['Продакшн', 'Твой ролик'],
                ['Сцена', '01'],
                ['Дубль', '01'],
              ].map(([k, v]) => (
                <div key={k} className="px-3 sm:px-5 py-3 border-r-2 last:border-r-0 border-lp-text">
                  <div className="text-lp-dim tracking-wider">{k}</div>
                  <div className="mt-1 font-display font-bold text-sm sm:text-lg text-lp-text normal-case">{v}</div>
                </div>
              ))}
            </div>

            <div className="px-5 sm:px-10 py-10 sm:py-14 text-center">
              <h2 className="font-display font-black uppercase text-4xl sm:text-6xl leading-[0.95] tracking-tight">
                Камера.
                <br />
                <span className="text-lp-amber">Мотор!</span>
              </h2>
              <p className="mt-5 text-lp-dim max-w-md mx-auto leading-relaxed">
                Первый ролик собирается за вечер. Начни в демо — регистрация понадобится, только
                когда захочешь сохранить.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/demo'}
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-md bg-lp-amber text-lp-ink font-display font-bold uppercase text-sm tracking-wide hover:brightness-110 transition"
                >
                  <Icon name="Clapperboard" size={18} />
                  {isAuthenticated ? 'К моим проектам' : 'Открыть редактор'}
                </Link>
                {!isAuthenticated && (
                  <Link
                    to="/auth"
                    className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-md border border-lp-line text-lp-text text-sm font-medium hover:border-lp-amber hover:text-lp-amber transition-colors"
                  >
                    Создать аккаунт
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t-2 border-lp-text font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-lp-dim">
              <span>Дата: {today}</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-lp-rec lp-rec-blink" /> Звук · синхрон
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingCta;