import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useHermozStore } from "@/store/useHermozStore";
import { ActionApprovalModal } from "@/components/action-modal/ActionApprovalModal";
import { MainLayout } from "@/components/layout/MainLayout";
import { FloatingOverlay } from "@/components/overlay/FloatingOverlay";
import { IntroLoader } from "@/components/intro/IntroLoader";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { proactiveEngine } from "@/core/initiative/proactiveEngine";
import "./styles/tokens.css";
import "./styles/global.css";
import "./App.css";

const WINDOW_SIZE_DASHBOARD = { width: 980, height: 680 };
const WINDOW_SIZE_OVERLAY = { width: 420, height: 490 };

export default function App() {
  const {
    settings,
    loadSettings,
    settingsLoaded,
    greet,
    sendMessage,
    startPTT,
    stopPTT,
    stopSpeaking,
  } = useHermozStore();

  const [showIntro, setShowIntro] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOverlayMode, setIsOverlayMode] = useState(false);

  const hasGreeted = useRef(false);

  // 1. Initial settings load
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 2. Initial greeting and proactive engine startup
  useEffect(() => {
    if (!settingsLoaded || hasGreeted.current) return;
    hasGreeted.current = true;
    
    // Check if user needs onboarding (no keys configured)
    const hasAnyKey = settings.hasGroqKey || settings.hasOpenRouterKey || settings.hasGeminiKey;
    if (!hasAnyKey) {
      setShowOnboarding(true);
    }

    // Proactive messages travel through the same response pipeline as chat,
    // so provider, speech, and memory behavior remain consistent.
    proactiveEngine.setCooldownSeconds(settings.proactiveCooldownSeconds);
    proactiveEngine.init((event) => {
      void sendMessage(`[proactive check-in: ${event.message}]`, { forceTts: true });
    });

    // Initial greeting after brief pause
    const t = setTimeout(() => greet(), 800);
    return () => {
      clearTimeout(t);
      proactiveEngine.stop();
    };
  }, [settingsLoaded, settings.hasGroqKey, settings.hasOpenRouterKey, settings.hasGeminiKey, settings.proactiveCooldownSeconds, greet, sendMessage]);

  // 3. Dynamic window resizing when toggling between Overlay and Dashboard
  useEffect(() => {
    const targetSize = isOverlayMode ? WINDOW_SIZE_OVERLAY : WINDOW_SIZE_DASHBOARD;
    invoke("resize_window", targetSize).catch(() => {
      // Running outside Tauri or preview mode
    });
  }, [isOverlayMode]);

  // 4. Push-to-Talk (Hold F1 to talk) listeners: window keyboard and global Tauri events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        if (!e.repeat) {
          startPTT();
        }
      } else if (e.key === "Escape") {
        stopSpeaking();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        stopPTT();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let unlistenStart: (() => void) | null = null;
    let unlistenStop: (() => void) | null = null;

    listen("ptt-start", () => {
      startPTT();
    })
      .then((fn) => {
        unlistenStart = fn;
      })
      .catch(() => {});

    listen("ptt-stop", () => {
      stopPTT();
    })
      .then((fn) => {
        unlistenStop = fn;
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (unlistenStart) unlistenStart();
      if (unlistenStop) unlistenStop();
    };
  }, [startPTT, stopPTT]);

  // Show the welcome screen on startup
  if (showIntro) {
    return <IntroLoader onFinish={() => setShowIntro(false)} />;
  }

  return (
    <div className="hermoz-app-container" data-theme="dark">
      {/* First-time API Key Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* Autonomous Action & Agent Approval Gate Modal (Dual Mode: Overlay & Dashboard) */}
      <ActionApprovalModal isOverlayMode={isOverlayMode} />

      {/* Main View: Floating Companion Overlay or Full Desktop Dashboard */}
      {isOverlayMode ? (
        <FloatingOverlay onOpenDashboard={() => setIsOverlayMode(false)} />
      ) : (
        <MainLayout onSwitchToOverlay={() => setIsOverlayMode(true)} />
      )}
    </div>
  );
}
