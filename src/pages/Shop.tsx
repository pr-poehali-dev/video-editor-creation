import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';
import { shop, wallet } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import useLpTheme from '@/hooks/use-lp-theme';

interface ShopItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  icon: string;
  preview_url: string;
  features: string[];
  owned: boolean;
}

interface PromoResult {
  valid: boolean;
  code: string;
  discount_type: string;
  discount_value: number;
  discount: number;
  final_price: number;
  original_price: number;
}

const categoryLabels: Record<string, string> = {
  transitions: 'Переходы',
  titles: 'Титры',
  effects: 'Эффекты',
  audio: 'Аудио',
  templates: 'Шаблоны',
  features: 'Функции',
};

const categoryIcons: Record<string, string> = {
  transitions: 'Sparkles',
  titles: 'Type',
  effects: 'Palette',
  audio: 'Music',
  templates: 'Layout',
  features: 'Cpu',
};

const categoryColors: Record<string, string> = {
  transitions: 'bg-lp-cyan',
  titles: 'bg-lp-amber',
  effects: 'bg-lp-rec',
  audio: 'bg-lp-green',
  templates: 'bg-lp-text',
  features: 'bg-lp-amber',
};

const Shop = () => {
  const { user, isAuthenticated, loadProfile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);
  useLpTheme();

  useEffect(() => {
    loadProfile();
    loadCatalog();
  }, []);

  useEffect(() => {
    if (user) setBalance(user.balance);
  }, [user]);

  useEffect(() => {
    setPromoCode('');
    setPromoResult(null);
    setPromoError('');
  }, [selectedItem]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await shop.catalog();
      setItems(data.items || []);
      setCategories(data.categories || []);
    } catch {}
    setLoading(false);
  };

  const handleCheckPromo = async () => {
    if (!promoCode.trim() || !selectedItem) return;
    setCheckingPromo(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const res = await shop.checkPromo(promoCode, selectedItem.slug);
      setPromoResult(res);
    } catch (e: any) {
      setPromoError(e.error || 'Недействительный промокод');
    }
    setCheckingPromo(false);
  };

  const handleBuy = useCallback(async (item: ShopItem) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (item.owned) return;

    setBuying(item.slug);
    setMessage(null);
    try {
      const code = promoResult?.valid ? promoResult.code : '';
      const res = await shop.buy(item.slug, code);
      setBalance(res.balance);
      setItems(prev => prev.map(i => i.slug === item.slug ? { ...i, owned: true } : i));
      let msg = `${item.name} приобретён!`;
      if (res.discount > 0) msg += ` Скидка: ${res.discount.toFixed(0)} ₽`;
      setMessage({ type: 'success', text: msg });
      setSelectedItem(null);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.error || 'Ошибка покупки' });
    }
    setBuying(null);
  }, [isAuthenticated, navigate, promoResult]);

  const filteredItems = activeCategory
    ? items.filter(i => i.category === activeCategory)
    : items;

  const getFinalPrice = (item: ShopItem) => {
    if (promoResult?.valid && selectedItem?.slug === item.slug) {
      return promoResult.final_price;
    }
    return item.price;
  };

  return (
    <div className="lp lp-grain min-h-screen">
      <header className="sticky top-0 z-40 border-b border-lp-line bg-lp-ink/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
              <span className="w-8 h-8 rounded-md bg-lp-amber flex items-center justify-center">
                <Icon name="Clapperboard" size={16} className="text-lp-ink" />
              </span>
              <span className="hidden sm:inline font-display font-bold text-[15px] tracking-tight">VideoForge</span>
            </button>
            <Separator orientation="vertical" className="hidden md:block h-6 bg-lp-line" />
            <span className="hidden md:inline font-mono text-[11px] uppercase tracking-wider text-lp-dim">Реквизиторская</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated && (
              <div className="flex items-center gap-2 h-8 px-2.5 rounded border border-lp-line font-mono text-xs tabular-nums">
                <Icon name="Wallet" size={13} className="text-lp-green" />
                <span className="font-bold">{balance.toFixed(0)} ₽</span>
              </div>
            )}
            <button onClick={() => navigate('/editor')} className="nle-button h-8 flex items-center gap-1.5">
              <Icon name="Clapperboard" size={12} /> <span className="hidden sm:inline">Редактор</span>
            </button>
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')} className="nle-button h-8 flex items-center gap-1.5">
                <Icon name="User" size={12} /> <span className="hidden sm:inline">Кабинет</span>
              </button>
            ) : (
              <button onClick={() => navigate('/auth')} className="nle-button active h-8 flex items-center gap-1.5">
                <Icon name="LogIn" size={12} /> Войти
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-lp-line">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-lp-amber">Реквизит для монтажа</div>
            <h1 className="mt-4 font-hero uppercase text-4xl sm:text-6xl leading-[1] tracking-tight">
              Магазин
              <br />
              <span className="text-lp-amber">эффектов</span>
            </h1>
          </div>
          <p className="max-w-sm text-lp-dim leading-relaxed">
            Переходы, титры, музыка и расширения. Купил — и они сразу появляются во вкладках редактора.
          </p>
        </section>

        {message && (
          <div className={`mt-6 px-4 py-3 rounded border flex items-center gap-2 text-sm ${message.type === 'success' ? 'border-lp-green/40 bg-lp-green/10 text-lp-green' : 'border-lp-rec/40 bg-lp-rec/10 text-lp-rec'}`}>
            <Icon name={message.type === 'success' ? 'CheckCircle' : 'AlertCircle'} size={16} />
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto"><Icon name="X" size={14} /></button>
          </div>
        )}

        <div className="mt-6 mb-6 flex gap-1.5 flex-wrap">
          {['', ...categories].map((cat, i) => {
            const on = activeCategory === cat;
            return (
              <button
                key={cat || 'all'}
                onClick={() => setActiveCategory(cat)}
                className={`h-9 px-3 rounded border font-mono text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  on ? 'bg-lp-amber border-lp-amber text-lp-ink' : 'border-lp-line text-lp-dim hover:text-lp-text'
                }`}
              >
                <span className="opacity-60 tabular-nums">R{String(i + 1).padStart(2, '0')}</span>
                {cat && <Icon name={categoryIcons[cat] || 'Package'} size={12} />}
                {cat ? categoryLabels[cat] || cat : 'Все'}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <Icon name="Loader2" size={28} className="animate-spin text-lp-amber" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-lp-dim">Достаём реквизит...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center font-mono text-xs uppercase tracking-wider text-lp-dim">В этой категории пока пусто</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item, i) => (
              <div
                key={item.id}
                className={`group rounded-md border bg-lp-panel overflow-hidden cursor-pointer transition-colors ${item.owned ? 'border-lp-green/50' : 'border-lp-line hover:border-lp-amber'}`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="relative h-32 bg-lp-ink overflow-hidden">
                  <div className="absolute inset-0 hero-grid opacity-70" />
                  <div className="absolute inset-x-0 top-0 h-2 lp-sprockets bg-lp-line" />
                  <div className="absolute inset-x-0 bottom-0 h-2 lp-sprockets bg-lp-line" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-14 h-14 rounded-md ${categoryColors[item.category] || 'bg-lp-dim'} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                      <Icon name={item.icon || 'Package'} size={26} className="text-lp-ink" />
                    </div>
                  </div>
                  <span className="absolute top-4 left-3 font-mono text-[10px] uppercase tracking-wider text-lp-dim">
                    #{String(i + 1).padStart(2, '0')} · {categoryLabels[item.category] || item.category}
                  </span>
                  {item.owned && (
                    <span className="absolute top-3.5 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-lp-green text-lp-ink font-mono text-[9px] font-bold uppercase">
                      <Icon name="Check" size={10} /> В деле
                    </span>
                  )}
                </div>
                <div className="p-4 border-t border-lp-line">
                  <h3 className="font-display font-bold text-sm uppercase tracking-tight">{item.name}</h3>
                  <p className="mt-1.5 text-xs text-lp-dim line-clamp-2 min-h-[2rem]">{item.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    {item.owned ? (
                      <span className="font-mono text-[11px] uppercase tracking-wider text-lp-green flex items-center gap-1">
                        <Icon name="CheckCircle" size={12} /> Установлено
                      </span>
                    ) : (
                      <span className="font-display text-xl font-bold tabular-nums">{item.price.toFixed(0)} ₽</span>
                    )}
                    {item.owned ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/editor'); }}
                        className="nle-button h-8 flex items-center gap-1.5"
                      >
                        <Icon name="Clapperboard" size={11} /> В редактор
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                        className="nle-button active h-8 px-4"
                      >
                        Купить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedItem(null)}>
          <div className="rounded-md border-2 border-lp-text bg-lp-panel w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-6 lp-clapper-stripes border-b-2 border-lp-text" />
            <div className="h-36 bg-lp-ink flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 hero-grid opacity-70" />
              <div className={`relative w-20 h-20 rounded-md ${categoryColors[selectedItem.category] || 'bg-lp-dim'} flex items-center justify-center`}>
                <Icon name={selectedItem.icon || 'Package'} size={36} className="text-lp-ink" />
              </div>
              <button onClick={() => setSelectedItem(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors">
                <Icon name="X" size={16} className="text-white" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{categoryLabels[selectedItem.category]}</span>
                  <h2 className="text-lg font-bold">{selectedItem.name}</h2>
                </div>
                {!selectedItem.owned && (
                  <div className="text-right">
                    {promoResult?.valid ? (
                      <>
                        <span className="text-sm text-muted-foreground line-through">{selectedItem.price.toFixed(0)} ₽</span>
                        <span className="text-2xl font-bold text-green-400 ml-2">{promoResult.final_price.toFixed(0)} ₽</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold">{selectedItem.price.toFixed(0)} ₽</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{selectedItem.description}</p>

              {selectedItem.features && selectedItem.features.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Что включено</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedItem.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'hsl(var(--editor-bg))' }}>
                        <Icon name="Check" size={12} className="text-green-400 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedItem.owned && isAuthenticated && (
                <div className="mb-4">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Промокод</label>
                  <div className="flex gap-2">
                    <Input
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); setPromoError(''); }}
                      placeholder="Введите промокод"
                      className="bg-secondary/50 border-border text-sm uppercase"
                      onKeyDown={e => e.key === 'Enter' && handleCheckPromo()}
                    />
                    <button
                      onClick={handleCheckPromo}
                      disabled={!promoCode.trim() || checkingPromo}
                      className="nle-button active px-4 whitespace-nowrap disabled:opacity-50"
                    >
                      {checkingPromo ? (
                        <Icon name="Loader2" size={12} className="animate-spin" />
                      ) : (
                        'Применить'
                      )}
                    </button>
                  </div>
                  {promoResult?.valid && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs">
                      <Icon name="Tag" size={14} />
                      <span>
                        Скидка {promoResult.discount_type === 'percent' ? `${promoResult.discount_value}%` : `${promoResult.discount_value.toFixed(0)} ₽`}
                        {' '}— вы экономите {promoResult.discount.toFixed(0)} ₽
                      </span>
                    </div>
                  )}
                  {promoError && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
                      <Icon name="AlertCircle" size={14} />
                      {promoError}
                    </div>
                  )}
                </div>
              )}

              {selectedItem.owned ? (
                <div>
                  <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium mb-2">
                    <Icon name="CheckCircle" size={18} /> Установлено
                  </div>
                  <div className="text-[11px] text-muted-foreground text-center">
                    {selectedItem.category === 'effects' && 'Доступно во вкладке «Эффекты» в редакторе'}
                    {selectedItem.category === 'transitions' && 'Доступно во вкладке «Переходы» в редакторе'}
                    {selectedItem.category === 'titles' && 'Доступно во вкладке «Текст» в редакторе'}
                    {selectedItem.category === 'audio' && 'Доступно во вкладке «Текст» → раздел «Аудио» в редакторе'}
                    {selectedItem.category === 'templates' && 'Доступно во вкладке «Текст» → раздел «Шаблоны» в редакторе'}
                    {selectedItem.category === 'features' && 'Расширение активировано во вкладке «Эффекты» в редакторе'}
                  </div>
                  <button
                    onClick={() => { setSelectedItem(null); navigate('/editor'); }}
                    className="w-full mt-3 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="Clapperboard" size={16} /> Открыть редактор
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBuy(selectedItem)}
                    disabled={buying === selectedItem.slug}
                    className="flex-1 py-3 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {buying === selectedItem.slug ? (
                      <>
                        <Icon name="Loader2" size={16} className="animate-spin" /> Покупка...
                      </>
                    ) : (
                      <>
                        <Icon name="ShoppingBag" size={16} /> Купить за {getFinalPrice(selectedItem).toFixed(0)} ₽
                      </>
                    )}
                  </button>
                  {isAuthenticated && balance < getFinalPrice(selectedItem) && (
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="px-4 py-3 rounded-lg font-medium text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Пополнить
                    </button>
                  )}
                </div>
              )}
              {isAuthenticated && !selectedItem.owned && balance < getFinalPrice(selectedItem) && (
                <p className="text-[11px] text-destructive mt-2 text-center">
                  Не хватает {(getFinalPrice(selectedItem) - balance).toFixed(0)} ₽. Пополните кошелёк.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;