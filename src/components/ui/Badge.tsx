import React from "react";

export type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "xs" | "sm";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "xs",
  style,
  className = "",
  ...props
}) => {
  const getStyles = (): React.CSSProperties => {
    const s: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-1)",
      padding: size === "xs" ? "1px 6px" : "2px 8px",
      borderRadius: "var(--radius-sm)",
      fontFamily: "var(--font-mono)",
      fontSize: size === "xs" ? "var(--text-2xs)" : "var(--text-xs)",
      fontWeight: "var(--weight-semibold)",
      lineHeight: 1.2,
      letterSpacing: "0.3px",
      userSelect: "none",
      border: "1px solid transparent",
    };

    switch (variant) {
      case "default":
        s.background = "var(--neutral-3)";
        s.color = "var(--color-text-secondary)";
        s.borderColor = "var(--color-border)";
        break;
      case "accent":
        s.background = "var(--color-accent-subtle)";
        s.color = "var(--color-accent)";
        s.borderColor = "var(--color-accent)";
        break;
      case "success":
        s.background = "rgba(52, 211, 153, 0.12)";
        s.color = "var(--color-success)";
        s.borderColor = "rgba(52, 211, 153, 0.3)";
        break;
      case "warning":
        s.background = "rgba(251, 191, 36, 0.12)";
        s.color = "var(--color-warning)";
        s.borderColor = "rgba(251, 191, 36, 0.3)";
        break;
      case "danger":
        s.background = "rgba(239, 68, 68, 0.12)";
        s.color = "var(--color-danger)";
        s.borderColor = "rgba(239, 68, 68, 0.3)";
        break;
    }

    return { ...s, ...style };
  };

  return (
    <span style={getStyles()} className={`momo-badge momo-badge-${variant} ${className}`} {...props}>
      {children}
    </span>
  );
};
