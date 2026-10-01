import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

const links = [
  { label: 'Демо', to: '/demo' },
  { label: 'Регистрация', to: '/auth' },
  { label: 'Мои проекты', to: '/dashboard' },
  { label: 'Магазин эффектов', to: '/shop' },
  { label: 'Конфиденциальность', to: '/privacy-policy' },
];

const LandingFooter = () => (
  <footer className="relative border-t border-lp-line">
    <div className="h-5 bg-lp-line lp-sprockets" />
    <div className="px-4 sm:px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="font-display font-black uppercase text-[10.5vw] xl:text-[8.5rem] leading-[0.85] whitespace-nowrap tracking-tighter text-lp-panel select-none">
          VideoForge
        </div>
        <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-md bg-lp-amber flex items-center justify-center">
              <Icon name="Clapperboard" size={16} className="text-lp-ink" />
            </span>
            <span className="text-sm text-lp-dim">Монтаж в браузере · © {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map(l => (
              <Link key={l.to} to={l.to} className="font-mono text-[11px] uppercase tracking-wider text-lp-dim hover:text-lp-amber transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  </footer>
);

export default LandingFooter;