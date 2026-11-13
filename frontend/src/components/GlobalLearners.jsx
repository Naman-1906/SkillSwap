import { useState, useEffect, useRef } from 'react';

const COUNTRIES = [
  { code: 'US', name: 'United States', learners: '12.5K', flag: '🇺🇸', skill: 'Web Dev', region: 'Americas', growth: '+8.2%', time: '2m ago' },
  { code: 'UK', name: 'United Kingdom', learners: '8.3K', flag: '🇬🇧', skill: 'Design', region: 'Europe', growth: '+5.7%', time: '1m ago' },
  { code: 'IN', name: 'India', learners: '15.7K', flag: '🇮🇳', skill: 'AI / ML', region: 'Asia', growth: '+12.4%', time: '3m ago' },
  { code: 'DE', name: 'Germany', learners: '6.2K', flag: '🇩🇪', skill: 'Engineering', region: 'Europe', growth: '+4.1%', time: '5m ago' },
  { code: 'JP', name: 'Japan', learners: '9.8K', flag: '🇯🇵', skill: 'Game Dev', region: 'Asia', growth: '+6.9%', time: '2m ago' },
  { code: 'BR', name: 'Brazil', learners: '7.1K', flag: '🇧🇷', skill: 'UX Design', region: 'Americas', growth: '+9.3%', time: '4m ago' },
  { code: 'CA', name: 'Canada', learners: '5.4K', flag: '🇨🇦', skill: 'Blockchain', region: 'Americas', growth: '+7.8%', time: '1m ago' },
  { code: 'AU', name: 'Australia', learners: '4.9K', flag: '🇦🇺', skill: 'Video & Photo', region: 'Oceania', growth: '+3.5%', time: '6m ago' },
  { code: 'FR', name: 'France', learners: '4.2K', flag: '🇫🇷', skill: 'Marketing', region: 'Europe', growth: '+5.2%', time: '2m ago' },
  { code: 'SG', name: 'Singapore', learners: '3.8K', flag: '🇸🇬', skill: 'Fintech', region: 'Asia', growth: '+11.6%', time: '1m ago' },
  { code: 'KR', name: 'South Korea', learners: '3.5K', flag: '🇰🇷', skill: 'Animation', region: 'Asia', growth: '+4.7%', time: '3m ago' },
  { code: 'MX', name: 'Mexico', learners: '3.2K', flag: '🇲🇽', skill: 'Mobile Dev', region: 'Americas', growth: '+6.1%', time: '4m ago' },
];

function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}


function CountryCard({ country, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      className="flex-shrink-0 w-[260px] sm:w-[320px] cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="border border-neutral-300/10 rounded-lg bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-400 hover:border-neutral-300/20 hover:bg-white/[0.04]">
        <div className="p-5">

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-3xl">{country.flag}</span>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm leading-tight truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {country.name}
                </h3>
                <p className="text-neutral-400 text-xs mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>{country.region}</p>
              </div>
            </div>
          </div>


          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-baseline">
              <span className="text-neutral-500 text-xs tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>Learners</span>
              <span className="text-white font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{country.learners}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-neutral-500 text-xs tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>Growth</span>
              <span className="text-emerald-400 font-bold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{country.growth}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-neutral-500 text-xs tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>Skill</span>
              <span className="text-neutral-200 font-bold text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>{country.skill}</span>
            </div>
          </div>


          <div className="h-px bg-neutral-300/10 my-4" />


          <div className="flex items-center justify-between">
            <span className="text-neutral-400 text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>{country.time}</span>
            <div className={`flex items-center justify-center w-6 h-6 transition-all duration-300 ${isHovered ? 'translate-x-0.5' : ''}`}>
              <svg className="w-4 h-4 text-neutral-500 transition-colors duration-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function MarqueeRow({ countries, direction = 'left', speed = 40 }) {
  return (
    <div className="relative overflow-hidden">

      <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-10 sm:w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      
      <div
        className="flex gap-6 animate-marquee"
        style={{
          animationDuration: `${speed}s`,
          animationDirection: direction === 'right' ? 'reverse' : 'normal',
        }}
      >
        {[...countries, ...countries, ...countries].map((c, i) => (
          <CountryCard
            key={`${c.code}-${i}`}
            country={c}
            onClick={() => console.log('Clicked:', c.name)}
          />
        ))}
      </div>
    </div>
  );
}

export default function GlobalLearnersPremium() {
  const [sectionRef, inView] = useInView(0.08);

  const total = COUNTRIES.reduce((s, c) => s + parseFloat(c.learners), 0).toFixed(1);
  const avgGrowth = (COUNTRIES.reduce((s, c) => s + parseFloat(c.growth), 0) / COUNTRIES.length).toFixed(1);

  return (
    <section
      ref={sectionRef}
      id="section-countries"
      className="relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(to bottom, #0a0a0a 0%, #0f0f15 50%, #0a0a0a 100%)'
      }}
    >

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-400/10 to-transparent" />
      

      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-lime-400/2 to-transparent" />
      

      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />


      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 pt-16 sm:pt-24 pb-12 sm:pb-16 z-10">
        <div
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 1s cubic-bezier(0.2,0.5,0.4,1)',
          }}
        >

          <div className="mb-6">
            <span className="inline-block text-neutral-400 text-xs tracking-widest font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>GLOBAL NETWORK</span>
          </div>


          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight max-w-2xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Real-time learning happening across {COUNTRIES.length} countries
          </h2>


          <p className="text-neutral-400 text-sm md:text-base max-w-lg mb-12 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
            Watch as thousands of learners connect and grow their skills worldwide. Live updates, real metrics.
          </p>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-md">
            <div>
              <p className="text-neutral-500 text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Total Learners</p>
              <p className="text-white text-2xl font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{total}K</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Countries</p>
              <p className="text-white text-2xl font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{COUNTRIES.length}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>Avg Growth</p>
              <p className="text-emerald-400 text-2xl font-extrabold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{avgGrowth}%</p>
            </div>
          </div>
        </div>
      </div>


      <div
        className="relative py-12"
        style={{
          opacity: inView ? 1 : 0,
          transition: 'opacity 0.8s ease 0.2s',
        }}
      >
        <MarqueeRow countries={COUNTRIES} direction="left" speed={30} />
      </div>


      <div
        className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 pb-16 sm:pb-24 z-10 text-center"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 1s cubic-bezier(0.2,0.5,0.4,1) 0.3s',
        }}
      >
        <button className="flex items-center gap-2 px-8 py-4 rounded-full border border-neutral-300/20 bg-white/[0.05] text-white font-bold text-sm hover:bg-white/[0.08] hover:border-neutral-300/30 transition-all duration-300 group whitespace-nowrap mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
          <span>Explore Global Network</span>
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
