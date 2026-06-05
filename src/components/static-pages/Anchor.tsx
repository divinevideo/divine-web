// ABOUTME: Anchor wrapper with consistent scroll offset for static pages
// ABOUTME: Keeps hero anchor navigation aligned below the fixed header

import type { ReactNode } from "react";

export function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  );
}
