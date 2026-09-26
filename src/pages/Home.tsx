import { useEffect } from 'react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingHero from '@/components/landing/LandingHero';
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
    document.title = 'VideoForge — видеоредактор в браузере';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingHeader />
      <main>
        <LandingHero />
        <div className="section-divider" />
        <LandingFeatures />
        <LandingHowItWorks />
        <div className="section-divider" />
        <LandingFormats />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Home;
