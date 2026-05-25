import * as React from "react"

import { cn } from "@/lib/utils"

type CardAccent =
  | "green"
  | "pink"
  | "violet"
  | "orange"
  | "yellow"
  | "blue"
  | "dark"

type CardVariant = "default" | "brand"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  accent?: CardAccent
}

const ACCENT_SHADOW: Record<CardAccent, string> = {
  green: "brand-offset-shadow-green",
  pink: "brand-offset-shadow-pink",
  violet: "brand-offset-shadow-violet",
  orange: "brand-offset-shadow-orange",
  yellow: "brand-offset-shadow-yellow",
  blue: "brand-offset-shadow-blue",
  dark: "brand-offset-shadow-dark",
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", accent, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variant === "brand"
          ? cn("brand-card", accent && ACCENT_SHADOW[accent])
          : "rounded-xl border border-brand-light-green bg-card text-card-foreground shadow-md transition-all duration-200 hover:shadow-lg dark:border-brand-dark-green",
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
export type { CardAccent, CardVariant, CardProps }
