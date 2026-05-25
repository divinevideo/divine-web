import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initCookieConsent,
  onAnalyticsConsentChanged,
  getAnalyticsConsent,
  _resetForTesting,
} from './cookieConsent';

describe('cookieConsent', () => {
  beforeEach(() => {
    _resetForTesting();
    delete window._hsp;
  });

  it('registers a listener on _hsp when initialized', () => {
    initCookieConsent();

    expect(window._hsp).toBeDefined();
    expect(window._hsp!.length).toBe(1);
    expect(window._hsp![0][0]).toBe('addPrivacyConsentListener');
  });

  it('is idempotent - second init does not double-register', () => {
    initCookieConsent();
    initCookieConsent();

    expect(window._hsp!.length).toBe(1);
  });

  it('fires callback when consent is granted', () => {
    initCookieConsent();

    const callback = vi.fn();
    onAnalyticsConsentChanged(callback);

    // Simulate HubSpot calling the listener
    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: true } });

    expect(callback).toHaveBeenCalledWith(true);
    expect(getAnalyticsConsent()).toBe(true);
  });

  it('fires callback when consent is denied', () => {
    initCookieConsent();

    const callback = vi.fn();
    onAnalyticsConsentChanged(callback);

    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: false } });

    expect(callback).toHaveBeenCalledWith(false);
    expect(getAnalyticsConsent()).toBe(false);
  });

  it('fires callback immediately if consent is already known', () => {
    initCookieConsent();

    // Simulate prior consent
    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: true } });

    // Register callback AFTER consent is already resolved
    const callback = vi.fn();
    onAnalyticsConsentChanged(callback);

    expect(callback).toHaveBeenCalledWith(true);
  });

  it('fires callback on consent change from granted to revoked', () => {
    initCookieConsent();

    const callback = vi.fn();
    onAnalyticsConsentChanged(callback);

    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: true } });
    hubspotCallback({ categories: { analytics: false } });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, true);
    expect(callback).toHaveBeenNthCalledWith(2, false);
    expect(getAnalyticsConsent()).toBe(false);
  });

  it('does not fire callback when consent value is unchanged', () => {
    initCookieConsent();

    const callback = vi.fn();
    onAnalyticsConsentChanged(callback);

    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: true } });
    hubspotCallback({ categories: { analytics: true } });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('notifies multiple listeners', () => {
    initCookieConsent();

    const callback1 = vi.fn();
    const callback2 = vi.fn();
    onAnalyticsConsentChanged(callback1);
    onAnalyticsConsentChanged(callback2);

    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: true } });

    expect(callback1).toHaveBeenCalledWith(true);
    expect(callback2).toHaveBeenCalledWith(true);
  });

  it('defaults to null consent when HubSpot has not responded', () => {
    initCookieConsent();
    expect(getAnalyticsConsent()).toBeNull();
  });

  it('catches errors in listener callbacks without breaking others', () => {
    initCookieConsent();

    const errorCallback = vi.fn(() => { throw new Error('boom'); });
    const goodCallback = vi.fn();
    onAnalyticsConsentChanged(errorCallback);
    onAnalyticsConsentChanged(goodCallback);

    const hubspotCallback = window._hsp![0][1] as (consent: { categories: { analytics: boolean } }) => void;
    hubspotCallback({ categories: { analytics: true } });

    expect(errorCallback).toHaveBeenCalled();
    expect(goodCallback).toHaveBeenCalledWith(true);
  });
});
