// ABOUTME: Presents pre-ban snapshot lifecycle states and starts recovery for available snapshots
// ABOUTME: Keeps absent and failed outcomes explicit without implying that an ordinary account was banned

import { Archive, ArrowClockwise, ClockCounterClockwise, WarningCircle } from "@phosphor-icons/react";

import { SectionHero } from "@/components/static-pages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SnapshotStatus } from "@/lib/exit/banSnapshotClient";

interface SnapshotRecoveryProps {
  status: SnapshotStatus | null;
  checkError: string | null;
  checking: boolean;
  recovering: boolean;
  disabled: boolean;
  onCheck: () => void;
  onRecover: (status: SnapshotStatus & { state: "available"; enforcement_id: string; expires_at: string }) => void;
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

export function SnapshotRecovery(props: SnapshotRecoveryProps) {
  const available = props.status?.state === "available" && props.status.enforcement_id && props.status.expires_at
    ? props.status as SnapshotStatus & { state: "available"; enforcement_id: string; expires_at: string }
    : null;

  return (
    <section>
      <SectionHero
        eyebrow="Pre-ban recovery"
        icon={<ClockCounterClockwise weight="fill" className="h-7 w-7" />}
        title="Check for a preserved snapshot"
        lead="If enforcement removed your account data, Divine may have preserved a private recovery snapshot for 30 days. Only your signed-in account can check or retrieve it."
      />
      <Card variant="brand" accent={available ? "yellow" : "blue"}>
        <CardContent className="pt-6 space-y-4">
          <Button type="button" variant="outline" onClick={props.onCheck} disabled={props.disabled || props.checking || props.recovering}>
            {props.checking ? <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ClockCounterClockwise className="h-4 w-4" aria-hidden="true" />}
            {props.checking ? "Checking for a snapshot" : "Check for a snapshot"}
          </Button>

          {props.checkError && <p className="text-base text-destructive" role="alert">{props.checkError}</p>}
          {props.status?.state === "absent" && <p className="text-base leading-relaxed text-muted-foreground" role="status">No pre-ban snapshot is available for this account. You can still create the ordinary account archive above.</p>}
          {props.status?.state === "capture_failed" && <p className="text-base leading-relaxed text-muted-foreground" role="status">Divine could not preserve a complete pre-ban snapshot for this account. The ordinary account archive above may still contain data that remains available.</p>}
          {props.status?.state === "expired" && <p className="text-base leading-relaxed text-muted-foreground" role="status">The preserved snapshot has expired and can no longer be recovered.</p>}
          {props.status?.state === "temporarily_unavailable" && <p className="text-base leading-relaxed text-muted-foreground" role="status">The preserved snapshot exists, but it is temporarily unavailable. Try checking again later.</p>}
          {available && (
            <div className="space-y-3" role="status">
              <div className="flex items-start gap-3">
                <WarningCircle weight="fill" className="mt-1 h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green" />
                <div>
                  <p className="font-semibold text-foreground">A pre-ban snapshot is ready to recover.</p>
                  <p className="text-base leading-relaxed text-muted-foreground">It expires on {formatExpiry(available.expires_at)}. {available.days_remaining} day{available.days_remaining === 1 ? "" : "s"} remaining.</p>
                </div>
              </div>
              <Button type="button" variant="sticker" onClick={() => props.onRecover(available)} disabled={props.recovering}>
                {props.recovering ? <ArrowClockwise className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                {props.recovering ? "Recovering your snapshot" : "Recover snapshot"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
