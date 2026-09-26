import { useState } from 'react';
import Icon from '@/components/ui/icon';

const faq = [
  {
    q: 'Нужно ли что-то устанавливать?',
    a: 'Нет. Редактор полностью работает в браузере — достаточно открыть сайт. Ничего скачивать и настраивать не нужно.',
  },
  {
    q: 'Какого размера файлы можно загружать?',
    a: 'До 1 ГБ на один файл. Большие видео загружаются частями, поэтому при обрыве связи закачка продолжится, а не начнётся заново.',
  },
  {
    q: 'Можно ли убрать заставку в начале видео?',
    a: 'Да. Выберите клип на таймлайне и в панели свойств задайте начало и конец нужного фрагмента — лишнее просто не попадёт в готовый ролик.',
  },
  {
    q: 'Как работают автоматические субтитры?',
    a: 'Мы распознаём речь из аудиодорожки и расставляем субтитры по словам с точной привязкой ко времени. Дальше вы выбираете стиль и при необходимости правите текст.',
  },
  {
    q: 'В каком качестве можно выгрузить видео?',
    a: 'От компактного 720p для рассылок до 4K с битрейтом 20 Мбит/с. Есть готовые пресеты под соцсети, YouTube и сайт, а также ручные настройки.',
  },
  {
    q: 'Можно попробовать без регистрации?',
    a: 'Да, в демо-режиме доступен весь монтаж — попробуйте таймлайн и эффекты. Сохранение проектов и экспорт открываются после регистрации.',
  },
  {
    q: 'Где хранятся мои проекты?',
    a: 'Проекты и загруженные файлы хранятся в вашем личном кабинете. Можно вернуться к монтажу с любого устройства, войдя в аккаунт.',
  },
];

const LandingFaq = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-accent">
            <Icon name="CircleHelp" size={12} />
            Вопросы
          </div>
          <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Частые <span className="text-gradient">вопросы</span>
          </h2>
        </div>

        <div className="mt-12 max-w-3xl mx-auto space-y-3">
          {faq.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="rounded-xl glass-card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-secondary/30 transition-colors"
                >
                  <span className="font-medium text-sm sm:text-base">{item.q}</span>
                  <Icon
                    name="ChevronDown"
                    size={18}
                    className={`shrink-0 text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LandingFaq;
