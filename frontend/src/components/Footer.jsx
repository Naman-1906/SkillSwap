import { useState, useEffect, useRef } from "react";
import clustrNetworkLogo from "../assets/logos/clustr-network-logo.png";

function useInView(threshold = 0.15) {
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

const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Success Stories", href: "#stories" },
    { label: "API", href: "#api" },
  ],
  company: [
    { label: "About Us", href: "#about" },
    { label: "Careers", href: "#careers" },
    { label: "Blog", href: "#blog" },
    { label: "Press", href: "#press" },
  ],
  resources: [
    { label: "Help Center", href: "#help" },
    { label: "Community", href: "#community" },
    { label: "Guidelines", href: "#guidelines" },
    { label: "Developers", href: "#developers" },
  ],
  legal: [
    { label: "Privacy Policy", href: "#privacy" },
    { label: "Terms of Service", href: "#terms" },
    { label: "Cookie Policy", href: "#cookies" },
    { label: "GDPR", href: "#gdpr" },
  ],
};

const SOCIAL_LINKS = [
  { icon: "𝕏", label: "X (Twitter)", href: "#" },
  { icon: "in", label: "LinkedIn", href: "#" },
  { icon: "📷", label: "Instagram", href: "#" },
  { icon: "▶", label: "YouTube", href: "#" },
  { icon: "💬", label: "Discord", href: "#" },
];

const STATS = [
  { value: "50K+", label: "Active Learners" },
  { value: "200+", label: "Expert Tutors" },
  { value: "1000+", label: "Courses" },
  { value: "98%", label: "Success Rate" },
];

const buildApiCandidates = () => {
  if (import.meta.env.VITE_API_URL) return [import.meta.env.VITE_API_URL.replace(/\/$/, '')];
  if (typeof window === 'undefined') return [''];
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    // try common dev backend ports in order
    return [
      `${window.location.protocol}//${host}:5000`,
      `${window.location.protocol}//${host}:5001`,
      `${window.location.protocol}//${host}:5002`,
      `${window.location.protocol}//${host}:5003`,
    ];
  }
  return [''];
};

const apiCandidates = buildApiCandidates();

export default function Footer() {
  const [sectionRef, inView] = useInView(0.1);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [subscribeError, setSubscribeError] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (email) {
      setSubscribing(true);
      setSubscribed(false);
      setSubscribeError("");
      setSubscribeMessage("");

      try {
        let response;
        let data = {};
        // try each candidate until one works
        for (const base of apiCandidates) {
          try {
            const url = base ? `${base}/api/newsletter/subscribe` : `/api/newsletter/subscribe`;
            response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            data = await response.json().catch(() => ({}));
            if (response) break;
          } catch {
            response = null;
          }
        }

        if (!response || !response.ok) {
          throw new Error((data && data.message) || 'Could not subscribe right now.');
        }

        setSubscribed(true);
        setSubscribeMessage(data.message || "Successfully subscribed!");
        setTimeout(() => setSubscribed(false), 3000);
        setEmail("");
      } catch (error) {
        setSubscribeError(error.message || "Could not subscribe right now.");
      } finally {
        setSubscribing(false);
      }
    }
  };

  return (
    <footer 
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1d29 50%, #0f1419 100%)'
      }}
    >

      <div className="absolute inset-0">

        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-r from-lime-400/8 via-violet-400/6 to-cyan-400/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-r from-violet-400/8 via-cyan-400/6 to-lime-400/8 rounded-full blur-[150px]" />
      </div>


      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(163,230,53,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(163,230,53,0.3) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="relative z-10">

        <div className="h-px bg-gradient-to-r from-transparent via-lime-400/40 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-lime-400/10 to-transparent" />


        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 py-16 sm:py-24">

          <div 
            className="mb-16 sm:mb-24"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(40px)',
              transition: 'all 1s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s'
            }}
          >
            <div className="max-w-3xl mx-auto text-center">

              <div className="inline-flex items-center gap-2 bg-lime-400/10 border border-lime-400/30 rounded-full px-6 py-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-lime-400" />
                <span className="text-lime-400 text-xs font-medium uppercase tracking-wider" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Stay Connected
                </span>
              </div>
              

              <h3 
                className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-violet-400">
                  Learning Insights
                </span>
                <br />
                <span className="text-white">Delivered Weekly</span>
              </h3>
              

              <p 
                className="text-neutral-300 text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Join 50,000+ learners receiving exclusive tips, success stories, and personalized learning recommendations every week.
              </p>


              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-5 py-3 rounded-full bg-neutral-900/60 border border-neutral-700/50 text-white placeholder-neutral-400 focus:outline-none focus:border-lime-400/60 transition-colors text-sm"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-6 py-3 rounded-full bg-lime-400 text-black font-semibold text-sm hover:bg-lime-300 transition-all duration-300 hover:scale-105"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {subscribing ? "Subscribing..." : "Subscribe"}
                </button>
              </form>

              {subscribeError && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30">
                  <span className="text-red-300 text-sm font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {subscribeError}
                  </span>
                </div>
              )}

              {subscribed && (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-400/20 border border-lime-400/30">
                  <svg className="w-4 h-4 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-lime-400 text-sm font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {subscribeMessage || "Successfully subscribed!"}
                  </span>
                </div>
              )}
            </div>
          </div>


          <div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 sm:gap-12 mb-16 sm:mb-20"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.25,0.46,0.45,0.94) 0.2s'
            }}
          >

            <div className="col-span-2 md:col-span-1">
              <div className="mb-6">
                <h4 
                  className="mb-3 flex items-center gap-2 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-violet-400"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  <img src={clustrNetworkLogo} alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain" />
                  Clustr
                </h4>
                <p 
                  className="text-neutral-400 text-sm leading-relaxed"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Exchange what you know for what you want to learn — with real people, in real time.
                </p>
              </div>


              <div className="flex flex-wrap gap-3">
                {SOCIAL_LINKS.map((social, i) => (
                  <a
                    key={i}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 rounded-xl bg-neutral-900/60 border border-neutral-700/50 flex items-center justify-center text-neutral-400 hover:text-lime-400 hover:border-lime-400/60 transition-all duration-300"
                  >
                    <span className="text-xs font-bold">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>


            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <h5 
                  className="text-white font-semibold text-xs uppercase tracking-wider mb-4 pb-2 border-b border-neutral-800/50"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </h5>
                <ul className="space-y-2">
                  {links.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.href}
                        className="block text-neutral-400 hover:text-lime-400 transition-colors duration-200 text-sm"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>


          <div 
            className="pt-6 border-t border-neutral-800/50"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.25,0.46,0.45,0.94) 0.3s'
            }}
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p 
                className="text-neutral-500 text-sm"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                © 2026 <span className="text-lime-400 font-medium">Clustr</span>. All rights reserved.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-lime-400" />
                  <span className="text-neutral-400 text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Status: Operational
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <a href="#" className="text-neutral-400 hover:text-lime-400 transition-colors duration-200 text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Cookie Settings
                  </a>
                  <a href="#" className="text-neutral-400 hover:text-lime-400 transition-colors duration-200 text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Language
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div className="h-16 bg-gradient-to-t from-black to-transparent" />
      </div>
    </footer>
  );
}
