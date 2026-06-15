import { describe, it, expect } from 'vitest';
import { isUrlLikeQuery } from './searchUtils';

describe('isUrlLikeQuery', () => {
  it('detects http URLs', () => {
    expect(isUrlLikeQuery('http://example.com')).toBe(true);
  });

  it('detects https URLs', () => {
    expect(isUrlLikeQuery('https://vine.co/v/hAgW0mP5zKL//')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isUrlLikeQuery('HTTPS://VINE.CO')).toBe(true);
    expect(isUrlLikeQuery('Http://Example.com')).toBe(true);
  });

  it('handles leading/trailing whitespace', () => {
    expect(isUrlLikeQuery('  https://vine.co  ')).toBe(true);
  });

  it('rejects normal search terms', () => {
    expect(isUrlLikeQuery('funny cats')).toBe(false);
  });

  it('rejects hashtags', () => {
    expect(isUrlLikeQuery('#divine')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isUrlLikeQuery('')).toBe(false);
  });

  it('rejects strings that contain URLs but do not start with them', () => {
    expect(isUrlLikeQuery('check out https://vine.co')).toBe(false);
  });

  it('detects bare hostname with path (scheme-less Vine URL)', () => {
    expect(isUrlLikeQuery('vine.co/v/hAgW0mP5zKL')).toBe(true);
    expect(isUrlLikeQuery('vine.co/v/hAgW0mP5zKL//')).toBe(true);
  });

  it('detects other bare hostname URLs with paths', () => {
    expect(isUrlLikeQuery('example.com/page')).toBe(true);
    expect(isUrlLikeQuery('sub.domain.co.uk/path')).toBe(true);
  });

  it('rejects bare hostnames without a path', () => {
    expect(isUrlLikeQuery('vine.co')).toBe(false);
    expect(isUrlLikeQuery('example.com')).toBe(false);
  });

  it('rejects dotted words that are not URLs', () => {
    expect(isUrlLikeQuery('funny.cats')).toBe(false);
    expect(isUrlLikeQuery('music.video')).toBe(false);
  });
});
