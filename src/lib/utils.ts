import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwindcss-safe-area emits `<prefix>-safe`, `<prefix>-safe-offset-<value>` and
// `<prefix>-safe-or-<value>`. tailwind-merge cannot parse those values, so out of the
// box it keeps them alongside a conflicting `p-0` or `top-0` passed in by a caller and
// leaves CSS source order to break the tie. The plugin's utilities are emitted after the
// core ones, so the safe-area class always wins and the caller's override is silently
// dropped. Registering them in the matching conflict groups restores the normal rule:
// the last class in the list wins.
const isSafeArea = (value: string) => /^safe(?:-(?:offset|or)-.+)?$/.test(value)

const SAFE_AREA_CLASS_GROUPS = [
  "p", "px", "py", "ps", "pe", "pt", "pr", "pb", "pl",
  "m", "mx", "my", "ms", "me", "mt", "mr", "mb", "ml",
  "inset", "inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left",
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: Object.fromEntries(
      SAFE_AREA_CLASS_GROUPS.map((group) => [group, [{ [group]: [isSafeArea] }]])
    ),
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
