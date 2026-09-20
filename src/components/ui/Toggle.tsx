import React from "react";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, label }) => {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-3)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
      }}
    >
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: "32px",
          height: "18px",
          borderRadius: "var(--radius-full)",
          background: checked ? "var(--color-accent)" : "var(--neutral-4)",
          border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border)"}`,
          position: "relative",
          transition: "all var(--duration-fast) var(--ease-out)",
        }}
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "#ffffff",
            position: "absolute",
            top: "2px",
            left: checked ? "16px" : "2px",
            transition: "left var(--duration-fast) var(--ease-spring)",
            boxShadow: "var(--shadow-xs)",
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
          {label}
        </span>
      )}
    </label>
  );
};

export const Spinner: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = "var(--color-accent)",
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid var(--neutral-4)`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spinnerRotate 0.7s linear infinite",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
};

export const Divider: React.FC<{ vertical?: boolean; margin?: string }> = ({
  vertical = false,
  margin = "var(--space-3) 0",
}) => {
  return (
    <div
      style={{
        [vertical ? "width" : "height"]: "1px",
        [vertical ? "height" : "width"]: "100%",
        background: "var(--color-border)",
        margin: vertical ? `0 ${margin}` : margin,
        flexShrink: 0,
      }}
    />
  );
};

export const Stack: React.FC<React.HTMLAttributes<HTMLDivElement> & { gap?: string }> = ({
  children,
  gap = "var(--space-3)",
  style,
  ...props
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }} {...props}>
      {children}
    </div>
  );
};

export const Row: React.FC<React.HTMLAttributes<HTMLDivElement> & { gap?: string; align?: string; justify?: string }> = ({
  children,
  gap = "var(--space-3)",
  align = "center",
  justify = "flex-start",
  style,
  ...props
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: align,
        justifyContent: justify,
        gap,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
