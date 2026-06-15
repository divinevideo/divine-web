import { describe, expect, it } from 'vitest';
import { OVERLAY_LAYERS, OVERLAY_LAYER_VALUES } from './overlayLayers';

describe('overlayLayers', () => {
  it('keeps documented class tokens stable', () => {
    expect(OVERLAY_LAYERS).toEqual({
      floating: 'z-50',
      toast: 'z-[100]',
      overlay: 'z-[200]',
      nestedOverlayFloating: 'z-[210]',
    });
  });

  it('keeps nested floating content above parent overlays', () => {
    expect(OVERLAY_LAYER_VALUES.nestedOverlayFloating).toBeGreaterThan(OVERLAY_LAYER_VALUES.overlay);
    expect(OVERLAY_LAYER_VALUES.overlay).toBeGreaterThan(OVERLAY_LAYER_VALUES.floating);
  });
});
