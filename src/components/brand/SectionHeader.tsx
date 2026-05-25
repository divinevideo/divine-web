import * as React from "react"

import { cn } from "@/lib/utils"

interface SectionHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h2" | "h3"
}

export function SectionHeader({
  as = "h2",
  className,
  children,
  ...rest
}: SectionHeaderProps) {
  if (import.meta.env.DEV && typeof className === "string" && /\buppercase\b/.test(className)) {
    throw new Error(
      "SectionHeader: the Divine brand forbids all-caps section headers. Remove `uppercase` from className.",
    )
  }
  const Tag = as
  return (
    <Tag
      className={cn(
        "font-extrabold tracking-tight text-brand-dark-green dark:text-brand-off-white",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
