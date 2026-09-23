import { useEffect, useState } from "react";
import { useHermozStore } from "@/store/useHermozStore";
import { memoryStore } from "@/core/memory/memoryStore";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { CompanionStyle, Proactivity, ProviderId, RoastLevel, Seriousness } from "@/types";

type SettingsTab =
  | "providers"
  | "personality"
  | "voice"
  | "window"
  | "memory"
  | "hotkeys";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
    settings,
    updateSettings,
    saveApiKey,
    clearApiKey,
    setProviderPriority,
    providerStatus,
    voices,
    loadVoices,
    testVoice,
    isSpeaking,
    activeMicName,
    checkActiveMic,
  } = useHermozStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [searchQuery, setSearchQuery] = useState("");

  // Local state for editing API keys
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);
  const [stitchKeyInput, setStitchKeyInput] = useState("");
  const [memories, setMemories] = useState(() => memoryStore.getMemories());

  useEffect(() => {
    loadVoices();
    checkActiveMic();
    setMemories(memoryStore.getMemories());
  }, [loadVoices, checkActiveMic]);

  const handleSaveKey = async (provider: ProviderId) => {
    if (!keyInput.trim()) return;
    try {
      await saveApiKey(provider, keyInput.trim());
      setKeyFeedback("Key successfully saved!");
      setEditingProvider(null);
      setKeyInput("");
      setTimeout(() => setKeyFeedback(null), 3000);
    } catch (err) {
      setKeyFeedback("Error: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const saveStitchKey = async () => {
    if (!stitchKeyInput.trim()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_stitch_api_key", { key: stitchKeyInput.trim() });
      await updateSettings({ hasStitchKey: true });
      setStitchKeyInput("");
      setKeyFeedback("Stitch API key saved securely in your operating system credential store.");
    } catch (error) {
      setKeyFeedback(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const movePriority = (idx: number, dir: -1 | 1) => {
    const list = [...(settings.providerPriority || ["groq", "openrouter", "gemini"])];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const temp = list[idx];
    list[idx] = list[target];
    list[target] = temp;
    setProviderPriority(list);
  };

  const activeProvider = providerStatus.find((p) => p.state === "connected");
  const providerChain = settings.providerPriority || ["groq", "openrouter", "gemini"];
  const p = settings.personality;

  return (
    <div
      className="relative w-full max-w-5xl h-[800px] max-h-[92vh] bg-[var(--neutral-2)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden shadow-black/80 backdrop-blur-xl font-sans text-slate-200"
      data-purpose="desktop-settings-window"
    >
      {/* TitleBar */}
      <header
        className="h-12 bg-[var(--neutral-3)] border-b border-[var(--color-border)] px-4 flex items-center justify-between select-none shrink-0"
        data-purpose="window-titlebar"
      >
        {/* Left: Hermoz Symbol & Title */}
        <div className="flex items-center space-x-3">
          <div className="relative w-7 h-7 rounded-lg bg-[var(--neutral-4)] border border-[var(--color-accent)] flex items-center justify-center shadow-inner group">
            <svg
              className="w-4 h-4 text-[var(--color-accent)] group-hover:scale-110 transition-transform"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="6.5" cy="6.5" fill="var(--color-accent)" r="3"></circle>
              <circle cx="17.5" cy="6.5" fill="var(--color-accent)" r="3"></circle>
              <ellipse cx="12" cy="14" fill="#0f1512" rx="8" ry="7" stroke="var(--color-accent)" strokeWidth="1.8"></ellipse>
              <ellipse cx="9" cy="13.5" fill="var(--color-accent)" rx="1.8" ry="2.2"></ellipse>
              <ellipse cx="15" cy="13.5" fill="var(--color-accent)" rx="1.8" ry="2.2"></ellipse>
              <ellipse cx="12" cy="16.5" fill="var(--color-accent)" rx="1.5" ry="1.1"></ellipse>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-accent)] ring-2 ring-obsidian-900 animate-pulse"></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold tracking-wide text-slate-100 font-mono">
              Hermoz Desktop
            </span>
            <span className="text-xs text-slate-400 font-normal">Settings</span>
            <span className="text-[10px] uppercase font-mono font-bold bg-[var(--color-accent-subtle)] border border-[var(--color-accent)] text-[var(--color-accent)] px-1.5 py-0.5 rounded tracking-wider">
              v2.4 PRO
            </span>
          </div>
        </div>

        {/* Center: Status Pill */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-mono bg-[var(--neutral-2)]/90 border border-[var(--color-border)] px-3 py-1 rounded-full text-[var(--color-accent)] shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-ping"></span>
          <span className="tracking-tight text-slate-300">
            Local Engine Active • Failover Ready
          </span>
        </div>

        {/* Right: Close Button */}
        <div className="flex items-center space-x-2">
          <button
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-300 hover:bg-red-950/60 transition group"
            onClick={onClose}
            title="Close Settings"
          >
            <svg
              className="w-4 h-4 group-hover:scale-110 transition-transform"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* Search & Quick Bar */}
      <div className="bg-[var(--neutral-2)]/70 border-b border-[var(--color-border)] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </span>
          <input
            className="w-full pl-9 pr-14 py-1.5 bg-[var(--neutral-3)]/90 border border-[var(--color-border)] rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/30 transition shadow-inner"
            placeholder="Search settings, hotkeys, models... (Ctrl + /)"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <kbd className="text-[10px] font-mono bg-[var(--neutral-4)] border border-[var(--color-border)] text-slate-400 px-1.5 py-0.5 rounded">
              Ctrl+K
            </kbd>
          </span>
        </div>

        {/* Quick Session Indicator Stats */}
        <div className="hidden lg:flex items-center space-x-4 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Overlay:</span>
            <span className="text-[var(--color-accent)] font-medium">Floating Panda</span>
          </div>
          <div className="h-3 w-px bg-[var(--neutral-3)]"></div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">PTT Hotkey:</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--neutral-4)] border border-[var(--color-border)] text-[var(--color-accent)] text-[11px]">
              F1 [Hold]
            </span>
          </div>
          <div className="h-3 w-px bg-[var(--neutral-3)]"></div>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Latency:</span>
            <span className="text-[var(--color-accent)]">42ms</span>
          </div>
        </div>
      </div>

      {/* Body Container (Sidebar + Main Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside
          className="w-60 bg-[var(--neutral-2)]/95 border-r border-[var(--color-border)]/70 p-3 flex flex-col justify-between select-none shrink-0"
          data-purpose="settings-sidebar"
        >
          <div className="space-y-1">
            <p className="px-3 py-2 text-[10px] font-mono tracking-wider font-semibold text-slate-500 uppercase">
              Configuration
            </p>

            {/* AI Providers & Routing */}
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                activeTab === "providers"
                  ? "bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-3)]"
              }`}
              onClick={() => setActiveTab("providers")}
            >
              <div className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span>AI Providers</span>
              </div>
              <span className="text-[10px] font-mono bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)] px-1.5 py-0.2 rounded-full font-semibold">
                3
              </span>
            </button>

            {/* Personality & Behavior */}
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                activeTab === "personality"
                  ? "bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-3)]"
              }`}
              onClick={() => setActiveTab("personality")}
            >
              <div className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span>Personality</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]/50"></span>
            </button>

            {/* Voice & Push-to-Talk */}
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                activeTab === "voice"
                  ? "bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-3)]"
              }`}
              onClick={() => setActiveTab("voice")}
            >
              <div className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span>Voice &amp; Audio</span>
              </div>
            </button>

            {/* Window & Overlay */}
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                activeTab === "window"
                  ? "bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-3)]"
              }`}
              onClick={() => setActiveTab("window")}
            >
              <div className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect height="18" rx="2" strokeWidth="2" width="18" x="3" y="3"></rect>
                  <path d="M3 9h18" strokeWidth="2"></path>
                  <path d="M9 21V9" strokeWidth="2"></path>
                </svg>
                <span>Window &amp; Overlay</span>
              </div>
            </button>

            {/* Memory Vault */}
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                activeTab === "memory"
                  ? "bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-3)]"
              }`}
              onClick={() => setActiveTab("memory")}
            >
              <div className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span>Memory Vault</span>
              </div>
              <span className="text-[9px] font-mono uppercase bg-[var(--neutral-3)] text-[var(--color-accent)] px-1 py-0.2 rounded border border-[var(--color-border)]">
                {memories.length}
              </span>
            </button>

            {/* Hotkeys */}
            <button
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                activeTab === "hotkeys"
                  ? "bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-3)]"
              }`}
              onClick={() => setActiveTab("hotkeys")}
            >
              <div className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect height="12" rx="2" strokeWidth="2" width="20" x="2" y="6"></rect>
                  <path d="M6 10h2m2 0h4m2 0h2M7 14h10"></path>
                </svg>
                <span>Hotkeys &amp; Keys</span>
              </div>
            </button>
          </div>

          {/* Sidebar Bottom: System Information Card */}
          <div className="mt-4 p-3 rounded-xl bg-[var(--neutral-3)] border border-[var(--color-border)] text-xs shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-mono text-[11px]">Failover Pipeline</span>
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-sm"></span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Active:{" "}
              <span className="text-[var(--color-accent)] font-semibold uppercase">
                {activeProvider?.id || "Local"}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>RAM: 142 MB</span>
              <span>Uptime: Active</span>
            </div>
          </div>
        </aside>

        {/* Main Settings Content Area */}
        <main
          className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6"
          data-purpose="settings-panel-content"
        >
          {keyFeedback && (
            <div className="p-3 rounded-xl bg-[var(--neutral-3)]/90 border border-[var(--color-accent)] text-[var(--color-accent)] text-xs font-mono">
              {keyFeedback}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 1: AI Providers & Failover Priority                     */}
          {/* ============================================================ */}
          {activeTab === "providers" && (
            <section className="space-y-4" data-purpose="section-ai-providers">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight">
                    AI Providers &amp; Failover Priority
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)]">
                    Zero-Loss Failover
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Hermoz supports three interchangeable AI brains. If your top priority provider hits a rate limit or runtime error, Hermoz automatically falls over to the next one in milliseconds with zero loss of memory, conversation, or screen context.
                </p>
              </div>

              {/* Provider Cards Stack */}
              <div className="space-y-3">
                {providerChain.map((pid, idx) => {
                  const isGroq = pid === "groq";
                  const isOpenRouter = pid === "openrouter";
                  const isGemini = pid === "gemini";

                  const hasKey = isGroq
                    ? settings.hasGroqKey
                    : isOpenRouter
                    ? settings.hasOpenRouterKey
                    : settings.hasGeminiKey;

                  const status = providerStatus.find((st) => st.id === pid);
                  const isLive = status?.state === "connected";
                  const isError = status?.state === "error" || status?.state === "rate_limited";

                  const title = isGroq
                    ? "Groq"
                    : isOpenRouter
                    ? "OpenRouter"
                    : "Google Gemini";

                  const subtitle = isGroq
                    ? "(Llama 3.3 70B Versatile)"
                    : isOpenRouter
                    ? "(Claude 3.5 Sonnet / Multi-Model)"
                    : "(Gemini 2.0 Flash)";

                  const desc = isGroq
                    ? "Ultra-fast inference (820 tokens/sec) • Instant latency responses"
                    : isOpenRouter
                    ? "Smart reasoning & full computer screen vision analysis"
                    : "Massive multimodal context window (1M tokens) through AI Studio";

                  return (
                    <div
                      key={pid}
                      className={`rounded-xl p-4 transition-all duration-200 ${
                        isLive
                          ? "bg-[var(--neutral-3)] border-2 border-[var(--color-accent)]/50 shadow-sm relative overflow-hidden"
                          : isError
                          ? "bg-[var(--neutral-3)]/80 border border-danger-border/70"
                          : "bg-[var(--neutral-3)]/80 border border-[var(--color-border)]"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start md:items-center space-x-3">
                          {/* Order Badge & Reorder Buttons */}
                          <div className="flex items-center space-x-1 bg-[var(--neutral-2)] border border-[var(--color-border)] px-2 py-1 rounded-lg shrink-0">
                            <span
                              className={`font-mono font-bold text-xs ${
                                isLive ? "text-[var(--color-accent)]" : "text-slate-300"
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <div className="flex flex-col ml-1 space-y-0.5">
                              <button
                                className="text-slate-400 hover:text-[var(--color-accent)] p-0.5 leading-none text-[9px] disabled:opacity-30"
                                onClick={() => movePriority(idx, -1)}
                                disabled={idx === 0}
                                title="Move up priority"
                              >
                                <ChevronUp size={10} />
                              </button>
                              <button
                                className="text-slate-400 hover:text-[var(--color-accent)] p-0.5 leading-none text-[9px] disabled:opacity-30"
                                onClick={() => movePriority(idx, 1)}
                                disabled={idx === providerChain.length - 1}
                                title="Move down priority"
                              >
                                <ChevronDown size={10} />
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <h3 className="text-sm font-semibold text-white font-mono">
                                {title} <span className="text-xs font-normal text-slate-400">{subtitle}</span>
                              </h3>

                              {isLive && (
                                <span className="inline-flex items-center space-x-1.5 text-[10px] font-mono text-[var(--color-accent)] bg-[var(--neutral-3)]/90 px-2 py-0.5 rounded-full border border-[var(--color-accent)]/60 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse"></span>
                                  <span>ACTIVE PRIMARY BRAIN</span>
                                </span>
                              )}

                              {isError && (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-danger-text bg-danger-soft px-2 py-0.5 rounded-full border border-danger-border/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                  <span>Bypassed / Fallback Active</span>
                                </span>
                              )}

                              {!isLive && !isError && hasKey && (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-mono text-[var(--color-accent)] bg-[var(--neutral-3)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></span>
                                  <span>Connected • Standby</span>
                                </span>
                              )}

                              {!hasKey && (
                                <span className="inline-flex items-center text-[10px] font-mono text-slate-500 bg-[var(--neutral-2)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                                  Key Not Set
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {desc}
                            </p>
                          </div>
                        </div>

                        {/* Key Edit / Input Actions */}
                        <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
                          {editingProvider === pid ? (
                            <div className="flex items-center space-x-1.5">
                              <input
                                className="bg-[var(--neutral-2)] border border-[var(--color-accent)] text-[var(--color-text)] text-xs font-mono rounded-lg px-2.5 py-1.5 w-44 focus:outline-none"
                                type="password"
                                placeholder={`Paste ${title} Key`}
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value)}
                                autoFocus
                              />
                              <button
                                className="px-2.5 py-1.5 text-xs font-mono bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-obsidian-950 font-bold rounded-lg transition"
                                onClick={() => handleSaveKey(pid)}
                              >
                                Save
                              </button>
                              <button
                                className="px-2 py-1.5 text-xs font-mono bg-obsidian-750 text-slate-400 rounded-lg hover:text-white"
                                onClick={() => {
                                  setEditingProvider(null);
                                  setKeyInput("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="relative">
                                <input
                                  className="bg-[var(--neutral-2)] border border-[var(--color-border)] text-slate-400 text-xs font-mono rounded-lg px-2.5 py-1.5 w-36 focus:outline-none"
                                  readOnly
                                  type="password"
                                  value={hasKey ? "••••••••••••••••" : ""}
                                  placeholder={hasKey ? "Key configured" : "No key"}
                                />
                                {hasKey && (
                                  <span className="absolute right-2 top-2 text-[10px] font-mono text-[var(--color-accent)] flex items-center space-x-1">
                                    <svg className="w-3 h-3 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                    </svg>
                                    <span>Saved</span>
                                  </span>
                                )}
                              </div>
                              <button
                                className="px-3 py-1.5 text-xs font-mono bg-obsidian-750 hover:bg-obsidian-700 text-slate-200 border border-[var(--color-border)] rounded-lg transition"
                                onClick={() => {
                                  setEditingProvider(pid);
                                  setKeyInput("");
                                }}
                              >
                                {hasKey ? "Edit Key" : "Set Key"}
                              </button>
                              {hasKey && (
                                <button
                                  className="px-2.5 py-1.5 text-xs font-mono bg-danger-soft/80 hover:bg-red-900/60 text-red-300 border border-danger-border rounded-lg transition"
                                  onClick={() => clearApiKey(pid)}
                                  title="Remove key"
                                >
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-xl p-4 bg-[var(--neutral-3)]/80 border border-[var(--color-border)]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white font-mono">Google Stitch <span className="text-xs font-normal text-slate-400">(UI generation)</span></h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">Generates web and mobile UI screens through Google’s official Stitch MCP endpoint. This key is not used for chat routing.</p>
                    </div>
                    {settings.hasStitchKey ? (
                      <button className="px-3 py-1.5 text-xs font-mono bg-danger-soft/80 hover:bg-red-900/60 text-red-300 border border-danger-border rounded-lg transition" onClick={async () => {
                        const { invoke } = await import("@tauri-apps/api/core");
                        await invoke("clear_stitch_api_key");
                        await updateSettings({ hasStitchKey: false });
                      }}>Remove</button>
                    ) : (
                      <div className="flex gap-2 w-full md:w-auto">
                        <input className="min-w-0 md:w-56 px-3 py-1.5 bg-[var(--neutral-2)] border border-[var(--color-border)] rounded-lg text-xs font-mono" type="password" placeholder="Paste Stitch API key" value={stitchKeyInput} onChange={(event) => setStitchKeyInput(event.target.value)} />
                        <button className="px-3 py-1.5 text-xs font-mono bg-[var(--color-accent)] text-obsidian-950 rounded-lg" onClick={saveStitchKey}>Save</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* TAB 2: Personality & Proactivity                            */}
          {/* ============================================================ */}
          {activeTab === "personality" && (
            <section className="space-y-6" data-purpose="section-personality">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight">
                  Personality &amp; Behavior
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customize Hermoz's attitude, roast intensity, proactive reactions, and humor style.
                </p>
              </div>

              <div className="bg-[var(--neutral-3)]/80 border border-[var(--color-border)] rounded-xl p-5 space-y-5">
                {/* Roast Level Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono font-medium text-slate-200 flex items-center space-x-2">
                      <span>Roast Level</span>
                      <span className="text-[10px] text-[var(--color-accent)] bg-[var(--neutral-3)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                        Level {p.roastLevel}: {p.roastLevel === 0 ? "Polite" : p.roastLevel === 1 ? "Witty" : p.roastLevel === 2 ? "Cheeky Bro" : "Savage"}
                      </span>
                    </label>
                    <span className="text-xs text-slate-400 italic">
                      {p.roastLevel === 0 && '"Happy to assist with your code anytime."'}
                      {p.roastLevel === 1 && '"Looks nice! Maybe refactor that function later?"'}
                      {p.roastLevel === 2 && '"Bro, is that third nested loop really necessary?"'}
                      {p.roastLevel === 3 && '"Bro you got 40 browser tabs open and 0 finished commits."'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-[var(--neutral-2)] p-1.5 rounded-xl border border-[var(--color-border)]">
                    {[
                      { level: 0, title: "0", sub: "Gentle & Polite" },
                      { level: 1, title: "1", sub: "Witty Friend" },
                      { level: 2, title: "2", sub: "Cheeky Bro" },
                      { level: 3, title: "3 (Savage)", sub: "Savage Roast" },
                    ].map((item) => {
                      const isSel = p.roastLevel === item.level;
                      return (
                        <button
                          key={item.level}
                          className={`py-2 text-center rounded-lg text-xs font-mono transition ${
                            isSel
                              ? "bg-[var(--color-accent)]/90 text-white font-bold shadow-sm ring-1 ring-[var(--color-accent)]/40"
                              : "text-slate-400 hover:text-slate-200 hover:bg-[var(--neutral-4)]"
                          }`}
                          onClick={() =>
                            updateSettings({
                              personality: { ...p, roastLevel: item.level as RoastLevel },
                            })
                          }
                        >
                          <div className="font-bold">{item.title}</div>
                          <div className="text-[10px] opacity-80">{item.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Proactivity & Seriousness */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proactivity */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Proactivity</label>
                    <select
                      className="w-full bg-[var(--neutral-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-[var(--color-accent)]/50 focus:outline-none"
                      value={p.proactivity}
                      onChange={(e) =>
                        updateSettings({
                          personality: { ...p, proactivity: e.target.value as Proactivity },
                        })
                      }
                    >
                      <option value="low">Quiet — only speaks when spoken to</option>
                      <option value="medium">Medium — chimes in sometimes (every 15-20 min)</option>
                      <option value="high">Active — comments on coding &amp; workspace</option>
                    </select>
                  </div>

                  {/* Seriousness */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">
                      Companion Tone / Seriousness
                    </label>
                    <select
                      className="w-full bg-[var(--neutral-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-[var(--color-accent)]/50 focus:outline-none"
                      value={p.seriousness}
                      onChange={(e) =>
                        updateSettings({
                          personality: { ...p, seriousness: e.target.value as Seriousness },
                        })
                      }
                    >
                      <option value="balanced">Balanced — friendly peer programmer</option>
                      <option value="casual">Casual Dev Bro — gamer slang &amp; caffeine jokes</option>
                      <option value="serious">Strict Senior Architect — zero BS, pure code reviews</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* TAB 3: Voice & Audio                                        */}
          {/* ============================================================ */}
          {activeTab === "voice" && (
            <section className="space-y-5" data-purpose="section-voice-audio">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight">
                  Voice &amp; Audio Input (Push-to-Talk)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Offline Windows speech synthesizer. Detected OS voices with zero cloud API latency or cost.
                </p>
              </div>

              <div className="bg-[var(--neutral-3)]/80 border border-[var(--color-border)] rounded-xl p-5 space-y-5">
                {/* Voice Selector and Test Voice Button */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-mono text-slate-300">Synthesizer Voice</label>
                    <select
                      className="w-full bg-[var(--neutral-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:border-[var(--color-accent)]/50 focus:outline-none"
                      value={settings.selectedVoice || ""}
                      onChange={(e) => updateSettings({ selectedVoice: e.target.value })}
                    >
                      {voices.length === 0 ? (
                        <option value="">Default Windows System Voice</option>
                      ) : (
                        voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.lang})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <button
                    className="flex items-center justify-center space-x-2 w-full py-2 bg-[var(--neutral-4)] hover:bg-obsidian-750 text-[var(--color-accent)] border border-[var(--color-border)]/40 hover:border-[var(--color-accent)] rounded-lg text-xs font-mono transition shadow-sm"
                    onClick={testVoice}
                    disabled={isSpeaking}
                  >
                    <svg className="w-4 h-4 text-[var(--color-accent)] fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"></path>
                    </svg>
                    <span>{isSpeaking ? "Speaking..." : "Test Voice Sample"}</span>
                  </button>
                </div>

                {/* Sliders: Speed & Pitch */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">Speech Rate / Speed</span>
                      <span className="text-[var(--color-accent)] font-semibold">
                        {settings.ttsSpeed.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      className="w-full cursor-pointer"
                      max="2.0"
                      min="0.5"
                      step="0.05"
                      type="range"
                      value={settings.ttsSpeed}
                      onChange={(e) => updateSettings({ ttsSpeed: parseFloat(e.target.value) })}
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>0.5x (Slow)</span>
                      <span>1.0x (Default)</span>
                      <span>2.0x (Hyper)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">Vocal Pitch</span>
                      <span className="text-[var(--color-accent)] font-semibold">
                        {settings.ttsPitch.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      className="w-full cursor-pointer"
                      max="1.5"
                      min="0.5"
                      step="0.05"
                      type="range"
                      value={settings.ttsPitch}
                      onChange={(e) => updateSettings({ ttsPitch: parseFloat(e.target.value) })}
                    />
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Low Depth</span>
                      <span>Normal</span>
                      <span>Animated</span>
                    </div>
                  </div>
                </div>

                {/* Voice Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <label className="flex items-center space-x-2.5 bg-[var(--neutral-2)]/60 p-2.5 rounded-lg border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-border)]/60 transition">
                    <input
                      checked={settings.speakChatResponses}
                      onChange={(e) => updateSettings({ speakChatResponses: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--color-accent)] bg-[var(--neutral-4)] border-[var(--color-border)]/80 focus:ring-0"
                      type="checkbox"
                    />
                    <span className="text-xs font-mono text-slate-300">Speak chat replies</span>
                  </label>

                  <label className="flex items-center space-x-2.5 bg-[var(--neutral-2)]/60 p-2.5 rounded-lg border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-border)]/60 transition">
                    <input
                      checked={settings.ttsEnabled}
                      onChange={(e) => updateSettings({ ttsEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--color-accent)] bg-[var(--neutral-4)] border-[var(--color-border)]/80 focus:ring-0"
                      type="checkbox"
                    />
                    <span className="text-xs font-mono text-slate-300">Proactive comments</span>
                  </label>

                  <label className="flex items-center space-x-2.5 bg-[var(--neutral-2)]/60 p-2.5 rounded-lg border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-border)]/60 transition">
                    <input
                      checked={settings.muteHermoz}
                      onChange={(e) => updateSettings({ muteHermoz: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--color-accent)] bg-[var(--neutral-4)] border-[var(--color-border)]/80 focus:ring-0"
                      type="checkbox"
                    />
                    <span className="text-xs font-mono text-slate-300">Mute Hermoz completely</span>
                  </label>
                </div>

                {/* Push-to-Talk Mic Visualizer Card */}
                <div className="bg-[var(--neutral-2)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-[var(--neutral-3)] text-[var(--color-accent)] border border-[var(--color-accent)] text-xs font-mono font-bold">
                        F1 Hotkey
                      </span>
                      <span className="text-xs text-slate-200 font-medium">
                        Hold anywhere to speak to Hermoz like a real desktop companion
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Release F1 to send</span>
                  </div>

                  <div className="flex items-center justify-between bg-[var(--neutral-3)] px-3.5 py-2.5 rounded-lg border border-[var(--color-border)]">
                    <div className="flex items-center space-x-3">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-accent)]"></span>
                      </span>
                      <div>
                        <div className="text-xs font-mono text-slate-200">
                          Active Mic:{" "}
                          <span className="text-[var(--color-accent)] font-semibold">
                            {activeMicName || "Default Audio Device"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Local VAD &amp; Whisper STT enabled
                        </div>
                      </div>
                    </div>
                    {/* Visualizer bars */}
                    <div className="flex items-center space-x-1.5 px-3">
                      <div className="w-1 bg-[var(--color-accent)]/40 rounded-full h-2"></div>
                      <div className="w-1 bg-[var(--color-accent)] rounded-full audio-bar-1"></div>
                      <div className="w-1 bg-[var(--color-accent)] rounded-full audio-bar-2"></div>
                      <div className="w-1 bg-[var(--color-accent)] rounded-full audio-bar-3"></div>
                      <div className="w-1 bg-[var(--color-accent)]/50 rounded-full audio-bar-4"></div>
                      <div className="w-1 bg-[var(--color-accent)] rounded-full audio-bar-5"></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* TAB 4: Window & Overlay                                      */}
          {/* ============================================================ */}
          {activeTab === "window" && (
            <section className="space-y-4" data-purpose="section-window-overlay">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight">
                  Window &amp; Desktop Overlay
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage floating widget pin and desktop overlay parameters.
                </p>
              </div>

              <div className="bg-[var(--neutral-3)]/80 border border-[var(--color-border)] rounded-xl p-5 divide-y divide-neutral-800/60">
                <div className="flex items-center justify-between py-3 first:pt-0">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono font-medium text-slate-200">
                      Launch at Windows Startup
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Silently start Hermoz minimized into the system tray when logging into Windows.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      checked={settings.launchAtStartup}
                      onChange={(e) => updateSettings({ launchAtStartup: e.target.checked })}
                      className="sr-only peer"
                      type="checkbox"
                    />
                    <div className="w-10 h-5 bg-obsidian-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)] shadow-inner"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono font-medium text-slate-200">
                      Always on Top
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Keeps Hermoz floating above other windows even during full-screen coding.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      checked={settings.alwaysOnTop}
                      onChange={(e) => updateSettings({ alwaysOnTop: e.target.checked })}
                      className="sr-only peer"
                      type="checkbox"
                    />
                    <div className="w-10 h-5 bg-obsidian-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)] shadow-inner"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono font-medium text-slate-200">
                      Click-through Mode
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ignores mouse clicks directly over Hermoz so you can interact with windows directly underneath.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      checked={settings.clickThrough}
                      onChange={(e) => updateSettings({ clickThrough: e.target.checked })}
                      className="sr-only peer"
                      type="checkbox"
                    />
                    <div className="w-10 h-5 bg-obsidian-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)] shadow-inner"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-3 last:pb-0">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono font-medium text-slate-200">
                      Hide Hermoz from screen captures
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Hermoz will not appear in screenshots, screen shares, or recordings.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      checked={settings.excludeFromCapture ?? true}
                      onChange={(e) => updateSettings({ excludeFromCapture: e.target.checked })}
                      className="sr-only peer"
                      type="checkbox"
                    />
                    <div className="w-10 h-5 bg-obsidian-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-accent)] shadow-inner"></div>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* TAB 5: Memory Vault                                         */}
          {/* ============================================================ */}
          {activeTab === "memory" && (
            <section className="space-y-4" data-purpose="section-memory-vault">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight flex items-center space-x-2">
                  <span>Long-Term Memory Vault</span>
                  <span className="text-[10px] font-mono bg-[var(--neutral-3)] text-[var(--color-accent)] px-2 py-0.5 rounded border border-[var(--color-border)]/60">
                    Persistent Canonical Storage
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Long-term memory lets Hermoz remember your personal projects, favorite languages, past errors, and daily goals between reboot sessions.
                </p>
              </div>

              <div className="bg-[var(--neutral-3)]/80 border border-[var(--color-border)] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--neutral-2)]/90 p-3.5 rounded-lg border border-[var(--color-border)]">
                  <div>
                    <div className="text-xs font-mono font-semibold text-[var(--color-accent)]">
                      Memory Status: Active ({memories.length} items stored)
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Persistent JSON Vault: <span className="text-slate-200">~/.hermoz/memory.json</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="px-2.5 py-1 text-xs font-mono bg-[var(--neutral-4)] hover:bg-obsidian-750 text-slate-200 border border-[var(--color-border)] rounded transition"
                      onClick={() => {
                        const json = JSON.stringify(memories, null, 2);
                        navigator.clipboard.writeText(json);
                        alert("Copied canonical memories JSON to clipboard!");
                      }}
                    >
                      Export JSON
                    </button>
                    <button
                      className="px-2.5 py-1 text-xs font-mono bg-danger-soft/80 hover:bg-red-950 text-red-300 border border-danger-border rounded transition"
                      onClick={() => {
                        if (confirm("Clear all long-term memories?")) {
                          memoryStore.clearAll();
                          setMemories([]);
                        }
                      }}
                    >
                      Purge Cache
                    </button>
                  </div>
                </div>

                {/* Recalled Context */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Stored Memory Facts
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono max-h-[260px] overflow-y-auto pr-1">
                    {memories.length === 0 ? (
                      <div className="p-3 text-slate-500">No memories saved yet.</div>
                    ) : (
                      memories.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded bg-[var(--neutral-2)]/60 border border-[var(--color-border)] text-slate-300 flex items-start space-x-2"
                        >
                          <span className="text-[var(--color-accent)] font-bold">•</span>
                          <span className="break-words">{m.content}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================ */}
          {/* TAB 6: Hotkeys & Shortcuts                                  */}
          {/* ============================================================ */}
          {activeTab === "hotkeys" && (
            <section className="space-y-4" data-purpose="section-hotkeys">
              <div>
                <h2 className="text-base font-bold text-slate-100 font-mono tracking-tight">
                  Hotkeys &amp; Shortcuts
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Native global keyboard bindings designed for flow state.
                </p>
              </div>

              <div className="bg-[var(--neutral-3)]/80 border border-[var(--color-border)] rounded-xl p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <span className="text-slate-300">Push-to-Talk (Hold to speak)</span>
                  <kbd className="px-2 py-1 bg-[var(--neutral-2)] border border-[var(--color-border)]/40 rounded text-[var(--color-accent)] font-bold">
                    F1
                  </kbd>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <span className="text-slate-300">Inspect Screen Instantly</span>
                  <kbd className="px-2 py-1 bg-[var(--neutral-2)] border border-[var(--color-border)]/40 rounded text-[var(--color-accent)] font-bold">
                    Alt + S
                  </kbd>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <span className="text-slate-300">Interrupt / Stop Hermoz Speaking</span>
                  <kbd className="px-2 py-1 bg-[var(--neutral-2)] border border-[var(--color-border)]/40 rounded text-[var(--color-accent)] font-bold">
                    Esc
                  </kbd>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <span className="text-slate-300">Send Chat Message</span>
                  <kbd className="px-2 py-1 bg-[var(--neutral-2)] border border-[var(--color-border)]/40 rounded text-[var(--color-accent)] font-bold">
                    Enter
                  </kbd>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-300">Insert Newline in Chat</span>
                  <kbd className="px-2 py-1 bg-[var(--neutral-2)] border border-[var(--color-border)]/40 rounded text-[var(--color-accent)] font-bold">
                    Shift + Enter
                  </kbd>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer
        className="h-16 bg-[var(--neutral-3)]/95 border-t border-[var(--color-border)] px-6 flex items-center justify-between select-none shrink-0"
        data-purpose="settings-footer"
      >
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
            <path
              clipRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              fillRule="evenodd"
            ></path>
          </svg>
          <span>All settings auto-saved to local configuration.</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-obsidian-750 border border-transparent transition"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2 rounded-xl text-xs font-mono font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-obsidian-950 shadow-sm transition duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={onClose}
          >
            Close &amp; Apply
          </button>
        </div>
      </footer>
    </div>
  );
}
