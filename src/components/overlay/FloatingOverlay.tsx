import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useHermozStore } from "@/store/useHermozStore";
import { screenAnalyzer } from "@/core/vision/screenAnalyzer";
import { memoryStore } from "@/core/memory/memoryStore";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import "./FloatingOverlay.css";
import {
  Camera,
  Mic,
  Terminal,
  Maximize2,
  ChevronDown,
  Pin,
  Sliders,
  X,
  Send,
  Database,
  Sparkles,
  Zap,
  Volume2,
  Moon,
  MessageSquare,
  Eye,
  Flame,
  Search,
} from "lucide-react";

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
    stopSpeaking,
    providerStatus,
    settings,
    updateSettings,
    captureScreenWithCheck,
    setActiveTab,
  } = useHermozStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [popoverFilter, setPopoverFilter] = useState("");
  const [miniPrompt, setMiniPrompt] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [memoriesCount, setMemoriesCount] = useState(() => memoryStore.getMemories().length);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [align, setAlign] = useState<"left" | "right" | "center">("center");
  const [showQuickControls, setShowQuickControls] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkEdgePosition = () => {
      try {
        const winY = window.screenY ?? 0;
        const winX = window.screenX ?? 0;
        const availW = window.screen.availWidth || 1920;

        if (winY < 160) {
          setPlacement("bottom");
        } else {
          setPlacement("top");
        }

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
      ? "OpenRouter (Llama 3.3)"
      : activeProvider.id === "groq"
      ? "Groq (GPT-OSS 120B)"
      : "Gemini (3.6 Flash)"
    : "Local Engine";

  const orbState: OrbState = isRecording
    ? "listening"
    : isSpeaking
    ? "composing"
    : isSending || activity === "thinking"
    ? "working"
    : "breathing";

  // If minimized into floating orb
  if (isMinimized) {
    return (
      <div
        className="w-full h-full flex items-end justify-end p-4 bg-transparent select-none cursor-pointer"
        onClick={() => setIsMinimized(false)}
        title="Click to expand Hermoz Companion"
      >
        <div className="relative flex items-center justify-center group" data-tauri-drag-region onMouseDown={handleDrag}>
          <span
            className="absolute w-14 h-14 rounded-full animate-ping opacity-20"
            style={{ background: "var(--gradient-antigravity)" }}
          />
          <span className="absolute w-12 h-12 rounded-full hermoz-mini-orb-glow" />
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
            style={{
              background: "var(--glass-bg-raised)",
              backdropFilter: "blur(var(--glass-blur))",
              border: "1.5px solid var(--color-accent)",
              boxShadow: "var(--glow-accent-sm)",
            }}
          >
            <ThinkingOrb state={orbState} size={20} theme="dark" />
          </div>
          {bubbleText && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full font-bold text-[9px] flex items-center justify-center font-mono hermoz-mini-badge"
              style={{
                background: "var(--gradient-antigravity)",
                color: "var(--color-accent-text)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              1
            </span>
          )}
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
      } p-2 sm:p-3 gap-2 bg-transparent select-none antialiased overflow-hidden`}
      style={{ fontFamily: "var(--font-sans)", color: "var(--color-text)" }}
      data-purpose="floating-companion-widget"
    >
      {/* 1. Quick Actions Popover (if opened) */}
      {showPopover && (
        <div
          className={`w-full rounded-xl p-3 flex flex-col gap-2 relative z-50 shrink-0 ${
            placement === "bottom" ? "order-3" : "order-1"
          }`}
          style={{
            background: "var(--glass-bg-raised)",
            backdropFilter: "blur(var(--glass-blur))",
            WebkitBackdropFilter: "blur(var(--glass-blur))",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-lg), var(--glow-accent-sm)",
            animation: "cardSlideUp var(--duration-fast) var(--ease-out)",
          }}
          data-purpose="quick-actions-popover"
        >
          {/* Popover Header */}
          <div
            className="flex items-center justify-between pb-2"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className="text-xs font-mono font-semibold flex items-center gap-1.5"
                style={{ color: "var(--color-text)" }}
              >
                <Zap size={12} style={{ color: "var(--color-accent)" }} />
                <span>Quick Actions &amp; Tools</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--neutral-3)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Ctrl+K
              </span>
              <button
                style={{
                  color: "var(--color-text-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "default",
                  padding: "2px",
                }}
                onClick={() => setShowPopover(false)}
                title="Close Palette"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Mini Filter */}
          <div className="relative flex items-center">
            <Search
              size={12}
              className="absolute left-2.5 pointer-events-none"
              style={{ color: "var(--color-text-muted)" }}
            />
            <input
              style={{
                width: "100%",
                background: "var(--neutral-1)",
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                color: "var(--color-text)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 8px 4px 26px",
                border: "1px solid var(--color-border)",
                outline: "none",
              }}
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
              <div
                className="text-[10px] font-mono uppercase tracking-wider font-semibold px-1 mb-1 flex items-center gap-1.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Eye size={10} />
                <span>Vision &amp; Screen</span>
              </div>
              <div className="space-y-1">
                <button
                  className="w-full flex items-center justify-between p-2 rounded-lg text-left transition-all"
                  style={{
                    background: "var(--neutral-3)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                  onClick={() => {
                    setShowPopover(false);
                    handleInspectScreen();
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{
                        background: "var(--color-accent-subtle)",
                        color: "var(--color-accent)",
                        border: "1px solid var(--color-accent)",
                      }}
                    >
                      <Camera size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-medium flex items-center gap-1.5">
                        <span>Inspect Active Window</span>
                      </div>
                      <div
                        className="text-[10px] font-mono truncate"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Analyze screen context
                      </div>
                    </div>
                  </div>
                  <kbd
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--neutral-1)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Alt + S
                  </kbd>
                </button>
              </div>
            </div>

            {/* Personality */}
            <div>
              <div
                className="text-[10px] font-mono uppercase tracking-wider font-semibold px-1 mb-1 flex items-center gap-1.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Flame size={10} />
                <span>Voice &amp; Personality</span>
              </div>
              <div
                className="flex items-center justify-between p-2 rounded-lg"
                style={{
                  background: "var(--neutral-3)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Roast Level
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <span
                    className="px-2 py-0.5 rounded cursor-pointer transition-colors"
                    style={{
                      background:
                        settings.personality.roastLevel === 2
                          ? "var(--color-accent-subtle)"
                          : "var(--neutral-1)",
                      color:
                        settings.personality.roastLevel === 2
                          ? "var(--color-accent)"
                          : "var(--color-text-muted)",
                      border: `1px solid ${
                        settings.personality.roastLevel === 2
                          ? "var(--color-accent)"
                          : "var(--color-border)"
                      }`,
                    }}
                    onClick={() =>
                      updateSettings({ personality: { ...settings.personality, roastLevel: 2 } })
                    }
                  >
                    Cheeky
                  </span>
                  <span
                    className="px-2 py-0.5 rounded cursor-pointer transition-colors"
                    style={{
                      background:
                        settings.personality.roastLevel === 3
                          ? "var(--color-accent-subtle)"
                          : "var(--neutral-1)",
                      color:
                        settings.personality.roastLevel === 3
                          ? "var(--color-accent)"
                          : "var(--color-text-muted)",
                      border: `1px solid ${
                        settings.personality.roastLevel === 3
                          ? "var(--color-accent)"
                          : "var(--color-border)"
                      }`,
                    }}
                    onClick={() =>
                      updateSettings({ personality: { ...settings.personality, roastLevel: 3 } })
                    }
                  >
                    Savage
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Popover Footer */}
          <div
            className="pt-2 flex items-center justify-between text-[10px] font-mono"
            style={{
              borderTop: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <span
              className="hover:underline cursor-pointer"
              style={{ color: "var(--color-accent)" }}
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
              style={{
                color: "var(--color-text)",
                background: "transparent",
                border: "none",
                padding: "0",
                fontFamily: "var(--font-mono)",
                cursor: "default",
              }}
            >
              Full Window ↵
            </button>
          </div>
        </div>
      )}

      {/* 2. Interactive Thought Bubble (strictly clamped, screen-edge aware, no overflow) */}
      {bubbleText && (
        <div
          className={`w-full max-w-[320px] max-h-[120px] rounded-xl p-2.5 sm:p-3 transition-all duration-200 shrink-0 relative cursor-pointer ${
            placement === "bottom" ? "order-2" : "order-2"
          }`}
          style={{
            background: "var(--glass-bg-raised)",
            backdropFilter: "blur(var(--glass-blur))",
            WebkitBackdropFilter: "blur(var(--glass-blur))",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-md), var(--glow-accent-sm)",
            animation: "cardSlideUp var(--duration-fast) var(--ease-out)",
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).tagName !== "BUTTON") {
              setBubble(null);
            }
          }}
          data-purpose="hermoz-speech-bubble"
        >
          {/* Edge-aware tail */}
          <div
            className={`absolute w-2.5 h-2.5 rotate-45 pointer-events-none ${
              placement === "bottom"
                ? "-top-1.5 border-l border-t"
                : "-bottom-1.5 border-r border-b"
            } ${
              align === "left"
                ? "left-8"
                : align === "right"
                ? "right-8"
                : "left-1/2 -translate-x-1/2"
            }`}
            style={{
              background: "var(--neutral-2)",
              borderColor: "var(--color-border-strong)",
            }}
          />

          {/* Header */}
          <div
            className="flex items-center justify-between pb-1 mb-1 text-[10px] font-mono"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-semibold text-[9.5px]"
                style={{
                  background: "var(--color-accent-subtle)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent)",
                }}
              >
                Hermoz
              </span>
              <span style={{ color: "var(--color-text-muted)", fontSize: "9.5px" }}>Insight</span>
            </div>
            <button
              style={{
                color: "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "default",
                padding: "2px",
              }}
              onClick={() => setBubble(null)}
              title="Dismiss remark"
            >
              <X size={10} />
            </button>
          </div>

          {/* Content: Clamped, wrapped, strictly bounded to max-height / max-width */}
          <div
            className="text-[12px] leading-snug break-words overflow-hidden line-clamp-3"
            style={{ color: "var(--color-text)" }}
          >
            <p className="m-0 font-medium">"{bubbleText}"</p>
          </div>

          {/* Quick Actions in Bubble */}
          <div
            className="mt-1.5 flex items-center justify-between pt-1 text-[9.5px] font-mono"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              className="px-2 py-0.5 rounded flex items-center gap-1 transition-all"
              style={{
                background: "var(--color-accent-subtle)",
                color: "var(--color-accent)",
                border: "1px solid var(--color-accent)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                sendMessage(`Tell me more about: "${bubbleText}"`);
              }}
            >
              <Sparkles size={10} />
              <span>Tell me more</span>
            </button>
            <span
              style={{ color: "var(--color-text-muted)", fontSize: "9px" }}
              onClick={() => setBubble(null)}
            >
              Click to dismiss
            </span>
          </div>
        </div>
      )}

      {/* 3. The Main Compact Floating Capsule HUD */}
      <div
        className={`w-full rounded-xl p-2.5 flex flex-col gap-2 relative overflow-hidden shrink-0 transition-all duration-200 hermoz-capsule-in ${
          placement === "bottom" ? "order-1" : "order-3"
        }`}
        style={{
          background: "var(--glass-bg-raised)",
          backdropFilter: "blur(var(--glass-blur))",
          WebkitBackdropFilter: "blur(var(--glass-blur))",
          border: isHovered
            ? "1px solid var(--color-accent)"
            : "1px solid var(--glass-border)",
          boxShadow: isHovered ? "var(--glow-accent-sm)" : "var(--shadow-sm)",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-purpose="main-companion-capsule"
      >
        {/* Top Grip & Status Pill */}
        <div
          className="flex items-center justify-between w-full pb-1 cursor-grab active:cursor-grabbing"
          style={{ borderBottom: "1px solid var(--color-border)" }}
          data-tauri-drag-region
          onMouseDown={handleDrag}
        >
          {/* Grip Dots & Avatar Indicator */}
          <div className="flex items-center gap-2" data-tauri-drag-region>
            <div
              className="flex flex-col gap-0.5 p-0.5 opacity-40"
              title="Drag widget anywhere"
            >
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
              </div>
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
                <span className="w-1 h-1 rounded-full bg-current" />
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--color-success)" }}
              />
            </div>

            <div
              className="flex items-center gap-1.5 font-mono text-[11px]"
              data-tauri-drag-region
            >
              <span className="font-semibold" style={{ color: "var(--color-text)" }}>
                Hermoz
              </span>
              <span style={{ color: "var(--color-text-muted)" }}>•</span>
              <span style={{ color: "var(--color-accent)", fontWeight: 500 }}>
                {expression === "smug"
                  ? "Cheeky"
                  : expression === "thinking"
                  ? "Thinking"
                  : "Ready"}
              </span>
              <span
                className="text-[9px] px-1 py-0.2 rounded font-mono"
                style={{
                  background: "var(--neutral-3)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                v2.4
              </span>
            </div>
          </div>

          {/* Controls: Pin, Popover, Full, Minimize */}
          <div className="flex items-center gap-0.5">
            <button
              style={{
                padding: "3px",
                borderRadius: "var(--radius-sm)",
                color: isAlwaysOnTop ? "var(--color-accent)" : "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "default",
              }}
              onClick={handleToggleAlwaysOnTop}
              title={isAlwaysOnTop ? "Always on Top (Active)" : "Pin Always on Top"}
            >
              <Pin size={13} />
            </button>

            <button
              style={{
                padding: "3px",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "default",
              }}
              onClick={() => setShowPopover((prev) => !prev)}
              title="Quick Actions & Tools (Ctrl+K)"
            >
              <Sliders size={13} />
            </button>

            <button
              style={{
                padding: "3px",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "default",
              }}
              onClick={onOpenDashboard}
              title="Expand to Full Hermoz Window"
            >
              <Maximize2 size={13} />
            </button>

            <button
              style={{
                padding: "3px",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "default",
              }}
              onClick={() => setIsMinimized(true)}
              title="Collapse to Mini Orb"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        </div>

        {/* Center Interactive Row: Avatar + Audio State */}
        <div className="flex items-center gap-2.5 px-0.5">
          {/* Avatar Icon */}
          <div
            className="relative cursor-pointer shrink-0"
            onClick={() => setShowQuickControls((prev) => !prev)}
            title="Click for quick controls: Talk / Listen / Chat / Settings / Sleep"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hermoz-avatar-ring"
              style={{
                background: "var(--glass-bg-raised)",
                border: showQuickControls
                  ? "1.5px solid var(--color-accent)"
                  : "1px solid var(--color-border)",
                boxShadow: showQuickControls ? "var(--glow-accent-sm)" : "none",
              }}
            >
              <ThinkingOrb state={orbState} size={20} theme="dark" />
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{
                background: isRecording
                  ? "var(--color-danger)"
                  : isSpeaking
                  ? "var(--color-accent)"
                  : "var(--color-success)",
              }}
            />
          </div>

          {/* Equalizer & Audio State */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span
                className="font-mono text-[10.5px] font-medium flex items-center gap-1"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <Eye size={11} style={{ color: "var(--color-accent)" }} />
                <span>Screen Context: Synced</span>
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                142ms
              </span>
            </div>

            <div
              className="h-4 w-full rounded px-2 flex items-center justify-between gap-1 overflow-hidden"
              style={{
                background: "var(--neutral-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span
                className="w-1 rounded-full h-2"
                style={{ background: "var(--color-accent)", opacity: 0.4 }}
              />
              <span
                className={`w-1 rounded-full ${
                  isSpeaking || isRecording ? "audio-bar-1" : "h-2"
                }`}
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className={`w-1 rounded-full ${
                  isSpeaking || isRecording ? "audio-bar-2" : "h-3"
                }`}
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className={`w-1 rounded-full ${
                  isSpeaking || isRecording ? "audio-bar-3" : "h-1.5"
                }`}
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className={`w-1 rounded-full ${
                  isSpeaking || isRecording ? "audio-bar-4" : "h-2.5"
                }`}
                style={{ background: "var(--color-accent)" }}
              />
              <span
                className="text-[9px] font-mono tracking-tighter uppercase pl-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {isRecording
                  ? "Listening"
                  : isSpeaking
                  ? "Speaking"
                  : isSending
                  ? "Thinking"
                  : "Online"}
              </span>
            </div>
          </div>
        </div>

        {/* Compact Click-State Quick Controls Bar (Talk / Listen / Chat / Settings / Sleep) */}
        {showQuickControls && (
          <div
            className="grid grid-cols-5 gap-1 pt-1 pb-0.5"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <button
              className="flex flex-col items-center justify-center p-1 rounded text-[9.5px] font-mono transition-colors"
              style={{
                background: isSpeaking ? "var(--color-accent-subtle)" : "var(--neutral-3)",
                color: isSpeaking ? "var(--color-accent)" : "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                } else {
                  sendMessage("Tell me a quick joke or punchy observation");
                }
              }}
              title="Talk / Stop speech"
            >
              <Volume2 size={12} />
              <span>Talk</span>
            </button>

            <button
              className="flex flex-col items-center justify-center p-1 rounded text-[9.5px] font-mono transition-colors"
              style={{
                background: isRecording ? "rgba(239,68,68,0.2)" : "var(--neutral-3)",
                color: isRecording ? "var(--color-danger)" : "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onMouseDown={() => startPTT()}
              onMouseUp={() => stopPTT()}
              title="Listen (Hold F1)"
            >
              <Mic size={12} />
              <span>Listen</span>
            </button>

            <button
              className="flex flex-col items-center justify-center p-1 rounded text-[9.5px] font-mono transition-colors"
              style={{
                background: "var(--neutral-3)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onClick={() => {
                setActiveTab("overview");
                onOpenDashboard();
              }}
              title="Open Chat"
            >
              <MessageSquare size={12} />
              <span>Chat</span>
            </button>

            <button
              className="flex flex-col items-center justify-center p-1 rounded text-[9.5px] font-mono transition-colors"
              style={{
                background: "var(--neutral-3)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onClick={() => {
                setActiveTab("settings");
                onOpenDashboard();
              }}
              title="Settings"
            >
              <Sliders size={12} />
              <span>Settings</span>
            </button>

            <button
              className="flex flex-col items-center justify-center p-1 rounded text-[9.5px] font-mono transition-colors"
              style={{
                background: "var(--neutral-3)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              onClick={() => {
                setShowQuickControls(false);
                setIsMinimized(true);
              }}
              title="Sleep / Minimize"
            >
              <Moon size={12} />
              <span>Sleep</span>
            </button>
          </div>
        )}

        {/* Quick Actions Pill Dock */}
        <div className="grid grid-cols-4 gap-1 pt-0.5" data-purpose="quick-actions-pill-dock">
          {/* Quick Action 1: Inspect */}
          <button
            className="flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-all hermoz-btn-lift"
            style={{
              background: "var(--neutral-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            onClick={handleInspectScreen}
            disabled={isInspecting || isSending}
            title="Inspect Desktop Screen (Alt + S)"
          >
            <Camera size={12} style={{ color: "var(--color-accent)" }} />
            <span>Inspect</span>
          </button>

          {/* Quick Action 2: Voice */}
          <button
            className="flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-all hermoz-btn-lift"
            style={{
              background: isRecording ? "rgba(239, 68, 68, 0.2)" : "var(--neutral-3)",
              border: `1px solid ${isRecording ? "var(--color-danger)" : "var(--color-border)"}`,
              color: isRecording ? "var(--color-danger)" : "var(--color-text)",
            }}
            onMouseDown={() => startPTT()}
            onMouseUp={() => stopPTT()}
            title="Voice Input (Hold F1)"
          >
            <Mic size={12} style={{ color: isRecording ? "var(--color-danger)" : "var(--color-accent)" }} />
            <span>{isRecording ? "Listening" : "Speak"}</span>
          </button>

          {/* Quick Action 3: Workspace */}
          <button
            className="flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-all hermoz-btn-lift"
            style={{
              background: "var(--neutral-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            onClick={() => {
              setActiveTab("workspace");
              onOpenDashboard();
            }}
            title="Open Agent Workspace"
          >
            <Terminal size={12} style={{ color: "var(--color-accent)" }} />
            <span>Agent</span>
          </button>

          {/* Quick Action 4: Full App */}
          <button
            className="flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-all hermoz-btn-lift"
            style={{
              background: "var(--color-accent)",
              border: "1px solid var(--color-accent-hover)",
              color: "#ffffff",
            }}
            onClick={onOpenDashboard}
            title="Expand to Full Hermoz Window"
          >
            <Maximize2 size={12} />
            <span>Full</span>
          </button>
        </div>

        {/* Collapsible Mini Prompt Input Pill */}
        <div className="relative w-full pt-0.5">
          <input
            style={{
              width: "100%",
              background: "var(--neutral-1)",
              fontSize: "var(--text-xs)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 28px 4px 8px",
              border: "1px solid var(--color-border)",
              outline: "none",
              fontFamily: "var(--font-mono)",
            }}
            placeholder="Ask Hermoz anything or hold F1..."
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
            style={{
              position: "absolute",
              right: "4px",
              top: "6px",
              padding: "2px",
              color: miniPrompt.trim() ? "var(--color-accent)" : "var(--color-text-muted)",
              background: "transparent",
              border: "none",
              cursor: miniPrompt.trim() ? "default" : "not-allowed",
            }}
            onClick={handleSendMiniPrompt}
            disabled={!miniPrompt.trim() || isSending}
            title="Send"
          >
            <Send size={12} />
          </button>
        </div>

        {/* Glanceable Mini Footer */}
        <div
          className="flex items-center justify-between text-[10px] font-mono pt-1 px-0.5"
          style={{
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <div className="flex items-center gap-1">
            <Database size={10} />
            <span>Vault: {memoriesCount} items</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--color-success)" }}
            />
            <span>{providerLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
