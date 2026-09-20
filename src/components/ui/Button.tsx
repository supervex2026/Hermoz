import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "secondary",
      size = "sm",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const getBaseStyles = (): React.CSSProperties => {
      const styles: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-semibold)",
        cursor: disabled || isLoading ? "not-allowed" : "default",
        opacity: disabled || isLoading ? 0.5 : 1,
        transition: "all var(--duration-fast) var(--ease-out)",
        userSelect: "none",
        whiteSpace: "nowrap",
        outline: "none",
        border: "1px solid transparent",
      };

      // Size
      switch (size) {
        case "xs":
          styles.fontSize = "var(--text-2xs)";
          styles.padding = "2px 6px";
          styles.height = "22px";
          break;
        case "sm":
          styles.fontSize = "var(--text-xs)";
          styles.padding = "3px 10px";
          styles.height = "var(--control-height)";
          break;
        case "md":
          styles.fontSize = "var(--text-sm)";
          styles.padding = "6px 14px";
          styles.height = "32px";
          break;
        case "lg":
          styles.fontSize = "var(--text-base)";
          styles.padding = "8px 18px";
          styles.height = "38px";
          break;
      }

      // Variant
      switch (variant) {
        case "primary":
          styles.backgroundColor = "var(--color-accent)";
          styles.color = "#ffffff";
          styles.borderColor = "var(--color-accent-hover)";
          styles.boxShadow = "var(--shadow-xs)";
          break;
        case "secondary":
          styles.backgroundColor = "var(--neutral-3)";
          styles.color = "var(--color-text)";
          styles.borderColor = "var(--color-border)";
          break;
        case "ghost":
          styles.backgroundColor = "transparent";
          styles.color = "var(--color-text-secondary)";
          styles.borderColor = "transparent";
          break;
        case "danger":
          styles.backgroundColor = "rgba(239, 68, 68, 0.15)";
          styles.color = "var(--color-danger)";
          styles.borderColor = "rgba(239, 68, 68, 0.3)";
          break;
        case "icon":
          styles.backgroundColor = "transparent";
          styles.color = "var(--color-text-muted)";
          styles.borderColor = "transparent";
          styles.padding = "0";
          styles.width = styles.height;
          break;
      }

      return { ...styles, ...style };
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={getBaseStyles()}
        className={`momo-btn momo-btn-${variant} ${className}`}
        {...props}
      >
        {leftIcon && <span style={{ display: "inline-flex" }}>{leftIcon}</span>}
        {children}
        {rightIcon && <span style={{ display: "inline-flex" }}>{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = "Button";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "sm", variant = "icon", label, ...props }, ref) => {
    return (
      <Button ref={ref} variant={variant} size={size} aria-label={label} title={label} {...props}>
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = "IconButton";
