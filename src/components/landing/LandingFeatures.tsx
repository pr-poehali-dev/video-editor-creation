import Icon from '@/components/ui/icon';

const tasks = [
  {
    tc: '00:00:07',
    problem: 'В начале ролика — чужая заставка',
    fix: 'Задаёшь «от» и «до» в секундах — лишнее не попадёт в итоговое видео.',
    tool: 'Обрезка',
    icon: 'Scissors',
  },
  {
    tc: '00:00:21',
    problem: 'Без звука ролик никто не досматривает',
    fix: 'Речь распознаётся автоматически, субтитры подсвечивают каждое слово.',
    tool: 'Автосубтитры',
    icon: 'Captions',
  },
  {
    tc: '00:00:38',
    problem: 'Нужно показать бренд в кадре',
    fix: 'Ставишь свой логотип в угол кадра: размер, отступ и прозрачность — ползунками.',
    tool: 'Наложение',
    icon: 'Stamp',
  },
  {
    tc: '00:00:52',
    problem: 'Исходник весит под гигабайт',
    fix: 'Файл грузится частями и докачивается после обрыва связи. Лимит — 1 ГБ.',
    tool: 'Загрузка',
    icon: 'HardDriveUpload',
  },
  {
    tc: '00:01:05',
    problem: 'Склейки выглядят резко',
    fix: 'Растворение, слайды, засветка, глитч — переход ставится одним кликом.',
    tool: 'Переходы',
    icon: 'Blend',
  },
  {
    tc: '00:01:19',
    problem: 'Видео лежит в соцсети, а не на компьютере',
    fix: 'Вставляешь ссылку — ролик сам приезжает в проект.',
    tool: 'Импорт по ссылке',
    icon: 'Link2',
  },
];

const LandingFeatures = () => (
  <section id="tasks" className="relative py-20 sm:py-28 px-4 sm:px-6 scroll-mt-16">
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-[320px_1fr] gap-10 lg:gap-16">
        <div className="lg:sticky lg:top-28 self-start">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-lp-amber">Сцена 01</div>
          <h2 className="mt-4 font-display font-black uppercase text-4xl sm:text-5xl leading-[0.95] tracking-tight">
            Монтажный
            <br />
            лист
          </h2>
          <p className="mt-5 text-lp-dim leading-relaxed">
            Мы не начинаем с кнопок. Сначала — с того, что мешает ролику выстрелить. Каждая
            строка — реальная задача и то, как она решается в редакторе.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] text-lp-dim">
            <Icon name="ListChecks" size={14} className="text-lp-amber" />
            {tasks.length} задач · 0 программ на установку
          </div>
        </div>

        <ol className="border-t border-lp-line">
          {tasks.map((t, i) => (
            <li
              key={t.tc}
              className="group grid grid-cols-[auto_1fr] sm:grid-cols-[96px_1fr_auto] gap-x-5 gap-y-2 py-6 sm:py-7 border-b border-lp-line hover:bg-lp-panel/70 transition-colors px-2 sm:px-4 -mx-2 sm:-mx-4"
            >
              <div className="font-mono text-xs text-lp-dim tabular-nums pt-1 group-hover:text-lp-amber transition-colors">
                <span className="block text-[10px] opacity-60">#{String(i + 1).padStart(2, '0')}</span>
                {t.tc}
              </div>
              <div>
                <h3 className="font-display font-bold text-lg sm:text-xl leading-snug">{t.problem}</h3>
                <p className="mt-2 text-sm sm:text-[15px] text-lp-dim leading-relaxed max-w-xl">
                  <span className="text-lp-amber mr-1.5">→</span>
                  {t.fix}
                </p>
              </div>
              <div className="col-start-2 sm:col-start-auto flex sm:justify-end items-start">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-lp-line font-mono text-[10px] uppercase tracking-wider text-lp-text group-hover:border-lp-amber group-hover:bg-lp-amber group-hover:text-lp-ink transition-colors">
                  <Icon name={t.icon} size={12} />
                  {t.tool}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  </section>
);

export default LandingFeatures;
