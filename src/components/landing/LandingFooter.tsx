import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const columns = [
  {
    title: 'Продукт',
    links: [
      { label: 'Возможности', to: '#features' },
      { label: 'Как это работает', to: '#how' },
      { label: 'Форматы экспорта', to: '#formats' },
      { label: 'Магазин эффектов', to: '/shop' },
    ],
  },
  {
    title: 'Начать',
    links: [
      { label: 'Демо-режим', to: '/demo' },
      { label: 'Регистрация', to: '/auth' },
      { label: 'Мои проекты', to: '/dashboard' },
      { label: 'Частые вопросы', to: '#faq' },
    ],
  },
];

const LandingFooter = () => (
  <footer className="relative border-t border-border/60">
    <div className="container mx-auto px-4 sm:px-6 py-14">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
        <div className="col-span-2">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Icon name="Film" size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">VideoForge</span>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
            Видеоредактор в браузере: таймлайн, эффекты, субтитры и экспорт до 4K без установки
            программ.
          </p>
        </div>

        {columns.map(col => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold">{col.title}</h4>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(l => (
                <li key={l.label}>
                  {l.to.startsWith('#') ? (
                    <a
                      href={l.to}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      to={l.to}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="section-divider my-10" />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} VideoForge. Все права защищены.
        </span>
        <Link to="/privacy-policy" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Политика конфиденциальности
        </Link>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
