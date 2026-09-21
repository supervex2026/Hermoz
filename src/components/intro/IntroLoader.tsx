import { Sparkles, Terminal, Camera, ArrowRight } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./IntroLoader.css";

interface IntroLoaderProps {
  onFinish: () => void;
}

export function IntroLoader({ onFinish }: IntroLoaderProps) {
  return (
    <div
      className="hermoz-intro-backdrop"
      data-tauri-drag-region
      onMouseDown={(e) => {
        if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
          try {
            getCurrentWindow().startDragging();
          } catch {}
        }
      }}
    >
      <div
        className="hermoz-intro-card"
        style={{
          maxWidth: "460px",
          background: "var(--neutral-2)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: "var(--space-8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "var(--space-5)",
        }}
      >
        {/* Hermoz Mascot Avatar */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "var(--radius-md)",
            background: "var(--neutral-3)",
            border: "1.5px solid var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--color-accent)">
            <circle cx="12" cy="13" r="7" />
            <circle cx="7" cy="7" r="3" />
            <circle cx="17" cy="7" r="3" />
            <circle cx="10" cy="12" fill="var(--neutral-1)" r="1.5" />
            <circle cx="14" cy="12" fill="var(--neutral-1)" r="1.5" />
            <ellipse cx="12" cy="15" fill="var(--neutral-1)" rx="1.5" ry="1" />
          </svg>
        </div>

        {/* Title & Subtitle */}
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-text)",
              letterSpacing: "0.2px",
            }}
          >
            Welcome to Hermoz
          </h2>
          <p
            style={{
              margin: "var(--space-2) 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              lineHeight: "var(--leading-ui)",
            }}
          >
            Your intelligent desktop companion. Lightweight, native, and private.
          </p>
        </div>

        {/* Feature Cards */}
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "var(--space-2)",
            marginTop: "var(--space-2)",
          }}
        >
          <div
            style={{
              padding: "var(--space-3) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--neutral-1)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Camera size={16} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--color-text)" }}>
              Vision
            </span>
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Alt+S Screen</span>
          </div>

          <div
            style={{
              padding: "var(--space-3) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--neutral-1)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Terminal size={16} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--color-text)" }}>
              Workspace
            </span>
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Local Safe Mode</span>
          </div>

          <div
            style={{
              padding: "var(--space-3) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--neutral-1)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--color-text)" }}>
              Fast AI
            </span>
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Zero Latency</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onFinish}
          style={{
            width: "100%",
            height: "36px",
            marginTop: "var(--space-2)",
            background: "var(--color-accent)",
            color: "#ffffff",
            border: "1px solid var(--color-accent-hover)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-semibold)",
            cursor: "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            boxShadow: "var(--shadow-sm)",
            transition: "background var(--duration-fast) var(--ease-out)",
          }}
        >
          <span>Get Started</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
