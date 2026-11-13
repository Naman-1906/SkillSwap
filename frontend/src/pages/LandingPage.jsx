import { useEffect, useState } from 'react';
import Footer from '../components/Footer';
import GlobalLearners from '../components/GlobalLearners';
import Hero from '../components/Hero';
import Learn from '../components/Learn';
import Navbar from '../components/Navbar';
import OurMission from '../components/OurMission';

const SECTIONS = [
  { id: 'section-hero', label: 'Home' },
  { id: 'section-learn', label: 'Learn' },
  { id: 'section-countries', label: 'Countries' },
  { id: 'section-mission', label: 'Mission' },
  { id: 'section-cta', label: 'Start' },
];

function scrollToId(id) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function LandingPage({ onLogin }) {
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [activeSection, setActiveSection] = useState('section-hero');

  useEffect(() => {
    const handleScroll = () => setShowBottomNav(window.scrollY > 120);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observers = SECTIONS.map(({ id }) => {
      const section = document.getElementById(id);
      if (!section) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveSection(entry.target.id);
          });
        },
        { threshold: 0.01, rootMargin: '-10% 0px -60% 0px' },
      );
      observer.observe(section);
      return observer;
    }).filter(Boolean);

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1a1d29] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#252a3a] via-[#1e2230] to-[#1a1d29]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
      <div className="pointer-events-none absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-gradient-radial from-amber-500/5 via-transparent to-transparent blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-radial from-blue-500/5 via-transparent to-transparent blur-[100px]" />

      <div className="relative z-10">
        <Navbar authReady user={null} onLogin={onLogin} />
        <Hero />
        <Learn />
        <GlobalLearners />
        <OurMission />

        <section
          id="section-cta"
          className="px-4 py-16 text-center sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Start?</h2>
            <p className="mb-10 text-neutral-300">
              Join learners and teachers sharing skills around the world.
            </p>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-full bg-lime-400 px-8 py-3 text-[15px] font-semibold text-black transition-all duration-200 hover:scale-[1.03] hover:bg-lime-300 active:scale-[0.97]"
            >
              Get Started Now
            </button>
          </div>
        </section>
        <Footer />
      </div>

      <div
        className="fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] gap-2 overflow-x-auto rounded-full border border-white/15 bg-white/10 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:bottom-8"
        style={{
          opacity: showBottomNav ? 1 : 0,
          transform: showBottomNav
            ? 'translateX(-50%) translateY(0)'
            : 'translateX(-50%) translateY(16px)',
          pointerEvents: showBottomNav ? 'auto' : 'none',
          transition: 'opacity 220ms ease, transform 220ms ease',
        }}
      >
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToId(id)}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition-all duration-300 sm:px-4 sm:text-sm ${
              activeSection === id ? 'bg-lime-400 text-black' : 'text-white hover:text-lime-400'
            }`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
