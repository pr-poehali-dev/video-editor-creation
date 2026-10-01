import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';
import useScrollProgress, { toTimecode } from './useScrollProgress';

const TOTAL_SECONDS = 90;

const navLinks = [
  { label: 'Сц. 01 · Задачи', href: '#tasks' },
  { label: 'Сц. 02 · Монтаж', href: '#cut' },
  { label: 'Сц. 03 · Экспорт', href: '#export' },
  { label: 'Титры', href: '#faq' },
];

const LandingHeader = () => {
  const { isAuthenticated } = useAuth();
  const progress = useScrollProgress();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-lp-ink/85 backdrop-blur-md border-b border-lp-line">
      <div className="h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 rounded-md bg-lp-amber flex items-center justify-center">
            <Icon name="Clapperboard" size={17} className="text-lp-ink" />
          </span>
          <span className="font-display font-bold text-[15px] tracking-tight text-lp-text">VideoForge</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-lp-dim hover:text-lp-amber transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-2.5 h-8 rounded border border-lp-line font-mono text-[11px] text-lp-text tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-lp-rec lp-rec-blink" />
            {toTimecode(progress * TOTAL_SECONDS)}
          </div>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 h-8 px-3.5 rounded bg-lp-amber text-lp-ink text-xs font-semibold hover:brightness-110 transition"
            >
              <Icon name="FolderOpen" size={14} />
              Мои проекты
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:inline-flex h-8 px-3 items-center text-xs text-lp-dim hover:text-lp-text transition-colors">
                Войти
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 h-8 px-3.5 rounded bg-lp-amber text-lp-ink text-xs font-semibold hover:brightness-110 transition"
              >
                <Icon name="Play" size={13} />
                Мотор!
              </Link>
            </>
          )}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded border border-lp-line text-lp-text"
            aria-label="Меню"
          >
            <Icon name={menuOpen ? 'X' : 'Menu'} size={16} />
          </button>
        </div>
      </div>

      <div className="relative h-[3px] bg-lp-line/60">
        <div className="absolute inset-y-0 left-0 bg-lp-amber" style={{ width: `${progress * 100}%` }} />
        <div className="absolute -top-[3px] w-[2px] h-[9px] bg-lp-rec" style={{ left: `calc(${progress * 100}% - 1px)` }} />
      </div>

      {menuOpen && (
        <nav className="lg:hidden border-t border-lp-line bg-lp-ink px-4 py-3 flex flex-col">
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 font-mono text-xs uppercase tracking-wider text-lp-dim hover:text-lp-amber"
            >
              {l.label}
            </a>
          ))}
          {!isAuthenticated && (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="py-2.5 font-mono text-xs uppercase tracking-wider text-lp-dim hover:text-lp-amber">
              Войти
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default LandingHeader;
