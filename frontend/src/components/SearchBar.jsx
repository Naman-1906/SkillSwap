import { useRef, useState } from "react";

export default function SearchBar() {
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState("");

  return (
    <div
      className={`flex w-full items-center bg-neutral-900/60 backdrop-blur-md border rounded-full px-4 sm:px-6 py-2.5 gap-3 max-w-[520px] transition-all duration-300 ${
        isFocused
          ? "border-lime-400 shadow-[0_0_0_3px_rgba(163,230,53,0.15),0_8px_32px_rgba(163,230,53,0.1)] scale-[1.02]"
          : "border-neutral-700/50 hover:border-neutral-600"
      }`}
    >

      <svg
        className={`shrink-0 transition-colors duration-300 ${isFocused ? "text-lime-400" : "text-neutral-500"}`}
        width="17"
        height="17"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What do you want to learn?"
        className="bg-transparent flex-1 min-w-0 text-sm text-white placeholder:text-neutral-500 outline-none"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />


      {value && (
        <button
          onClick={() => { setValue(""); inputRef.current?.focus(); }}
          className="text-neutral-600 hover:text-neutral-300 transition-colors duration-200 shrink-0"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}


      <button
        className="bg-lime-400 hover:bg-lime-300 transition-all duration-200 rounded-full w-10 h-10 flex items-center justify-center shrink-0 hover:scale-110 hover:shadow-lg hover:shadow-lime-400/30 active:scale-95"
        onClick={() => inputRef.current?.focus()}
      >
        <svg
          width="17"
          height="17"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#000"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
