import Icon from '@/components/ui/icon';

const presets = [
  { icon: 'Instagram', title: 'Соцсети', spec: '1080p · 30 fps', text: 'Вертикальные и квадратные ролики для ленты и сторис.' },
  { icon: 'Youtube', title: 'YouTube', spec: '4K · 20 Мбит/с', text: 'Максимальное качество для длинных видео и обзоров.' },
  { icon: 'Globe', title: 'Сайт', spec: 'WebM · VP9', text: 'Лёгкий формат, который быстро грузится на страницах.' },
  { icon: 'Mail', title: 'Рассылка', spec: '720p · 24 fps', text: 'Компактный файл, который не перегрузит письмо.' },
  { icon: 'Image', title: 'GIF-анимация', spec: '480×270 · 12 fps', text: 'Короткие зацикленные превью и реакции.' },
  { icon: 'Settings2', title: 'Свои настройки', spec: 'любое разрешение', text: 'Задайте разрешение, битрейт и частоту кадров вручную.' },
];

const LandingFormats = () => (
  <section id="formats" className="relative py-20 sm:py-28">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs text-primary">
          <Icon name="Share2" size={12} />
          Экспорт
        </div>
        <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
          Готовые пресеты <span className="text-gradient">под каждую площадку</span>
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Не нужно разбираться в кодеках и битрейтах — выберите, куда выкладываете видео.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {presets.map(p => (
          <div key={p.title} className="p-6 rounded-2xl glass-card glass-card-hover">
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-border/60 flex items-center justify-center">
                <Icon name={p.icon} size={20} className="text-primary" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground px-2 py-1 rounded-full bg-secondary/60 border border-border/60">
                {p.spec}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-base">{p.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default LandingFormats;
