// ABOUTME: Sticker-style support email link for static policy pages
// ABOUTME: Standardizes mailto CTA presentation across family and review pages

import { EnvelopeSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function SupportEmailButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button asChild variant="sticker" size="lg">
      <a href={href} className="inline-flex items-center gap-2">
        <EnvelopeSimple weight="fill" className="h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}
