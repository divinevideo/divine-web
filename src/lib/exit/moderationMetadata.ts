import { isHex64 } from "./hex";

export type AnnotationStatus = "banned" | "quarantined";

export interface ModerationAnnotation {
  eventId: string;
  status: AnnotationStatus;
}

export interface ExportModeration {
  annotations: ModerationAnnotation[];
  annotationsStatus: "complete" | "incomplete" | "unsupported";
  invalidAnnotationCount: number;
  orphanAnnotationCount: number;
  conflictingAnnotationCount: number;
  withheld: WithheldResult;
}

export type AnnotationMetadata =
  | { kind: "unsupported" }
  | {
      kind: "available";
      annotations: Map<string, AnnotationStatus>;
      invalidCount: number;
      conflictingCount: number;
    };

export type WithheldResult =
  | { kind: "unsupported" }
  | { kind: "unavailable" }
  | { kind: "known"; count: number };

export interface FilteredAnnotations {
  annotations: Map<string, AnnotationStatus>;
  orphanCount: number;
}

export function parseAnnotations(raw: unknown): AnnotationMetadata {
  if (raw === undefined) {
    return { kind: "unsupported" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "available", annotations: new Map(), invalidCount: 1, conflictingCount: 0 };
  }

  const annotations = new Map<string, AnnotationStatus>();
  let invalidCount = 0;
  let conflictingCount = 0;

  for (const [eventId, value] of Object.entries(raw)) {
    if (!isHex64(eventId) || !value || typeof value !== "object" || Array.isArray(value)) {
      invalidCount += 1;
      continue;
    }

    const status = (value as { status?: unknown }).status;
    if (status !== "banned" && status !== "quarantined") {
      invalidCount += 1;
      continue;
    }
    const normalizedEventId = eventId.toLowerCase();
    const previous = annotations.get(normalizedEventId);
    if (previous && previous !== status) {
      conflictingCount += 1;
      continue;
    }
    annotations.set(normalizedEventId, status);
  }

  return { kind: "available", annotations, invalidCount, conflictingCount };
}

export function parseWithheld(raw: unknown): WithheldResult {
  if (raw === undefined) {
    return { kind: "unsupported" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "unavailable" };
  }

  const candidate = raw as { complete?: unknown; count?: unknown };
  if (candidate.complete === false) {
    return { kind: "unavailable" };
  }
  if (
    candidate.complete === true &&
    typeof candidate.count === "number" &&
    Number.isSafeInteger(candidate.count) &&
    candidate.count >= 0
  ) {
    return { kind: "known", count: candidate.count };
  }
  return { kind: "unavailable" };
}

// Annotations arrive canonicalised to lower case, but the archive must key them
// by the event ID exactly as it appears in `events.json`, so the manifest always
// cross-references the signed events byte for byte.
export function dropOrphanAnnotations(
  annotations: Map<string, AnnotationStatus>,
  eventIds: ReadonlySet<string>
): FilteredAnnotations {
  const canonicalById = new Map<string, string>();
  for (const eventId of eventIds) {
    canonicalById.set(eventId.toLowerCase(), eventId);
  }

  const filtered = new Map<string, AnnotationStatus>();
  let orphanCount = 0;

  for (const [eventId, status] of annotations) {
    const canonical = canonicalById.get(eventId);
    if (canonical === undefined) {
      orphanCount += 1;
      continue;
    }
    filtered.set(canonical, status);
  }

  return { annotations: filtered, orphanCount };
}
