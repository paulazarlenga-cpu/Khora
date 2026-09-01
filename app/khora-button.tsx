import type { ButtonHTMLAttributes, ReactNode } from "react";

export type KhoraButtonVariant = "primary" | "success" | "secondary" | "neutral" | "danger" | "utility";
export type KhoraButtonSize = "lg" | "md" | "sm" | "xs";

export type KhoraButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "disabled"> & {
  /** Functional emphasis of the action, independent from its visual context. */
  variant?: KhoraButtonVariant;
  /** Consistent hit area for the current context. */
  size?: KhoraButtonSize;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  iconOnly?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/**
 * The single button primitive for KHORA. Legacy class names can still be
 * passed through className while new actions should use variant + size.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "start",
  iconOnly = false,
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = false,
  className = "",
  children,
  type = "button",
  ...props
}: KhoraButtonProps) {
  const label = loading ? (loadingLabel ?? "Cargando…") : children;
  const classes = [
    "khora-button",
    `khora-button--${variant}`,
    `khora-button--${size}`,
    iconOnly ? "khora-button--icon-only" : "",
    fullWidth ? "khora-button--full-width" : "",
    loading ? "khora-button--loading" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="khora-button__spinner" aria-hidden="true" />}
      {!loading && icon && iconPosition === "start" && <span className="khora-button__icon" aria-hidden={iconOnly ? undefined : true}>{icon}</span>}
      {!iconOnly && <span className="khora-button__label">{label}</span>}
      {!loading && icon && iconPosition === "end" && <span className="khora-button__icon" aria-hidden="true">{icon}</span>}
    </button>
  );
}

export default Button;
