import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMomoStore } from "@/store/useMomoStore";
import { screenAnalyzer } from "@/core/vision/screenAnalyzer";
import { memoryStore } from "@/core/memory/memoryStore";

interface FloatingOverlayProps {
  onOpenDashboard: () => void;
}

export function FloatingOverlay({ onOpenDashboard }: FloatingOverlayProps) {
  const {
    expression,
    activity,
    bubbleText,
    setBubble,
    startPTT,
    stopPTT,
    isRecording,
    sendMessage,
    isSending,
    isSpeaking,
    providerStatus,
    settings,
    updateSettings,
    captureScreenWithCheck,
    setActiveTab,
  } = useMomoStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [popoverFilter, setPopoverFilter] = useState("");
  const [miniPrompt, setMiniPrompt] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [memoriesCount, setMemoriesCount] = useState(() => memoryStore.getMemories().length);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [align, setAlign] = useState<"left" | "right" | "center">("center");

  useEffect(() => {
    const checkEdgePosition = () => {
      try {
        const winY = window.screenY ?? 0;
        const winX = window.screenX ?? 0;
        const availH = window.screen.availHeight || 1080;
        const availW = window.screen.availWidth || 1920;

        // If near top edge of the screen (< 160px), flip bubble below the capsule
        if (winY < 160) {
          setPlacement("bottom");
        } else {
          setPlacement("top");
        }

        // If near right edge of the screen, align bubble leftward; if near left edge, align rightward
        if (winX > availW - 440) {
          setAlign("left");
        } else if (winX < 180) {
          setAlign("right");
        } else {
          setAlign("center");
        }
      } catch {
        /* fallback */
      }
    };

    checkEdgePosition();
    const interval = setInterval(checkEdgePosition, 1200);
    window.addEventListener("resize", checkEdgePosition);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", checkEdgePosition);
    };
  }, []);

  // Auto-hide bubble after 7.5 seconds
  useEffect(() => {
    if (!bubbleText) return;
    const timer = setTimeout(() => {
      setBubble(null);
    }, 7500);
    return () => clearTimeout(timer);
  }, [bubbleText, setBubble]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMemoriesCount(memoryStore.getMemories().length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDrag = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button, input")) {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.startDragging();
      } catch {
        /* outside Tauri */
      }
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    const next = !isAlwaysOnTop;
    setIsAlwaysOnTop(next);
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setAlwaysOnTop(next);
    } catch {
      /* outside Tauri */
    }
  };

  const handleInspectScreen = async () => {
    if (isInspecting || isSending) return;
    setIsInspecting(true);
    try {
      const imageBase64 = await captureScreenWithCheck();
      if (!imageBase64) return;
      const { context } = await screenAnalyzer.analyzeScreen(imageBase64);
      const prompt =
        context.confidence < 0.6
          ? `[Screen inspect (low confidence: ${Math.round(context.confidence * 100)}%). Honestly admit you're not fully sure what is on screen, but give your thoughts on ${context.application} / ${context.activity}.]`
          : `[Screen inspect: ${context.application} - ${context.activity}. Give brief sharp feedback and playfully banter or roast what you see.]`;
      await sendMessage(prompt, { image: imageBase64 });
    } catch (err) {
      console.warn("Screen inspect failed:", err);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSendMiniPrompt = () => {
    if (!miniPrompt.trim() || isSending) return;
    sendMessage(miniPrompt);
    setMiniPrompt("");
  };

  const activeProvider = providerStatus.find((p) => p.state === "connected");
  const providerLabel = activeProvider
    ? activeProvider.id === "openrouter"
      ? "OpenRouter (Claude 3.5s)"
      : activeProvider.id === "groq"
      ? "Groq (Llama 3.3)"
      : "Gemini (2.0 Flash)"
    : "Local Engine";

  // If minimized into floating orb
  if (isMinimized) {
    return (
      <div
        className="w-full h-full flex items-end justify-end p-4 bg-transparent select-none cursor-pointer"
        onClick={() => setIsMinimized(false)}
        title="Click to expand Momo Companion"
      >
        <div className="relative flex items-center justify-center group" data-tauri-drag-region onMouseDown={handleDrag}>
          {/* Pulse ring */}
          <span className="absolute w-14 h-14 rounded-full bg-emerald-500/20 animate-ping"></span>
          {/* Orb Container */}
          <div className="w-12 h-12 rounded-full bg-[#0c1813] border-2 border-emerald-400/80 flex items-center justify-center shadow-xl shadow-emerald-950/80 group-hover:scale-110 transition-transform">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 48 48">
              <circle cx="12" cy="11" fill="#042f22" r="5" stroke="#10b981" strokeWidth="2"></circle>
              <circle cx="36" cy="11" fill="#042f22" r="5" stroke="#10b981" strokeWidth="2"></circle>
              <rect fill="#0c1d16" height="28" rx="12" stroke="#34d399" strokeWidth="2" width="32" x="8" y="10"></rect>
              <circle cx="17" cy="22" fill="#34d399" r="2"></circle>
              <circle cx="31" cy="22" fill="#34d399" r="2"></circle>
              <path d="M21 30 Q24 33 27 30" fill="none" stroke="#10b981" strokeLinecap="round" strokeWidth="2"></path>
            </svg>
          </div>
          {/* Unread badge */}
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center font-mono ring-2 ring-[#050807]">
            1
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col ${
        placement === "bottom" ? "justify-start" : "justify-end"
      } ${
        align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center"
      } p-2 sm:p-3 gap-2 bg-transparent select-none font-sans text-slate-200 antialiased overflow-hidden`}
      data-purpose="floating-companion-widget"
    >
      {/* 1. Quick Actions Popover (if opened) */}
      {showPopover && (
        <div
          className={`w-full bg-[#0c1210]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl shadow-black/90 ring-1 ring-emerald-500/30 p-3 flex flex-col gap-2.5 relative z-50 animate-bounce-subtle shrink-0 ${
            placement === "bottom" ? "order-3" : "order-1"
          }`}
          data-purpose="quick-actions-popover"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 border-b border-emerald-950/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-mono font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>⚡ Quick Actions &amp; Tools</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                ⌘K
              </span>
              <button
                className="text-slate-400 hover:text-emerald-400 p-0.5 rounded transition-colors"
                onClick={() => setShowPopover(false)}
                title="Close Palette"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clipRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    fillRule="evenodd"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          {/* Mini Filter */}
          <div className="relative flex items-center">
            <svg
              className="w-3.5 h-3.5 text-emerald-500/70 absolute left-2.5 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
            <input
              className="w-full bg-[#080d0b] text-[11px] font-mono text-emerald-100 placeholder-emerald-800/70 rounded-lg pl-8 pr-3 py-1.5 border border-emerald-900/50 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 outline-none"
              placeholder="Filter actions or shortcuts..."
              type="text"
              value={popoverFilter}
              onChange={(e) => setPopoverFilter(e.target.value)}
            />
          </div>

          {/* Categorized Action List */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
            {/* Vision & Screen */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-500/70 font-semibold px-1 mb-1 flex items-center gap-1.5">
                <span>👁️ Vision &amp; Screen</span>
              </div>
              <div className="space-y-1">
                <button
                  className="w-full flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-left transition-all group"
                  onClick={() => {
                    setShowPopover(false);
                    handleInspectScreen();
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-medium text-emerald-200 flex items-center gap-1.5">
                        <span>Inspect Active Window</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">Analyze screen context</div>
                    </div>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#070d0a] border border-emerald-800/40 text-emerald-300">
                    Alt + S
                  </kbd>
                </button>
              </div>
            </div>

            {/* Voice & Personality */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-500/70 font-semibold px-1 mb-1 flex items-center gap-1.5">
                <span>🎙️ Voice &amp; Personality</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#070d0a] border border-emerald-950/80">
                <span className="text-xs font-mono text-slate-300 pl-1">Roast Level</span>
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <span
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      settings.personality.roastLevel === 2
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-[#0f1814] text-slate-400 hover:text-emerald-300"
                    }`}
                    onClick={() => updateSettings({ personality: { ...settings.personality, roastLevel: 2 } })}
                  >
                    Cheeky
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      settings.personality.roastLevel === 3
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-[#0f1814] text-slate-400 hover:text-emerald-300"
                    }`}
                    onClick={() => updateSettings({ personality: { ...settings.personality, roastLevel: 3 } })}
                  >
                    Savage 🔥
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Popover Footer */}
          <div className="pt-2 border-t border-emerald-950/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span
              className="text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              onClick={() => {
                setShowPopover(false);
                setIsMinimized(true);
              }}
            >
              Dock to Mini Orb
            </span>
            <button
              onClick={() => {
                setShowPopover(false);
                onOpenDashboard();
              }}
              className="text-emerald-300 hover:text-emerald-200 flex items-center gap-1 bg-transparent border-0 p-0 font-mono"
            >
              Full Window ↵
            </button>
          </div>
        </div>
      )}

      {/* 2. Interactive Thought Bubble (strictly clamped, screen-edge aware, no overflow) */}
      {bubbleText && (
        <div
          className={`w-full max-w-[320px] max-h-[120px] hud-glass-elevated rounded-2xl p-2.5 sm:p-3 shadow-2xl shadow-emerald-950/80 border border-emerald-500/40 transition-all duration-200 shrink-0 relative cursor-pointer ${
            placement === "bottom" ? "order-2" : "order-2"
          }`}
          onClick={(e) => {
            if ((e.target as HTMLElement).tagName !== "BUTTON") {
              setBubble(null);
            }
          }}
          data-purpose="momo-speech-bubble"
        >
          {/* Edge-aware tail */}
          <div
            className={`absolute w-2.5 h-2.5 bg-[#0c1410] rotate-45 pointer-events-none ${
              placement === "bottom"
                ? "-top-1.5 border-l border-t border-emerald-500/40"
                : "-bottom-1.5 border-r border-b border-emerald-500/40"
            } ${
              align === "left" ? "left-8" : align === "right" ? "right-8" : "left-1/2 -translate-x-1/2"
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-emerald-500/15 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold text-[9.5px]">
                Momo
              </span>
              <span className="text-emerald-400/70 text-[9.5px]">Insight</span>
            </div>
            <button
              className="text-slate-400 hover:text-emerald-400 p-0.5 transition-colors"
              onClick={() => setBubble(null)}
              title="Dismiss remark"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  fillRule="evenodd"
                ></path>
              </svg>
            </button>
          </div>

          {/* Content: Clamped, wrapped, no horizontal/vertical overflow */}
          <div className="text-[12px] text-emerald-50 leading-snug break-words overflow-hidden line-clamp-3">
            <p className="m-0 font-medium">"{bubbleText}"</p>
          </div>

          {/* Quick Actions in Bubble */}
          <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-emerald-950/80 text-[9.5px] font-mono">
            <button
              className="px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                sendMessage(`Tell me more about: "${bubbleText}"`);
              }}
            >
              <span>⚡ Tell me more</span>
            </button>
            <span className="text-emerald-400/50 text-[9px] hover:text-emerald-300 transition-colors" onClick={() => setBubble(null)}>
              Click to dismiss
            </span>
          </div>
        </div>
      )}

      {/* 3. The Main Compact Floating Capsule HUD */}
      <div
        className={`w-full hud-glass rounded-2xl p-3 shadow-2xl shadow-black/80 border border-emerald-500/30 flex flex-col gap-2.5 relative overflow-hidden backdrop-blur-2xl shrink-0 ${
          placement === "bottom" ? "order-1" : "order-3"
        }`}
        data-purpose="main-companion-capsule"
      >
        {/* Top Grip & Status Pill */}
        <div
          className="flex items-center justify-between w-full border-b border-emerald-950 pb-1.5 cursor-grab active:cursor-grabbing"
          data-tauri-drag-region
          onMouseDown={handleDrag}
        >
          {/* Grip Dots & Avatar Indicator */}
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <div className="flex flex-col gap-0.5 p-0.5 text-emerald-700/60" title="Drag widget anywhere">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current"></span>
                <span className="w-1 h-1 rounded-full bg-current"></span>
                <span className="w-1 h-1 rounded-full bg-current"></span>
              </div>
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current"></span>
                <span className="w-1 h-1 rounded-full bg-current"></span>
                <span className="w-1 h-1 rounded-full bg-current"></span>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute"></div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/20"></div>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px]" data-tauri-drag-region>
              <span className="font-bold text-white tracking-wide">Momo</span>
              <span className="text-emerald-500/60">•</span>
              <span className="text-emerald-400 font-medium">
                {expression === "smug" ? "Cheeky" : expression === "thinking" ? "Thinking" : "Happy"}
              </span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/20">
                v2.4 PRO
              </span>
            </div>
          </div>

          {/* Controls: Pin, Popover, Full, Minimize */}
          <div className="flex items-center gap-0.5 text-slate-400">
            {/* Always on top button */}
            <button
              className={`p-1 rounded transition-colors ${
                isAlwaysOnTop ? "text-emerald-400 hover:text-emerald-300" : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={handleToggleAlwaysOnTop}
              title={isAlwaysOnTop ? "Always on Top (Active)" : "Pin Always on Top"}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a1 1 0 011 1v2.293l2.854 2.853a1 1 0 01.293.707V10a1 1 0 01-1 1h-2v6a1 1 0 11-2 0v-6H7a1 1 0 01-1-1V8.854a1 1 0 01.293-.707L9.146 5.293V3a1 1 0 011-1z"></path>
              </svg>
            </button>

            {/* Quick Actions Tools Toggle */}
            <button
              className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/60 transition-colors"
              onClick={() => setShowPopover((prev) => !prev)}
              title="Quick Actions & Tools (⌘K)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
            </button>

            {/* Expand to Full App Window */}
            <button
              className="p-1 rounded hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400 transition-colors group"
              onClick={onOpenDashboard}
              title="Expand to Full Momo Window"
            >
              <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                ></path>
              </svg>
            </button>

            {/* Collapse to Mini Orb */}
            <button
              className="p-1 rounded hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400 transition-colors"
              onClick={() => setIsMinimized(true)}
              title="Collapse to Mini Orb"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Center Interactive Row: Momo Animated Avatar + Reactive Voice Waveform */}
        <div className="flex items-center gap-3 px-1">
          {/* Momo Expressive Panda Icon Avatar */}
          <div
            className="relative group cursor-pointer shrink-0"
            onClick={() => sendMessage("Yo Momo, what do you think of my current workspace?")}
            title="Click Momo for quick banter"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0c1a14] via-[#09140f] to-[#040907] border-2 border-emerald-500/40 p-1.5 flex items-center justify-center shadow-lg shadow-emerald-950/60 group-hover:border-emerald-400 transition-all">
              <svg className="w-8 h-8 text-emerald-400 animate-bounce-subtle" fill="none" viewBox="0 0 48 48">
                <circle cx="12" cy="11" fill="#042f22" r="6" stroke="#10b981" strokeWidth="2.5"></circle>
                <circle cx="36" cy="11" fill="#042f22" r="6" stroke="#10b981" strokeWidth="2.5"></circle>
                <rect fill="#0c1d16" height="30" rx="14" stroke="#34d399" strokeWidth="2.5" width="34" x="7" y="10"></rect>
                <ellipse cx="16" cy="24" fill="#042f22" rx="5" ry="6"></ellipse>
                <ellipse cx="32" cy="24" fill="#042f22" rx="5" ry="6"></ellipse>
                <circle className="animate-pulse" cx="17" cy="23.5" fill="#34d399" r="2.2"></circle>
                <circle className="animate-pulse" cx="31" cy="23.5" fill="#34d399" r="2.2"></circle>
                <polygon fill="#34d399" points="24,28 21.5,31 26.5,31"></polygon>
                <path d="M20 33 Q24 36.5 28 33" fill="none" stroke="#10b981" strokeLinecap="round" strokeWidth="2"></path>
              </svg>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#0c1410] border border-emerald-500 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
            </div>
          </div>

          {/* Dynamic Status + Equalizer */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-mono text-emerald-400 text-[10.5px] font-medium flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                Screen Context: Synced
              </span>
              <span className="text-[10px] font-mono text-slate-500">142ms</span>
            </div>

            {/* Equalizer Bar */}
            <div className="h-5 w-full rounded-lg bg-[#070d0a] border border-emerald-950/90 px-2 flex items-center justify-between gap-1 overflow-hidden">
              <span className="w-1 bg-emerald-500/40 rounded-full h-2 animate-pulse"></span>
              <span className={`w-1 bg-emerald-400 rounded-full ${isSpeaking || isRecording ? "audio-bar-1" : "h-3.5"}`}></span>
              <span className={`w-1 bg-emerald-400 rounded-full ${isSpeaking || isRecording ? "audio-bar-2" : "h-2"}`}></span>
              <span className={`w-1 bg-emerald-300 rounded-full ${isSpeaking || isRecording ? "audio-bar-3" : "h-4"}`}></span>
              <span className={`w-1 bg-emerald-500 rounded-full ${isSpeaking || isRecording ? "audio-bar-4" : "h-2.5"}`}></span>
              <span className={`w-1 bg-emerald-400 rounded-full ${isSpeaking || isRecording ? "audio-bar-5" : "h-3"}`}></span>
              <span className="w-1 bg-emerald-300 rounded-full h-1.5"></span>
              <span className="text-[9px] font-mono text-emerald-400/70 tracking-tighter uppercase pl-1">
                {isRecording ? "Listening" : isSpeaking ? "Speaking" : isSending ? "Thinking" : "Online"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Pill Dock */}
        <div className="grid grid-cols-4 gap-1.5 pt-0.5" data-purpose="quick-actions-pill-dock">
          {/* Quick Action 1: Inspect Screen [Alt+S] */}
          <button
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/70 to-[#0e1914] border border-emerald-500/30 hover:border-emerald-400/70 hover:bg-emerald-900/30 text-emerald-300 text-xs font-mono font-medium transition-all group"
            onClick={handleInspectScreen}
            disabled={isInspecting || isSending}
            title="Inspect Desktop Screen (Alt + S)"
          >
            <svg
              className={`w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform ${
                isInspecting ? "animate-spin" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span>Inspect</span>
          </button>

          {/* Quick Action 2: Voice Mic (Hold F1) */}
          <button
            className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all group ${
              isRecording
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/25"
                : "bg-gradient-to-r from-emerald-950/70 to-[#0e1914] border-emerald-500/30 hover:border-emerald-400/70 text-emerald-300"
            }`}
            onMouseDown={() => startPTT()}
            onMouseUp={() => stopPTT()}
            title="Voice Input (Hold F1)"
          >
            <svg className="w-3.5 h-3.5 text-current group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span>{isRecording ? "Listening" : "Speak"}</span>
          </button>

          {/* Quick Action 3: Agent Workspace */}
          <button
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/70 to-[#0e1914] border border-emerald-500/30 hover:border-emerald-400/70 text-emerald-300 text-xs font-mono font-medium transition-all group"
            onClick={() => {
              setActiveTab("workspace");
              onOpenDashboard();
            }}
            title="Open Agent Workspace"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Agent</span>
          </button>

          {/* Quick Action 4: Open Full Momo App */}
          <button
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-bold text-xs shadow-md shadow-emerald-500/25 transition-all group"
            onClick={onOpenDashboard}
            title="Expand to Full Momo Window"
          >
            <svg className="w-3.5 h-3.5 text-slate-950 group-hover:rotate-45 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
            </svg>
            <span>Full</span>
          </button>
        </div>

        {/* Collapsible Mini Prompt Input Pill */}
        <div className="relative w-full pt-0.5">
          <input
            className="w-full bg-[#080d0b] text-xs text-emerald-100 placeholder-emerald-800/70 rounded-xl px-3 py-2 pr-9 border border-emerald-950 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all font-mono"
            placeholder="Ask Momo anything or hold F1..."
            type="text"
            value={miniPrompt}
            onChange={(e) => setMiniPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMiniPrompt();
              }
            }}
            disabled={isSending}
          />
          <button
            className="absolute right-2 top-2.5 p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 transition-colors"
            onClick={handleSendMiniPrompt}
            disabled={!miniPrompt.trim() || isSending}
            title="Send"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" fillRule="evenodd"></path>
            </svg>
          </button>
        </div>

        {/* Glanceable Mini Footer */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-emerald-950/70 px-1">
          <div className="flex items-center gap-1.5 text-emerald-400/90">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span>Mem Vault: {memoriesCount} items</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-emerald-400/90">{providerLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
