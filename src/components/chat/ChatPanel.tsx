import { useEffect, useRef, useState } from "react";
import { useHermozStore } from "@/store/useHermozStore";
import { ThinkingOrb } from "thinking-orbs";
import {
  Camera,
  Mic,
  Send,
  Copy,
  RotateCcw,
  Volume2,
  Square,
  Settings,
  Trash2,
  Paperclip,
  ChevronDown,
  Check,
  Zap,
  PanelLeft,
} from "lucide-react";
import { SessionSidebar } from "./SessionSidebar";

const PROVIDER_INFO: Record<string, { label: string; model: string }> = {
  groq: { label: "Groq", model: "openai/gpt-oss-120b" },
  openrouter: { label: "OpenRouter", model: "meta-llama/llama-3.3-70b-instruct" },
  gemini: { label: "Gemini", model: "gemini-3.6-flash" },
};

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const {
    messages,
    isSending,
    isExecutingAction,
    sendMessage,
    clearChat,
    speakMessage,
    providerStatus,
    refreshProviderStatus,
    openSettings,
    settings,
    isSpeaking,
    stopSpeaking,
    isRecording,
    startPTT,
    stopPTT,
    captureScreenWithCheck,
    agentModeEnabled,
    toggleAgentMode,
    stopAgentLoop,
    sessionSidebarOpen,
    toggleSessionSidebar,
  } = useHermozStore();

  const [draft, setDraft] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshProviderStatus();
  }, [refreshProviderStatus]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSend = () => {
    if (!draft.trim() || isSending) return;
    sendMessage(draft);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickVision = async () => {
    if (isCapturing || isSending) return;
    setIsCapturing(true);
    try {
      const base64 = await captureScreenWithCheck();
      if (!base64) return;
      await sendMessage(
        "[User clicked 'Inspect Screen'. Look at active desktop, give brief sharp feedback, and playfully roast what you see.]",
        { image: base64 }
      );
    } catch (err) {
      console.warn("Screen inspect failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetry = (msgIndex: number) => {
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        sendMessage(messages[i].content);
        break;
      }
    }
  };

  const activeProvider = providerStatus.find((p) => p.state === "connected");
  const providerId = activeProvider?.id || "openrouter";
  const providerDetails = PROVIDER_INFO[providerId] || {
    label: providerId.toUpperCase(),
    model: "ai-brain",
  };

  return (
    <div className="w-full h-full flex overflow-hidden" data-purpose="chat-with-session-sidebar">
      {sessionSidebarOpen && <SessionSidebar />}
      <section
        className="flex-1 h-full flex flex-col relative overflow-hidden"
        style={{
          background: "var(--color-bg)",
          borderRight: "1px solid var(--color-border)",
          fontFamily: "var(--font-sans)",
          color: "var(--color-text)",
        }}
        data-purpose="chat-main-area"
      >
        {/* Conversation Header Bar */}
        <div
          className="h-12 px-5 flex items-center justify-between sticky top-0 z-20 shrink-0"
          style={{
            borderBottom: "1px solid var(--color-border)",
            background: "var(--neutral-2)",
          }}
          data-purpose="chat-header"
        >
          <div className="flex items-center space-x-2.5">
            <button
              onClick={toggleSessionSidebar}
              className="p-1.5 rounded-lg hover:bg-[var(--neutral-3)] transition-colors bg-transparent border-0 cursor-pointer flex items-center justify-center"
              style={{ color: sessionSidebarOpen ? "var(--color-accent)" : "var(--color-text-muted)" }}
              title={sessionSidebarOpen ? "Hide Sessions & Projects Sidebar" : "Show Sessions & Projects Sidebar"}
            >
              <PanelLeft size={16} />
            </button>
            <h1
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              Conversation
            </h1>

          {/* Provider Dropdown Chip */}
          <div
            className="flex items-center rounded-full px-2.5 py-0.5 cursor-pointer transition-all"
            style={{
              background: "var(--neutral-3)",
              border: "1px solid var(--color-border)",
            }}
            onClick={openSettings}
            title="Active AI Provider & Routing (Click to configure)"
          >
            <span
              className="w-1.5 h-1.5 rounded-full mr-1.5"
              style={{
                background: activeProvider ? "var(--color-success)" : "var(--color-warning)",
              }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-accent)" }}
            >
              {providerDetails.label}
            </span>
            <span
              className="text-xs ml-1 font-mono text-[11px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              / {providerDetails.model}
            </span>
            <ChevronDown size={11} className="ml-1 text-gray-500" />
          </div>
        </div>

        {/* Quick Chat Actions & Metrics */}
        <div className="flex items-center space-x-2">
          {/* Latency & Token Badge */}
          <div
            className="hidden sm:flex items-center space-x-2 text-[11px] font-mono px-2 py-0.5 rounded"
            style={{
              background: "var(--neutral-1)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>142ms</span>
            <span>•</span>
            <span>4.2k tokens</span>
          </div>

          {/* Stop TTS Button (if active) */}
          {isSpeaking && (
            <button
              className="flex items-center space-x-1 px-2 py-0.5 text-xs font-mono rounded transition-colors"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "var(--color-danger)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
              onClick={stopSpeaking}
              title="Stop Speaking (Esc)"
            >
              <Square size={10} />
              <span>Stop TTS</span>
            </button>
          )}

          {/* Settings / Clear actions */}
          <button
            className="p-1 rounded transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onClick={openSettings}
            title="Chat & AI Settings"
            aria-label="Chat & AI Settings"
          >
            <Settings size={14} />
          </button>

          <button
            className="p-1 rounded transition-colors hover:text-red-400"
            style={{ color: "var(--color-text-muted)" }}
            onClick={clearChat}
            title="Clear Context"
            aria-label="Clear Context"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Chat Stream (Scrollable) */}
      <div
        className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
        ref={listRef}
        data-purpose="chat-messages-container"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: "var(--neutral-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-accent)">
                <circle cx="12" cy="13" r="7" />
                <circle cx="7" cy="7" r="3" />
                <circle cx="17" cy="7" r="3" />
                <circle cx="10" cy="12" fill="var(--neutral-1)" r="1.5" />
                <circle cx="14" cy="12" fill="var(--neutral-1)" r="1.5" />
                <ellipse cx="12" cy="15" fill="var(--neutral-1)" rx="1.5" ry="1" />
              </svg>
            </div>
            <h3
              className="text-xs font-semibold font-mono"
              style={{ color: "var(--color-text)" }}
            >
              Hermoz Companion Ready
            </h3>
            <p
              className="text-xs max-w-sm mt-1 leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              Type a message, click{" "}
              <span style={{ color: "var(--color-accent)", fontWeight: 500 }}>Inspect Screen</span>,
              or hold{" "}
              <span
                className="font-mono px-1 py-0.5 rounded"
                style={{
                  background: "var(--neutral-3)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-accent)",
                }}
              >
                F1
              </span>{" "}
              to speak anytime.
            </p>
          </div>
        )}

        {messages.map((m, idx) => {
          const isHermoz = m.role === "hermoz";
          const isInspectPrompt = !isHermoz && m.content.includes("Inspect Screen");
          const timeFormatted = new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          if (!isHermoz) {
            return (
              <div
                key={m.id}
                className="flex justify-end"
                data-purpose={isInspectPrompt ? "user-action-prompt" : "user-message"}
              >
                <div
                  className="max-w-xl rounded-xl rounded-tr-xs p-3 text-xs leading-relaxed"
                  style={{
                    background: "var(--neutral-3)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  {isInspectPrompt ? (
                    <div className="flex items-start space-x-2">
                      <Camera
                        size={14}
                        className="shrink-0 mt-0.5"
                        style={{ color: "var(--color-accent)" }}
                      />
                      <p className="font-normal selectable-text">{m.content}</p>
                    </div>
                  ) : (
                    <p className="font-normal selectable-text">{m.content}</p>
                  )}
                  <div
                    className="mt-1 flex items-center justify-end space-x-1.5 text-[10px] font-mono"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <span>{timeFormatted}</span>
                    <span>•</span>
                    <span>delivered</span>
                  </div>
                </div>
              </div>
            );
          }

          // Hermoz message card
          const isVisionRoast =
            m.interactionMode === "argument" ||
            m.interactionMode === "playful" ||
            m.content.toLowerCase().includes("desktop") ||
            m.content.toLowerCase().includes("screen");

          return (
            <div
              key={m.id}
              className="flex items-start space-x-3 group"
              data-purpose="hermoz-message"
            >
              {/* Hermoz Tiny Avatar */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                style={{
                  background: "var(--neutral-3)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-accent)">
                  <circle cx="12" cy="13" r="7" />
                  <circle cx="7" cy="7" r="3" />
                  <circle cx="17" cy="7" r="3" />
                  <circle cx="10" cy="12" fill="var(--neutral-1)" r="1.5" />
                  <circle cx="14" cy="12" fill="var(--neutral-1)" r="1.5" />
                  <ellipse cx="12" cy="15" fill="var(--neutral-1)" rx="1.5" ry="1" />
                </svg>
              </div>

              {/* Message Bubble with Actions */}
              <div
                className="flex-1 max-w-2xl rounded-xl rounded-tl-xs p-3.5 transition-all"
                style={{
                  background: "var(--neutral-2)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                {/* Hermoz Header Meta */}
                <div
                  className="flex items-center justify-between pb-1.5 mb-2"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className="text-xs font-semibold tracking-wide"
                      style={{ color: "var(--color-accent)" }}
                    >
                      Hermoz
                    </span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.2 rounded"
                      style={{
                        background: "var(--neutral-3)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {m.provider ? PROVIDER_INFO[m.provider]?.label || m.provider : "Engine"}
                    </span>
                    {isVisionRoast && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded"
                        style={{
                          background: "rgba(251, 191, 36, 0.1)",
                          border: "1px solid rgba(251, 191, 36, 0.3)",
                          color: "var(--color-warning)",
                        }}
                      >
                        Vision Analysis
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {timeFormatted}
                  </span>
                </div>

                {/* Message Body */}
                <div
                  className="text-xs leading-relaxed space-y-2 selectable-text"
                  style={{ color: "var(--color-text)" }}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>

                {/* Action Bar */}
                <div
                  className="mt-2.5 pt-1.5 flex items-center justify-between text-xs"
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <button
                      className="flex items-center space-x-1 transition-colors hover:text-white"
                      style={{ background: "transparent", border: "none", cursor: "default" }}
                      onClick={() => handleCopy(m.id, m.content)}
                      title="Copy Response"
                    >
                      {copiedId === m.id ? <Check size={11} /> : <Copy size={11} />}
                      <span className="text-[11px]">
                        {copiedId === m.id ? "Copied!" : "Copy"}
                      </span>
                    </button>

                    <button
                      className="flex items-center space-x-1 transition-colors hover:text-white"
                      style={{ background: "transparent", border: "none", cursor: "default" }}
                      onClick={() => handleRetry(idx)}
                      title="Retry / Regenerate"
                    >
                      <RotateCcw size={11} />
                      <span className="text-[11px]">Retry</span>
                    </button>

                    <button
                      className="flex items-center space-x-1 transition-colors hover:text-white"
                      style={{ background: "transparent", border: "none", cursor: "default" }}
                      onClick={() => speakMessage(m.content)}
                      title="Speak Aloud via Local TTS"
                    >
                      <Volume2 size={11} />
                      <span className="text-[11px]">Listen</span>
                    </button>
                  </div>

                  <div className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                    Tokens: ~{Math.max(12, Math.round(m.content.length / 4))} out
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking / Typing State */}
        {isSending && (
          <div className="flex items-start space-x-3 group">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                background: "var(--neutral-3)",
                border: "1px solid var(--color-border)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-accent)">
                <circle cx="12" cy="13" r="7" />
                <circle cx="7" cy="7" r="3" />
                <circle cx="17" cy="7" r="3" />
                <circle cx="10" cy="12" fill="var(--neutral-1)" r="1.5" />
                <circle cx="14" cy="12" fill="var(--neutral-1)" r="1.5" />
                <ellipse cx="12" cy="15" fill="var(--neutral-1)" rx="1.5" ry="1" />
              </svg>
            </div>
            <div
              className="rounded-xl rounded-tl-xs p-3 flex items-center space-x-2"
              style={{
                background: "var(--neutral-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span
                className="text-xs font-mono font-medium"
                style={{ color: "var(--color-accent)" }}
              >
                Hermoz is thinking
              </span>
              <ThinkingOrb state="working" size={20} theme="dark" aria-label="Hermoz is thinking" />
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Dock */}
      <div
        className="p-3 shrink-0"
        style={{
          background: "var(--neutral-2)",
          borderTop: "1px solid var(--color-border)",
        }}
        data-purpose="chat-input-dock"
      >
        {isExecutingAction && (
          <div
            className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              background: "var(--color-accent-subtle)",
              border: "1px solid var(--color-accent)",
              color: "var(--color-accent)",
            }}
          >
            <div className="flex items-center space-x-2">
              <span
                className="w-2 h-2 rounded-full animate-ping"
                style={{ background: "var(--color-accent)" }}
              />
              <span className="font-medium">Action running in background — you can continue chatting</span>
            </div>
            <button
              onClick={stopAgentLoop}
              className="text-[10px] font-mono hover:underline cursor-pointer bg-transparent border-0 p-0 ml-2"
              style={{ color: "var(--color-danger)" }}
              title="Stop running background command"
            >
              Stop
            </button>
          </div>
        )}

        <div
          className="relative flex items-center rounded-lg p-1 transition-all"
          style={{
            background: "var(--neutral-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Quick attachment trigger */}
          <button
            className="p-1.5 rounded transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            title="Insert code block template"
            aria-label="Insert code block template"
            onClick={() => setDraft((d) => d + "\n```\n// Code snippet\n```")}
          >
            <Paperclip size={14} />
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            className="w-full bg-transparent border-0 focus:ring-0 text-xs px-2 py-1 font-sans focus:outline-none"
            style={{ color: "var(--color-text)" }}
            placeholder="Message Hermoz (Enter to send, hold F1 to speak)..."
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />

          {/* Inspect Screen button inside input */}
          <button
            className="flex items-center space-x-1 px-2 py-1 rounded transition-all mr-1 shrink-0"
            style={{
              background: "var(--neutral-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
            title="Inspect Current Desktop Screen (Alt + S)"
            onClick={handleQuickVision}
            disabled={isCapturing || isSending}
          >
            <Camera
              size={12}
              className={isCapturing ? "animate-spin" : ""}
              style={{ color: "var(--color-accent)" }}
            />
            <span className="text-xs font-medium hidden sm:inline">
              {isCapturing ? "Inspecting..." : "Inspect"}
            </span>
          </button>

          {/* Agent Mode toggle — build/create requests route to the Canvas */}
          <button
            className="p-1.5 rounded transition-all mr-1 shrink-0 flex items-center gap-1"
            style={{
              background: agentModeEnabled ? "var(--gradient-antigravity)" : "transparent",
              color: agentModeEnabled ? "var(--color-accent-text)" : "var(--color-text-muted)",
              border: agentModeEnabled ? "none" : "1px solid var(--color-border)",
              boxShadow: agentModeEnabled ? "var(--glow-accent-sm)" : "none",
            }}
            title={agentModeEnabled ? "Agent Mode ON — build requests open the Canvas" : "Agent Mode OFF — click to enable"}
            aria-label="Toggle Agent Mode"
            onClick={toggleAgentMode}
          >
            <Zap size={13} />
            <span className="text-[10px] font-semibold hidden sm:inline">Agent</span>
          </button>

          {/* Voice PTT Mic trigger button */}
          <button
            className="p-1.5 rounded transition-colors mr-1 shrink-0"
            style={{
              background: isRecording ? "rgba(239, 68, 68, 0.2)" : "transparent",
              color: isRecording ? "var(--color-danger)" : "var(--color-text-muted)",
              border: isRecording ? "1px solid var(--color-danger)" : "none",
            }}
            title="Voice Input (Hold F1)"
            aria-label="Voice Input (Hold F1)"
            onMouseDown={() => startPTT()}
            onMouseUp={() => stopPTT()}
          >
            <Mic size={14} />
          </button>

          {/* Send Button */}
          <button
            className="font-bold p-1.5 rounded transition-all active:scale-95 flex items-center justify-center shrink-0"
            style={{
              background: "var(--color-accent)",
              color: "#ffffff",
              border: "1px solid var(--color-accent-hover)",
              cursor: !draft.trim() || isSending ? "not-allowed" : "default",
              opacity: !draft.trim() || isSending ? 0.5 : 1,
            }}
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            title="Send Message"
            aria-label="Send Message"
          >
            <Send size={13} />
          </button>
        </div>

        {/* Shortcuts / Input Footer */}
        <div
          className="flex items-center justify-between mt-1.5 px-1 text-[10.5px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>
            Press{" "}
            <kbd
              className="px-1 py-0.2 rounded font-mono text-[10px]"
              style={{
                background: "var(--neutral-3)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              Enter
            </kbd>{" "}
            to send •{" "}
            <kbd
              className="px-1 py-0.2 rounded font-mono text-[10px]"
              style={{
                background: "var(--neutral-3)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
              }}
            >
              Shift + Enter
            </kbd>{" "}
            for newline
          </span>
          <button
            onClick={openSettings}
            className="hover:underline cursor-pointer bg-transparent border-0 p-0 text-[10.5px] font-mono"
            style={{ color: "var(--color-accent)" }}
          >
            Shortcuts (Ctrl+K)
          </button>
        </div>
      </div>
    </section>
    </div>
  );
}
