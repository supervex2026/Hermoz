import { useState } from "react";
import { useMomoStore } from "@/store/useMomoStore";
import { ExternalLink, Key, Sparkles } from "lucide-react";

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const { saveApiKey, loadSettings } = useMomoStore();
  const [groqKey, setGroqKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!groqKey.trim() && !openRouterKey.trim() && !geminiKey.trim()) {
      setError("Paste at least one API key to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (groqKey.trim()) {
        await saveApiKey("groq", groqKey.trim());
      }
      if (openRouterKey.trim()) {
        await saveApiKey("openrouter", openRouterKey.trim());
      }
      if (geminiKey.trim()) {
        await saveApiKey("gemini", geminiKey.trim());
      }
      await loadSettings();
      onComplete();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Failed to save key";
      setError(msg);
      console.error("Failed to save keys:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
      style={{
        background: "rgba(0, 0, 0, 0.75)",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text)",
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl p-5 flex flex-col gap-4"
        style={{
          background: "var(--neutral-2)",
          border: "1px solid var(--color-border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Banner */}
        <div
          className="flex items-center space-x-3 pb-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "var(--neutral-3)",
              border: "1px solid var(--color-border)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-accent)">
              <circle cx="12" cy="13" r="7" />
              <circle cx="7" cy="7" r="3" />
              <circle cx="17" cy="7" r="3" />
              <circle cx="10" cy="12" fill="var(--neutral-1)" r="1.5" />
              <circle cx="14" cy="12" fill="var(--neutral-1)" r="1.5" />
              <ellipse cx="12" cy="15" fill="var(--neutral-1)" rx="1.5" ry="1" />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Welcome to Momo
              </h2>
              <span
                className="text-[10px] font-mono px-1.5 py-0.2 rounded"
                style={{
                  background: "var(--color-accent-subtle)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent)",
                }}
              >
                v2.4
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Your desktop AI companion with zero-loss routing.
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          Provide at least one AI provider key to power Momo. Keys are encrypted via Windows
          Credential Manager.
        </p>

        {/* Inputs */}
        <div className="space-y-3 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label style={{ color: "var(--color-text-secondary)" }}>
                Groq API Key (Free &amp; Fast)
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] hover:underline inline-flex items-center gap-1"
                style={{ color: "var(--color-accent)" }}
              >
                <span>Get free key</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              className="w-full rounded-md px-3 py-1.5 outline-none font-mono text-xs"
              style={{
                background: "var(--neutral-1)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="gsk_..."
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label style={{ color: "var(--color-text-secondary)" }}>
                OpenRouter API Key (Multi-Model)
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] hover:underline inline-flex items-center gap-1"
                style={{ color: "var(--color-accent)" }}
              >
                <span>Get key</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              className="w-full rounded-md px-3 py-1.5 outline-none font-mono text-xs"
              style={{
                background: "var(--neutral-1)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="sk-or-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label style={{ color: "var(--color-text-secondary)" }}>
                Google Gemini API Key (AI Studio)
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] hover:underline inline-flex items-center gap-1"
                style={{ color: "var(--color-accent)" }}
              >
                <span>Get free key</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <input
              type="password"
              className="w-full rounded-md px-3 py-1.5 outline-none font-mono text-xs"
              style={{
                background: "var(--neutral-1)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {error && (
          <div
            className="p-2 rounded text-xs font-mono"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div
          className="flex items-center justify-end space-x-2 pt-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            className="px-3 py-1.5 rounded-md text-xs font-mono transition"
            style={{
              background: "var(--neutral-3)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
            onClick={onSkip || onComplete}
          >
            Skip for now
          </button>
          <button
            className="px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition disabled:opacity-50"
            style={{
              background: "var(--color-accent)",
              border: "1px solid var(--color-accent-hover)",
              color: "#ffffff",
              boxShadow: "var(--shadow-xs)",
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save & Launch Momo"}
          </button>
        </div>
      </div>
    </div>
  );
}
