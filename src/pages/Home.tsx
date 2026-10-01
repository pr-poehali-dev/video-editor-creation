import { useEffect } from 'react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingHero from '@/components/landing/LandingHero';
import LandingFilmStrip from '@/components/landing/LandingFilmStrip';
import LandingFeatures from '@/components/landing/LandingFeatures';
import LandingHowItWorks from '@/components/landing/LandingHowItWorks';
import LandingFormats from '@/components/landing/LandingFormats';
import LandingFaq from '@/components/landing/LandingFaq';
import LandingCta from '@/components/landing/LandingCta';
import LandingFooter from '@/components/landing/LandingFooter';
import useAuth from '@/hooks/use-auth';

const Home = () => {
  const loadProfile = useAuth(s => s.loadProfile);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    document.title = 'VideoForge — монтаж видео в браузере';
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);

  return (
    <div className="lp lp-grain min-h-screen overflow-x-hidden font-sans">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingFilmStrip />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingFormats />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Home;
