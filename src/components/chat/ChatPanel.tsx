import { useEffect, useRef, useState } from "react";
import { useMomoStore } from "@/store/useMomoStore";
import { screenAnalyzer } from "@/core/vision/screenAnalyzer";

const PROVIDER_INFO: Record<string, { label: string; model: string }> = {
  groq: { label: "Groq", model: "openai/gpt-oss-120b" },
  openrouter: { label: "OpenRouter", model: "meta-llama/llama-3.3-70b-instruct" },
  gemini: { label: "Gemini", model: "gemini-3.6-flash" },
};

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const {
    messages,
    isSending,
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
  } = useMomoStore();

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
    // Find preceding user message
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
    <section
      className="w-full h-full flex flex-col border-r border-obsidian-800 bg-gradient-to-b from-obsidian-900 to-obsidian-950 relative overflow-hidden"
      data-purpose="chat-main-area"
    >
      {/* Conversation Header Bar */}
      <div
        className="h-14 border-b border-obsidian-800/80 px-6 flex items-center justify-between bg-obsidian-900/60 backdrop-blur-md sticky top-0 z-20 shrink-0"
        data-purpose="chat-header"
      >
        <div className="flex items-center space-x-3">
          <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span>Conversation</span>
          </h1>

          {/* Provider Dropdown Chip */}
          <div
            className="flex items-center bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-700/80 hover:border-emerald-500/40 rounded-full px-2.5 py-1 cursor-pointer transition-all"
            onClick={openSettings}
            title="Active AI Provider & Routing (Click to configure)"
          >
            <span
              className={`w-2 h-2 rounded-full mr-1.5 ${
                activeProvider
                  ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  : "bg-amber-400 animate-pulse"
              }`}
            ></span>
            <span className="text-xs font-medium text-emerald-300">
              {providerDetails.label}
            </span>
            <span className="text-xs text-gray-400 ml-1 font-mono text-[11px]">
              / {providerDetails.model}
            </span>
            <svg
              className="w-3 h-3 text-gray-400 ml-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
          </div>
        </div>

        {/* Quick Chat Actions & Metrics */}
        <div className="flex items-center space-x-2">
          {/* Latency & Token Badge */}
          <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-gray-400 bg-obsidian-950 px-2.5 py-1 rounded-md border border-obsidian-800">
            <span className="text-emerald-400 font-semibold">142ms</span>
            <span className="text-gray-600">•</span>
            <span>4.2k tokens</span>
          </div>

          {/* Stop TTS Button (if active) */}
          {isSpeaking && (
            <button
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-lg hover:bg-emerald-900 transition-colors"
              onClick={stopSpeaking}
              title="Stop Speaking (Esc)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Stop TTS</span>
            </button>
          )}

          {/* Settings / Clear actions */}
          <button
            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-obsidian-800 rounded-lg transition-colors"
            onClick={openSettings}
            title="Chat & AI Settings"
            aria-label="Chat & AI Settings"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
              <path
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
          </button>

          <button
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-obsidian-800 rounded-lg transition-colors"
            onClick={clearChat}
            title="Clear Context"
            aria-label="Clear Context"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Stream (Scrollable) */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        ref={listRef}
        data-purpose="chat-messages-container"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-obsidian-800 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-glow-sm">
              <svg
                className="w-10 h-10 text-emerald-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="13" r="7"></circle>
                <circle cx="7" cy="7" r="3"></circle>
                <circle cx="17" cy="7" r="3"></circle>
                <circle cx="10" cy="12" fill="#0B100E" r="1.5"></circle>
                <circle cx="14" cy="12" fill="#0B100E" r="1.5"></circle>
                <ellipse cx="12" cy="15" fill="#0B100E" rx="1.5" ry="1"></ellipse>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-emerald-300 font-mono">
              Momo Companion Ready
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1 leading-relaxed">
              I live on your desktop. Type a message, click{" "}
              <span className="text-emerald-400 font-medium">Inspect Screen</span>,
              or hold <span className="font-mono text-emerald-400 bg-obsidian-800 px-1 py-0.5 rounded border border-emerald-900/60">F1</span> to speak anytime.
            </p>
          </div>
        )}

        {messages.map((m, idx) => {
          const isMomo = m.role === "momo";
          const isInspectPrompt =
            !isMomo && m.content.includes("Inspect Screen");
          const timeFormatted = new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          if (!isMomo) {
            return (
              <div
                key={m.id}
                className="flex justify-end"
                data-purpose={isInspectPrompt ? "user-action-prompt" : "user-message"}
              >
                <div
                  className={`max-w-xl glass-bubble-user rounded-2xl rounded-tr-sm p-4 text-emerald-100 text-sm leading-relaxed border border-emerald-500/30 ${
                    isInspectPrompt ? "font-mono text-xs text-emerald-200 border-emerald-500/40" : ""
                  }`}
                >
                  {isInspectPrompt ? (
                    <div className="flex items-start space-x-2">
                      <svg
                        className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <p className="font-normal selectable-text">{m.content}</p>
                    </div>
                  ) : (
                    <p className="font-normal selectable-text">{m.content}</p>
                  )}
                  <div className="mt-1.5 flex items-center justify-end space-x-1.5 text-[10px] text-emerald-300/60 font-mono">
                    <span>{timeFormatted}</span>
                    <span>•</span>
                    <span>delivered</span>
                  </div>
                </div>
              </div>
            );
          }

          // Momo message card
          const isVisionRoast =
            m.interactionMode === "argument" ||
            m.interactionMode === "playful" ||
            m.content.toLowerCase().includes("desktop") ||
            m.content.toLowerCase().includes("screen");

          return (
            <div
              key={m.id}
              className="flex items-start space-x-3 group"
              data-purpose="momo-message"
            >
              {/* Momo Tiny Avatar */}
              <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-glow-sm overflow-hidden p-1">
                <svg
                  className="w-6 h-6 text-emerald-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="13" r="7"></circle>
                  <circle cx="7" cy="7" r="3"></circle>
                  <circle cx="17" cy="7" r="3"></circle>
                  <circle cx="10" cy="12" fill="#0B100E" r="1.5"></circle>
                  <circle cx="14" cy="12" fill="#0B100E" r="1.5"></circle>
                  <ellipse cx="12" cy="15" fill="#0B100E" rx="1.5" ry="1"></ellipse>
                </svg>
              </div>

              {/* Message Bubble with Actions */}
              <div className="flex-1 max-w-2xl bg-obsidian-850/90 border border-obsidian-750/90 hover:border-emerald-500/30 transition-all rounded-2xl rounded-tl-sm p-4 shadow-card-ambient">
                {/* Momo Header Meta */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-obsidian-800">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-emerald-400 tracking-wide">
                      Momo
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-obsidian-750 text-gray-300 border border-obsidian-700">
                      {m.provider ? PROVIDER_INFO[m.provider]?.label || m.provider : "Engine"}
                    </span>
                    {isVisionRoast && (
                      <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-500/30 px-1.5 rounded">
                        Vision Analysis
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">
                    {timeFormatted}
                  </span>
                </div>

                {/* Message Body */}
                <div className="text-sm text-gray-200 leading-relaxed space-y-2 selectable-text">
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>

                {/* Action Bar */}
                <div className="mt-3 pt-2 flex items-center justify-between border-t border-obsidian-800/60 text-xs text-gray-400">
                  <div className="flex items-center space-x-3">
                    <button
                      className="hover:text-emerald-400 flex items-center space-x-1 transition-colors"
                      onClick={() => handleCopy(m.id, m.content)}
                      title="Copy Response"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <span className="text-[11px]">
                        {copiedId === m.id ? "Copied!" : "Copy"}
                      </span>
                    </button>

                    <button
                      className="hover:text-emerald-400 flex items-center space-x-1 transition-colors"
                      onClick={() => handleRetry(idx)}
                      title="Retry / Regenerate"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <span className="text-[11px]">Retry</span>
                    </button>

                    <button
                      className="hover:text-emerald-400 flex items-center space-x-1 transition-colors"
                      onClick={() => speakMessage(m.content)}
                      title="Speak Aloud via Local TTS"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <span className="text-[11px]">Listen</span>
                    </button>
                  </div>

                  <div className="text-[10px] text-gray-500 font-mono">
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
            <div className="w-9 h-9 rounded-xl bg-obsidian-800 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-glow-sm overflow-hidden p-1">
              <svg
                className="w-6 h-6 text-emerald-400 animate-pulse"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="13" r="7"></circle>
                <circle cx="7" cy="7" r="3"></circle>
                <circle cx="17" cy="7" r="3"></circle>
                <circle cx="10" cy="12" fill="#0B100E" r="1.5"></circle>
                <circle cx="14" cy="12" fill="#0B100E" r="1.5"></circle>
                <ellipse cx="12" cy="15" fill="#0B100E" rx="1.5" ry="1"></ellipse>
              </svg>
            </div>
            <div className="bg-obsidian-850/90 border border-obsidian-750/90 rounded-2xl rounded-tl-sm p-4 shadow-card-ambient flex items-center space-x-3">
              <span className="text-xs font-mono text-emerald-400 font-medium">
                Momo is thinking
              </span>
              <div className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"></span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Dock */}
      <div
        className="p-4 bg-obsidian-900/90 border-t border-obsidian-800 backdrop-blur-md shrink-0"
        data-purpose="chat-input-dock"
      >
        <div className="relative flex items-center bg-obsidian-950 rounded-xl border border-obsidian-750 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/40 transition-all p-1.5 shadow-inner">
          {/* Quick attachment trigger */}
          <button
            className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-obsidian-850 rounded-lg transition-colors"
            title="Attach file or code context"
            aria-label="Attach file or code context"
            onClick={() => setDraft((d) => d + "\n```\n// Code snippet\n```")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            className="w-full bg-transparent border-0 focus:ring-0 text-sm text-gray-100 placeholder-gray-500 px-3 py-2 font-sans focus:outline-none"
            placeholder="Message Momo (Enter to send, hold F1 to speak)..."
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />

          {/* Inspect Screen button inside input */}
          <button
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-obsidian-850 hover:bg-emerald-950/60 border border-obsidian-700 hover:border-emerald-500/50 text-gray-300 hover:text-emerald-300 transition-all mr-1.5 group shrink-0"
            title="Inspect Current Desktop Screen (Alt + S)"
            onClick={handleQuickVision}
            disabled={isCapturing || isSending}
          >
            <svg
              className={`w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform ${
                isCapturing ? "animate-spin" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
              <path
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
            <span className="text-xs font-medium hidden sm:inline">
              {isCapturing ? "Inspecting..." : "Inspect"}
            </span>
          </button>

          {/* Voice PTT Mic trigger button */}
          <button
            className={`p-2 rounded-lg transition-colors mr-1 shrink-0 ${
              isRecording
                ? "bg-emerald-500 text-obsidian-950 shadow-glow-sm"
                : "text-gray-400 hover:text-emerald-400 hover:bg-obsidian-850"
            }`}
            title="Voice Input (Click or Hold F1)"
            aria-label="Voice Input (Click or Hold F1)"
            onMouseDown={() => startPTT()}
            onMouseUp={() => stopPTT()}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
          </button>

          {/* Neon Emerald Send Button */}
          <button
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-obsidian-950 font-bold p-2.5 rounded-lg shadow-glow-sm hover:shadow-glow-md transition-all active:scale-95 flex items-center justify-center shrink-0"
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            title="Send Message"
            aria-label="Send Message"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 12h14M12 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              ></path>
            </svg>
          </button>
        </div>

        {/* Shortcuts / Input Footer */}
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-gray-500">
          <span>
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-obsidian-800 text-gray-400 font-mono text-[10px] border border-obsidian-700">
              Enter
            </kbd>{" "}
            to send •{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-obsidian-800 text-gray-400 font-mono text-[10px] border border-obsidian-700">
              Shift + Enter
            </kbd>{" "}
            for newline
          </span>
          <button
            onClick={openSettings}
            className="text-emerald-400/80 hover:underline cursor-pointer bg-transparent border-0 p-0 text-[11px] font-mono"
          >
            Keyboard Shortcuts (⌘K)
          </button>
        </div>
      </div>
    </section>
  );
}
