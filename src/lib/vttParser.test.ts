// ABOUTME: Tests for WebVTT parser
// ABOUTME: Covers timestamp parsing, VTT content parsing, and active cue lookup

import { describe, it, expect } from 'vitest';
import { parseVttTimestamp, parseVtt, getActiveCue, type VttCue } from './vttParser';

describe('parseVttTimestamp', () => {
  it('parses MM:SS.mmm format', () => {
    expect(parseVttTimestamp('00:02.500')).toBe(2.5);
  });

  it('parses HH:MM:SS.mmm format', () => {
    expect(parseVttTimestamp('01:02:03.500')).toBe(3723.5);
  });

  it('parses whole seconds', () => {
    expect(parseVttTimestamp('00:05.000')).toBe(5);
  });

  it('returns NaN for invalid input', () => {
    expect(parseVttTimestamp('invalid')).toBeNaN();
    expect(parseVttTimestamp('')).toBeNaN();
  });
});

describe('parseVtt', () => {
  it('parses a simple VTT file', () => {
    const vtt = `WEBVTT

00:00.000 --> 00:02.500
Hello world

00:02.500 --> 00:05.000
Goodbye world`;

    const cues = parseVtt(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ startTime: 0, endTime: 2.5, text: 'Hello world' });
    expect(cues[1]).toEqual({ startTime: 2.5, endTime: 5, text: 'Goodbye world' });
  });

  it('handles cue identifiers (numbered cues)', () => {
    const vtt = `WEBVTT

1
00:00.000 --> 00:02.000
First cue

2
00:02.000 --> 00:04.000
Second cue`;

    const cues = parseVtt(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('First cue');
    expect(cues[1].text).toBe('Second cue');
  });

  it('strips HTML tags from text', () => {
    const vtt = `WEBVTT

00:00.000 --> 00:02.000
<b>Bold</b> and <i>italic</i> text`;

    const cues = parseVtt(vtt);
    expect(cues[0].text).toBe('Bold and italic text');
  });

  it('handles multi-line cue text', () => {
    const vtt = `WEBVTT

00:00.000 --> 00:03.000
Line one
Line two`;

    const cues = parseVtt(vtt);
    expect(cues[0].text).toBe('Line one\nLine two');
  });

  it('skips malformed timestamp lines', () => {
    const vtt = `WEBVTT

bad --> also bad
This is skipped

00:00.000 --> 00:02.000
This is kept`;

    const cues = parseVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('This is kept');
  });

  it('handles empty VTT', () => {
    expect(parseVtt('')).toEqual([]);
    expect(parseVtt('WEBVTT')).toEqual([]);
  });

  it('handles HH:MM:SS.mmm timestamps', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Full format`;

    const cues = parseVtt(vtt);
    expect(cues[0]).toEqual({ startTime: 0, endTime: 3, text: 'Full format' });
  });

  it('handles Windows-style line endings', () => {
    const vtt = "WEBVTT\r\n\r\n00:00.000 --> 00:02.000\r\nHello\r\n\r\n";
    const cues = parseVtt(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hello');
  });
});

describe('getActiveCue', () => {
  const cues: VttCue[] = [
    { startTime: 0, endTime: 2, text: 'First' },
    { startTime: 2, endTime: 4, text: 'Second' },
    { startTime: 4, endTime: 6, text: 'Third' },
  ];

  it('returns the active cue', () => {
    expect(getActiveCue(cues, 1)).toEqual(cues[0]);
    expect(getActiveCue(cues, 3)).toEqual(cues[1]);
    expect(getActiveCue(cues, 5.5)).toEqual(cues[2]);
  });

  it('returns null when no cue is active', () => {
    expect(getActiveCue(cues, 6)).toBeNull();
    expect(getActiveCue(cues, 10)).toBeNull();
  });

  it('handles exact boundary (start inclusive, end exclusive)', () => {
    expect(getActiveCue(cues, 0)).toEqual(cues[0]);
    expect(getActiveCue(cues, 2)).toEqual(cues[1]); // At boundary, next cue starts
  });

  it('returns null for empty cues', () => {
    expect(getActiveCue([], 1)).toBeNull();
  });
});
