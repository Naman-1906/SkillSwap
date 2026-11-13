import { useEffect, useRef, useState } from "react";
import SearchBar from "./SearchBar";
import MiniCards from "./MiniCards";

function FadeUp({ children, visible, delay = 0, className = "" }) {
  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.9s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s, transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function Hero() {
  const [visible, setVisible] = useState(false);
  const [underlineDrawn, setUnderline] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setUnderline(true), 850);
    videoRef.current?.play().catch(() => {});

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <section
      id="section-hero"
      className="relative min-h-screen"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1a1d29 50%, #0f1419 100%)" }}
    >
      <section className="flex flex-col lg:flex-row gap-12 lg:gap-16 px-4 sm:px-6 lg:px-16 pt-16 sm:pt-20 lg:pt-24 pb-16 sm:pb-20 lg:pb-24 max-w-[1280px] mx-auto items-start">
        <FadeUp
          visible={visible}
          delay={0.08}
          className="w-full max-w-[400px] mx-auto lg:mx-0 shrink-0 flex flex-col gap-5 order-2 lg:order-1"
        >
          <div className="rounded-3xl overflow-hidden relative aspect-[4/5] sm:h-[480px] sm:aspect-auto">
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-[1.02]"
              autoPlay
              muted
              loop
              playsInline
            >
              <source src="https://assets.mixkit.co/active_storage/video_items/100455/1724284388/100455-video-720.mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:bottom-5 sm:left-5 flex items-center justify-center sm:justify-start gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-white text-[11px] sm:text-xs font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>
                Live sessions happening now
              </span>
            </div>
          </div>

          <FadeUp visible={visible} delay={0.5}>
            <div className="grid grid-cols-2 bg-neutral-900/70 rounded-2xl border border-neutral-800 overflow-hidden">
              {[
                { n: "100+", l: "Fields of study" },
                { n: "12k", l: "Active learners" },
              ].map((stat, i) => (
                <div key={stat.l} className={`px-4 sm:px-6 py-4 sm:py-5 ${i === 0 ? "border-r border-neutral-800" : ""}`}>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-[-1px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {stat.n}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-neutral-500 uppercase tracking-[2px] sm:tracking-[2.5px] mt-1.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {stat.l}
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </FadeUp>

        <div className="flex-1 flex flex-col gap-7 sm:gap-9 pt-0 lg:pt-4 order-1 lg:order-2">
          <FadeUp visible={visible} delay={0.12}>
            <div className="inline-flex items-center gap-2.5 bg-lime-400/8 border border-lime-400/20 rounded-full px-4 py-2 w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-lime-400" />
              <span className="text-lime-400 text-xs font-semibold tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
                The skill exchange platform
              </span>
            </div>
          </FadeUp>

          <FadeUp visible={visible} delay={0.22}>
            <h1
              className="text-[42px] sm:text-[58px] lg:text-[80px] font-extrabold leading-[0.96] tracking-[-2px] sm:tracking-[-3px] lg:tracking-[-4px] text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Swap skills.
              <br />
              <span className="relative inline-block">
                Grow faster.
                <span
                  className="absolute left-0 bottom-[-5px] h-[5px] bg-lime-400 rounded-full"
                  style={{
                    width: underlineDrawn ? "100%" : "0%",
                    transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </span>
            </h1>
          </FadeUp>

          <FadeUp visible={visible} delay={0.36}>
            <p className="text-[15px] sm:text-[17px] text-neutral-400 max-w-[400px] leading-[1.8]" style={{ fontFamily: "'Inter', sans-serif" }}>
              Exchange what you know for what you want to learn with real people, in real time.
            </p>
          </FadeUp>

          <FadeUp visible={visible} delay={0.48}>
            <SearchBar />
          </FadeUp>

          <FadeUp visible={visible} delay={0.62}>
            <MiniCards visible={visible} />
          </FadeUp>
        </div>
      </section>
    </section>
  );
}
