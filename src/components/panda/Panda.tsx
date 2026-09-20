import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PandaBody, PandaFace } from "./pandaArt";
import type { Expression, MomoActivity } from "@/types";
import "./Panda.css";

interface PandaProps {
  expression: Expression;
  activity: MomoActivity;
  onClick: () => void;
  /** Fired once the window has actually been moved by the user (mouse up). */
  onDragEnd?: () => void;
}

/**
 * The floating character itself. A mousedown starts a native OS window drag
 * (so Momo moves like a real desktop object, not a DOM element scrolling
 * inside a fixed window) while a plain click (no movement) opens the chat
 * panel via `onClick`.
 */
export function Panda({ expression, activity, onClick, onDragEnd }: PandaProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  // Idle blinking: overrides the eyes briefly with a closed shape, but only
  // for expressions where a blink still makes sense (not already
  // sleeping/wide/closed).
  useEffect(() => {
    const blinkable: Expression[] = ["neutral", "happy", "thinking", "annoyed", "smug", "confused"];
    if (!blinkable.includes(expression)) return;

    let timeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 3500;
      timeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 140);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeout);
  }, [expression]);

  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;

    try {
      const appWindow = getCurrentWindow();
      // startDragging() blocks (in terms of the promise) until the drag
      // gesture ends, so we treat any call to it as a potential drag and
      // decide "was this actually a click?" using distance moved instead.
      await appWindow.startDragging();
      onDragEnd?.();
    } catch {
      // Not running inside Tauri (e.g. `npm run dev` in a plain browser for
      // UI iteration) - just ignore, clicking still works below.
    }
  }, [onDragEnd]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownPos.current) {
      onClick();
      return;
    }
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    const moved = Math.sqrt(dx * dx + dy * dy) > 4;
    pointerDownPos.current = null;
    if (!moved) onClick();
  }, [onClick]);

  const [mouthOpen, setMouthOpen] = useState(false);
  const isTalking = activity === "speaking" || activity === "arguing" || activity === "roasting";

  // Animated mouth flapping during speech/talk
  useEffect(() => {
    if (!isTalking) {
      setMouthOpen(false);
      return;
    }
    const interval = setInterval(() => {
      setMouthOpen((prev) => !prev);
    }, 150);
    return () => clearInterval(interval);
  }, [isTalking]);

  const displayExpression: Expression = isBlinking ? "sleepy" : expression;

  return (
    <div
      className={`momo-panda momo-activity-${activity}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      role="button"
      aria-label="Momo"
      tabIndex={0}
    >
      <svg viewBox="0 0 200 240" className="momo-panda-svg" xmlns="http://www.w3.org/2000/svg">
        <PandaBody>
          <PandaFace expression={displayExpression} mouthOpen={isTalking && mouthOpen} />
        </PandaBody>
      </svg>
    </div>
  );
}
