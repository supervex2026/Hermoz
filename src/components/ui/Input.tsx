import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, style, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        style={{
          width: "100%",
          height: "var(--control-height)",
          padding: "0 var(--space-4)",
          background: "var(--neutral-1)",
          border: error ? "1px solid var(--color-danger)" : "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xs)",
          outline: "none",
          transition: "border-color var(--duration-fast) var(--ease-out)",
          ...style,
        }}
        className={`momo-input ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, style, className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        style={{
          width: "100%",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--neutral-1)",
          border: error ? "1px solid var(--color-danger)" : "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          outline: "none",
          resize: "vertical",
          ...style,
        }}
        className={`momo-textarea ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, style, className = "", ...props }, ref) => {
    return (
      <select
        ref={ref}
        style={{
          height: "var(--control-height)",
          padding: "0 var(--space-4)",
          background: "var(--neutral-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xs)",
          outline: "none",
          cursor: "default",
          ...style,
        }}
        className={`momo-select ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = "Select";
