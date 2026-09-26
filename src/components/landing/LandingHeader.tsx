import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';

const navLinks = [
  { label: 'Возможности', href: '#features' },
  { label: 'Как это работает', href: '#how' },
  { label: 'Форматы', href: '#formats' },
  { label: 'Вопросы', href: '#faq' },
];

const LandingHeader = () => {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border/60' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
              <Icon name="Film" size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">VideoForge</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(l => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/60"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Icon name="LayoutDashboard" size={15} />
                Мои проекты
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="hidden sm:inline-flex items-center h-9 px-4 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Войти
                </Link>
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors glow-primary"
                >
                  <Icon name="Play" size={14} />
                  Попробовать
                </Link>
              </>
            )}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
              aria-label="Меню"
            >
              <Icon name={menuOpen ? 'X' : 'Menu'} size={18} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden pb-4 animate-fade-in">
            <div className="flex flex-col gap-1 pt-2 border-t border-border/60">
              {navLinks.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors"
                >
                  {l.label}
                </a>
              ))}
              {!isAuthenticated && (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors"
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default LandingHeader;
