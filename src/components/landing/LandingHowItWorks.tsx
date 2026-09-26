import Icon from '@/components/ui/icon';

const steps = [
  {
    num: '01',
    icon: 'Upload',
    title: 'Загрузите материалы',
    text: 'Перетащите видео, фото и музыку в панель медиа или вставьте ссылку на видео из интернета.',
  },
  {
    num: '02',
    icon: 'SlidersHorizontal',
    title: 'Смонтируйте',
    text: 'Разложите клипы по таймлайну, обрежьте лишнее, добавьте текст, переходы и эффекты.',
  },
  {
    num: '03',
    icon: 'Captions',
    title: 'Добавьте субтитры',
    text: 'Нажмите одну кнопку — речь распознается и превратится в оформленные субтитры.',
  },
  {
    num: '04',
    icon: 'Download',
    title: 'Выгрузите результат',
    text: 'Выберите готовый пресет под соцсети или сайт и скачайте видео в нужном качестве.',
  },
];

const LandingHowItWorks = () => (
  <section id="how" className="relative py-20 sm:py-28">
    <div className="absolute inset-0 aurora opacity-60 pointer-events-none" />
    <div className="container relative mx-auto px-4 sm:px-6">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-accent">
            <Icon name="Route" size={12} />
            Как это работает
          </div>
          <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            От исходников до
            <br />
            <span className="text-gradient">готового ролика</span>
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-lg">
            Четыре шага без изучения сложных программ. Первый ролик собирается за один вечер даже
            без опыта монтажа.
          </p>

          <div className="mt-10 space-y-4">
            {steps.map(s => (
              <div key={s.num} className="flex gap-4 p-4 rounded-xl glass-card glass-card-hover">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary/25 to-accent/10 border border-border/60 flex items-center justify-center">
                  <Icon name={s.icon} size={19} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary/70 tracking-widest">{s.num}</span>
                    <h3 className="font-semibold text-sm">{s.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-primary/12 blur-3xl rounded-full animate-pulse-glow pointer-events-none" />
          <div className="relative rounded-2xl overflow-hidden glass-card animate-float-slow">
            <img
              src="https://cdn.poehali.dev/projects/238a5289-75c3-4972-a2c7-31a94579110e/files/3616a302-8889-4f78-bd5b-b269ff0394c8.jpg"
              alt="Работа в видеоредакторе"
              className="w-full aspect-[4/5] object-cover"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-background via-background/80 to-transparent">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon name="Clock" size={13} className="text-primary" />
                Первый ролик — уже сегодня
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LandingHowItWorks;
