import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';

const perks = [
  'Без установки программ',
  'Файлы до 1 ГБ',
  'Экспорт до 4K',
];

const LandingCta = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative py-20 sm:py-28">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden glass-card glow-primary">
          <div className="absolute inset-0 aurora pointer-events-none" />
          <div className="absolute inset-0 hero-grid opacity-60 pointer-events-none" />

          <div className="relative px-6 py-14 sm:px-14 sm:py-20 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
              <Icon name="Film" size={26} className="text-white" />
            </div>

            <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Смонтируйте первый ролик
              <br />
              <span className="text-gradient">уже сегодня</span>
            </h2>

            <p className="mt-5 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Откройте редактор и попробуйте всё сами — регистрация не нужна, чтобы начать.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={isAuthenticated ? '/dashboard' : '/demo'}
                className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all hover:scale-[1.02]"
              >
                <Icon name="Sparkles" size={18} />
                {isAuthenticated ? 'К моим проектам' : 'Открыть редактор'}
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full glass-card glass-card-hover font-medium"
                >
                  <Icon name="UserPlus" size={18} className="text-primary" />
                  Создать аккаунт
                </Link>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {perks.map(p => (
                <span key={p} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="Check" size={13} className="text-green-400" />
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingCta;
