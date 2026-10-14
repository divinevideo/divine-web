// ABOUTME: Small presentational helpers shared by the family page sections
// ABOUTME: Moved verbatim from the original FamilyPage (FrameStep, SettingsRow, PlanColumn)

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FrameStep({
  icon,
  label,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-green text-brand-dark-green flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white mb-1">
          {label}
        </h3>
        <p className="text-base text-foreground/80 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export function SettingsRow({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white mb-1">
        {title}
      </h3>
      <p className="text-base leading-relaxed text-foreground/80">{body}</p>
    </div>
  );
}

export function PlanColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <Card variant="brand">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 list-disc pl-5 marker:text-brand-green text-base leading-relaxed">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
