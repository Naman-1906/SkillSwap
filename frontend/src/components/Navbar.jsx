import { useState, useEffect, useCallback } from "react";
import clustrNetworkLogo from "../assets/logos/clustr-network-logo.png";

const NAV_LINKS = [
  { label: "Home",      id: "section-hero"      },
  { label: "Learn",     id: "section-learn"     },
  { label: "Countries", id: "section-countries" },
  { label: "Mission",   id: "section-mission"   },
];

const NAVBAR_HEIGHT = 64;

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getActiveSection() {

  const scrollPos = window.scrollY + NAVBAR_HEIGHT + 10;


  const positions = NAV_LINKS.map(({ id }) => {
    const el = document.getElementById(id);
    return { id, top: el ? el.offsetTop : Infinity };
  });


  let active = positions[0].id;
  for (const { id, top } of positions) {
    if (top <= scrollPos) active = id;
  }
  return active;
}

function getDefaultClustrUrl() {
  return 'http://localhost:5173';
}

export default function Navbar({ onLogin, onLogout, user, authReady }) {
  const [scrolled,      setScrolled]      = useState(false);
  const [activeSection, setActiveSection] = useState("section-hero");
  const [menuOpen,      setMenuOpen]      = useState(false);
  const clustrEnvUrl = import.meta.env.VITE_CLUSTR_URL?.replace(/\/$/, "");
  const clustrAuthUrl = `${clustrEnvUrl || getDefaultClustrUrl()}/auth`;

  const handleLogin = () => {
    if (typeof window !== 'undefined') {
      if (typeof onLogin === 'function') {
        onLogin();
      } else {
        window.location.href = clustrAuthUrl;
      }
    }
  };

  const updateActive = useCallback(() => {
    setScrolled(window.scrollY > 20);
    setActiveSection(getActiveSection());
  }, []);

  useEffect(() => {
    let rafId = null;

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateActive);
    };

    window.addEventListener("scroll", onScroll, { passive: true });


    const timer = setTimeout(updateActive, 200);

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [updateActive]);

  const authLabel = user?.displayName || user?.email || "Account";

  return (
    <nav
      className={`flex items-center justify-between px-4 sm:px-6 md:px-16 py-4 sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#0f1117]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
          : "bg-transparent"
      }`}
    >
      {}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); scrollToId("section-hero"); }}
        className="flex items-center gap-2 group shrink-0"
        aria-label="Clustr home"
      >
        <img src={clustrNetworkLogo} alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain" />
        <span
          className="whitespace-nowrap text-xl font-bold tracking-tight text-lime-400 transition-colors duration-300"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Clustr
        </span>
      </a>

      {}
      <div className="hidden md:flex items-center gap-0.5 bg-white/[0.06] border border-white/[0.10] rounded-full px-2 py-1.5">
        {NAV_LINKS.map((link) => {
          const isActive = activeSection === link.id;
          return (
            <button
              key={link.id}
              onClick={() => scrollToId(link.id)}
              className={`text-[13.5px] transition-all duration-200 px-5 py-1.5 rounded-full cursor-pointer ${
                isActive
                  ? "bg-lime-400 text-black font-semibold shadow-[0_0_14px_rgba(163,230,53,0.5)]"
                  : "text-neutral-300 hover:text-white hover:bg-white/[0.08]"
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      {}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        {authReady && user ? (
          <>
            <span
              className="max-w-[180px] truncate px-3 py-1.5 text-[13.5px] text-neutral-200"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {authLabel}
            </span>
            <button
              onClick={onLogout}
              className="text-[13.5px] text-neutral-300 hover:text-white transition-colors duration-200 px-5 py-1.5 rounded-full hover:bg-white/[0.08] cursor-pointer"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Log out
            </button>
          </>
        ) : (
          <button
            onClick={handleLogin}
            className="text-[13.5px] text-neutral-300 hover:text-white transition-colors duration-200 px-5 py-1.5 rounded-full hover:bg-white/[0.08] cursor-pointer"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Log in
          </button>
        )}

        <button
          onClick={user ? onLogout : handleLogin}
          className="flex items-center gap-2 text-[13.5px] font-semibold text-black bg-lime-400 hover:bg-lime-300 px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_20px_rgba(163,230,53,0.2)] hover:shadow-[0_0_28px_rgba(163,230,53,0.35)]"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {user ? "Sign out" : "Get started"}
          {!user && (
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          )}
        </button>
      </div>

      {}
      <button
        className="md:hidden flex flex-col gap-1.5 p-2"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span className={`block w-6 h-0.5 bg-white transition-all duration-300 origin-center ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
        <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
        <span className={`block w-6 h-0.5 bg-white transition-all duration-300 origin-center ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
      </button>

      {}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#0f1117]/95 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 py-6 flex flex-col gap-2 md:hidden">
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                onClick={() => { scrollToId(link.id); setMenuOpen(false); }}
                className={`text-left text-sm px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-lime-400/20 text-lime-400 font-semibold border border-lime-400/30"
                    : "text-neutral-300 hover:text-white hover:bg-white/[0.06]"
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {link.label}
              </button>
            );
          })}
          <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.08]">
            {authReady && user ? (
              <button
                onClick={() => {
                  onLogout?.();
                  setMenuOpen(false);
                }}
                className="flex-1 text-sm text-neutral-300 border border-white/[0.15] rounded-full py-2.5 hover:bg-white/[0.06] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Log out
              </button>
            ) : (
              <button
                onClick={() => {
                  onLogin?.();
                  setMenuOpen(false);
                }}
                className="flex-1 text-sm text-neutral-300 border border-white/[0.15] rounded-full py-2.5 hover:bg-white/[0.06] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Log in
              </button>
            )}
            <button
              onClick={() => {
                if (user) {
                  onLogout?.();
                } else {
                  handleLogin();
                }
                setMenuOpen(false);
              }}
              className="flex-1 text-sm font-semibold text-black bg-lime-400 hover:bg-lime-300 rounded-full py-2.5 transition-colors"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {user ? "Sign out" : "Get started"}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
