import type { ImgHTMLAttributes } from "react";

export type KhoraLogoVariant = "full" | "horizontal" | "wordmark" | "icon";
export type KhoraLogoSize = "sm" | "md" | "lg";
export type KhoraLogoTheme = "green" | "white";

type KhoraLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  variant?: KhoraLogoVariant;
  size?: KhoraLogoSize;
  theme?: KhoraLogoTheme;
  /** Use when the surrounding UI already exposes the KHORA name. */
  decorative?: boolean;
};

const logoSources: Record<KhoraLogoVariant, Record<KhoraLogoTheme, string>> = {
  full: {
    green: "/brand/khora-logo.svg",
    white: "/brand/khora-logo-white.svg",
  },
  horizontal: {
    green: "/brand/khora-logo-horizontal.svg",
    white: "/brand/khora-logo-horizontal-white.svg",
  },
  wordmark: {
    green: "/brand/khora-wordmark.svg",
    white: "/brand/khora-wordmark-white.svg",
  },
  icon: {
    green: "/brand/khora-icon.svg",
    white: "/brand/khora-icon-white.svg",
  },
};

export function KhoraLogo({
  variant = "horizontal",
  size = "md",
  theme = "green",
  decorative = false,
  className,
  ...props
}: KhoraLogoProps) {
  const classes = [
    "khora-logo",
    `khora-logo--${variant}`,
    `khora-logo--${size}`,
    `khora-logo--${theme}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <img
      {...props}
      className={classes}
      src={logoSources[variant][theme]}
      alt={decorative ? "" : "KHORA"}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
