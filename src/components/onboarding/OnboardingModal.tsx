import { useState } from "react";
import { useMomoStore } from "@/store/useMomoStore";

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans text-slate-200">
      <div className="relative w-full max-w-lg bg-obsidian-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 shadow-black/90 flex flex-col gap-4">
        {/* Banner */}
        <div className="flex items-center space-x-3.5 pb-3 border-b border-emerald-950">
          <div className="w-12 h-12 rounded-xl bg-obsidian-800 border border-emerald-500/40 flex items-center justify-center shadow-glow-sm">
            <svg
              className="w-8 h-8 text-emerald-400"
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
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white font-mono">Welcome to Momo</h2>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                v2.4 PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Your witty desktop AI companion with zero-loss routing.
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed">
          Provide at least one AI provider key to power Momo. Keys are encrypted via Windows
          Credential Manager.
        </p>

        {/* Inputs */}
        <div className="space-y-3 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300">Groq API Key (Free &amp; Ultra-Fast)</label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Get free key ↗
              </a>
            </div>
            <input
              type="password"
              className="w-full bg-[#080d0b] text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 border border-emerald-950 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 outline-none"
              placeholder="gsk_..."
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300">OpenRouter API Key (Multi-Model)</label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Get key ↗
              </a>
            </div>
            <input
              type="password"
              className="w-full bg-[#080d0b] text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 border border-emerald-950 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 outline-none"
              placeholder="sk-or-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300">Google Gemini API Key (AI Studio)</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Get free key ↗
              </a>
            </div>
            <input
              type="password"
              className="w-full bg-[#080d0b] text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 border border-emerald-950 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 outline-none"
              placeholder="AIzaSy..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-danger-soft border border-danger-border text-danger-text text-xs font-mono">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-emerald-950">
          <button
            className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-obsidian-800 transition"
            onClick={onSkip || onComplete}
          >
            Skip for now
          </button>
          <button
            className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-obsidian-950 shadow-glow-sm hover:shadow-glow-md transition disabled:opacity-50"
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
