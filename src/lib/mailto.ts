// ABOUTME: Utility helpers for building encoded mailto links
// ABOUTME: Used by static pages with prefilled support email subjects and bodies

export function buildMailtoLink(
  email: string,
  subject: string,
  body?: string,
): string {
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${email}?${params.toString().replace(/\+/g, "%20")}`;
}
