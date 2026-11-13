import { useState, useEffect, useRef } from "react";

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

function useCounter(target, inView, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 4)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);
  return count;
}

function Counter({ value, suffix = "" }) {
  const [ref, inView] = useInView(0.3);
  const count = useCounter(value, inView);
  return <span ref={ref}>{count}{suffix}</span>;
}

const ACTIVITIES = [
  { user: "Aiko T.",    gave: "Figma",      got: "Python",    time: "2m ago",  avatar: "AT" },
  { user: "Marcus R.",  gave: "Guitar",     got: "Spanish",   time: "5m ago",  avatar: "MR" },
  { user: "Priya S.",   gave: "React",      got: "Yoga",      time: "8m ago",  avatar: "PS" },
  { user: "Leon K.",    gave: "Video edit", got: "SEO",       time: "11m ago", avatar: "LK" },
  { user: "Nadia F.",   gave: "Copywriting",got: "Branding",  time: "14m ago", avatar: "NF" },
  { user: "Omar J.",    gave: "Finance",    got: "Web3",      time: "17m ago", avatar: "OJ" },
];

const ACCENT = [
  { text: "text-lime-400",   faint: "bg-lime-400/10",   border: "border-lime-400/20",   glow: "rgba(163,230,53,0.12)"  },
  { text: "text-violet-400", faint: "bg-violet-400/10", border: "border-violet-400/20", glow: "rgba(167,139,250,0.12)" },
  { text: "text-cyan-400",   faint: "bg-cyan-400/10",   border: "border-cyan-400/20",   glow: "rgba(34,211,238,0.12)"  },
  { text: "text-orange-400", faint: "bg-orange-400/10", border: "border-orange-400/20", glow: "rgba(251,146,60,0.12)"  },
];

const FEATURES = [
  {
    i: 0, tag: "Core mechanic",
    title: "Teach one.\nLearn one.",
    body: "No money changes hands. Give an hour of what you know, get an hour of what you want. That's it.",
    stat: 50, statSuffix: "k+", statLabel: "swaps completed",
    icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>,
  },
  {
    i: 1, tag: "Smart matching",
    title: "Find your\nexact match.",
    body: "Paired by goals, schedule, and skill level — not just availability. The right person, fast.",
    stat: 3, statSuffix: "min", statLabel: "avg. match time",
    icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>,
  },
  {
    i: 2, tag: "Format",
    title: "Short sessions.\nBig results.",
    body: "30-minute focused swaps. No fluff, no lectures. Just two people making each other better.",
    stat: 30, statSuffix: "min", statLabel: "per session",
    icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  },
  {
    i: 3, tag: "Progress",
    title: "Track every\nlevel up.",
    body: "Skill progression, session history, community reputation. Watch yourself grow with every swap.",
    stat: 98, statSuffix: "%", statLabel: "report real progress",
    icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
  },
];


function FeatureCarousel({ inView }) {
  const trackRef  = useRef(null);
  const posRef    = useRef(0);
  const pausedRef = useRef(false);
  const rafRef    = useRef(null);
  const SPEED     = 0.55; 
  const CARD_W    = 460 + 24; 



  const cards = [...FEATURES, ...FEATURES]; 

  useEffect(() => {
    if (!inView) return;

    const tick = () => {
      const el = trackRef.current;
      if (el && !pausedRef.current) {
        posRef.current += SPEED;
        const halfScroll = CARD_W * FEATURES.length;

        if (posRef.current >= halfScroll) {
          posRef.current -= halfScroll;
        }
        el.scrollLeft = posRef.current;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, CARD_W]);

  return (
    <div className="relative">

      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0d0d0d] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0d0d0d] to-transparent z-10 pointer-events-none" />

      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-hidden px-24 py-8"
        style={{ scrollbarWidth: "none" }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
      >
        {cards.map((f, idx) => {
          const c = ACCENT[f.i];
          return (
            <div
              key={idx}
              className="shrink-0 w-[460px] rounded-3xl bg-neutral-900/60 border border-neutral-800/80 p-10 flex flex-col gap-8 cursor-default group"
              style={{ transition: "border-color 0.3s, box-shadow 0.4s" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#525252";
                e.currentTarget.style.boxShadow  = `0 20px 80px ${c.glow}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.boxShadow  = "";
              }}
            >

              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-2xl ${c.faint} border ${c.border} flex items-center justify-center ${c.text}`}>
                  {f.icon}
                </div>
                <span className={`text-[10px] font-bold tracking-[4px] uppercase ${c.text} opacity-50 pt-1`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {f.tag}
                </span>
              </div>


              <h3
                className="text-[34px] font-extrabold leading-[1.08] tracking-[-1.5px] text-white whitespace-pre-line"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {f.title}
              </h3>


              <p className="text-neutral-500 text-base leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {f.body}
              </p>


              <div className="mt-auto pt-8 border-t border-neutral-800 flex items-end justify-between">
                <div>
                  <div className={`text-5xl font-extrabold tabular-nums leading-none ${c.text}`}
                    style={{ fontFamily: "'Syne', sans-serif" }}>
                    <Counter value={f.stat} suffix={f.statSuffix} />
                  </div>
                  <div className="text-neutral-600 text-sm mt-2"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {f.statLabel}
                  </div>
                </div>
                <div className={`opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-9 h-9 rounded-full ${c.faint} border ${c.border} flex items-center justify-center`}>
                  <svg className={c.text} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ActivityFeed({ inView }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setActive(i => (i + 1) % ACTIVITIES.length), 2600);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div className="relative h-[72px] overflow-hidden">
      {ACTIVITIES.map((a, i) => {
        const offset = (i - active + ACTIVITIES.length) % ACTIVITIES.length;
        const isActive = offset === 0;
        const isPrev   = offset === ACTIVITIES.length - 1;
        return (
          <div
            key={i}
            className="absolute inset-x-0 transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
            style={{
              opacity: isActive ? 1 : 0,
              transform: isActive ? "translateY(0)" : isPrev ? "translateY(-100%)" : "translateY(100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-400 shrink-0"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {a.avatar}
              </div>
              <div className="flex-1">
                <span className="text-white text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>{a.user} </span>
                <span className="text-neutral-500 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>swapped </span>
                <span className="text-lime-400 text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>{a.gave}</span>
                <span className="text-neutral-600 text-sm mx-1">→</span>
                <span className="text-violet-400 text-sm font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>{a.got}</span>
              </div>
              <span className="text-neutral-700 text-xs shrink-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>{a.time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


export default function WhySkillSwap() {
  const [sectionRef, inView] = useInView(0.1);

  return (
    <section id="section-why" ref={sectionRef} className="py-32 relative overflow-hidden">

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(163,230,53,0.04),transparent)] pointer-events-none" />


      <div
        className="px-16 max-w-6xl mx-auto mb-16"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(28px)",
          transition: "all 0.8s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold tracking-[6px] text-lime-400 uppercase mb-5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Why SkillSwap
            </p>
            <h2
              className="text-[58px] font-extrabold leading-[0.93] tracking-[-3px] text-white"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              A different kind<br />
              <span className="text-neutral-600">of learning.</span>
            </h2>
          </div>
          <p className="text-neutral-500 max-w-[320px] text-[15px] leading-relaxed md:text-right"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Not passive watching. Not expensive courses.<br />
            A living exchange where knowledge flows both ways.
          </p>
        </div>
      </div>


      <div
        style={{
          opacity: inView ? 1 : 0,
          transition: "opacity 0.7s ease 0.3s",
        }}
      >
        <FeatureCarousel inView={inView} />
      </div>


      <div
        className="px-16 max-w-6xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-5 gap-5"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(28px)",
          transition: "all 0.8s cubic-bezier(0.25,0.46,0.45,0.94) 0.5s",
        }}
      >


        <div className="md:col-span-3 rounded-3xl border border-neutral-800/80 bg-neutral-900/40 p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(163,230,53,0.03),transparent_65%)] pointer-events-none" />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs font-bold text-neutral-400 tracking-[4px] uppercase"
                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Live activity
              </span>
            </div>
            <span className="text-xs text-neutral-700" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              updating live
            </span>
          </div>
          <ActivityFeed inView={inView} />


          <div className="flex gap-8 mt-8 pt-8 border-t border-neutral-800">
            {[
              { n: "12k+", l: "learners online" },
              { n: "80+",  l: "countries" },
              { n: "100+", l: "skill categories" },
            ].map(s => (
              <div key={s.l}>
                <div className="text-white text-xl font-extrabold" style={{ fontFamily: "'Syne', sans-serif" }}>{s.n}</div>
                <div className="text-neutral-600 text-xs mt-0.5" style={{ fontFamily: "'DM Sans', sans-serif" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>


        <div className="md:col-span-2 rounded-3xl border border-neutral-800/80 bg-neutral-900/40 p-8 flex flex-col justify-between relative overflow-hidden group hover:border-neutral-700 transition-all duration-400">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(167,139,250,0.05),transparent_65%)] pointer-events-none" />

          <div>
            <p className="text-[10px] font-bold tracking-[4px] text-violet-400 uppercase mb-5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Start today
            </p>
            <h3
              className="text-[28px] font-extrabold tracking-[-1px] text-white leading-[1.1] mb-4"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Your first swap<br />is waiting.
            </h3>
            <p className="text-neutral-500 text-sm leading-relaxed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Free to start. No credit card. Just bring a skill and curiosity.
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-8">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const clustrEnvUrl = import.meta.env.VITE_CLUSTR_URL?.replace(/\/$/, '');
                  const targetUrl = `${clustrEnvUrl || 'http://localhost:5173'}/auth`;
                  window.location.href = targetUrl;
                }
              }}
              className="flex items-center justify-center gap-2 bg-lime-400 hover:bg-lime-300 text-black font-bold text-sm px-6 py-3.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] w-full"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Get started free
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
            <button
              className="text-sm text-neutral-600 hover:text-neutral-300 transition-colors duration-200 py-2 text-center"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              See how it works →
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}