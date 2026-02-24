// ABOUTME: Pure WebVTT parser for subtitle overlay
// ABOUTME: Parses VTT content to cue array and finds active cue for current playback time

export interface VttCue {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Parse a VTT timestamp string to seconds
 * Supports "HH:MM:SS.mmm" and "MM:SS.mmm" formats
 */
export function parseVttTimestamp(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length < 2) return NaN;

  let hours = 0;
  let minutes: number;
  let seconds: number;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    seconds = parseFloat(parts[2]);
  } else {
    minutes = parseInt(parts[0], 10);
    seconds = parseFloat(parts[1]);
  }

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Strip HTML tags from cue text
 */
function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

/**
 * Parse WebVTT content into an array of cues
 * Tolerant: skips malformed cues, strips HTML tags
 */
export function parseVtt(vttContent: string): VttCue[] {
  const cues: VttCue[] = [];
  const lines = vttContent.split(/\r?\n/);

  let i = 0;
  // Skip WEBVTT header and any metadata
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Look for timestamp line: "00:00.000 --> 00:02.500"
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim().split(' ')[0]);
      const startTime = parseVttTimestamp(startStr);
      const endTime = parseVttTimestamp(endStr);

      if (isNaN(startTime) || isNaN(endTime)) {
        i++;
        continue;
      }

      // Collect text lines until empty line or end
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }

      const text = stripTags(textLines.join('\n')).trim();
      if (text) {
        cues.push({ startTime, endTime, text });
      }
    } else {
      i++;
    }
  }

  return cues;
}

/**
 * Find the active cue for a given playback time
 */
export function getActiveCue(cues: VttCue[], currentTime: number): VttCue | null {
  for (const cue of cues) {
    if (currentTime >= cue.startTime && currentTime < cue.endTime) {
      return cue;
    }
  }
  return null;
}
