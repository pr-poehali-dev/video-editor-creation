const words = ['Обрезка', 'Титры', 'Субтитры', 'Переходы', 'Цветокор', 'Звук', 'Скорость', 'Логотип', 'Экспорт 4K'];

const LandingFilmStrip = () => {
  const row = [...words, ...words];
  return (
    <div className="relative bg-lp-amber text-lp-ink overflow-hidden -rotate-[1.5deg] scale-[1.03] my-4 border-y-4 border-lp-ink">
      <div className="h-2 lp-sprockets" />
      <div className="flex w-max animate-marquee py-3">
        {row.map((w, i) => (
          <span key={i} className="flex items-center gap-6 px-6 font-display font-black uppercase text-xl sm:text-2xl tracking-tight whitespace-nowrap">
            {w}
            <span className="w-2.5 h-2.5 rounded-full bg-lp-ink" />
          </span>
        ))}
      </div>
      <div className="h-2 lp-sprockets" />
    </div>
  );
};

export default LandingFilmStrip;
