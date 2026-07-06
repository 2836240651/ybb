import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type PillButtonBaseProps = {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  variant?: "primary" | "outline";
};

type PillButtonAsButton = PillButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type PillButtonAsLink = PillButtonBaseProps &
  Omit<ComponentProps<typeof Link>, "className"> & { href: string };

export type PillButtonProps = PillButtonAsButton | PillButtonAsLink;

const sizeClasses = {
  sm: "px-4 py-2 text-button",
  md: "px-6 py-3 text-button",
  lg: "px-8 py-4 text-button h-14",
};

const variantClasses = {
  primary:
    "bg-foreground text-background hover:bg-neutral-800 active:scale-[0.98] motion-reduce:active:scale-100",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-neutral-50 active:scale-[0.98] motion-reduce:active:scale-100",
};

export function PillButton({
  children,
  className,
  size = "md",
  fullWidth,
  variant = "primary",
  ...props
}: PillButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-button font-medium interaction-cta",
    "disabled:cursor-not-allowed disabled:opacity-40",
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className
  );

  if ("href" in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as PillButtonAsButton;
  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
