import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { login, register, loading, error, clearError, isAuthenticated, loadProfile } = useAuth();

  useEffect(() => {
    loadProfile().then(() => {
      if (useAuth.getState().isAuthenticated) navigate('/dashboard');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate('/dashboard');
    } catch {}
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  const fieldClass = 'mt-1.5 h-11 bg-lp-ink border-lp-line text-lp-text placeholder:text-lp-dim/60 focus-visible:ring-lp-amber focus-visible:ring-offset-0';
  const labelClass = 'font-mono text-[10px] uppercase tracking-wider text-lp-dim';

  return (
    <div className="lp lp-grain min-h-screen grid lg:grid-cols-[1fr_minmax(0,520px)]">
      <aside className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-lp-line overflow-hidden">
        <div className="absolute inset-0 hero-grid opacity-50 pointer-events-none" />
        <Link to="/" className="relative flex items-center gap-2.5 w-fit">
          <span className="w-9 h-9 rounded-md bg-lp-amber flex items-center justify-center">
            <Icon name="Clapperboard" size={18} className="text-lp-ink" />
          </span>
          <span className="font-display font-bold text-base tracking-tight">VideoForge</span>
        </Link>

        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-lp-amber">Гримёрка</div>
          <h2 className="mt-5 font-hero uppercase text-4xl xl:text-5xl leading-[1.05] tracking-tight">
            {mode === 'login' ? (
              <>С возвращением<br /><span className="text-lp-amber">на площадку</span></>
            ) : (
              <>Твой первый<br /><span className="text-lp-amber">съёмочный день</span></>
            )}
          </h2>
          <ul className="mt-8 space-y-3 max-w-sm text-sm text-lp-dim">
            {[
              'Проекты сохраняются и открываются с любого устройства',
              'Файлы до 1 ГБ загружаются частями и докачиваются',
              'Экспорт до 4K и готовые пресеты под площадки',
            ].map(t => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-[9px] w-3 h-px bg-lp-amber shrink-0" />
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-lp-dim">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lp-rec lp-rec-blink" /> Standby
          </span>
          <span className="tabular-nums">00:00:00:00</span>
        </div>
      </aside>

      <main className="relative flex flex-col justify-center px-5 sm:px-10 py-10">
        <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-10 w-fit">
          <span className="w-8 h-8 rounded-md bg-lp-amber flex items-center justify-center">
            <Icon name="Clapperboard" size={16} className="text-lp-ink" />
          </span>
          <span className="font-display font-bold text-[15px] tracking-tight">VideoForge</span>
        </Link>

        <div className="w-full max-w-sm mx-auto">
          <div className="h-8 lp-clapper-stripes rounded-t-md border-2 border-lp-text" />
          <div className="rounded-b-md border-2 border-t-0 border-lp-text bg-lp-panel">
            <div className="grid grid-cols-2 border-b-2 border-lp-text">
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); clearError(); }}
                  className={`py-3 font-display font-bold uppercase text-xs tracking-wide transition-colors first:border-r-2 border-lp-text ${
                    mode === m ? 'bg-lp-amber text-lp-ink' : 'text-lp-dim hover:text-lp-text'
                  }`}
                >
                  {m === 'login' ? 'Вход' : 'Регистрация'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <Label className={labelClass}>Имя в титрах</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" className={fieldClass} />
                </div>
              )}

              <div>
                <Label className={labelClass}>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                  className={fieldClass}
                />
              </div>

              <div>
                <Label className={labelClass}>Пароль</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  className={fieldClass}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded border border-lp-rec/40 bg-lp-rec/10 text-lp-rec text-sm">
                  <Icon name="AlertCircle" size={16} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-md bg-lp-amber text-lp-ink font-display font-bold uppercase text-sm tracking-wide hover:brightness-110 transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Icon name="Loader2" size={16} className="animate-spin" />
                    {mode === 'login' ? 'Входим...' : 'Создаём...'}
                  </span>
                ) : mode === 'login' ? 'Мотор!' : 'Создать аккаунт'}
              </button>

              {mode === 'register' && (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded border border-dashed border-lp-green/40 font-mono text-[11px] uppercase tracking-wider text-lp-green">
                  <Icon name="Gift" size={14} />
                  100 ₽ бонус за регистрацию
                </div>
              )}
            </form>

            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t-2 border-lp-text">
              <button onClick={switchMode} className="text-xs text-lp-dim hover:text-lp-amber transition-colors">
                {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-wider text-lp-dim">Дубль 01</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs">
            <Link to="/" className="inline-flex items-center gap-1.5 text-lp-dim hover:text-lp-text transition-colors">
              <Icon name="ArrowLeft" size={14} /> На главную
            </Link>
            <Link to="/demo" className="inline-flex items-center gap-1.5 text-lp-dim hover:text-lp-amber transition-colors">
              Демо без регистрации <Icon name="ArrowRight" size={14} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;