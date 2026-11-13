import { useEffect, useRef, useState } from "react";
import studentStudyingVideo from "../assets/videos/student-studying-in-library.mp4";

function useInView(threshold = 0.2) {
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

export default function OurMission() {
  const [sectionRef, inView] = useInView(0.15);
  const [imageRef, imageInView] = useInView(0.2);

  const missionPoints = [
    {
      title: "Accessible Learning",
      desc: "Quality education for everyone, everywhere",
      icon: (
        <svg className="w-6 h-6 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Peer Collaboration",
      desc: "Learn by teaching, teach by learning",
      icon: (
        <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: "Skill Growth",
      desc: "Accelerate your journey with guided practice",
      icon: (
        <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="section-mission"
      className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-12 relative overflow-hidden border-t-2 border-b-2"
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        background: "linear-gradient(135deg, #1a1d29 0%, #0d0d0d 40%, #1a1d29 70%, #15314dff 100%)",
        borderTopColor: "rgba(163,230,53,0.3)",
        borderBottomColor: "rgba(163,230,53,0.3)",
        boxShadow: "inset 0 1px 0 rgba(163,230,53,0.1), inset 0 -1px 0 rgba(163,230,53,0.1)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute top-20 left-10 w-32 h-32 text-lime-400/20" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
          <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 6" />
        </svg>
        <div className="absolute top-32 right-20 text-lime-400/30" style={{ clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)", width: "40px", height: "40px", background: "currentColor" }} />
        <div className="absolute bottom-40 left-20 text-cyan-400/20" style={{ clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)", width: "24px", height: "24px", background: "currentColor" }} />
      </div>

      <div className="max-w-7xl mx-auto relative">
        <div
          className="text-center mb-12 sm:mb-16 lg:mb-20"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-lime-400/50" />
            <span className="text-[10px] sm:text-xs font-black tracking-[4px] sm:tracking-[6px] text-lime-400 uppercase">About Us</span>
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-lime-400/50" />
          </div>

          <h2 className="text-[40px] sm:text-[56px] lg:text-[72px] font-black leading-[1] tracking-[-2px] sm:tracking-[-3px] lg:tracking-[-4px] text-white mb-6">
            Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600">Mission</span> Behind This Platform
          </h2>

          <p className="mt-6 sm:mt-10 text-[15px] sm:text-[18px] text-neutral-200 max-w-3xl mx-auto leading-[1.7]">
            Our mission is to make quality education accessible, empowering learners to grow, explore, and achieve their goals through collaborative skill exchange.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div
            ref={imageRef}
            className="relative mb-10 lg:mb-0"
            style={{
              opacity: imageInView ? 1 : 0,
              transform: imageInView ? "translateX(0)" : "translateX(-60px)",
              transition: "all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s",
            }}
          >
            <div className="absolute -left-2 sm:-left-4 -top-2 sm:-top-4 w-full h-full border-2 border-lime-400/30 rounded-3xl" />
            <div className="absolute -right-2 sm:-right-4 -bottom-2 sm:-bottom-4 w-full h-full border-2 border-cyan-400/20 rounded-3xl" />

            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 p-2">
              <div className="rounded-2xl overflow-hidden bg-[#252a3a]">
                <div className="aspect-[4/3] relative">
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    src={studentStudyingVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-lime-400/10 pointer-events-none" />
                </div>
              </div>
            </div>

            <div
              className="absolute left-4 right-4 -bottom-10 sm:left-auto sm:right-4 lg:-bottom-6 lg:-right-6 bg-[#1a1d29]/80 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              style={{
                opacity: imageInView ? 1 : 0,
                transform: imageInView ? "scale(1)" : "scale(0.8)",
                transition: "all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.5s",
              }}
            >
              <div className="text-white font-black text-lg sm:text-2xl">United States</div>
              <div className="text-neutral-300 text-sm mt-1">Students Helped</div>
              <div className="border-t border-white/[0.08] pt-3 mt-3 flex items-baseline gap-1">
                <span className="text-3xl sm:text-5xl font-black text-white">12.5K</span>
                <span className="text-neutral-300 text-sm">active learners</span>
              </div>
            </div>
          </div>

          <div
            className="space-y-8"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateX(0)" : "translateX(60px)",
              transition: "all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s",
            }}
          >
            <div>
              <h3 className="text-[32px] sm:text-[38px] lg:text-[44px] font-bold text-white mb-6 leading-[1.1]">
                Make Class Material <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Instantly Studiable</span> at Your Pace
              </h3>
              <p className="text-[15px] sm:text-[17px] text-neutral-200 leading-[1.8] max-w-lg">
                Turn your slides, videos, and notes into flashcard sets, practice tests, and study guides. Our platform empowers you to learn collaboratively by exchanging skills with peers worldwide.
              </p>
            </div>

            <div className="space-y-4">
              {missionPoints.map((point, i) => (
                <div
                  key={point.title}
                  className="flex items-start gap-3 sm:gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-300 group"
                  style={{
                    opacity: inView ? 1 : 0,
                    transform: inView ? "translateY(0)" : "translateY(20px)",
                    transition: `all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.4 + i * 0.1}s`,
                  }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-400/20 to-cyan-400/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    {point.icon}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg sm:text-xl mb-2 sm:mb-3">{point.title}</h4>
                    <p className="text-neutral-300 text-sm leading-[1.7]">{point.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(20px)",
                transition: "all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.7s",
              }}
            >
              <button className="group inline-flex items-center gap-3 px-6 sm:px-10 py-4 rounded-full bg-gradient-to-r from-lime-400 to-cyan-400 text-black font-bold text-[15px] sm:text-[16px] hover:from-lime-300 hover:to-cyan-300 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-[0_8px_32px_rgba(163,230,53,0.3)] hover:shadow-[0_12px_40px_rgba(163,230,53,0.4)]">
                <span>Start swapping skills</span>
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
