import { useState } from "react";
import { screenAnalyzer, ScreenDebugInfo } from "@/core/vision/screenAnalyzer";
import { useMomoStore } from "@/store/useMomoStore";
import { CameraIcon, SparklesIcon, SendIcon } from "@/components/icons/Icons";
import "./VisionPanel.css";

export function VisionPanel() {
  const { sendMessage, isSending, captureScreenWithCheck } = useMomoStore();
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [roastReply, setRoastReply] = useState("");
  const [debugInfo, setDebugInfo] = useState<ScreenDebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      const base64 = await captureScreenWithCheck();
      if (!base64) return;
      setSnapshot(base64);

      // Perform genuine multimodal analysis through AI router
      await screenAnalyzer.analyzeScreen(
        base64,
        "Analyze what is on my screen right now. Point out key elements, tell me what I'm working on, and playfully roast any funny or chaotic things you notice with witty bro banter.",
      );

      setDebugInfo(screenAnalyzer.getDebugInfo());
    } catch (err) {
      console.warn("Screen capture failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRoastBack = () => {
    if (!roastReply.trim() || isSending) return;
    sendMessage(roastReply.trim());
    setRoastReply("");
  };

  return (
    <div className="momo-vision-container">
      <header className="momo-vision-header">
        <div className="momo-vision-header-info">
          <h2>Screen Awareness &amp; Vision Studio</h2>
          <p>Let Momo inspect your active desktop to give real-time advice, check your work, or playfully roast your code.</p>
        </div>
        <div className="momo-vision-header-actions">
          <button
            className="liquid-glass-btn"
            onClick={() => {
              setDebugInfo(screenAnalyzer.getDebugInfo());
              setShowDebug(!showDebug);
            }}
            title="Toggle Developer Screen Debug Diagnostics"
          >
            {showDebug ? "Hide Debug" : "Screen Debug"}
          </button>
          <button
            className="liquid-glass-btn liquid-glass-btn-primary"
            onClick={handleCapture}
            disabled={isCapturing || isSending}
          >
            <CameraIcon size={18} />
            {isCapturing ? "Capturing Screen..." : "Capture & Analyze Screen"}
          </button>
        </div>
      </header>

      {/* Developer Screen Diagnostics (Hidden from regular view by default) */}
      {showDebug && debugInfo && (
        <div className="momo-vision-debug-box liquid-glass-card">
          <h4>Screen Debug Diagnostics</h4>
          <div className="momo-vision-debug-grid">
            <div><strong>Monitor:</strong> {debugInfo.monitor}</div>
            <div><strong>Active Window:</strong> {debugInfo.activeWindow}</div>
            <div><strong>Capture Size:</strong> {debugInfo.captureSize}</div>
            <div><strong>Vision Provider:</strong> {debugInfo.visionProvider}</div>
            <div><strong>Vision Model:</strong> {debugInfo.visionModel}</div>
            <div><strong>Captured At:</strong> {new Date(debugInfo.capturedAt).toLocaleTimeString()}</div>
            <div><strong>Context Age:</strong> {debugInfo.contextAgeSeconds}s {debugInfo.isStale ? "(Stale)" : "(Fresh)"}</div>
          </div>
        </div>
      )}

      <div className="momo-vision-content">
        <div className="momo-vision-preview-card liquid-glass-card">
          {snapshot ? (
            <div className="momo-vision-preview-wrapper">
              <img src={snapshot} alt="Captured Screen" className="momo-vision-img" />
              <div className="momo-vision-badge">
                <SparklesIcon size={14} /> Screen Inspected &amp; Analyzed
              </div>
            </div>
          ) : (
            <div className="momo-vision-placeholder">
              <CameraIcon size={48} className="momo-vision-icon-dim" />
              <h3>No screen captured yet</h3>
              <p>Click "Capture &amp; Analyze Screen" to share a snapshot of your workspace with Momo.</p>
            </div>
          )}
        </div>

        <div className="momo-vision-roastback-card liquid-glass-card">
          <h3>Banter &amp; Roast Back</h3>
          <p className="momo-vision-hint">
            Did Momo just tease your code or layout? Don't take it sitting down—fire back with a witty comeback.
          </p>
          <div className="momo-vision-roast-row">
            <input
              type="text"
              className="liquid-glass-input"
              placeholder="Roast Momo back or defend your work..."
              value={roastReply}
              onChange={(e) => setRoastReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleRoastBack();
                }
              }}
            />
            <button
              className="liquid-glass-btn liquid-glass-btn-primary"
              onClick={handleRoastBack}
              disabled={!roastReply.trim() || isSending}
            >
              <SendIcon size={16} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
