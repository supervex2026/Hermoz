import { useState, useEffect, lazy, Suspense } from "react";
import { useMomoStore } from "@/store/useMomoStore";
import { memoryStore } from "@/core/memory/memoryStore";
import { screenAnalyzer } from "@/core/vision/screenAnalyzer";
import { TitleBar } from "@/components/titlebar/TitleBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { VisionPanel } from "@/components/vision/VisionPanel";
import { MemoryPanel } from "@/components/memory/MemoryPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import "./MainLayout.css";

const AgentWorkspace = lazy(() => import("@/components/workspace/AgentWorkspace"));

export type SecondaryTab = "overview" | "vision" | "workspace" | "memory" | "settings";

interface MainLayoutProps {
  onSwitchToOverlay: () => void;
}

export function MainLayout({ onSwitchToOverlay }: MainLayoutProps) {
  const {
    activeTab,
    setActiveTab,
    expression,
    activity,
    bubbleText,
    sendMessage,
    providerStatus,
    settings,
    settingsOpen,
    closeSettings,
    openSettings,
    captureScreenWithCheck,
  } = useMomoStore();

  const [memories, setMemories] = useState(() => memoryStore.getMemories());
  const [screenInfo, setScreenInfo] = useState(() => screenAnalyzer.getDebugInfo());
  const [isInspecting, setIsInspecting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMemories(memoryStore.getMemories());
      setScreenInfo(screenAnalyzer.getDebugInfo());
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handlePandaPoke = () => {
    const pokeMessages = [
      "Hey Momo, what's up?",
      "Checking in, how are you feeling?",
      "Tell me a quick thought about my current setup.",
    ];
    const pick = pokeMessages[Math.floor(Math.random() * pokeMessages.length)];
    sendMessage(pick);
  };

  const handleInspectScreen = async () => {
    if (isInspecting) return;
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
      console.warn("Inspect failed:", err);
    } finally {
      setIsInspecting(false);
    }
  };

  const providerChain = settings.providerPriority || ["groq", "openrouter", "gemini"];
  const activeProvider = providerStatus.find((p) => p.state === "connected");

  // Mood label
  const moodLabel =
    expression === "happy"
      ? "Happy"
      : expression === "thinking"
      ? "Thinking"
      : expression === "smug"
      ? "Cheeky"
      : expression === "concerned"
      ? "Perplexed"
      : "Chill";

  return (
    <div className="w-full h-full bg-obsidian-950 text-gray-200 font-sans antialiased select-none flex flex-col overflow-hidden">
      {/* Main Container Window Frame */}
      <div className="relative w-full h-full bg-obsidian-900 flex flex-col overflow-hidden">
        {/* Obsidian Titlebar */}
        <TitleBar />

        {/* Two Column Layout: Conversation (Left ~65%) and Companion HUD (Right ~35%) */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Conversation Column */}
          <section className="w-full lg:w-[65%] flex flex-col h-full overflow-hidden">
            <ChatPanel onClose={onSwitchToOverlay} />
          </section>

          {/* Right Companion HUD Column */}
          <aside
            className="hidden lg:flex w-[35%] flex-col bg-obsidian-950/70 p-4 space-y-4 overflow-y-auto border-l border-obsidian-800"
            data-purpose="companion-diagnostics-hud"
          >
            {/* TOP WIDGET: Momo Avatar & Mood Hub */}
            <div
              className="bg-obsidian-900 border border-obsidian-750 rounded-2xl p-4 relative shadow-card-ambient overflow-hidden"
              data-purpose="avatar-mood-widget"
            >
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-start space-x-3.5">
                {/* Momo Panda Stylized Visual Avatar */}
                <div
                  className="relative shrink-0 cursor-pointer group"
                  onClick={handlePandaPoke}
                  title="Click to poke or chat with Momo"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-obsidian-800 to-obsidian-900 border-2 border-emerald-500/40 flex items-center justify-center shadow-glow-sm group-hover:border-emerald-400 transition-all">
                    {/* Digital Panda Character */}
                    <svg
                      className="w-11 h-11 text-gray-100 group-hover:scale-105 transition-transform"
                      viewBox="0 0 100 100"
                    >
                      {/* Ears */}
                      <circle
                        cx="26"
                        cy="26"
                        fill="#182721"
                        r="16"
                        stroke="#34D399"
                        strokeWidth="2.5"
                      ></circle>
                      <circle
                        cx="74"
                        cy="26"
                        fill="#182721"
                        r="16"
                        stroke="#34D399"
                        strokeWidth="2.5"
                      ></circle>
                      <circle cx="26" cy="26" fill="#10B981" r="8"></circle>
                      <circle cx="74" cy="26" fill="#10B981" r="8"></circle>
                      {/* Face base */}
                      <circle
                        cx="50"
                        cy="54"
                        fill="#F3F4F6"
                        r="38"
                        stroke="#1F332C"
                        strokeWidth="3"
                      ></circle>
                      {/* Eye Patches */}
                      <ellipse
                        cx="36"
                        cy="50"
                        fill="#13201B"
                        rx="10"
                        ry="13"
                        transform="rotate(-12 36 50)"
                      ></ellipse>
                      <ellipse
                        cx="64"
                        cy="50"
                        fill="#13201B"
                        rx="10"
                        ry="13"
                        transform="rotate(12 64 50)"
                      ></ellipse>
                      {/* Pupils with green glint */}
                      <circle
                        cx="37"
                        cy="49"
                        fill="#10B981"
                        r="4.5"
                        className={activity === "thinking" ? "animate-ping" : ""}
                      ></circle>
                      <circle cx="38.5" cy="47.5" fill="#FFFFFF" r="1.5"></circle>
                      <circle
                        cx="63"
                        cy="49"
                        fill="#10B981"
                        r="4.5"
                        className={activity === "thinking" ? "animate-ping" : ""}
                      ></circle>
                      <circle cx="64.5" cy="47.5" fill="#FFFFFF" r="1.5"></circle>
                      {/* Nose & Cheek Blush */}
                      <polygon fill="#1F332C" points="50,60 46,65 54,65"></polygon>
                      <circle
                        cx="25"
                        cy="62"
                        fill="#34D399"
                        opacity="0.3"
                        r="4"
                      ></circle>
                      <circle
                        cx="75"
                        cy="62"
                        fill="#34D399"
                        opacity="0.3"
                        r="4"
                      ></circle>
                      {/* Cute Smile */}
                      <path
                        d="M44 68 Q50 74 56 68"
                        fill="none"
                        stroke="#1F332C"
                        strokeLinecap="round"
                        strokeWidth="2.5"
                      ></path>
                    </svg>
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-obsidian-900"></span>
                  </span>
                </div>

                {/* Identity & State */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-white tracking-wide">
                      Momo
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                      {activity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="text-xs text-gray-400">Mood:</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {moodLabel}
                    </span>
                    <span className="text-xs text-gray-500">• Cheeky</span>
                  </div>
                  {/* Thought Bubble Preview */}
                  <div className="mt-2 text-[11px] italic text-emerald-300/80 bg-obsidian-950/80 border border-obsidian-750 rounded-lg p-2 leading-tight">
                    {bubbleText
                      ? `"${bubbleText.slice(0, 95)}${bubbleText.length > 95 ? "…" : ""}"`
                      : '"Hey, welcome back! I am right here on your desktop, ready to help."'}
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Navigation Tabs */}
            <nav
              className="grid grid-cols-5 gap-1 p-1 bg-obsidian-900 rounded-xl border border-obsidian-800 text-xs shrink-0"
              data-purpose="hud-sub-tabs"
            >
              <button
                className={`py-1.5 px-1.5 text-center rounded-lg font-medium flex items-center justify-center space-x-1 transition-all ${
                  activeTab === "overview"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-obsidian-800"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                <svg
                  className="w-3 h-3 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4 6h16M4 12h16M4 18h7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                <span>Overview</span>
              </button>

              <button
                className={`py-1.5 px-1.5 text-center rounded-lg font-medium flex items-center justify-center space-x-1 transition-all ${
                  activeTab === "vision"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-obsidian-800"
                }`}
                onClick={() => setActiveTab("vision")}
              >
                <svg
                  className="w-3 h-3 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                <span>Vision</span>
              </button>

              <button
                className={`py-1.5 px-1.5 text-center rounded-lg font-medium flex items-center justify-center space-x-1 transition-all ${
                  activeTab === "workspace"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-obsidian-800"
                }`}
                onClick={() => setActiveTab("workspace")}
              >
                <svg
                  className="w-3 h-3 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                <span>Agent</span>
              </button>

              <button
                className={`py-1.5 px-1.5 text-center rounded-lg font-medium flex items-center justify-center space-x-1 transition-all ${
                  activeTab === "memory"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-obsidian-800"
                }`}
                onClick={() => setActiveTab("memory")}
              >
                <svg
                  className="w-3 h-3 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                <span>Memory</span>
              </button>

              <button
                className={`py-1.5 px-1.5 text-center rounded-lg font-medium flex items-center justify-center space-x-1 transition-all ${
                  activeTab === "settings" || settingsOpen
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-obsidian-800"
                }`}
                onClick={() => openSettings()}
              >
                <svg
                  className="w-3 h-3 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                <span>Settings</span>
              </button>
            </nav>

            {/* TAB CONTENT: Overview */}
            {activeTab === "overview" && (
              <>
                {/* SECTION 1: Screen Awareness Card */}
                <div
                  className="bg-obsidian-900 border border-obsidian-750 rounded-2xl p-3.5 space-y-3 shadow-sm"
                  data-purpose="screen-awareness-module"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
                      <span className="text-xs font-semibold text-white tracking-wide">
                        Screen Awareness
                      </span>
                    </div>
                    <button
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors bg-transparent border-0 p-0"
                      onClick={() => setActiveTab("vision")}
                    >
                      Studio →
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {screenInfo ? (
                      <>
                        Last inspected:{" "}
                        <strong className="text-gray-200">
                          {screenInfo.contextAgeSeconds}s ago
                        </strong>{" "}
                        ({screenInfo.isStale ? "Stale" : "Fresh"}). Momo observes desktop workspace context.
                      </>
                    ) : (
                      "Momo can observe desktop workspace context and assist proactively."
                    )}
                  </p>
                  {/* Inspect Action Button */}
                  <button
                    className="w-full py-2.5 px-3 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center justify-center space-x-2 transition-all group"
                    onClick={handleInspectScreen}
                    disabled={isInspecting}
                  >
                    <svg
                      className={`w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform ${
                        isInspecting ? "animate-spin" : ""
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
                    <span>{isInspecting ? "Inspecting..." : "Inspect Screen Now"}</span>
                    <span className="text-[10px] font-mono text-gray-400 group-hover:text-emerald-400">
                      (Alt + S)
                    </span>
                  </button>
                </div>

                {/* SECTION 2: Memory Vault Card */}
                <div
                  className="bg-obsidian-900 border border-obsidian-750 rounded-2xl p-3.5 space-y-2.5 shadow-sm"
                  data-purpose="memory-vault-module"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-4 h-4 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <span className="text-xs font-semibold text-white tracking-wide">
                        Memory Vault
                      </span>
                    </div>
                    <button
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-transparent border-0 p-0"
                      onClick={() => setActiveTab("memory")}
                    >
                      Vault ({memories.length}) →
                    </button>
                  </div>
                  {/* Memory Chips Stack */}
                  <div className="space-y-1.5">
                    {memories.length === 0 ? (
                      <div className="p-2 rounded-lg bg-obsidian-850 border border-obsidian-800 text-[11px] text-gray-400">
                        No memories saved yet. Momo learns as you chat.
                      </div>
                    ) : (
                      memories.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="p-2 rounded-lg bg-obsidian-850 border border-obsidian-800 text-[11px] text-gray-300 truncate flex items-center justify-between group hover:border-emerald-500/30 transition-colors"
                        >
                          <span className="truncate">{m.content}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-2"></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SECTION 3: AI Routing Pipeline */}
                <div
                  className="bg-obsidian-900 border border-obsidian-750 rounded-2xl p-3.5 space-y-2.5 shadow-sm"
                  data-purpose="ai-routing-module"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-4 h-4 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        ></path>
                      </svg>
                      <span className="text-xs font-semibold text-white tracking-wide">
                        AI Routing &amp; Fallback
                      </span>
                    </div>
                    <button
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-transparent border-0 p-0"
                      onClick={() => openSettings()}
                    >
                      Configure →
                    </button>
                  </div>
                  {/* Fallback Pipeline Chain */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto py-1 text-[10px] font-mono">
                    {providerChain.map((p, idx) => {
                      const isLive = activeProvider?.id === p;
                      return (
                        <div key={p} className="flex items-center space-x-1.5 shrink-0">
                          <div
                            className={`px-2 py-1 rounded border flex items-center space-x-1 ${
                              isLive
                                ? "bg-emerald-950 border-emerald-500/40 text-emerald-300 font-semibold shadow-glow-sm"
                                : "bg-obsidian-800 border-obsidian-700 text-gray-300"
                            }`}
                          >
                            <span className={isLive ? "text-emerald-400" : "text-gray-500"}>
                              #{idx + 1}
                            </span>
                            <span>{p.toUpperCase()}</span>
                          </div>
                          {idx < providerChain.length - 1 && (
                            <span className="text-gray-600">→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* TAB CONTENT: Vision Studio */}
            {activeTab === "vision" && (
              <div className="flex-1 overflow-y-auto">
                <VisionPanel />
              </div>
            )}

            {/* TAB CONTENT: Memory Panel */}
            {activeTab === "memory" && (
              <div className="flex-1 overflow-y-auto">
                <MemoryPanel />
              </div>
            )}

            {/* TAB CONTENT: Agent Workspace */}
            {activeTab === "workspace" && (
              <div className="flex-1 overflow-y-auto">
                <Suspense
                  fallback={
                    <div className="p-4 text-xs text-gray-500 font-mono animate-pulse">
                      Loading Agent Workspace...
                    </div>
                  }
                >
                  <AgentWorkspace />
                </Suspense>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Float Momo on Desktop Action Button */}
            <div className="pt-2 shrink-0" data-purpose="floating-mode-action">
              <button
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-obsidian-950 font-bold text-xs tracking-wide shadow-glow-sm hover:shadow-glow-md transition-all flex items-center justify-center space-x-2 active:scale-95"
                onClick={onSwitchToOverlay}
                title="Float Momo on Desktop"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                <span>Float Momo on Desktop</span>
              </button>
            </div>
          </aside>
        </main>
      </div>

      {/* Settings Modal (Stitch Settings UI) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <SettingsPanel onClose={closeSettings} />
        </div>
      )}
    </div>
  );
}
