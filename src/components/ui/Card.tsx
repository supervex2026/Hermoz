import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "raised" | "sunken";
  padding?: "none" | "sm" | "md" | "lg";
  bordered?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = "surface", padding = "md", bordered = true, style, className = "", ...props }, ref) => {
    const getPadding = () => {
      switch (padding) {
        case "none":
          return "0";
        case "sm":
          return "var(--space-3) var(--space-4)";
        case "md":
          return "var(--space-5) var(--space-6)";
        case "lg":
          return "var(--space-6) var(--space-8)";
      }
    };

    const getBg = () => {
      switch (variant) {
        case "surface":
          return "var(--color-surface)";
        case "raised":
          return "var(--color-raised)";
        case "sunken":
          return "var(--neutral-1)";
      }
    };

    return (
      <div
        ref={ref}
        style={{
          background: getBg(),
          padding: getPadding(),
          borderRadius: "var(--radius-md)",
          border: bordered ? "1px solid var(--color-border)" : "none",
          boxShadow: variant === "raised" ? "var(--shadow-sm)" : "none",
          ...style,
        }}
        className={`momo-card ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ children, title, actions, style, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          ...style,
        }}
        className={`momo-panel ${className}`}
        {...props}
      >
        {(title || actions) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-3) var(--space-5)",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--neutral-2)",
              flexShrink: 0,
            }}
          >
            {title && (
              <div style={{ fontWeight: "var(--weight-semibold)", fontSize: "var(--text-sm)", color: "var(--color-text)" }}>
                {title}
              </div>
            )}
            {actions && <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>{actions}</div>}
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>{children}</div>
      </div>
    );
  }
);
Panel.displayName = "Panel";
