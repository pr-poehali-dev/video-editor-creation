import Icon from '@/components/ui/icon';

const features = [
  {
    icon: 'Layers',
    title: 'Многодорожечный таймлайн',
    text: 'Видео, аудио, картинки и текст на отдельных дорожках. Перетаскивайте, режьте и меняйте порядок мышью.',
    accent: 'from-primary/20 to-primary/5',
  },
  {
    icon: 'Scissors',
    title: 'Обрезка начала и конца',
    text: 'Уберите заставку или лишний хвост за пару секунд — точная подрезка по секундам с визуальной шкалой.',
    accent: 'from-accent/20 to-accent/5',
  },
  {
    icon: 'Captions',
    title: 'Субтитры автоматически',
    text: 'Распознаём речь и расставляем субтитры по словам. Остаётся только выбрать стиль оформления.',
    accent: 'from-primary/20 to-primary/5',
  },
  {
    icon: 'Wand2',
    title: 'Эффекты и переходы',
    text: 'Цветокоррекция, размытие, виньетка, глитч, растворение и слайды — применяются в один клик.',
    accent: 'from-accent/20 to-accent/5',
  },
  {
    icon: 'Type',
    title: 'Титры и анимация текста',
    text: 'Заголовки, нижние трети, выноски и конечные титры с анимацией появления и своими шрифтами.',
    accent: 'from-primary/20 to-primary/5',
  },
  {
    icon: 'Music',
    title: 'Работа со звуком',
    text: 'Отдельная громкость для каждого клипа, фоновая музыка, озвучка и извлечение аудио из видео.',
    accent: 'from-accent/20 to-accent/5',
  },
  {
    icon: 'Gauge',
    title: 'Скорость и рампы',
    text: 'Замедление, ускорение, стоп-кадр и плавные скоростные рампы для динамичных склеек.',
    accent: 'from-primary/20 to-primary/5',
  },
  {
    icon: 'CloudUpload',
    title: 'Файлы до 1 ГБ',
    text: 'Загружайте большие исходники — они режутся на части и докачиваются при обрыве связи.',
    accent: 'from-accent/20 to-accent/5',
  },
  {
    icon: 'Link2',
    title: 'Импорт по ссылке',
    text: 'Вставьте ссылку на видео из соцсети или файлообменника — заберём файл прямо в проект.',
    accent: 'from-primary/20 to-primary/5',
  },
];

const LandingFeatures = () => (
  <section id="features" className="relative py-20 sm:py-28">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-primary">
          <Icon name="Zap" size={12} />
          Возможности
        </div>
        <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
          Всё для монтажа <span className="text-gradient">в одном окне</span>
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Инструменты профессиональной программы, но в интерфейсе, который понятен с первого раза.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {features.map(f => (
          <div key={f.title} className="group p-6 rounded-2xl glass-card glass-card-hover">
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.accent} border border-border/60 flex items-center justify-center`}
            >
              <Icon name={f.icon} size={20} className="text-primary" />
            </div>
            <h3 className="mt-4 font-semibold text-base">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
