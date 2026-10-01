import { useState } from 'react';
import Icon from '@/components/ui/icon';

const faq = [
  { q: 'Что нужно установить?', a: 'Ничего. Редактор живёт во вкладке браузера — открыл сайт и монтируешь.' },
  { q: 'Какой файл потянет?', a: 'До 1 ГБ на файл. Большое видео грузится частями: если связь оборвётся, загрузка продолжится с того же места.' },
  { q: 'Как убрать заставку?', a: 'Выдели клип на таймлайне, в блоке «Обрезка» укажи, с какой секунды начинать. Всё, что раньше, в ролик не попадёт.' },
  { q: 'Субтитры правда сами?', a: 'Да. Речь распознаётся из звуковой дорожки, слова расставляются по времени. Остаётся выбрать стиль и поправить опечатки.' },
  { q: 'Можно без регистрации?', a: 'Демо-режим открыт всем: таймлайн, эффекты, титры. Сохранение проектов и экспорт — после регистрации.' },
  { q: 'Где лежат мои проекты?', a: 'В личном кабинете. Зашёл с другого компьютера — продолжил монтаж с того же места.' },
];

const LandingFaq = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 sm:py-28 px-4 sm:px-6 bg-lp-panel border-y border-lp-line scroll-mt-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-lp-amber">Финальные титры</div>
          <h2 className="mt-4 font-display font-black uppercase text-4xl sm:text-5xl leading-[0.95] tracking-tight">
            Вопросы
            <br />
            из зала
          </h2>
        </div>

        <dl className="mt-14">
          {faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-t border-lp-line last:border-b">
                <dt>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-4 py-5 text-left group"
                    aria-expanded={isOpen}
                  >
                    <span className="sm:text-right font-mono text-[11px] uppercase tracking-wider text-lp-dim group-hover:text-lp-amber transition-colors hidden sm:block">
                      Вопрос {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="sm:hidden font-display font-bold text-base">{item.q}</span>
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                        isOpen ? 'bg-lp-amber border-lp-amber text-lp-ink' : 'border-lp-line text-lp-dim'
                      }`}
                    >
                      <Icon name={isOpen ? 'Minus' : 'Plus'} size={14} />
                    </span>
                    <span className="hidden sm:block font-display font-bold text-lg">{item.q}</span>
                  </button>
                </dt>
                <dd className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden">
                    <p className="pb-6 sm:pl-[calc(50%+1.875rem)] text-sm text-lp-dim leading-relaxed sm:-mt-1">
                      {item.a}
                    </p>
                  </div>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
};

export default LandingFaq;