import { useEffect, useRef, useState } from "react";
import "./SpeechBubble.css";

interface SpeechBubbleProps {
  text: string;
  /** Which side of the panda the bubble should lean towards */
  align?: "left" | "right" | "center";
  /** Placement above or below the panda depending on screen edge */
  placement?: "top" | "bottom";
  /** Milliseconds per character for the type-on effect. 0 disables it. */
  typeSpeedMs?: number;
  onDismiss?: () => void;
  /** Auto-hide after this many ms once the text has finished typing. */
  autoHideMs?: number | null;
}

export function SpeechBubble({
  text,
  align = "right",
  placement = "top",
  typeSpeedMs = 12,
  onDismiss,
  autoHideMs = 7000,
}: SpeechBubbleProps) {
  // Ensure overlay speech bubble is never bloated with huge markdown dumps or code
  const cleanText = (text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .trim()
    .slice(0, 95);
  const [shown, setShown] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setShown("");
    indexRef.current = 0;

    if (typeSpeedMs <= 0) {
      setShown(cleanText);
      return;
    }

    const interval = setInterval(() => {
      indexRef.current += 1;
      setShown(cleanText.slice(0, indexRef.current));
      if (indexRef.current >= cleanText.length) {
        clearInterval(interval);
      }
    }, typeSpeedMs);

    return () => clearInterval(interval);
  }, [cleanText, typeSpeedMs]);

  useEffect(() => {
    if (autoHideMs == null) return;
    const finishedTypingAt = typeSpeedMs > 0 ? cleanText.length * typeSpeedMs : 0;
    const timer = setTimeout(() => onDismiss?.(), finishedTypingAt + autoHideMs);
    return () => clearTimeout(timer);
  }, [cleanText, autoHideMs, typeSpeedMs, onDismiss]);

  return (
    <div className={`momo-bubble-anchor momo-bubble-${placement} momo-bubble-${align}`}>
      <div className="momo-bubble" onClick={onDismiss} title="Click to dismiss">
        <p className="momo-bubble-text">{shown}</p>
        <div className="momo-bubble-tail" />
      </div>
    </div>
  );
}
