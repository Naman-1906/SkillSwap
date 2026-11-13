import { useEffect, useRef, useState } from "react";
import learnerIllustration from "../assets/images/learner-illustration.png";

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setInView(true);
    }, { threshold });

    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView];
}

function StickerCard({ children, style, className = "" }) {
  return (
    <div
      className={`absolute backdrop-blur-xl bg-neutral-950/80 border border-neutral-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function FloatDot({ style }) {
  return <div className="absolute rounded-full bg-lime-400/20 animate-pulse" style={style} />;
}

const FEATURES = [
  {
    title: "Your schedule",
    desc: "No fixed timetables. Learn when you want.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: "Real people",
    desc: "Practitioners, not just educators.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    title: "Track growth",
    desc: "Skill levels, history, rep. All in one.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];

function ProgressBar({ label, pct, color, delay, inView }) {
  return (
    <div style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(8px)", transition: `all 0.6s ease ${delay}s` }}>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-neutral-400" style={{ fontFamily: "'Inter', sans-serif" }}>{label}</span>
        <span className="text-xs font-bold" style={{ color, fontFamily: "'DM Sans', sans-serif" }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: inView ? `${pct}%` : "0%",
            backgroundColor: color,
            transition: `width 1.2s cubic-bezier(0.25,1,0.5,1) ${delay + 0.2}s`,
          }}
        />
      </div>
    </div>
  );
}

export default function Learn() {
  const [sectionRef, inView] = useInView(0.15);

  return (
    <section
      ref={sectionRef}
      id="section-learn"
      className="relative overflow-hidden"
      style={{
        minHeight: 700,
        background: "linear-gradient(135deg, #0f1419 0%, #33274b1b 30%, #0d0d0d 70%, #0e1220ff 100%)",
      }}
    >
      <style>{`
        @keyframes drift {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(1deg); }
          66% { transform: translateY(4px) rotate(-0.5deg); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(-1.5deg); }
        }
        @keyframes drift3 {
          0%, 100% { transform: translateY(0px); }
          40% { transform: translateY(6px); }
          80% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
        .float-1 { animation: drift 7s ease-in-out infinite; }
        .float-2 { animation: drift2 9s ease-in-out infinite; }
        .float-3 { animation: drift3 5s ease-in-out infinite; }
        .shimmer { animation: shimmer 3s ease-in-out infinite; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(163,230,53,0.05) 0%, transparent 65%)" }} />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 65%)" }} />
      </div>

      <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-0 items-center min-h-[700px]">
          <div
            className="py-16 sm:py-20 lg:py-28 lg:pr-12 relative z-10"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(28px)",
              transition: "all 0.85s cubic-bezier(0.25,0.46,0.45,0.94)",
            }}
          >
            <p className="text-[11px] font-bold tracking-[6px] text-lime-400 uppercase mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
              Flexible learning
            </p>

            <h2 className="text-[36px] sm:text-[44px] lg:text-[52px] font-extrabold leading-[1] tracking-[-2px] lg:tracking-[-3px] text-white mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Learn anytime,
              <br />
              <span className="text-neutral-500">at your pace.</span>
            </h2>

            <p className="text-[16px] text-neutral-400 leading-[1.85] mb-10 max-w-[400px]" style={{ fontFamily: "'Inter', sans-serif" }}>
              No fixed schedules. No pressure. Book sessions when it suits you, with people who match your goals exactly.
            </p>

            <div className="flex flex-col gap-5 mb-10">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4"
                  style={{
                    opacity: inView ? 1 : 0,
                    transform: inView ? "translateY(0)" : "translateY(14px)",
                    transition: `all 0.7s cubic-bezier(0.25,0.46,0.45,0.94) ${0.2 + i * 0.1}s`,
                  }}
                >
                  <div className="w-9 h-9 rounded-xl bg-lime-400/8 border border-lime-400/15 flex items-center justify-center text-lime-400 shrink-0 mt-0.5">
                    {feature.icon}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm mb-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {feature.title}
                    </div>
                    <div className="text-neutral-500 text-sm leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {feature.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="flex items-center gap-2 bg-lime-400 hover:bg-lime-300 text-black font-bold text-sm px-6 py-3.5 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(14px)",
                transition: "all 0.7s cubic-bezier(0.25,0.46,0.45,0.94) 0.55s",
              }}
            >
              Start learning free
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

          <div className="relative h-[520px] sm:h-[620px] lg:h-[700px]" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.8s ease 0.3s" }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[240px] h-[360px] sm:w-[320px] sm:h-[500px] lg:w-[380px] lg:h-[580px]" style={{ zIndex: 5 }}>
              <div className="w-full h-full relative" style={{ filter: "drop-shadow(0 0 40px rgba(163,230,53,0.15))" }}>
                <img
                  src={learnerIllustration}
                  alt="Learner"
                  className="w-full h-full object-contain object-center"
                  style={{
                    borderRadius: "999px 999px 0 0",
                    maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                  }}
                />
              </div>
            </div>

            <StickerCard className="float-1 w-[150px] sm:w-[200px] p-3 sm:p-4" style={{ top: 40, left: 0, zIndex: 10 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                <span className="text-[10px] font-bold tracking-[2px] text-lime-400 uppercase" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Live now
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">MT</div>
                <div>
                  <div className="text-white text-xs font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>Marco T.</div>
                  <div className="text-neutral-500 text-[10px]" style={{ fontFamily: "'Inter', sans-serif" }}>Teaching React</div>
                </div>
              </div>
              <div className="mt-3 bg-lime-400/10 border border-lime-400/20 rounded-lg px-2.5 py-1.5 text-center">
                <span className="text-lime-400 text-[11px] font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>Join session</span>
              </div>
            </StickerCard>

            <StickerCard className="float-2 w-[160px] sm:w-[210px] p-3 sm:p-4" style={{ top: 90, right: 0, zIndex: 10 }}>
              <div className="text-[10px] font-bold tracking-[2px] text-neutral-500 uppercase mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                Your progress
              </div>
              <div className="flex flex-col gap-2.5">
                <ProgressBar label="React" pct={78} color="#a3e635" delay={0.4} inView={inView} />
                <ProgressBar label="Figma" pct={55} color="#a78bfa" delay={0.5} inView={inView} />
                <ProgressBar label="Python" pct={40} color="#22d3ee" delay={0.6} inView={inView} />
              </div>
            </StickerCard>

            <StickerCard className="float-3 px-3 sm:px-4 py-2.5 sm:py-3" style={{ bottom: 140, left: 0, zIndex: 10 }}>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl">★</span>
                <div>
                  <div className="text-white text-sm sm:text-base font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>4.9</div>
                  <div className="text-neutral-500 text-[10px]" style={{ fontFamily: "'Inter', sans-serif" }}>avg rating</div>
                </div>
              </div>
            </StickerCard>

            <StickerCard className="float-1 px-3 sm:px-4 py-2.5 sm:py-3" style={{ top: 250, right: 0, zIndex: 10, animationDelay: "1.5s" }}>
              <div className="text-[10px] font-bold tracking-[2px] text-neutral-500 uppercase mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                Swaps done
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>50k+</div>
              <div className="flex gap-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full bg-lime-400/40 shimmer" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </StickerCard>

            <StickerCard className="float-2 px-3 py-2" style={{ bottom: 210, right: 12, zIndex: 10, animationDelay: "3s", borderColor: "rgba(163,230,53,0.3)" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-lime-400 flex items-center justify-center">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span className="text-white text-xs font-bold" style={{ fontFamily: "'Inter', sans-serif" }}>Free to start</span>
              </div>
            </StickerCard>

            <FloatDot style={{ width: 6, height: 6, top: 60, right: 80, animationDelay: "0s", animationDuration: "2s" }} />
            <FloatDot style={{ width: 4, height: 4, top: 200, left: 30, animationDelay: "0.5s", animationDuration: "3s" }} />
            <FloatDot style={{ width: 8, height: 8, bottom: 180, right: 60, animationDelay: "1s", animationDuration: "2.5s" }} />
            <FloatDot style={{ width: 5, height: 5, bottom: 100, left: 60, animationDelay: "1.5s", animationDuration: "4s" }} />

            <div className="absolute rounded-full border border-lime-400/10 float-3" style={{ width: 220, height: 220, top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1 }} />
            <div className="absolute rounded-full border border-lime-400/5 float-2" style={{ width: 320, height: 320, top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1, animationDelay: "2s" }} />
          </div>
        </div>
      </div>
    </section>
  );
}
