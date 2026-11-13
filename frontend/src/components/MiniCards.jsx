import { useState } from "react";

const CARDS = [
  {
    src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&q=80",
    label: "Design",
    color: "text-lime-400",
  },
  {
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&q=80",
    label: "Coding",
    color: "text-violet-400",
  },
  {
    src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80",
    label: "Marketing",
    color: "text-cyan-400",
  },
];

export default function MiniCards({ visible }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-5">
      <div className="flex flex-col gap-3 max-w-[280px] sm:max-w-[200px] sm:pb-3">
        <p className="text-sm text-neutral-300 font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Choose what you <span className="text-white border-b-2 border-lime-400 pb-0.5">want</span> to learn
        </p>
        <p className="text-xs text-neutral-500 leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          The best specialists from all over the world are waiting to{" "}
          <strong className="text-neutral-400 font-bold">share their knowledge</strong> with you.
        </p>

        <div className="flex items-center gap-2 mt-1">
          <div className="flex -space-x-2">
            {["#a3e635", "#a78bfa", "#22d3ee"].map((bg, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border-2 border-[#0d0d0d] flex items-center justify-center text-[8px] font-bold text-black"
                style={{ backgroundColor: bg }}
              >
                {["A", "M", "P"][i]}
              </div>
            ))}
          </div>
          <span className="text-[11px] text-neutral-500" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            +12k active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-5">
        {CARDS.map((card, i) => (
          <div
            key={i}
            className="h-32 sm:h-40 rounded-2xl overflow-hidden cursor-pointer relative min-w-0 sm:w-28 sm:shrink-0"
            style={{
              transitionProperty: "opacity, transform, filter",
              transitionDuration: "700ms",
              transitionTimingFunction: "cubic-bezier(0.25,0.46,0.45,0.94)",
              transitionDelay: `${0.8 + i * 0.15}s`,
              opacity: visible ? 1 : 0,
              transform: visible
                ? hoveredIdx === i
                  ? "translateY(-6px) scale(1.04)"
                  : "translateY(0) rotate(0deg) scale(1)"
                : `translateY(40px) rotate(${i % 2 === 0 ? "-8deg" : "8deg"}) scale(0.8)`,
              filter: visible ? "blur(0px)" : "blur(8px)",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <img
              src={card.src}
              alt={card.label}
              className="w-full h-full object-cover"
              style={{
                transform: hoveredIdx === i ? "scale(1.08)" : "scale(1)",
                transition: "transform 400ms ease",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div
              className="absolute bottom-0 left-0 right-0 p-3"
              style={{
                transform: hoveredIdx === i ? "translateY(0)" : "translateY(6px)",
                opacity: hoveredIdx === i ? 1 : 0.7,
                transition: "all 300ms ease",
              }}
            >
              <span className={`text-xs font-bold ${card.color}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {card.label}
              </span>
            </div>
            <div
              className="absolute inset-0 rounded-2xl border-2 transition-all duration-300"
              style={{
                borderColor: hoveredIdx === i ? "rgba(163,230,53,0.5)" : "transparent",
                boxShadow: hoveredIdx === i ? "inset 0 0 16px rgba(163,230,53,0.08)" : "none",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
