import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';

const stats = [
  { value: '1 ГБ', label: 'размер файла' },
  { value: '4K', label: 'экспорт видео' },
  { value: '0 ₽', label: 'старт без карты' },
];

const LandingHero = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div className="absolute inset-0 aurora pointer-events-none" />
      <div className="absolute inset-0 hero-grid pointer-events-none" />

      <div className="container relative mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-muted-foreground animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Монтаж прямо в браузере — без установки программ
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight animate-fade-up">
            Видеоредактор, который
            <br />
            <span className="text-gradient">работает в браузере</span>
          </h1>

          <p
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-up"
            style={{ animationDelay: '0.1s' }}
          >
            Профессиональный монтаж без тяжёлых программ. Таймлайн, эффекты, автоматические
            субтитры и экспорт в 4K — всё в одной вкладке.
          </p>

          <div
            className="mt-9 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            <Link
              to={isAuthenticated ? '/dashboard' : '/demo'}
              className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all glow-primary hover:scale-[1.02]"
            >
              <Icon name="Sparkles" size={18} />
              {isAuthenticated ? 'Открыть мои проекты' : 'Начать монтаж бесплатно'}
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full glass-card glass-card-hover font-medium"
            >
              <Icon name="MonitorPlay" size={18} className="text-primary" />
              Демо без регистрации
            </Link>
          </div>

          <div
            className="mt-10 flex items-center justify-center gap-8 sm:gap-12 animate-fade-up"
            style={{ animationDelay: '0.3s' }}
          >
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-gradient">{s.value}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative mt-14 sm:mt-20 max-w-5xl mx-auto animate-fade-up"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="absolute -inset-x-12 -top-8 bottom-0 bg-primary/15 blur-3xl rounded-full animate-pulse-glow pointer-events-none" />
          <div className="relative rounded-2xl overflow-hidden glass-card glow-primary">
            <div className="h-9 flex items-center gap-1.5 px-4 border-b border-border/60 bg-secondary/40">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-accent/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              <span className="ml-3 text-[11px] text-muted-foreground">VideoForge — монтаж проекта</span>
            </div>
            <img
              src="https://cdn.poehali.dev/projects/238a5289-75c3-4972-a2c7-31a94579110e/files/b80e383e-806b-4306-9efd-a21389ba8794.jpg"
              alt="Интерфейс видеоредактора VideoForge"
              className="w-full aspect-[16/9] object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
